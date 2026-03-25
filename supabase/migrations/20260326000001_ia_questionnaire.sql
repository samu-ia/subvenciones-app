-- IA Questionnaire: extend solicitudes + match notifications

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS preguntas_ia       JSONB,
  ADD COLUMN IF NOT EXISTS respuestas_ia      JSONB,
  ADD COLUMN IF NOT EXISTS informe_viabilidad TEXT;

ALTER TABLE cliente_subvencion_match
  ADD COLUMN IF NOT EXISTS notificado_admin      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_cliente    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_cliente_at TIMESTAMPTZ;
