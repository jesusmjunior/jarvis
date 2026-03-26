import { GoogleGenAI } from "@google/genai";
import { searchService } from './searchService';
import { secrets } from '../config/secrets';

export interface Report {
  id: string;
  title: string;
  content: string;
  sources: string[];
  createdAt: number;
  youtubeVideos?: any[];
  metadata?: {
    year?: string;
    imdbRating?: string;
    videoUrl?: string;
    imageUrl?: string;
  };
}

export const archiveReport = async (report: Report): Promise<string> => {
  try {
    const reports = await getReports();
    const updatedReports = [report, ...reports.filter(r => r.id !== report.id)];
    localStorage.setItem('jarvis_reports', JSON.stringify(updatedReports));
    return report.id;
  } catch (e) {
    console.error('Erro ao arquivar relatório:', e);
    throw e;
  }
};

export const getReports = async (): Promise<Report[]> => {
  try {
    const saved = localStorage.getItem('jarvis_reports');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Erro ao carregar relatórios:', e);
    return [];
  }
};

export const deleteReport = async (id: string): Promise<void> => {
  try {
    const reports = await getReports();
    const updatedReports = reports.filter(r => r.id !== id);
    localStorage.setItem('jarvis_reports', JSON.stringify(updatedReports));
  } catch (e) {
    console.error('Erro ao excluir relatório:', e);
  }
};

export const publishToHashnode = async (report: Report, token: string, publicationId?: string): Promise<boolean> => {
  if (!token) throw new Error("Token do Hashnode não configurado.");
  
  let targetPublicationId = publicationId;

  // Fetch publicationId if not provided
  if (!targetPublicationId) {
    try {
      const meQuery = `
        query {
          me {
            publications(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `;
      const meResponse = await fetch('https://gql.hashnode.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ query: meQuery })
      });
      const meResult = await meResponse.json();
      const edges = meResult.data?.me?.publications?.edges;
      if (edges && edges.length > 0) {
        targetPublicationId = edges[0].node.id;
      } else {
        throw new Error("Nenhuma publicação encontrada para este usuário no Hashnode.");
      }
    } catch (e) {
      console.error('Erro ao buscar publicationId:', e);
      throw new Error("Falha ao obter ID da publicação. Verifique seu token.");
    }
  }

  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      title: report.title,
      contentMarkdown: report.content + "\n\n---\n\n### Fontes Consultadas\n" + report.sources.join("\n"),
      publicationId: targetPublicationId,
      tags: [{ name: "AI", slug: "ai" }, { name: "Research", slug: "research" }]
    }
  };

  try {
    const response = await fetch('https://gql.hashnode.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    if (result.errors) {
      console.error('Erros do Hashnode:', result.errors);
      throw new Error(result.errors[0]?.message || "Erro desconhecido ao publicar.");
    }
    return !!result.data?.publishPost?.post?.url;
  } catch (e) {
    console.error('Erro ao publicar no Hashnode:', e);
    throw e;
  }
};

export const protocoloMariResearch = async (query: string, onProgress?: (progress: number) => void, apiKey?: string, mode: 'deep' | 'fast' = 'deep'): Promise<Report> => {
  const activeKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  if (!activeKey) throw new Error("API Key não configurada para o Protocolo MARI.");
  
  if (onProgress) onProgress(0.1);
  const ai = new GoogleGenAI({ apiKey: activeKey });

  // 1. Research (Ajustar número de fontes conforme o modo)
  const numSources = mode === 'fast' ? 3 : 15;
  if (onProgress) onProgress(0.2);
  const responseSearch = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Pesquise sobre: ${query}. Encontre de ${mode === 'fast' ? '3 a 5' : '10 a 15'} fontes confiáveis e vídeos relevantes no YouTube.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  if (onProgress) onProgress(0.4);
  const chunks = responseSearch.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c: any) => c.web?.uri || c.maps?.uri || '').filter(Boolean);
  
  // Search for video specifically
  if (onProgress) onProgress(0.5);
  const videoSearch = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Encontre o URL direto do vídeo mais relevante no YouTube para: ${query}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  
  const videoChunks = videoSearch.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const videoUrl = videoChunks.find((c: any) => c.web?.uri?.includes('youtube.com/watch'))?.web?.uri || '';
  
  // 2. Generate Content (Protocolo Mari - Revista Eletrônica)
  if (onProgress) onProgress(0.7);
  const prompt = `
    Você é um redator sênior de uma revista eletrônica premium. Siga o "Protocolo Mari" ${mode === 'fast' ? '(Versão Rápida/Reduzida)' : ''} para criar uma reportagem ${mode === 'fast' ? 'concisa, direta e elegante' : 'longa, profunda e elegante'}.
    
    Query: ${query}
    
    Fontes de Pesquisa (Use ${mode === 'fast' ? 'de 3 a 5' : 'de 10 a 15'} fontes):
    ${JSON.stringify(chunks)}
    
    Vídeo Recomendado: ${videoUrl}
    
    Instruções do Protocolo Mari (Revista Eletrônica):
    - Título Impactante e chamativo.
    - Introdução ${mode === 'fast' ? 'direta' : 'com Letra Capitular (o primeiro caractere deve ser destacado)'}.
    - Desenvolvimento ${mode === 'fast' ? 'conciso e objetivo' : 'longo e profundo'}, com dados cruciais integrados.
    - Utilize citações recuadas (blockquotes) para destacar dados ou opiniões de especialistas das fontes pesquisadas.
    - Se houver vídeos relevantes, indique onde inseri-los no texto com [VIDEO: url_do_youtube].
    - Estrutura: Título, Introdução, Desenvolvimento, Conclusão.
    - Ao final, compile uma lista elegante de "Referências Consultadas" com links.
    - Estilo: Linguagem sofisticada, premium, envolvente.
    - RETORNE TAMBÉM UM JSON NO FORMATO: {"year": "ano", "imdbRating": "nota", "imageUrl": "url_da_imagem_representativa_do_polination", "videoUrl": "url_do_trailer_ou_video_principal"}
  `;

  const response = await ai.models.generateContent({
    model: mode === 'fast' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview",
    contents: prompt,
  });

  if (onProgress) onProgress(0.95);
  const text = response.text || '';
  const jsonMatch = text.match(/\{.*\}/s);
  let metadata: any = {};
  try {
    if (jsonMatch) metadata = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Erro ao parsear metadata:", e);
  }

  let youtubeVideos: any[] = [];
  const finalVideoUrl = metadata.videoUrl || videoUrl;
  if (finalVideoUrl && finalVideoUrl.includes('youtube.com/watch?v=')) {
    const videoId = finalVideoUrl.split('v=')[1]?.split('&')[0];
    if (videoId) {
      youtubeVideos.push({ id: videoId, title: "Vídeo Relacionado" });
    }
  } else if (finalVideoUrl && finalVideoUrl.includes('youtu.be/')) {
    const videoId = finalVideoUrl.split('youtu.be/')[1]?.split('?')[0];
    if (videoId) {
      youtubeVideos.push({ id: videoId, title: "Vídeo Relacionado" });
    }
  }

  return {
    id: Date.now().toString(),
    title: `Relatório Acadêmico: ${query}`,
    content: text.replace(/\{.*\}/s, ''),
    sources,
    createdAt: Date.now(),
    metadata,
    youtubeVideos
  };
};
