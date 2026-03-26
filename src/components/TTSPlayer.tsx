import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Volume2, Settings, ChevronDown } from 'lucide-react';
import { ttsService } from '../services/ttsService';

interface TTSPlayerProps {
  text: string;
  apiKey?: string;
  voiceName?: string;
}

export const TTSPlayer: React.FC<TTSPlayerProps> = ({ text, apiKey, voiceName }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [voice, setVoice] = useState<string>(voiceName || '');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = ttsService.getVoices();
      setVoices(allVoices);
      
      // Try to find a default voice if none specified
      if (!voice && !voiceName) {
        const preferred = allVoices.find(v => 
          v.name.includes('Francisca') || 
          v.name.includes('Antonio') || 
          v.name.includes('Google') ||
          v.lang.startsWith('pt')
        );
        if (preferred) setVoice(preferred.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    if (voiceName) {
      setVoice(voiceName);
    }
  }, [voiceName]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      ttsService.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        ttsService.resume();
      } else {
        await ttsService.speak(text, { rate, voice: voice || undefined });
      }
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    ttsService.stop();
    setIsPlaying(false);
  };

  // Filter voices to show preferred ones first or only relevant ones
  const filteredVoices = voices.filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en'));

  return (
    <div className="flex flex-col gap-2 bg-zinc-900/40 backdrop-blur-md p-3 rounded-xl border border-white/5 shadow-inner">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePlayPause} 
            className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            title={isPlaying ? 'Pausar' : 'Ouvir Reportagem'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button 
            onClick={handleStop} 
            className="p-2 bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-all"
            title="Parar"
          >
            <Square className="w-4 h-4" />
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-1" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Leitura por Voz</span>
        </div>
        
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all ${showSettings ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:bg-white/5'}`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="flex flex-wrap gap-3 p-2 bg-black/20 rounded-lg border border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Velocidade</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={rate} 
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="text-[10px] font-mono text-indigo-400 w-8">{rate.toFixed(1)}x</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Voz Narradora</label>
            <div className="relative">
              <select 
                value={voice} 
                onChange={(e) => setVoice(e.target.value)}
                className="w-full bg-zinc-800 text-[10px] text-zinc-300 p-1.5 rounded border border-white/10 appearance-none focus:outline-none focus:border-indigo-500/50"
              >
                <option value="">Voz Padrão</option>
                {/* Prioritize specific voices mentioned by user */}
                <optgroup label="Vozes Recomendadas">
                  {voices.filter(v => v.name.includes('Francisca')).map(v => <option key={v.name} value={v.name}>Francisca (Natural)</option>)}
                  {voices.filter(v => v.name.includes('Antonio')).map(v => <option key={v.name} value={v.name}>Antonio (Natural)</option>)}
                  {voices.filter(v => v.name.includes('Google') && v.lang.startsWith('pt')).map(v => <option key={v.name} value={v.name}>Google Português</option>)}
                </optgroup>
                <optgroup label="Outras Vozes">
                  {filteredVoices.filter(v => !v.name.includes('Francisca') && !v.name.includes('Antonio') && !v.name.includes('Google')).map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
