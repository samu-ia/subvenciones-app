-- ============================================================================
-- ONBOARDING + FACTURA — columnas para onboarding de perfiles y facturas en expediente
-- 2026-03-27
-- ============================================================================

-- 1) perfiles: flag de onboarding completado
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT FALSE;

-- 2) perfiles: datos del wizard de onboarding (idempotente con 20260329000002)
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB;

-- 3) expediente: URL de la factura asociada
ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS factura_url TEXT;

-- 4) expediente: número de factura
ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS factura_numero TEXT;

-- 5) expediente: importe concedido de la subvención
ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS importe_subvencion NUMERIC;

-- 6) Índice parcial: localizar rápido perfiles que NO han completado onboarding
CREATE INDEX IF NOT EXISTS idx_perfiles_onboarding
  ON public.perfiles(onboarding_completado)
  WHERE onboarding_completado = FALSE;

-- Comentarios descriptivos
COMMENT ON COLUMN public.perfiles.onboarding_completado IS 'TRUE cuando el usuario ha completado el wizard de onboarding';
COMMENT ON COLUMN public.perfiles.onboarding_data IS 'Respuestas del wizard de onboarding: actividad, prioridades, preferencias';
COMMENT ON COLUMN public.expediente.factura_url IS 'URL del archivo de factura subido (Storage)';
COMMENT ON COLUMN public.expediente.factura_numero IS 'Número de factura para la justificación';
COMMENT ON COLUMN public.expediente.importe_subvencion IS 'Importe concedido de la subvención en euros';
