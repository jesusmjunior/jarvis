import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface PasswordScreenProps {
  onUnlock: () => void;
}

export default function PasswordScreen({ onUnlock }: PasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '@Wsx280360') {
      onUnlock();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-500/10 p-4 rounded-full">
            <ShieldCheck className="w-12 h-12 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2">Acesso Restrito</h2>
        <p className="text-zinc-400 text-center mb-8">Por favor, insira a senha para acessar o aplicativo.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Digite a senha..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">Senha incorreta.</p>}
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Acessar
          </button>
        </form>
      </div>
    </div>
  );
}
