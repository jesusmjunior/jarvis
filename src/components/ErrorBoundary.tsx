import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { errorService, ErrorCategory } from '../services/errorService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorService.log(error, ErrorCategory.SYSTEM, 'Ocorreu um erro crítico no aplicativo.');
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#18181b] border border-[#27272a] rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-2">Ops! Algo deu errado</h1>
            <p className="text-[#a1a1aa] mb-8 leading-relaxed">
              Ocorreu um erro inesperado que impediu o funcionamento correto do JESUS I.A. 
              Nossa equipe técnica já foi notificada.
            </p>
            
            <div className="bg-[#09090b] rounded-lg p-4 mb-8 text-left border border-[#27272a]">
              <p className="text-xs font-mono text-red-400 break-all">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
            </div>
            
            <button
              onClick={this.handleReset}
              className="w-full bg-white text-black font-medium py-3 px-6 rounded-xl hover:bg-[#e4e4e7] transition-all flex items-center justify-center gap-2 group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Recarregar JESUS I.A.
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
