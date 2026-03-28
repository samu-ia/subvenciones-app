-- ============================================================================
-- FIX COMPLETO - EJECUTAR EN SUPABASE SQL EDITOR
-- Ve a: supabase.com → tu proyecto → SQL Editor → pega todo esto y ejecuta
-- ============================================================================

-- ─── 1. TABLA documentos: añadir columnas que faltan ─────────────────────────

DO $$
BEGIN
  -- 'contenido' es la columna más importante (el texto del documento)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='contenido') THEN
    ALTER TABLE public.documentos ADD COLUMN contenido TEXT;
  END IF;

  -- 'nombre' puede que exista, si no la añadimos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='nombre') THEN
    ALTER TABLE public.documentos ADD COLUMN nombre TEXT NOT NULL DEFAULT 'Sin título';
  END IF;

  -- 'generado_por_ia' (el código lo usa así, no 'generado_con_ia')
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='generado_por_ia') THEN
    ALTER TABLE public.documentos ADD COLUMN generado_por_ia BOOLEAN DEFAULT false;
  END IF;

  -- 'tipo_documento' sin CHECK constraint restrictivo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='tipo_documento') THEN
    ALTER TABLE public.documentos ADD COLUMN tipo_documento TEXT DEFAULT 'nota';
  END IF;

  -- 'reunion_id'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='reunion_id') THEN
    ALTER TABLE public.documentos ADD COLUMN reunion_id UUID REFERENCES public.reuniones(id) ON DELETE CASCADE;
  END IF;

  -- 'expediente_id'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='expediente_id') THEN
    ALTER TABLE public.documentos ADD COLUMN expediente_id UUID;
  END IF;

  -- 'orden'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='orden') THEN
    ALTER TABLE public.documentos ADD COLUMN orden INTEGER DEFAULT 0;
  END IF;

  -- 'updated_at'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='updated_at') THEN
    ALTER TABLE public.documentos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- 'prompt_usado' para documentos generados por IA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='documentos' AND column_name='prompt_usado') THEN
    ALTER TABLE public.documentos ADD COLUMN prompt_usado TEXT;
  END IF;
END $$;

-- Eliminar CHECK constraint restrictivo en tipo_documento si existe
DO $$
BEGIN
  -- La migración 000004 creó un CHECK muy restrictivo, lo eliminamos
  ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_tipo_documento_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ─── 2. TABLA archivos: crear si no existe ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID,
  reunion_id UUID REFERENCES public.reuniones(id) ON DELETE CASCADE,
  nif TEXT,
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes BIGINT,
  texto_extraido TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Añadir columnas que podrían faltar en archivos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='archivos' AND column_name='reunion_id') THEN
    ALTER TABLE public.archivos ADD COLUMN reunion_id UUID REFERENCES public.reuniones(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='archivos' AND column_name='nif') THEN
    ALTER TABLE public.archivos ADD COLUMN nif TEXT;
  END IF;
END $$;


-- ─── 3. TABLAS ia_providers e ia_tool_configs ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ia_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'openrouter', 'azure', 'custom')),
  api_key TEXT,
  base_url TEXT,
  organization TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.ia_tool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_type VARCHAR(20) CHECK (workspace_type IN ('expediente', 'reunion', 'global')),
  tool VARCHAR(50) NOT NULL CHECK (tool IN ('notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search')),
  enabled BOOLEAN DEFAULT true,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  stream_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_type, tool)
);

CREATE TABLE IF NOT EXISTS public.ia_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  workspace_type VARCHAR(20) NOT NULL,
  tool VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  tokens_used INTEGER,
  execution_time_ms INTEGER,
  sources_used JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 4. RLS: habilitar y crear políticas permisivas ──────────────────────────

-- documentos
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_all" ON public.documentos;
CREATE POLICY "documentos_all" ON public.documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- archivos
ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "archivos_all" ON public.archivos;
CREATE POLICY "archivos_all" ON public.archivos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ia_providers
ALTER TABLE public.ia_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ia_providers_own" ON public.ia_providers;
CREATE POLICY "ia_providers_own" ON public.ia_providers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ia_tool_configs
ALTER TABLE public.ia_tool_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ia_tool_configs_own" ON public.ia_tool_configs;
CREATE POLICY "ia_tool_configs_own" ON public.ia_tool_configs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ia_tool_executions
ALTER TABLE public.ia_tool_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ia_executions_own" ON public.ia_tool_executions;
CREATE POLICY "ia_executions_own" ON public.ia_tool_executions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─── 5. STORAGE bucket 'archivos' ────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archivos', 'archivos', false, 52428800,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','text/csv','text/markdown',
        'image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DROP POLICY IF EXISTS "storage_archivos_all_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_all_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_all_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_all_delete" ON storage.objects;

CREATE POLICY "storage_archivos_all_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archivos');
CREATE POLICY "storage_archivos_all_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archivos');
CREATE POLICY "storage_archivos_all_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'archivos');
CREATE POLICY "storage_archivos_all_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'archivos');


-- ─── 6. Índices útiles ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documentos_reunion ON public.documentos(reunion_id) WHERE reunion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_expediente ON public.documentos(expediente_id) WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archivos_reunion ON public.archivos(reunion_id) WHERE reunion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ia_providers_user ON public.ia_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_tools_user ON public.ia_tool_configs(user_id);

-- ============================================================================
-- FIN. Si no hay errores, todo debería funcionar.
-- ============================================================================
