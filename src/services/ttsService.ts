
export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
}

export const ttsService = {
  cleanTextForTTS: (text: string): string => {
    if (!text) return '';
    
    return text
      // Remove Markdown headers (e.g., # Header)
      .replace(/^#+\s+/gm, '')
      // Remove bold/italic markers (e.g., **bold**, *italic*, __bold__, _italic_)
      .replace(/(\*\*|\*|__|_) /g, ' ')
      .replace(/ (\*\*|\*|__|_) /g, ' ')
      .replace(/(\*\*|\*|__|_) /g, ' ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/_/g, '')
      // Remove Markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove Markdown images ![alt](url) -> alt
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
      // Remove inline code backticks
      .replace(/`/g, '')
      // Remove blockquotes > text
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '')
      // Remove list markers (e.g., - item, * item, 1. item)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove special tags like [VIDEO:url] or [IMAGE:prompt]
      .replace(/\[VIDEO:[^\]]+\]/g, '')
      .replace(/\[IMAGE:[^\]]+\]/g, '')
      // Remove excessive punctuation used for styling
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  },

  speak: (text: string, options: TTSOptions = {}) => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Web Speech API not supported'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Clean the text before speaking
      const cleanedText = ttsService.cleanTextForTTS(text);
      if (!cleanedText) {
        resolve(true);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      if (options.voice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === options.voice);
        if (selectedVoice) utterance.voice = selectedVoice;
      }

      utterance.onend = () => resolve(true);
      utterance.onerror = (e) => reject(e);

      window.speechSynthesis.speak(utterance);
    });
  },

  pause: () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  },

  resume: () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  },

  stop: () => {
    window.speechSynthesis.cancel();
  },

  getVoices: () => {
    return window.speechSynthesis.getVoices();
  }
};
