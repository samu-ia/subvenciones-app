-- ============================================================================
-- FASES DE EXPEDIENTE + ALERTAS
-- Fecha: 2026-03-28
-- · Añade columnas de fase y fechas clave al expediente
-- · Crea tabla alertas para alertas manuales y automáticas
-- ============================================================================

-- ─── 1. COLUMNAS DE FASE Y FECHAS EN EXPEDIENTE ──────────────────────────────

ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'preparacion',
  ADD COLUMN IF NOT EXISTS fase_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plazo_solicitud DATE,             -- plazo para presentar
  ADD COLUMN IF NOT EXISTS fecha_presentacion DATE,          -- fecha real de presentación
  ADD COLUMN IF NOT EXISTS fecha_resolucion_provisional DATE,-- cuando se publica RP
  ADD COLUMN IF NOT EXISTS fecha_alegaciones_fin DATE,       -- fin del plazo de alegaciones (RP + 15 días)
  ADD COLUMN IF NOT EXISTS fecha_resolucion_definitiva DATE, -- cuando se publica RD
  ADD COLUMN IF NOT EXISTS plazo_aceptacion DATE,            -- plazo para aceptar (CRÍTICO)
  ADD COLUMN IF NOT EXISTS fecha_inicio_ejecucion DATE,      -- inicio del período de ejecución
  ADD COLUMN IF NOT EXISTS fecha_fin_ejecucion DATE,         -- fin del período de ejecución
  ADD COLUMN IF NOT EXISTS plazo_justificacion DATE,         -- plazo para presentar justificación
  ADD COLUMN IF NOT EXISTS fecha_cobro DATE,                 -- fecha real de cobro
  ADD COLUMN IF NOT EXISTS importe_solicitado NUMERIC,       -- importe solicitado en la solicitud
  ADD COLUMN IF NOT EXISTS importe_concedido NUMERIC;        -- importe concedido en resolución

-- CHECK constraint para fase (idempotente vía DO block)
DO $$
BEGIN
  ALTER TABLE public.expediente DROP CONSTRAINT IF EXISTS expediente_fase_check;
  ALTER TABLE public.expediente ADD CONSTRAINT expediente_fase_check
    CHECK (fase IN (
      'preparacion',          -- preparando documentación y memoria
      'presentada',           -- solicitud presentada, esperando resolución
      'instruccion',          -- en revisión por la administración (3-6 meses)
      'resolucion_provisional',-- resolución provisional emitida (15 días alegaciones)
      'alegaciones',          -- presentando alegaciones
      'resolucion_definitiva',-- resolución definitiva emitida
      'aceptacion',           -- CRÍTICO: cliente debe aceptar en 10-15 días
      'ejecucion',            -- ejecutando el proyecto
      'justificacion',        -- presentando justificación de gastos
      'cobro',                -- cobro recibido
      'denegada',             -- solicitud denegada
      'desistida'             -- cliente desistió
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_expediente_fase ON public.expediente(fase);

-- ─── 2. TABLA ALERTAS ────────────────────────────────────────────────────────
-- Almacena alertas manuales y las auto-generadas que el admin confirma/resuelve

CREATE TABLE IF NOT EXISTS public.alertas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL,    -- ver CHECK abajo
  prioridad     TEXT NOT NULL DEFAULT 'media',
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  expediente_id UUID REFERENCES public.expediente(id) ON DELETE CASCADE,
  nif           TEXT REFERENCES public.cliente(nif) ON DELETE CASCADE,
  fecha_limite  DATE,             -- fecha límite asociada a la alerta
  resuelta      BOOLEAN DEFAULT false,
  resuelta_at   TIMESTAMPTZ,
  auto_generada BOOLEAN DEFAULT false,  -- true = creada por el sistema automáticamente
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_tipo_check;
  ALTER TABLE public.alertas ADD CONSTRAINT alertas_tipo_check
    CHECK (tipo IN (
      'plazo_solicitud',       -- deadline para presentar próximo
      'plazo_aceptacion',      -- CRÍTICO: debe aceptar resolución
      'plazo_alegaciones',     -- 15 días para presentar alegaciones
      'plazo_justificacion',   -- plazo de justificación próximo
      'plazo_ejecucion',       -- fin de ejecución próximo
      'match_nuevo',           -- nuevo match de alta puntuación
      'solicitud_pendiente',   -- solicitud esperando acción del admin
      'expediente_parado',     -- expediente sin actividad > 30 días
      'custom'                 -- alerta manual
    ));

  ALTER TABLE public.alertas DROP CONSTRAINT IF EXISTS alertas_prioridad_check;
  ALTER TABLE public.alertas ADD CONSTRAINT alertas_prioridad_check
    CHECK (prioridad IN ('critica', 'alta', 'media', 'baja'));
END $$;

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_admin_all" ON public.alertas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE INDEX IF NOT EXISTS idx_alertas_exp_id    ON public.alertas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_alertas_nif        ON public.alertas(nif);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta   ON public.alertas(resuelta);
CREATE INDEX IF NOT EXISTS idx_alertas_prioridad  ON public.alertas(prioridad);
CREATE INDEX IF NOT EXISTS idx_alertas_created    ON public.alertas(created_at DESC);
