import React, { useState } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { Database, Check, X, Loader2, Save, RefreshCw, ShieldCheck, ShieldAlert, Code, Copy, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

export default function SupabaseConfigManager() {
  const { config, updateConfig, isConnected, isTesting, testConnection, missingTables } = useSupabase();
  const [url, setUrl] = useState(config.url);
  const [key, setKey] = useState(config.key);
  const [isSaving, setIsSaving] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  const hasMissingTables = missingTables.length > 0;

  const schemaSql = `
-- ============================================================
-- JESUS I.A. 360° — Schema Definitivo v5 para Supabase
-- Autor: Jesus Martins Oliveira Junior
-- Baseado em: server.ts (código-fonte real da aplicação)
-- Execute no: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Extensões ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- PASSO 0 — NORMALIZAÇÃO DE COLUNAS LEGADAS
-- Renomeia user_id → uid em todas as tabelas que precisam
-- Só executa se user_id existe E uid não existe (idempotente)
-- ============================================================
do $$
declare
  tbl  text;
  pol  text;
  v_rec record;
  tbls text[] := array[
    'sessions','memory','search_history','youtube_videos',
    'cards','background_tasks','maps','photos'
  ];
begin
  -- 1. REMOVE TODAS AS VIEWS PARA EVITAR ERROS DE DEPENDÊNCIA
  for v_rec in (
    select matviewname as name, 'materialized view' as type from pg_matviews where schemaname = 'public'
    union all
    select viewname as name, 'view' as type from pg_views where schemaname = 'public'
  ) loop
    execute format('drop %s if exists public.%I cascade', v_rec.type, v_rec.name);
  end loop;
  raise notice '[PASSO 0] Todas as views removidas para conversão de tipos.';

  foreach tbl in array tbls loop
    -- Renomeia user_id → uid
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and column_name = 'user_id'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and column_name = 'uid'
    ) then
      execute format('alter table public.%I rename column user_id to uid', tbl);
      raise notice '[PASSO 0] Renomeado user_id → uid em: %', tbl;
    end if;

    -- Se houver mudança de tipo pendente, removemos as políticas primeiro
    -- Isso evita o erro de dependência (cannot alter type of a column used in a policy)
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and (
          (column_name = 'uid' and data_type = 'uuid') OR
          (column_name = 'id' and data_type = 'uuid' and tbl != 'youtube_videos')
        )
    ) then
      for pol in (select policyname from pg_policies where schemaname = 'public' and tablename = tbl) loop
        execute format('drop policy if exists %I on public.%I', pol, tbl);
      end loop;
      raise notice '[PASSO 0] Políticas removidas temporariamente em: %', tbl;
    end if;

    -- Se uid é uuid, converte para text (aplicação usa uid TEXT)
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and column_name = 'uid' and data_type = 'uuid'
    ) then
      execute format(
        'alter table public.%I alter column uid type text using uid::text', tbl
      );
      raise notice '[PASSO 0] uid uuid→text em: %', tbl;
    end if;

    -- Se id é uuid (exceto youtube_videos que mantém uuid), converte para text
    if tbl != 'youtube_videos' and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl
        and column_name = 'id' and data_type = 'uuid'
    ) then
      execute format(
        'alter table public.%I alter column id type text using id::text', tbl
      );
      raise notice '[PASSO 0] id uuid→text em: %', tbl;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- TABELA 1: app_metadata
-- ============================================================
create table if not exists public.app_metadata (
  key        text        primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_metadata enable row level security;
drop policy if exists "app_metadata: authenticated" on public.app_metadata;
create policy "app_metadata: authenticated" on public.app_metadata for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 2: sessions
-- ============================================================
create table if not exists public.sessions (
  id          text    primary key,
  uid         text    not null,
  title       text,
  tags        text[]  default '{}',
  created_at  bigint,
  updated_at  bigint,
  is_archived boolean default false,
  archived_at bigint,
  is_pinned   boolean default false
);

create index if not exists idx_sessions_uid on public.sessions(uid);
create index if not exists idx_sessions_updated on public.sessions(uid, updated_at desc);

alter table public.sessions enable row level security;
drop policy if exists "sessions: authenticated" on public.sessions;
create policy "sessions: authenticated" on public.sessions for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 3: memory
-- ============================================================
create table if not exists public.memory (
  id         text   primary key,
  uid        not null text,
  session_id text,
  role       text,
  content    text,
  timestamp  bigint,
  type       text   default 'text',
  metadata   jsonb  default '{}'
);

create index if not exists idx_memory_uid on public.memory(uid);
create index if not exists idx_memory_session_id on public.memory(session_id);
create index if not exists idx_memory_timestamp on public.memory(uid, timestamp desc);

alter table public.memory enable row level security;
drop policy if exists "memory: authenticated" on public.memory;
create policy "memory: authenticated" on public.memory for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 4: search_history
-- ============================================================
create table if not exists public.search_history (
  id         text   primary key,
  uid        text   not null,
  query      text,
  type       text,
  results    jsonb  default '[]',
  timestamp  bigint,
  tags       text[] default '{}',
  summary    text,
  session_id text
);

create index if not exists idx_search_history_uid on public.search_history(uid);
create index if not exists idx_search_history_timestamp on public.search_history(uid, timestamp desc);

alter table public.search_history enable row level security;
drop policy if exists "search_history: authenticated" on public.search_history;
create policy "search_history: authenticated" on public.search_history for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 5: youtube_videos
-- ============================================================
create table if not exists public.youtube_videos (
  id            uuid   primary key default gen_random_uuid(),
  "videoId"     text   not null,
  title         text,
  channel_title text,
  thumbnail     text,
  link          text,
  timestamp     bigint,
  session_id    text,
  uid           text,
  unique("videoId", session_id)
);

create index if not exists idx_youtube_uid on public.youtube_videos(uid);
create index if not exists idx_youtube_timestamp on public.youtube_videos(timestamp desc);

alter table public.youtube_videos enable row level security;
drop policy if exists "youtube_videos: authenticated" on public.youtube_videos;
create policy "youtube_videos: authenticated" on public.youtube_videos for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 6: cards
-- ============================================================
create table if not exists public.cards (
  id           text    primary key,
  uid          text    not null,
  session_id   text,
  type         text,
  title        text,
  content      text,
  timestamp    bigint,
  color        text,
  is_collapsed boolean default false,
  is_pinned    boolean default false,
  is_archived  boolean default false,
  metadata     jsonb   default '{}'
);

create index if not exists idx_cards_uid on public.cards(uid);
create index if not exists idx_cards_timestamp on public.cards(uid, timestamp desc);

alter table public.cards enable row level security;
drop policy if exists "cards: authenticated" on public.cards;
create policy "cards: authenticated" on public.cards for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 7: background_tasks
-- ============================================================
create table if not exists public.background_tasks (
  id           text        primary key,
  uid          text        not null,
  title        text,
  progress     integer     default 0,
  status       text        default 'pending',
  acknowledged boolean     default false,
  created_at   timestamptz default now()
);

create index if not exists idx_background_tasks_uid on public.background_tasks(uid);

alter table public.background_tasks enable row level security;
drop policy if exists "background_tasks: authenticated" on public.background_tasks;
create policy "background_tasks: authenticated" on public.background_tasks for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 8: maps
-- ============================================================
create table if not exists public.maps (
  id         text             primary key,
  uid        text             not null,
  title      text,
  address    text,
  lat        double precision,
  lng        double precision,
  timestamp  bigint,
  session_id text,
  metadata   jsonb            default '{}'
);

create index if not exists idx_maps_uid on public.maps(uid);

alter table public.maps enable row level security;
drop policy if exists "maps: authenticated" on public.maps;
create policy "maps: authenticated" on public.maps for all using (auth.role() = 'authenticated');

-- ============================================================
-- TABELA 9: photos
-- ============================================================
create table if not exists public.photos (
  id         text   primary key,
  uid        text   not null,
  url        text,
  title      text,
  timestamp  bigint,
  session_id text,
  metadata   jsonb  default '{}'
);

create index if not exists idx_photos_uid on public.photos(uid);

alter table public.photos enable row level security;
drop policy if exists "photos: authenticated" on public.photos;
create policy "photos: authenticated" on public.photos for all using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKET — uploads
-- ============================================================
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true) on conflict (id) do nothing;

drop policy if exists "uploads: read" on storage.objects;
drop policy if exists "uploads: insert" on storage.objects;

create policy "uploads: read" on storage.objects for select using (bucket_id = 'uploads' and auth.role() = 'authenticated');
create policy "uploads: insert" on storage.objects for insert with check (bucket_id = 'uploads' and auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================
do $$
declare
  tbl  text;
  tbls text[] := array[
    'app_metadata','sessions','memory','search_history',
    'youtube_videos','cards','background_tasks','maps','photos'
  ];
begin
  foreach tbl in array tbls loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;

-- ============================================================
-- VIEWS AUXILIARES
-- ============================================================
create or replace view public.v_sessions_active as
  select * from public.sessions
  where is_archived = false order by updated_at desc;

create or replace view public.v_sessions_pinned as
  select * from public.sessions
  where is_pinned = true and is_archived = false order by updated_at desc;

create or replace view public.v_cards_active as
  select * from public.cards
  where is_archived = false order by timestamp desc;

create or replace view public.v_tasks_pending as
  select * from public.background_tasks
  where status != 'completed' and acknowledged = false
  order by created_at desc;

-- ============================================================
-- FIM — JESUS I.A. 360° Schema v5.2
-- ============================================================
`;

  const copySchema = () => {
    navigator.clipboard.writeText(schemaSql);
    alert('SQL Schema copiado para o clipboard!');
  };

  const handleSave = async () => {
    setIsSaving(true);
    updateConfig({ url, key });
    setTimeout(async () => {
      await testConnection();
      setIsSaving(false);
    }, 500);
  };

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <Database className={`w-5 h-5 ${isConnected ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Configuração Supabase</h3>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Banco de Dados Principal</p>
          </div>
        </div>
        
        {/* LED Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full shadow-lg ${isConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-tighter ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Supabase URL</label>
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />
        </div>
        
        <div>
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Anon Key / Service Role</label>
          <div className="relative">
            <input 
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          onClick={handleSave}
          disabled={isSaving || isTesting}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </button>
        
        <button 
          onClick={() => testConnection()}
          disabled={isTesting || isSaving}
          className="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-xl py-3 transition-all"
          title="Testar Conexão"
        >
          {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {isConnected ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[10px] text-emerald-500/80 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
            <ShieldCheck className="w-3 h-3" />
            <span>Sincronia ativa: Todos os dados estão sendo persistidos corretamente.</span>
          </div>
          
          {hasMissingTables && (
            <div className="flex flex-col gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                <ShieldAlert className="w-3 h-3" />
                <span>Tabelas Ausentes Detectadas</span>
              </div>
              <p className="text-[9px] text-zinc-400">
                As seguintes tabelas não foram encontradas no seu banco de dados: 
                <span className="text-red-400 ml-1">{missingTables.join(', ')}</span>.
              </p>
              <p className="text-[9px] text-zinc-500">
                Use o SQL Schema abaixo para inicializar o banco de dados no seu painel do Supabase.
              </p>
            </div>
          )}
          
          <button 
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-white transition-all px-1"
          >
            <Terminal className="w-3 h-3" />
            <span>{showSchema ? 'Ocultar SQL Schema' : 'Ver SQL Schema para Inicialização'}</span>
          </button>

          {showSchema && (
            <div className="relative group">
              <pre className="bg-black/50 border border-white/5 rounded-xl p-4 text-[9px] font-mono text-zinc-400 overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                {schemaSql}
              </pre>
              <button 
                onClick={copySchema}
                className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Copiar SQL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[10px] text-red-500/80 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
            <ShieldAlert className="w-3 h-3" />
            <span>Erro de sincronia: Verifique as chaves ou a conexão com a internet.</span>
          </div>
          
          <button 
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-white transition-all px-1"
          >
            <Terminal className="w-3 h-3" />
            <span>{showSchema ? 'Ocultar SQL Schema' : 'Ver SQL Schema para Inicialização'}</span>
          </button>

          {showSchema && (
            <div className="relative group">
              <pre className="bg-black/50 border border-white/5 rounded-xl p-4 text-[9px] font-mono text-zinc-400 overflow-x-auto max-h-40 custom-scrollbar leading-relaxed">
                {schemaSql}
              </pre>
              <button 
                onClick={copySchema}
                className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="Copiar SQL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
