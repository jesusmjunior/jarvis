export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('jarvis_auth_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Add Supabase keys if present in localStorage
  const supabaseUrl = localStorage.getItem('jarvis_supabase_url');
  const supabaseKey = localStorage.getItem('jarvis_supabase_key');
  if (supabaseUrl) headers.set('x-supabase-url', supabaseUrl);
  if (supabaseKey) headers.set('x-supabase-key', supabaseKey);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  console.log(`JARVIS API: Fetching ${url}`, { method: options.method || 'GET' });

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response;
}
