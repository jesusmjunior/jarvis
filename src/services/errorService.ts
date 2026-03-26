export enum ErrorCategory {
  API = 'API',
  DATABASE = 'DATABASE',
  AUTH = 'AUTH',
  USER_INTERACTION = 'USER_INTERACTION',
  SYSTEM = 'SYSTEM',
  GENERAL = 'GENERAL',
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  timestamp: number;
  details?: any;
  userFriendlyMessage: string;
}

type ErrorListener = (error: AppError) => void;
const listeners: Set<ErrorListener> = new Set();

export const errorService = {
  subscribe(listener: ErrorListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  log(error: unknown, category: ErrorCategory, userFriendlyMessage?: string) {
    let message = 'Ocorreu um erro inesperado.';
    let details: any = null;

    if (error instanceof Error) {
      message = error.message;
      details = error;
      try {
        const parsed = JSON.parse(message);
        // Check if it's a DatabaseErrorInfo JSON string (legacy)
        if (parsed.operationType && parsed.authInfo) {
          category = ErrorCategory.DATABASE;
          message = `Erro no Banco de Dados Supabase (${parsed.operationType}) em ${parsed.path || 'caminho desconhecido'}`;
          details = parsed;
        } 
        // Check for Gemini API errors (429 Rate Limit)
        else if (parsed.error && (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED')) {
          category = ErrorCategory.API;
          message = 'Limite de cota do Gemini excedido. Por favor, aguarde um momento ou use sua própria API Key nas configurações.';
          details = parsed;
        }
      } catch {
        // Not JSON, check for Supabase/PostgREST errors
        if (message.includes('schema cache') || message.includes('relation') || message.includes('table') || message.includes('column')) {
          category = ErrorCategory.DATABASE;
          // Keep the original message in details for debugging
          details = { originalMessage: message };
          if (message.includes('schema cache')) {
            message = 'Tabelas do banco de dados não encontradas ou cache do schema desatualizado no Supabase.';
          }
        }
      }
    } else if (typeof error === 'string') {
      message = error;
    }

    const appError: AppError = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      category,
      timestamp: Date.now(),
      details,
      userFriendlyMessage: userFriendlyMessage || this.getDefaultUserFriendlyMessage(category, message),
    };

    console.error(`[${category}]`, appError);
    listeners.forEach((listener) => listener(appError));
    
    return appError;
  },

  getDefaultUserFriendlyMessage(category: ErrorCategory, originalMessage: string): string {
    switch (category) {
      case ErrorCategory.API:
        if (originalMessage.includes('Limite de cota')) {
          return 'Você atingiu o limite de requisições do Gemini. Aguarde 1 minuto ou configure sua própria chave nas Configurações.';
        }
        return 'Não foi possível conectar ao servidor. Verifique sua internet.';
      case ErrorCategory.DATABASE:
        if (originalMessage.includes('permission-denied') || originalMessage.includes('JWT')) {
          return 'Você não tem permissão para realizar esta ação no banco de dados.';
        }
        if (originalMessage.includes('schema cache') || originalMessage.includes('table')) {
          return 'O banco de dados não está configurado corretamente. Verifique as tabelas no Supabase.';
        }
        return 'Erro ao acessar o banco de dados.';
      case ErrorCategory.AUTH:
        return 'Erro de autenticação. Tente fazer login novamente.';
      case ErrorCategory.USER_INTERACTION:
        return 'Ops! Algo deu errado com sua solicitação.';
      default:
        return 'Ocorreu um erro interno. Nossa equipe foi notificada.';
    }
  }
};
