// ============================================================
// JARVIS 360° — /supabase.ts
// Credenciais reais — projeto: mdhmbnlijiwgrdecrfeo
// Admins: admjesusia@gmail.com, jesusmjunior2021@gmail.com, martjesusmartins@gmail.com
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://mdhmbnlijiwgrdecrfeo.supabase.co';
const DEFAULT_KEY = 'sb_publishable_gG_IRyVcGs6fflpt4lXseg_AQxyLIaE';

const getInitialUrl = () => typeof window !== 'undefined' ? localStorage.getItem('jarvis_supabase_url') || DEFAULT_URL : DEFAULT_URL;
const getInitialKey = () => typeof window !== 'undefined' ? localStorage.getItem('jarvis_supabase_key') || DEFAULT_KEY : DEFAULT_KEY;

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (url?: string, key?: string): SupabaseClient => {
  if (url && key) {
    // If new credentials are provided, always create a new client
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'jarvis360_supabase_session',
      },
      global: {
        headers: {
          'x-jarvis-admin': 'martjesusmartins@gmail.com',
        },
      },
      db: {
        schema: 'public',
      },
    });
    return supabaseInstance;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(getInitialUrl(), getInitialKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'jarvis360_supabase_session',
      },
      global: {
        headers: {
          'x-jarvis-admin': 'martjesusmartins@gmail.com',
        },
      },
      db: {
        schema: 'public',
      },
    });
  }
  return supabaseInstance;
};

// For backward compatibility
export const supabase = getSupabaseClient();

export const JARVIS_CONFIG = {
  SUPABASE_URL: getInitialUrl(),
  SUPABASE_PROJECT_REF: 'mdhmbnlijiwgrdecrfeo',
  ADMIN_EMAIL: 'admjesusia@gmail.com,jesusmjunior2021@gmail.com,martjesusmartins@gmail.com',
  MCP_URL: 'https://mcp.supabase.com/mcp?project_ref=mdhmbnlijiwgrdecrfeo',
} as const;
