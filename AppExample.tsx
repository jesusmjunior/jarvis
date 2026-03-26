// ==============================================================
// JARVIS 360° — Exemplo de uso do useJarvisContext
// Cole nos seus componentes existentes como referência
// ==============================================================

import { useJarvisContext } from './src/contexts/JarvisProvider';

export function JarvisLoginButton() {
  const { isAuth, isLoading, isAdmin, session, login, logout } =
    useJarvisContext();

  if (isLoading) return <p>Carregando...</p>;

  if (!isAuth) {
    return (
      <button onClick={login}>
        Conectar Google Workspace
      </button>
    );
  }

  return (
    <div>
      <img src={session?.avatar_url} alt="avatar" width={32} />
      <span>{session?.display_name}</span>
      {isAdmin && <span>[ADMIN]</span>}
      <button onClick={logout}>Sair</button>
    </div>
  );
}

export function JarvisChatExample() {
  const {
    messages,
    isSyncing,
    sessionId,
    newSession,
    addMessage,
    flushSession,
    searchMemory,
  } = useJarvisContext();

  async function handleNewChat() {
    await newSession('Novo chat JARVIS');
  }

  function handleUserMessage(text: string) {
    addMessage('user', text);
  }

  async function handleSearchMemory(q: string) {
    const results = await searchMemory(q, 'L2');
    console.log('Memória L2:', results);
  }

  return (
    <div>
      <div>
        {isSyncing && <span>Sincronizando...</span>}
        <button onClick={handleNewChat}>Novo Chat</button>
        <button onClick={flushSession}>Salvar agora</button>
      </div>
      <ul>
        {messages.map(m => (
          <li key={m.id}>[{m.role}] {m.content}</li>
        ))}
      </ul>
    </div>
  );
}
