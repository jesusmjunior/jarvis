import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Archive, BookOpen, Share2 } from 'lucide-react';
import { Report } from '../services/reportService';
import { GoogleGenAI, Modality } from "@google/genai";

import { useApiKey } from '../contexts/ApiKeyContext';
import { secrets } from '../config/secrets';

interface ReportCardProps {
  report: Report;
  onArchive: (id: string) => void;
}

export default function ReportCard({ report, onArchive }: ReportCardProps) {
  const { activeKey: apiKey } = useApiKey();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeApiKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey: activeApiKey });

  const playTTS = async () => {
    setIsPlaying(true);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: report.content }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => setIsPlaying(false);
    }
  };

  const stopTTS = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-lg">
      <h3 className="text-lg font-bold text-white">{report.title}</h3>
      <p className="text-sm text-zinc-400 line-clamp-3">{report.content.substring(0, 150)}...</p>
      
      <div className="flex items-center gap-2 pt-2">
        <button onClick={isPlaying ? stopTTS : playTTS} className="p-2 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => onArchive(report.id)} className="p-2 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white">
          <Archive className="w-4 h-4" />
        </button>
        <button className="p-2 bg-zinc-800 rounded-lg text-zinc-300 hover:text-white">
          <BookOpen className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
