import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Mail, ArrowRight } from 'lucide-react';

interface Rule {
  id: string;
  from: string;
  subjectContains: string;
  action: 'archive' | 'delete' | 'star';
}

export const GmailAutomationRules: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [action, setAction] = useState<'archive' | 'delete' | 'star'>('archive');

  useEffect(() => {
    const savedRules = localStorage.getItem('gmail_automation_rules');
    if (savedRules) setRules(JSON.parse(savedRules));
  }, []);

  const saveRules = (newRules: Rule[]) => {
    setRules(newRules);
    localStorage.setItem('gmail_automation_rules', JSON.stringify(newRules));
  };

  const addRule = () => {
    if (!from && !subject) return;
    const newRule = { id: Date.now().toString(), from, subjectContains: subject, action };
    saveRules([...rules, newRule]);
    setFrom('');
    setSubject('');
  };

  const deleteRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-medium text-white">Regras de Automação</h3>
      <div className="flex gap-2">
        <input placeholder="De (remetente)" value={from} onChange={e => setFrom(e.target.value)} className="bg-zinc-900 border border-white/10 rounded p-2 text-sm" />
        <input placeholder="Assunto contém" value={subject} onChange={e => setSubject(e.target.value)} className="bg-zinc-900 border border-white/10 rounded p-2 text-sm" />
        <select value={action} onChange={e => setAction(e.target.value as any)} className="bg-zinc-900 border border-white/10 rounded p-2 text-sm">
          <option value="archive">Arquivar</option>
          <option value="delete">Deletar</option>
          <option value="star">Marcar com estrela</option>
        </select>
        <button onClick={addRule} className="bg-white text-zinc-900 px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>
      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded border border-white/5">
            <div className="text-sm text-zinc-300">
              Se de <span className="font-bold">{rule.from || '*'}</span> e assunto contém <span className="font-bold">{rule.subjectContains || '*'}</span>, então <span className="font-bold text-red-400">{rule.action}</span>
            </div>
            <button onClick={() => deleteRule(rule.id)} className="text-zinc-500 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
