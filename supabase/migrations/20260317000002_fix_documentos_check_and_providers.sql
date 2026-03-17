-- ============================================================================
-- Fix: Eliminar CHECK restrictivo de tipo_documento + arreglar ia_providers
-- ============================================================================

-- 1. Eliminar el CHECK constraint de tipo_documento (demasiado restrictivo)
--    Permite cualquier string: 'nota', 'notas', 'preparacion', 'guion', etc.
DO $$ BEGIN
  ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_tipo_documento_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Asegurarse de que tipo_documento tiene un default válido
ALTER TABLE public.documentos
  ALTER COLUMN tipo_documento SET DEFAULT 'nota';

-- 2. Asegurar que ia_providers tiene constraint UNIQUE(user_id, provider)
--    necesaria para el upsert con onConflict: 'user_id,provider'
DO $$ BEGIN
  ALTER TABLE public.ia_providers
    ADD CONSTRAINT ia_providers_user_provider_unique UNIQUE (user_id, provider);
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3. Asegurar que ia_tool_configs tiene constraint UNIQUE(user_id, tool)
DO $$ BEGIN
  ALTER TABLE public.ia_tool_configs
    ADD CONSTRAINT ia_tool_configs_user_tool_unique UNIQUE (user_id, tool);
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Asegurar RLS + políticas en ia_providers e ia_tool_configs
ALTER TABLE public.ia_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_tool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_tool_executions ENABLE ROW LEVEL SECURITY;

-- Políticas para ia_providers
DROP POLICY IF EXISTS "ia_providers_select" ON public.ia_providers;
DROP POLICY IF EXISTS "ia_providers_insert" ON public.ia_providers;
DROP POLICY IF EXISTS "ia_providers_update" ON public.ia_providers;
DROP POLICY IF EXISTS "ia_providers_delete" ON public.ia_providers;

CREATE POLICY "ia_providers_select" ON public.ia_providers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ia_providers_insert" ON public.ia_providers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ia_providers_update" ON public.ia_providers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ia_providers_delete" ON public.ia_providers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Políticas para ia_tool_configs
DROP POLICY IF EXISTS "ia_tool_configs_select" ON public.ia_tool_configs;
DROP POLICY IF EXISTS "ia_tool_configs_insert" ON public.ia_tool_configs;
DROP POLICY IF EXISTS "ia_tool_configs_update" ON public.ia_tool_configs;
DROP POLICY IF EXISTS "ia_tool_configs_delete" ON public.ia_tool_configs;

CREATE POLICY "ia_tool_configs_select" ON public.ia_tool_configs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ia_tool_configs_insert" ON public.ia_tool_configs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ia_tool_configs_update" ON public.ia_tool_configs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ia_tool_configs_delete" ON public.ia_tool_configs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Políticas para ia_tool_executions
DROP POLICY IF EXISTS "ia_tool_executions_select" ON public.ia_tool_executions;
DROP POLICY IF EXISTS "ia_tool_executions_insert" ON public.ia_tool_executions;

CREATE POLICY "ia_tool_executions_select" ON public.ia_tool_executions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ia_tool_executions_insert" ON public.ia_tool_executions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Asegurar columnas necesarias en documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS contenido TEXT,
  ADD COLUMN IF NOT EXISTS generado_por_ia BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
