-- ============================================================
-- JESUS I.A. 360° — Schema Definitivo v8 para Supabase
-- Autor: Jesus Martins Oliveira Junior
-- Correção: Garantia de existência de colunas antes de alteração
-- ============================================================

DO $$ 
BEGIN
    -- ─── PASSO 1: LIMPEZA DE DEPENDÊNCIAS (VIEWS) ──────────────
    DROP VIEW IF EXISTS public.v_memory_l1 CASCADE;
    DROP VIEW IF EXISTS public.v_memory_l2 CASCADE;
    DROP VIEW IF EXISTS public.v_memory_l3 CASCADE;
    DROP VIEW IF EXISTS public.v_search_stats CASCADE;

    -- ─── PASSO 2: CRIAÇÃO/REPARAÇÃO DE TABELAS ─────────────────
    
    -- Tabela: app_metadata
    CREATE TABLE IF NOT EXISTS public.app_metadata (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Tabela: sessions
    CREATE TABLE IF NOT EXISTS public.sessions (id TEXT PRIMARY KEY);
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS created_at BIGINT;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS updated_at BIGINT;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS archived_at BIGINT;
    ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

    -- Tabela: memory
    CREATE TABLE IF NOT EXISTS public.memory (id TEXT PRIMARY KEY);
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS role TEXT;
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS content TEXT;
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';
    ALTER TABLE public.memory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    
    -- Adiciona FK se não existir (ignora erro se já houver)
    BEGIN
        ALTER TABLE public.memory ADD CONSTRAINT memory_session_id_fkey 
        FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Tabela: search_history
    CREATE TABLE IF NOT EXISTS public.search_history (id TEXT PRIMARY KEY);
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS query TEXT;
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS type TEXT;
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]';
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS summary TEXT;
    ALTER TABLE public.search_history ADD COLUMN IF NOT EXISTS session_id TEXT;

    -- Tabela: youtube_videos
    CREATE TABLE IF NOT EXISTS public.youtube_videos (id UUID DEFAULT gen_random_uuid() PRIMARY KEY);
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS "videoId" TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS channel_title TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS thumbnail TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS link TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS uid TEXT;
    
    BEGIN
        ALTER TABLE public.youtube_videos ADD CONSTRAINT youtube_videos_videoId_session_id_key UNIQUE("videoId", session_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Tabela: cards
    CREATE TABLE IF NOT EXISTS public.cards (id TEXT PRIMARY KEY);
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS type TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS content TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_collapsed BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

    BEGIN
        ALTER TABLE public.cards ADD CONSTRAINT cards_session_id_fkey 
        FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Tabela: maps
    CREATE TABLE IF NOT EXISTS public.maps (id TEXT PRIMARY KEY);
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

    -- Tabela: photos
    CREATE TABLE IF NOT EXISTS public.photos (id TEXT PRIMARY KEY);
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS url TEXT;
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS timestamp BIGINT;
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

    -- Tabela: background_tasks
    CREATE TABLE IF NOT EXISTS public.background_tasks (id TEXT PRIMARY KEY);
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS uid TEXT;
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.background_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- ─── PASSO 3: LIMPEZA DE POLÍTICAS ─────────────────────────
    DROP POLICY IF EXISTS "acesso próprio" ON public.memory;
    DROP POLICY IF EXISTS "acesso próprio" ON public.sessions;
    DROP POLICY IF EXISTS "acesso próprio" ON public.search_history;
    DROP POLICY IF EXISTS "acesso próprio" ON public.cards;
    DROP POLICY IF EXISTS "acesso próprio" ON public.maps;
    DROP POLICY IF EXISTS "acesso próprio" ON public.photos;
    DROP POLICY IF EXISTS "acesso próprio" ON public.youtube_videos;
    DROP POLICY IF EXISTS "acesso próprio" ON public.background_tasks;
    DROP POLICY IF EXISTS "Allow all for authenticated users on app_metadata" ON public.app_metadata;

    -- ─── PASSO 4: NORMALIZAÇÃO DE TIPOS (TEXT) ─────────────────
    -- Agora garantimos que uid é NOT NULL e do tipo TEXT
    UPDATE public.sessions SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.sessions ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.sessions ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.memory SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.memory ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.memory ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.search_history SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.search_history ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.search_history ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.youtube_videos SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.youtube_videos ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.cards SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.cards ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.cards ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.maps SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.maps ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.maps ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.photos SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.photos ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.photos ALTER COLUMN uid TYPE text USING uid::text;

    UPDATE public.background_tasks SET uid = '' WHERE uid IS NULL;
    ALTER TABLE public.background_tasks ALTER COLUMN uid SET NOT NULL;
    ALTER TABLE public.background_tasks ALTER COLUMN uid TYPE text USING uid::text;

    -- ─── PASSO 5: RLS E NOVAS POLÍTICAS ────────────────────────
    ALTER TABLE public.app_metadata ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.memory ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.background_tasks ENABLE ROW LEVEL SECURITY;

    -- Admins: admjesusia@gmail.com, jesusmjunior2021@gmail.com, martjesusmartins@gmail.com
    
    CREATE POLICY "acesso próprio" ON public.app_metadata FOR ALL USING (
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.sessions FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.memory FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.search_history FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.youtube_videos FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.cards FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.maps FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.photos FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    CREATE POLICY "acesso próprio" ON public.background_tasks FOR ALL USING (
        auth.uid()::text = uid OR 
        auth.jwt() ->> 'email' IN ('admjesusia@gmail.com', 'jesusmjunior2021@gmail.com', 'martjesusmartins@gmail.com')
    );

    -- ─── PASSO 6: RECRIAÇÃO DE VIEWS ───────────────────────────
    CREATE OR REPLACE VIEW public.v_memory_l1 AS 
    SELECT * FROM public.memory 
    WHERE timestamp > (extract(epoch from now()) * 1000 - 86400000);

    CREATE OR REPLACE VIEW public.v_memory_l2 AS 
    SELECT * FROM public.memory 
    WHERE timestamp > (extract(epoch from now()) * 1000 - 604800000);

    CREATE OR REPLACE VIEW public.v_memory_l3 AS 
    SELECT * FROM public.memory;

    CREATE OR REPLACE VIEW public.v_search_stats AS
    SELECT type, count(*) as total
    FROM public.search_history
    GROUP BY type;

    -- ─── PASSO 7: REALTIME ─────────────────────────────────────
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_metadata;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.memory;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.search_history;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_videos;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.background_tasks;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.maps;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
    EXCEPTION WHEN OTHERS THEN NULL; END;

END $$;
