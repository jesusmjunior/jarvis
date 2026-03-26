// ============================================================================
// CONFIGURAÇÃO DE SEGREDOS E VARIÁVEIS DE AMBIENTE
// ============================================================================
// ATENÇÃO: Preencha suas chaves aqui para que o app funcione após a exportação.
// Se estas variáveis estiverem preenchidas, elas terão prioridade sobre o .env
// ============================================================================

export const secrets = {
  // SUPABASE
  SUPABASE_URL: "", // Ex: "https://xxxx.supabase.co"
  SUPABASE_KEY: "", // Chave anônima (anon key)
  
  // GOOGLE OAUTH
  OAUTH_CLIENT_ID: "", // Ex: "123456789-xxxx.apps.googleusercontent.com"
  OAUTH_CLIENT_SECRET: "", // Ex: "GOCSPX-xxxx"
  
  // GEMINI API
  GEMINI_API_KEY: "", // Ex: "AIzaSyxxxx"
  
  // CONFIGURAÇÕES DO APP
  APP_URL: "", // URL do seu app (ex: "http://localhost:3000" ou URL do Firebase)
  ADMIN_EMAIL: "", // E-mail do administrador principal (ou lista separada por vírgula)
  SESSION_SECRET: "", // Segredo para a sessão do Express
};
