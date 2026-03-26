import { useState } from "react";
import { Eye, EyeOff, AlertCircle, Key, CheckCircle2, XCircle, Trash2, HelpCircle, Cloud, Upload, Download, RefreshCw } from "lucide-react";
import { errorService, ErrorCategory } from "../services/errorService";
import { GoogleGenAI } from "@google/genai";
import { useApiKey } from "../contexts/ApiKeyContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ApiKeyRecord {
  id: string;
  name: string;
  maskedKey: string;
  key?: string; // Obfuscated key
  expiresAt: string;
  engine: string;
  savedAt: string;
  status: "idle" | "testing" | "success" | "error" | "quota_exceeded";
}

// Helper to obfuscate/deobfuscate
const obfuscate = (str: string) => btoa(str);
const deobfuscate = (str: string) => atob(str);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const maskKey = (key: string): string => {
  if (key.length < 10) return "••••••••••";
  return key.slice(0, 6) + "•".repeat(key.length - 10) + key.slice(-4);
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ApiKeyManager() {
  const { keys, setKeys, setActiveKeyId, activeKeyId, testKey, refreshStatus } = useApiKey();
  const [inputKey, setInputKey] = useState("");
  const [keyName, setKeyName] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "saved" | "refreshing">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);
  const [showDriveHelp, setShowDriveHelp] = useState(false);

  const handleRefresh = async () => {
    setStatus("refreshing");
    await refreshStatus();
    setStatus("idle");
  };

  const handleSave = async () => {
    if (!inputKey.trim() || !keyName.trim()) {
      setErrorMsg("Preencha o nome e a chave.");
      return;
    }
    if (!inputKey.startsWith("AIza")) {
      setErrorMsg("Chave inválida.");
      return;
    }

    setStatus("saving");
    setErrorMsg("");

    try {
      const result = await testKey(inputKey.trim());
      const newKey: ApiKeyRecord = {
        id: Date.now().toString(),
        name: keyName,
        maskedKey: maskKey(inputKey.trim()),
        key: obfuscate(inputKey.trim()),
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
        engine: "gemini-3-flash-preview",
        savedAt: new Date().toISOString(),
        status: result.status,
      };

      const updatedKeys = [...keys, newKey];
      setKeys(updatedKeys);
      if (!activeKeyId) setActiveKeyId(newKey.id);
      
      setInputKey("");
      setKeyName("");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMsg("Erro ao salvar.");
      setStatus("error");
    }
  };

  const handleDelete = async (id: string) => {
    // if (!user) return;
    const updatedKeys = keys.filter(k => k.id !== id);
    // await setDoc(doc(db, "settings", user.uid), {
    //   keys: updatedKeys,
    //   activeKeyId: activeKeyId === id ? (updatedKeys[0]?.id || null) : activeKeyId,
    // });
    setKeys(updatedKeys);
    if (activeKeyId === id) setActiveKeyId(updatedKeys[0]?.id || null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Key className="w-5 h-5 text-emerald-500" />
          Gestão de API Keys
        </h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh} 
            disabled={status === "refreshing"}
            className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${status === "refreshing" ? "animate-spin text-emerald-500" : "text-zinc-500"}`}
            title="Atualizar Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowDriveHelp(!showDriveHelp)} className="text-zinc-500 hover:text-white">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showDriveHelp && (
        <div className="bg-zinc-900 p-4 rounded-xl border border-white/10 text-xs text-zinc-400 space-y-2">
          <p className="font-bold text-white">Configuração Google Drive</p>
          <p>1. Crie uma pasta chamada "Jarvis 360" no seu Google Drive.</p>
          <p>2. O arquivo "Jarvis 360.db" será criado automaticamente lá.</p>
          <p>3. Se o app não conseguir criar, exporte o banco de dados manualmente e faça o upload para essa pasta.</p>
          <div className="flex gap-2 pt-2">
            <button className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded"><Download className="w-3 h-3"/> Exportar DB</button>
            <button className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded"><Upload className="w-3 h-3"/> Importar DB</button>
          </div>
        </div>
      )}

      {/* Lista de Chaves */}
      <div className="space-y-3">
        {keys.map((keyRecord) => (
          <div
            key={keyRecord.id}
            className={`w-full p-4 rounded-xl border transition-all ${
              activeKeyId === keyRecord.id
                ? "bg-zinc-900 border-emerald-500/50"
                : "bg-zinc-950 border-white/5 hover:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <button className="flex-1 flex items-center gap-3" onClick={() => setActiveKeyId(keyRecord.id)}>
                <div className={`w-3 h-3 rounded-full ${
                  keyRecord.status === "success" ? "bg-emerald-500" : 
                  keyRecord.status === "quota_exceeded" ? "bg-amber-500" :
                  keyRecord.status === "error" ? "bg-red-500" : "bg-zinc-500"
                }`} />
                <div className="text-left">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {keyRecord.name}
                    {keyRecord.status === "quota_exceeded" && (
                      <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded">COTA EXCEDIDA</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-zinc-400">{keyRecord.maskedKey}</div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDelete(keyRecord.id)} className="text-zinc-600 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
                {keyRecord.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : keyRecord.status === "quota_exceeded" ? (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input da nova chave */}
      <div className="space-y-4 pt-6 border-t border-white/5">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nome da Chave</label>
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Ex: Gemini Pro"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-colors pr-12"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Validade</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </div>
          <div className="flex-1 pt-6">
            <button
              onClick={handleSave}
              disabled={status === "saving"}
              className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                status === "saved"
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-100 text-black hover:bg-white"
              }`}
            >
              {status === "saving" ? "Salvando..." : status === "saved" ? "Salvo!" : "Salvar Chave"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
