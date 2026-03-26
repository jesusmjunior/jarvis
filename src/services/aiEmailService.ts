import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const aiEmailService = {
  async correctGrammar(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Corrija a gramática e a ortografia deste texto, mantendo o sentido original: "${text}"`,
    });
    return response.text || text;
  },

  async formalize(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Reescreva este texto em um tom mais formal e profissional: "${text}"`,
    });
    return response.text || text;
  },

  async generateFromNarrative(narrative: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Redija um e-mail completo e profissional baseado nesta narrativa coloquial: "${narrative}"`,
    });
    return response.text || narrative;
  },

  async getSuggestions(context: string): Promise<string[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sugira 3 frases ou citações para completar este contexto de e-mail: "${context}". Retorne apenas as frases separadas por quebra de linha.`,
    });
    return response.text ? response.text.split('\n').filter(s => s.trim() !== '') : [];
  }
};
