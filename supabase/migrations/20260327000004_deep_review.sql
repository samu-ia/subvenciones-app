-- Añade deep_review al match para guardar el análisis profundo por PDF
ALTER TABLE public.cliente_subvencion_match
  ADD COLUMN IF NOT EXISTS deep_review JSONB,
  ADD COLUMN IF NOT EXISTS deep_review_at TIMESTAMPTZ;

COMMENT ON COLUMN public.cliente_subvencion_match.deep_review IS
  'Análisis profundo generado por Gemini leyendo el PDF real de la convocatoria. Incluye: elegible, probabilidad, requisitos por item, documentacion_necesaria, preguntas_para_cliente, riesgos, recomendacion.';

COMMENT ON COLUMN public.cliente_subvencion_match.deep_review_at IS
  'Fecha del último deep review. NULL = pendiente de analizar.';

CREATE INDEX IF NOT EXISTS idx_match_deep_review_null
  ON public.cliente_subvencion_match(nif, score DESC)
  WHERE deep_review IS NULL AND es_hard_exclude = FALSE;
