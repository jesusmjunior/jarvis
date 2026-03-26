import React, { useState, useEffect } from 'react';
import { X, Mic, Sparkles, Send, Smile, Check, Loader2 } from 'lucide-react';
import { aiEmailService } from '../services/aiEmailService';

interface EmailComposerProps {
  onClose: () => void;
  onSend: (email: { to: string; subject: string; body: string }) => void;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({ onClose, onSend }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const signature = "\n\nDM Jesus Martin Oliveira Júnior\nTelefone: 98984711808";

  const handleAIAction = async (action: 'correct' | 'formalize' | 'complete') => {
    setLoading(true);
    try {
      if (action === 'correct') setBody(await aiEmailService.correctGrammar(body));
      else if (action === 'formalize') setBody(await aiEmailService.formalize(body));
      else if (action === 'complete') {
        const suggestions = await aiEmailService.getSuggestions(body);
        if (suggestions.length > 0) setBody(body + "\n\n" + suggestions[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/90 flex items-center justify-center z-50">
      <div className="bg-zinc-950 w-[600px] border border-zinc-700 flex flex-col h-[500px]">
        <div className="bg-zinc-900 p-3 flex justify-between items-center border-b border-zinc-700">
          <span className="text-sm font-medium text-white">Nova Mensagem</span>
          <button onClick={onClose}><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1">
          <input placeholder="Para" value={to} onChange={e => setTo(e.target.value)} className="bg-transparent border-b border-zinc-700 p-2 text-sm text-white focus:outline-none" />
          <input placeholder="Assunto" value={subject} onChange={e => setSubject(e.target.value)} className="bg-transparent border-b border-zinc-700 p-2 text-sm text-white focus:outline-none" />
          <textarea 
            value={body} 
            onChange={e => setBody(e.target.value)} 
            className="flex-1 bg-transparent p-2 text-sm text-white resize-none focus:outline-none"
            placeholder="Escreva seu e-mail..."
          />
        </div>
        <div className="p-3 bg-zinc-900 border-t border-zinc-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setIsRecording(!isRecording)} className={`p-2 ${isRecording ? 'bg-red-900' : 'hover:bg-zinc-800'}`}><Mic className="w-4 h-4" /></button>
            <button onClick={() => handleAIAction('correct')} className="p-2 hover:bg-zinc-800"><Check className="w-4 h-4" /></button>
            <button onClick={() => handleAIAction('formalize')} className="p-2 hover:bg-zinc-800"><Sparkles className="w-4 h-4" /></button>
            <button className="p-2 hover:bg-zinc-800"><Smile className="w-4 h-4" /></button>
          </div>
          <button onClick={() => onSend({ to, subject, body: body + signature })} className="bg-zinc-700 text-white px-6 py-2 text-sm font-medium flex items-center gap-2 hover:bg-zinc-600">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
