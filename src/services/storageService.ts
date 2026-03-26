import { apiFetch } from './apiClient';

export interface StorageConfig {
  mode: 'memory';
}

class StorageService {
  private config: StorageConfig = { mode: 'memory' };
  private isInitialized = false;
  public isLoading = false;
  private listeners: ((loading: boolean) => void)[] = [];

  subscribe(listener: (loading: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private setLoading(loading: boolean) {
    this.isLoading = loading;
    this.listeners.forEach(l => l(loading));
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      // Load saved config
      const saved = localStorage.getItem('jarvis_storage_config');
      if (saved) {
        this.config = JSON.parse(saved);
      }
      this.isInitialized = true;
      console.log('StorageService initialized with backend API');
    } catch (error) {
      console.error('Error initializing StorageService:', error);
      throw error;
    }
  }

  // Configuration
  setConfig(config: StorageConfig) {
    this.config = config;
    localStorage.setItem('jarvis_storage_config', JSON.stringify(config));
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  // File Upload to Supabase Storage via Backend API
  async uploadFile(file: File, metadata: any) {
    this.setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Perform the upload to the backend endpoint
      const response = await apiFetch('/api/db/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await response.json();

      // Save metadata via backend API for easier retrieval later
      const fileKey = `file_${uploadResult.path.split('/').pop()}`;
      await apiFetch('/api/db/metadata', {
        method: 'POST',
        body: JSON.stringify({
          key: fileKey,
          value: {
            file_path: uploadResult.path,
            public_url: uploadResult.url,
            file_name: file.name,
            size: file.size,
            type: file.type,
            metadata: metadata,
            created_at: new Date().toISOString()
          }
        })
      });

      return uploadResult.url; // Return the public URL for immediate use
    } catch (error: any) {
      console.error('JARVIS: Erro ao fazer upload do arquivo:', error);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  // Generic Query Methods (Compatibility)
  async execute(sql: string, params?: any[]) {
    console.warn('execute not implemented for backend API');
    return null;
  }

  async query(table: string, query: any) {
    if (table === 'app_metadata') {
      const res = await apiFetch('/api/db/metadata');
      return res.json();
    }
    return [];
  }

  // Specific Data Helpers
  async getAllMetadata() {
    return this.query('app_metadata', {});
  }

  async saveMetadata(key: string, value: any) {
    await apiFetch('/api/db/metadata', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
  }

  async deleteMetadata(key: string) {
    await apiFetch(`/api/db/metadata/${key}`, { method: 'DELETE' });
  }

  async getMetadata(key: string) {
    try {
      const res = await apiFetch(`/api/db/metadata/${key}`);
      const data = await res.json();
      try {
        return JSON.parse(data.value);
      } catch {
        return data.value;
      }
    } catch {
      return null;
    }
  }
}

export const storageService = new StorageService();
