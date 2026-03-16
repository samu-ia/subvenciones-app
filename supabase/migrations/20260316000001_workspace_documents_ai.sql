-- ============================================================================
-- WORKSPACE UNIFICADO - SOPORTE PARA DOCUMENTOS E IA CONTEXTUAL
-- Fecha: 2026-03-16
-- Descripción: Mejoras para sistema de documentos con IA
-- ============================================================================

-- 1. MEJORAR TABLA DOCUMENTOS
-- ============================================================================

-- Agregar columnas para mejor gestión de documentos
DO $$ 
BEGIN
  -- Tipo de documento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'tipo_documento') THEN
    ALTER TABLE public.documentos ADD COLUMN tipo_documento TEXT;
  END IF;
  
  -- Metadata flexible
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'metadata') THEN
    ALTER TABLE public.documentos ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Generado por IA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'generado_por_ia') THEN
    ALTER TABLE public.documentos ADD COLUMN generado_por_ia BOOLEAN DEFAULT false;
  END IF;
  
  -- Prompt usado para generar
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'prompt_usado') THEN
    ALTER TABLE public.documentos ADD COLUMN prompt_usado TEXT;
  END IF;
  
  -- Asociación con reunión
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'reunion_id') THEN
    ALTER TABLE public.documentos ADD COLUMN reunion_id UUID REFERENCES reuniones(id) ON DELETE CASCADE;
  END IF;
  
  -- Orden de visualización
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'orden') THEN
    ALTER TABLE public.documentos ADD COLUMN orden INTEGER DEFAULT 0;
  END IF;
END $$;


-- 2. CREAR TABLA DE ARCHIVOS ADJUNTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES expediente(id) ON DELETE CASCADE,
  reunion_id UUID REFERENCES reuniones(id) ON DELETE CASCADE,
  nif TEXT REFERENCES cliente(nif) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes BIGINT,
  texto_extraido TEXT, -- Para RAG
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Al menos uno debe estar presente
  CONSTRAINT archivos_contexto_check CHECK (
    expediente_id IS NOT NULL OR 
    reunion_id IS NOT NULL OR 
    nif IS NOT NULL
  )
);

COMMENT ON TABLE public.archivos IS 'Archivos adjuntos (PDFs, documentos) con texto extraído para IA';


-- 3. CREAR TABLA DE INTERACCIONES CON IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ia_interacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'chat', 'generacion', 'busqueda_profunda', 'edicion'
  contexto_id UUID NOT NULL,
  contexto_tipo TEXT NOT NULL, -- 'reunion' o 'expediente'
  prompt TEXT NOT NULL,
  respuesta TEXT,
  documentos_usados UUID[],
  archivos_usados UUID[],
  modelo TEXT, -- 'gpt-4', 'gpt-3.5-turbo', etc.
  tokens_usados INTEGER,
  duracion_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT ia_tipo_check CHECK (tipo IN ('chat', 'generacion', 'busqueda_profunda', 'edicion', 'resumen', 'checklist')),
  CONSTRAINT ia_contexto_check CHECK (contexto_tipo IN ('reunion', 'expediente'))
);

COMMENT ON TABLE public.ia_interacciones IS 'Historial de interacciones con IA para trazabilidad';


-- 4. CREAR ÍNDICES OPTIMIZADOS
-- ============================================================================

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_documentos_reunion ON public.documentos(reunion_id) WHERE reunion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_orden ON public.documentos(expediente_id, orden) WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON public.documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_ia ON public.documentos(generado_por_ia) WHERE generado_por_ia = true;

-- Índices para archivos
CREATE INDEX IF NOT EXISTS idx_archivos_expediente ON public.archivos(expediente_id) WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archivos_reunion ON public.archivos(reunion_id) WHERE reunion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archivos_cliente ON public.archivos(nif) WHERE nif IS NOT NULL;

-- Índices para IA interacciones
CREATE INDEX IF NOT EXISTS idx_ia_contexto ON public.ia_interacciones(contexto_tipo, contexto_id);
CREATE INDEX IF NOT EXISTS idx_ia_tipo ON public.ia_interacciones(tipo);
CREATE INDEX IF NOT EXISTS idx_ia_created ON public.ia_interacciones(created_at DESC);


-- 5. HABILITAR ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_interacciones ENABLE ROW LEVEL SECURITY;


-- 6. VALORES POR DEFECTO Y TRIGGERS
-- ============================================================================

-- Trigger para actualizar updated_at en documentos si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'updated_at') THEN
    ALTER TABLE public.documentos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Function para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger en documentos
DROP TRIGGER IF EXISTS update_documentos_updated_at ON public.documentos;
CREATE TRIGGER update_documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
