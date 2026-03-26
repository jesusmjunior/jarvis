import { searchService, SearchEntry } from './searchService';
import { memoryService, ChatSession, MemoryEntry } from './memoryService';
import { youtubeService, YouTubeVideo } from './youtubeService';
import { storageService } from './storageService';

export interface DataTreeNode {
  id: string;
  label: string;
  type: 'date' | 'session' | 'search' | 'note' | 'video' | 'source' | 'file';
  timestamp: number;
  children?: DataTreeNode[];
  data?: any;
}

export const dataTreeService = {
  buildTree: async (uid: string): Promise<DataTreeNode[]> => {
    const sessions = await memoryService.getSessions(uid);
    const searches = await searchService.getHistory(uid, 200);
    const videos = await youtubeService.getYouTubeVideos(uid);
    
    // Group by date first, then by session
    const dateTree: Record<string, DataTreeNode> = {};
    
    // 1. Initialize sessions in the tree
    sessions.forEach(session => {
      const dateKey = new Date(session.updatedAt).toLocaleDateString();
      if (!dateTree[dateKey]) {
        dateTree[dateKey] = {
          id: `date-${dateKey}`,
          label: dateKey,
          type: 'date',
          timestamp: session.updatedAt,
          children: []
        };
      }
      
      const sessionNode: DataTreeNode = {
        id: `session-${session.id}`,
        label: session.title,
        type: 'session',
        timestamp: session.updatedAt,
        data: session,
        children: []
      };
      
      dateTree[dateKey].children?.push(sessionNode);
    });
    
    // 2. Add searches to their respective sessions
    searches.forEach(search => {
      const sessionId = search.sessionId || 'default';
      const dateKey = new Date(search.timestamp).toLocaleDateString();
      
      // Find session node
      let sessionNode: DataTreeNode | undefined;
      for (const dKey in dateTree) {
        sessionNode = dateTree[dKey].children?.find(c => c.id === `session-${sessionId}`);
        if (sessionNode) break;
      }
      
      const searchNode: DataTreeNode = {
        id: `search-${search.id}`,
        label: `Busca: ${search.query}`,
        type: 'search',
        timestamp: search.timestamp,
        data: search,
        children: search.results?.map((res, idx) => ({
          id: `source-${search.id}-${idx}`,
          label: res.title || res.name || 'Fonte consultada',
          type: 'source',
          timestamp: search.timestamp,
          data: res
        }))
      };

      if (sessionNode) {
        sessionNode.children?.push(searchNode);
      } else {
        // Fallback to date grouping if session not found
        if (!dateTree[dateKey]) {
          dateTree[dateKey] = { id: `date-${dateKey}`, label: dateKey, type: 'date', timestamp: search.timestamp, children: [] };
        }
        dateTree[dateKey].children?.push(searchNode);
      }
    });

    // 3. Add videos to their respective sessions
    videos.forEach(video => {
      const sessionId = video.sessionId || 'default';
      const dateKey = new Date(video.timestamp).toLocaleDateString();
      
      let sessionNode: DataTreeNode | undefined;
      for (const dKey in dateTree) {
        sessionNode = dateTree[dKey].children?.find(c => c.id === `session-${sessionId}`);
        if (sessionNode) break;
      }

      const videoNode: DataTreeNode = {
        id: `video-${video.id}`,
        label: `Vídeo: ${video.title}`,
        type: 'video',
        timestamp: video.timestamp,
        data: video
      };

      if (sessionNode) {
        sessionNode.children?.push(videoNode);
      } else {
        if (!dateTree[dateKey]) {
          dateTree[dateKey] = { id: `date-${dateKey}`, label: dateKey, type: 'date', timestamp: video.timestamp, children: [] };
        }
        dateTree[dateKey].children?.push(videoNode);
      }
    });

    // 4. Add files to their respective sessions or dates
    try {
      const metadata = await storageService.getAllMetadata();
      const files = metadata.filter((m: any) => m.key.startsWith('file_')).map((m: any) => {
        let val = m.value;
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch (e) {
            console.error('Error parsing file metadata:', e);
          }
        }
        return { ...val, id: m.key };
      });

      files.forEach(file => {
        const sessionId = file.metadata?.sessionId || 'default';
        const timestamp = file.created_at ? new Date(file.created_at).getTime() : Date.now();
        const dateKey = new Date(timestamp).toLocaleDateString();
        
        let sessionNode: DataTreeNode | undefined;
        for (const dKey in dateTree) {
          sessionNode = dateTree[dKey].children?.find(c => c.id === `session-${sessionId}`);
          if (sessionNode) break;
        }

        const fileNode: DataTreeNode = {
          id: file.id,
          label: `Arquivo: ${file.file_name || 'Sem nome'}`,
          type: 'file',
          timestamp: timestamp,
          data: file
        };

        if (sessionNode) {
          sessionNode.children?.push(fileNode);
        } else {
          if (!dateTree[dateKey]) {
            dateTree[dateKey] = { id: `date-${dateKey}`, label: dateKey, type: 'date', timestamp: timestamp, children: [] };
          }
          dateTree[dateKey].children?.push(fileNode);
        }
      });
    } catch (error) {
      console.error('Error loading files for data tree:', error);
    }
    
    // Sort everything
    const finalTree = Object.values(dateTree).sort((a, b) => b.timestamp - a.timestamp);
    finalTree.forEach(dateNode => {
      dateNode.children?.sort((a, b) => b.timestamp - a.timestamp);
      dateNode.children?.forEach(sessionNode => {
        sessionNode.children?.sort((a, b) => b.timestamp - a.timestamp);
      });
    });

    return finalTree;
  }
};
