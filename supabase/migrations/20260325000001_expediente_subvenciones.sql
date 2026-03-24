-- ============================================================================
-- AMPLIAR EXPEDIENTE PARA INTEGRACIÓN CON SUBVENCIONES
-- Fecha: 2026-03-25
-- · Añade título, organismo, subvencion_id, notas a expediente
-- · Expande el CHECK de estado para incluir 'en_tramitacion'
-- ============================================================================

ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS titulo          TEXT,
  ADD COLUMN IF NOT EXISTS organismo       TEXT,
  ADD COLUMN IF NOT EXISTS subvencion_id   UUID REFERENCES public.subvenciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas           TEXT;

-- Ampliar CHECK de estado: dropeamos la restricción vieja y la recreamos
DO $$
BEGIN
  ALTER TABLE public.expediente
    DROP CONSTRAINT IF EXISTS expediente_estado_check;
  ALTER TABLE public.expediente
    ADD CONSTRAINT expediente_estado_check
      CHECK (estado IN (
        'lead_caliente', 'en_proceso', 'presentado', 'resuelto', 'descartado',
        'en_tramitacion', 'activo', 'cancelado'
      ));
END $$;

CREATE INDEX IF NOT EXISTS idx_expediente_subv ON public.expediente(subvencion_id);
