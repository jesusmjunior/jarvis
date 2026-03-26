export class WhiteboardManager {
  private static instance: WhiteboardManager;
  private popup: Window | null = null;
  private port: MessagePort | null = null;
  private listeners: Set<(data: any) => void> = new Set();
  private messageQueue: any[] = [];
  private isConnected = false;

  private constructor() {
    window.addEventListener('message', this.handleWindowMessage.bind(this));
    // Periodically check if popup is closed to reset connection state
    setInterval(() => {
      if (this.popup && this.popup.closed && this.isConnected) {
        console.log('WhiteboardManager: Popup closed, resetting state');
        this.resetState();
        this.listeners.forEach(listener => listener({ type: 'WHITEBOARD_DISCONNECTED' }));
      }
    }, 1000);
  }

  private resetState() {
    this.isConnected = false;
    if (this.port) {
      try {
        this.port.close();
      } catch (e) {}
    }
    this.port = null;
  }

  static getInstance() {
    if (!WhiteboardManager.instance) {
      WhiteboardManager.instance = new WhiteboardManager();
    }
    return WhiteboardManager.instance;
  }

  open() {
    if (this.popup && !this.popup.closed) {
      console.log('WhiteboardManager: Popup already open, focusing');
      this.popup.focus();
      return true;
    }

    console.log('WhiteboardManager: Opening new whiteboard popup');
    this.resetState();
    this.popup = window.open('/whiteboard', 'whiteboard', 'width=1024,height=768');
    return !!this.popup;
  }

  private handleWindowMessage(event: MessageEvent) {
    // Security: Validate origin if possible, but in this env it's dynamic
    // At least validate it's from our own origin
    if (event.origin !== window.location.origin) return;
    
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'WHITEBOARD_READY') {
      // Ensure the message is from our popup
      if (!this.popup || (event.source !== this.popup)) {
        if (event.source && event.source instanceof Window) {
          console.log('WhiteboardManager: Adopting existing popup window');
          this.popup = event.source as Window;
        } else {
          console.warn('WhiteboardManager: Received WHITEBOARD_READY from unknown source');
          return;
        }
      }

      console.log('WhiteboardManager: Received WHITEBOARD_READY, initiating handshake');
      
      // Mark as not connected during handshake
      this.isConnected = false;

      // Close old port if exists
      if (this.port) {
        this.port.close();
        this.port = null;
      }

      const channel = new MessageChannel();
      this.port = channel.port1;
      
      this.port.onmessage = (e) => {
        // Log incoming messages for debugging
        console.log('WhiteboardManager: Received message from popup:', e.data.type);
        
        if (e.data.type === 'PORT_READY') {
          console.log('WhiteboardManager: Handshake complete, port is ready');
          
          // Flush queue
          if (this.messageQueue.length > 0) {
            console.log(`WhiteboardManager: Flushing ${this.messageQueue.length} queued messages`);
            while (this.messageQueue.length > 0) {
              const msg = this.messageQueue.shift();
              if (this.port) {
                this.port.postMessage(msg.data, msg.transfer);
              }
            }
          }
          
          if (!this.isConnected) {
            this.isConnected = true;
            console.log('WhiteboardManager: Connection established and port initialized');
            this.listeners.forEach(listener => listener({ type: 'WHITEBOARD_CONNECTED' }));
          }
          return;
        }

        this.listeners.forEach(listener => listener(e.data));
      };

      this.popup.postMessage({ type: 'INIT_PORT' }, window.location.origin, [channel.port2]);
    }
  }

  send(data: any, transfer?: Transferable[]) {
    if (this.port && this.isConnected) {
      try {
        this.port.postMessage(data, transfer);
      } catch (e) {
        console.error('WhiteboardManager: Failed to send message, port might be broken', e);
        this.resetState();
        this.messageQueue.push({ data, transfer });
        this.open();
      }
    } else {
      console.log('WhiteboardManager: Port not ready, queueing message:', data.type || 'unknown');
      // Only queue if not already in queue to avoid duplicates
      const isDuplicate = this.messageQueue.some(m => 
        m.data.type === data.type && 
        JSON.stringify(m.data) === JSON.stringify(data)
      );
      
      if (!isDuplicate) {
        this.messageQueue.push({ data, transfer });
      }

      if (!this.popup || this.popup.closed) {
        this.open();
      }
    }
  }

  subscribe(listener: (data: any) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const whiteboardManager = WhiteboardManager.getInstance();
