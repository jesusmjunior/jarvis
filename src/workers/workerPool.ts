export class WorkerPool {
  private workers: Worker[] = [];
  private queue: any[] = [];
  private activeTasks: Map<number, any> = new Map();
  private workerStatus: Map<Worker, boolean> = new Map();

  constructor(size: number = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./taskWorker.ts', import.meta.url), { type: 'module' });
      this.workers.push(worker);
      this.workerStatus.set(worker, false);

      worker.onmessage = (e) => {
        const { id, result } = e.data;
        const task = this.activeTasks.get(id);
        if (task) {
          task.resolve(result);
          this.activeTasks.delete(id);
        }
        this.workerStatus.set(worker, false);
        this.processQueue();
      };
    }
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    const availableWorker = this.workers.find(w => !this.workerStatus.get(w));
    if (availableWorker) {
      const task = this.queue.shift();
      this.workerStatus.set(availableWorker, true);
      availableWorker.postMessage(task.message, task.transfer);
    }
  }

  execute(message: any, transfer?: Transferable[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Date.now() + Math.random();
      const task = { id, resolve, reject, message: { ...message, id }, transfer };
      this.activeTasks.set(id, task);
      this.queue.push(task);
      this.processQueue();
    });
  }
  
  terminate() {
    this.workers.forEach(w => w.terminate());
  }
}

export const globalWorkerPool = new WorkerPool();
