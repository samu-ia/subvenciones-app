-- Título comercial generado por IA — en lenguaje de la calle para PYMEs
ALTER TABLE public.subvenciones
  ADD COLUMN IF NOT EXISTS titulo_comercial TEXT;

CREATE INDEX IF NOT EXISTS idx_subvenciones_titulo_comercial
  ON public.subvenciones(id) WHERE titulo_comercial IS NULL;
