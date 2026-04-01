-- Añadir columna pipeline_ciclo a subvenciones
-- Usada por pipeline-magistral.mjs para registrar el número de ciclo de procesamiento
ALTER TABLE subvenciones
  ADD COLUMN IF NOT EXISTS pipeline_ciclo INTEGER DEFAULT 1;
