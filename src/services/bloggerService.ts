import { PERFORMANCE_API_ID } from '../constants';

export interface BloggerConfig {
  token: string;
  publicationId: string;
}

// In-memory configuration, to be updated by the user
let config: BloggerConfig = {
  token: '',
  publicationId: ''
};

export const setBloggerConfig = (token: string, publicationId: string) => {
  config = { token, publicationId };
  localStorage.setItem('blogger_config', JSON.stringify(config));
};

export const getBloggerConfig = (): BloggerConfig => {
  if (!config.token || !config.publicationId) {
    const saved = localStorage.getItem('blogger_config');
    if (saved) {
      config = JSON.parse(saved);
    }
  }
  return config;
};

export const publishToBlogger = async (report: any): Promise<boolean> => {
  const { token, publicationId } = getBloggerConfig();
  if (!token || !publicationId) {
    throw new Error("Configuração do Blogger não encontrada.");
  }

  try {
    // Direct API call to the REST Node with performance ID
    const response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${publicationId}/posts/?performanceId=${PERFORMANCE_API_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: report.title,
        content: report.content,
        labels: report.sources || []
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro ao publicar no Blogger:', errorData);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Erro ao publicar no Blogger:', e);
    return false;
  }
};
