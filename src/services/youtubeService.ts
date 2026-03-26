import { apiFetch } from './apiClient';
import { syncService } from './syncService';

export interface YouTubeVideo {
  id: string;
  videoId?: string;
  sessionId?: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  link: string;
  timestamp: number;
}

export const youtubeService = {
  saveYouTubeVideo: async (uid: string, video: YouTubeVideo) => {
    // 1. Add to Sync Queue
    syncService.addToQueue('youtube', { ...video, uid });

    // 2. Try immediate save
    try {
      await apiFetch('/api/db/youtube', {
        method: 'POST',
        body: JSON.stringify({
          uid,
          videoId: video.videoId || video.id,
          title: video.title,
          channel_title: video.channelTitle,
          thumbnail: video.thumbnail,
          link: video.link,
          timestamp: video.timestamp,
          sessionId: video.sessionId
        })
      });
    } catch (error) {
      console.warn('Falha no salvamento imediato do vídeo, ficará na fila de sincronização.');
    }
  },

  getYouTubeVideos: async (uid: string): Promise<YouTubeVideo[]> => {
    const res = await apiFetch(`/api/db/youtube/${uid}`);
    const data = await res.json();
    return data.map((v: any) => ({
      id: v.videoId || v.id,
      title: v.title,
      channelTitle: v.channel_title,
      thumbnail: v.thumbnail,
      link: v.link,
      timestamp: v.timestamp
    }));
  },

  deleteYouTubeVideo: async (id: string) => {
    await apiFetch(`/api/db/youtube/${id}`, { method: 'DELETE' });
  }
};
