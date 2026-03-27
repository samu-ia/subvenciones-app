-- Añadir columna onboarding_data a perfiles para guardar respuestas del wizard de onboarding
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.perfiles.onboarding_data IS 'Respuestas del wizard de onboarding: actividad, prioridades, preferencias';
