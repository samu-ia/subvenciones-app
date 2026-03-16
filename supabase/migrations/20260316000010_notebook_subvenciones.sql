-- ============================================================================
-- NOTEBOOK INTELIGENTE - SISTEMA DE SUBVENCIONES DETECTADAS
-- Fecha: 2026-03-16
-- Descripción: Tablas para el sistema de análisis de subvenciones tipo NotebookLM
-- ============================================================================

-- ─── 1. TABLA DE SUBVENCIONES DETECTADAS ─────────────────────────────────────
-- Cada registro representa una subvención detectada por la IA para una reunión

CREATE TABLE IF NOT EXISTS public.subvenciones_detectadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id    UUID REFERENCES public.reuniones(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES public.expediente(id) ON DELETE CASCADE,
  nif           TEXT REFERENCES public.cliente(nif) ON DELETE CASCADE,

  -- Datos de la subvención
  titulo        TEXT NOT NULL,
  organismo     TEXT,
  descripcion   TEXT,
  importe_max   NUMERIC,
  plazo_inicio  DATE,
  plazo_fin     DATE,
  estado_conv   TEXT CHECK (estado_conv IN ('abierta', 'cerrada', 'proxima', 'por_confirmar')) DEFAULT 'por_confirmar',
  url_oficial   TEXT,
  numero_bdns   TEXT,  -- enlace opcional a tabla ayudas

  -- Análisis IA
  resumen_ia    TEXT,
  motivo_match  TEXT,
  puntuacion    INTEGER CHECK (puntuacion >= 1 AND puntuacion <= 10),
  encaja        BOOLEAN DEFAULT true,
  motivo_rechazo TEXT,

  -- Documentos faltantes detectados
  docs_faltantes TEXT[],

  -- Estado del expediente relacionado
  estado_expediente TEXT CHECK (estado_expediente IN (
    'detectada', 'revisando', 'viable', 'preparando', 'presentada', 'concedida', 'denegada', 'descartada'
  )) DEFAULT 'detectada',

  -- ¿Se presentó? ¿Se concedió? (para dataset futuro)
  presentada    BOOLEAN,
  concedida     BOOLEAN,
  importe_concedido NUMERIC,

  -- Metadata flexible (JSON adicional de la IA)
  metadata      JSONB DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Al menos reunion_id o expediente_id debe existir
  CONSTRAINT subvenciones_contexto_check CHECK (
    reunion_id IS NOT NULL OR expediente_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_subv_det_reunion ON public.subvenciones_detectadas(reunion_id);
CREATE INDEX IF NOT EXISTS idx_subv_det_expediente ON public.subvenciones_detectadas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_subv_det_nif ON public.subvenciones_detectadas(nif);

COMMENT ON TABLE public.subvenciones_detectadas IS 
  'Subvenciones detectadas por IA durante el análisis de una reunión o expediente. Dataset de aprendizaje.';


-- ─── 2. TABLA DE CHECKLIST POR SUBVENCIÓN ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvenciones_checklist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id  UUID NOT NULL REFERENCES public.subvenciones_detectadas(id) ON DELETE CASCADE,
  orden          INTEGER DEFAULT 0,
  texto          TEXT NOT NULL,
  completado     BOOLEAN DEFAULT false,
  obligatorio    BOOLEAN DEFAULT true,
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_check_subvencion ON public.subvenciones_checklist(subvencion_id);

COMMENT ON TABLE public.subvenciones_checklist IS 
  'Checklist de requisitos por subvención detectada';


-- ─── 3. RELACIÓN DOCUMENTOS ↔ SUBVENCIÓN ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvenciones_documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id UUID NOT NULL REFERENCES public.subvenciones_detectadas(id) ON DELETE CASCADE,
  documento_id  UUID REFERENCES public.documentos(id) ON DELETE CASCADE,
  archivo_id    UUID REFERENCES public.archivos(id) ON DELETE CASCADE,
  tipo          TEXT CHECK (tipo IN ('bases_oficiales', 'analisis', 'documentacion_cliente', 'generado_ia', 'otro')) DEFAULT 'otro',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subv_doc_check CHECK (documento_id IS NOT NULL OR archivo_id IS NOT NULL)
);

COMMENT ON TABLE public.subvenciones_documentos IS 
  'Documentos y archivos asociados a una subvención detectada';


-- ─── 4. TABLA DE INVESTIGACIONES (LOG DE DEEP SEARCH) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.investigaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id    UUID REFERENCES public.reuniones(id) ON DELETE CASCADE,
  expediente_id UUID REFERENCES public.expediente(id) ON DELETE CASCADE,
  nif           TEXT REFERENCES public.cliente(nif),

  -- Datos usados en la búsqueda
  datos_cliente JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Estado de la investigación
  estado        TEXT CHECK (estado IN ('pendiente', 'ejecutando', 'completada', 'error')) DEFAULT 'pendiente',

  -- Resultado
  num_subvenciones_encontradas INTEGER DEFAULT 0,
  documento_id  UUID REFERENCES public.documentos(id),  -- doc investigacion_subvenciones.md
  resumen       TEXT,
  error_msg     TEXT,

  -- Modelo usado
  proveedor     TEXT,
  modelo        TEXT,
  tokens_usados INTEGER,
  duracion_ms   INTEGER,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_investigaciones_reunion ON public.investigaciones(reunion_id);

COMMENT ON TABLE public.investigaciones IS 
  'Log de investigaciones de búsqueda profunda para trazabilidad y mejora del sistema';


-- ─── 5. AÑADIR COLUMNAS A REUNIONES (datos snapshot del cliente) ───────────────

DO $$
BEGIN
  -- Snapshot de datos del cliente en el momento de la reunión
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'reuniones' AND column_name = 'cliente_snapshot') THEN
    ALTER TABLE public.reuniones ADD COLUMN cliente_snapshot JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Estado de la investigación de subvenciones
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'reuniones' AND column_name = 'investigacion_estado') THEN
    ALTER TABLE public.reuniones ADD COLUMN investigacion_estado TEXT 
      CHECK (investigacion_estado IN ('pendiente', 'ejecutando', 'completada', 'error'))
      DEFAULT 'pendiente';
  END IF;

  -- Número de subvenciones detectadas (desnormalizado para UI rápida)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'reuniones' AND column_name = 'num_subvenciones') THEN
    ALTER TABLE public.reuniones ADD COLUMN num_subvenciones INTEGER DEFAULT 0;
  END IF;
END $$;


-- ─── 6. FUNCIÓN: actualizar updated_at automáticamente ────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subvenciones_detectadas_updated_at
  BEFORE UPDATE ON public.subvenciones_detectadas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 7. RLS POLICIES ──────────────────────────────────────────────────────────

ALTER TABLE public.subvenciones_detectadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_checklist  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigaciones         ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados (ajustar según necesidad)
CREATE POLICY "auth_users_subvenciones_detectadas" ON public.subvenciones_detectadas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_users_subvenciones_checklist" ON public.subvenciones_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_users_subvenciones_documentos" ON public.subvenciones_documentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_users_investigaciones" ON public.investigaciones
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
