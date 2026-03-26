import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { errorService, AppError, ErrorCategory } from '../services/errorService';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<AppError[]>([]);

  useEffect(() => {
    const unsubscribe = errorService.subscribe((error) => {
      setToasts((prev) => [...prev, error]);
      
      // Auto-remove after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== error.id));
      }, 6000);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastProps {
  toast: AppError;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.category) {
      case ErrorCategory.DATABASE:
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case ErrorCategory.AUTH:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case ErrorCategory.API:
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getBgColor = () => {
    switch (toast.category) {
      case ErrorCategory.DATABASE:
        return 'bg-amber-500/10 border-amber-500/20';
      case ErrorCategory.AUTH:
        return 'bg-red-500/10 border-red-500/20';
      case ErrorCategory.API:
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      className={`pointer-events-auto w-80 p-4 rounded-xl border backdrop-blur-md shadow-2xl flex gap-3 items-start group ${getBgColor()}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-grow min-w-0">
        <h4 className="text-sm font-semibold text-white mb-1">
          {toast.category === ErrorCategory.DATABASE ? 'Erro de Banco de Dados' : 
           toast.category === ErrorCategory.AUTH ? 'Erro de Acesso' : 
           toast.category === ErrorCategory.API ? (toast.message.includes('cota') ? 'Limite de Cota' : 'Erro de Conexão') : 'Ops! Algo deu errado'}
        </h4>
        <p className="text-xs text-[#a1a1aa] leading-relaxed break-words">
          {toast.userFriendlyMessage}
        </p>
      </div>

      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 text-[#71717a] hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
