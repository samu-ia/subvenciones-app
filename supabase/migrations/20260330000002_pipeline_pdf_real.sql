-- Migración: Pipeline PDF Real
-- Añade columnas para tracking de PDF real y campos extraídos estructurados
-- Crea bucket de Storage para almacenar los PDFs de convocatorias

-- 1. Nuevas columnas en subvenciones
ALTER TABLE subvenciones
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_procesado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pdf_disponible BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS campos_extraidos JSONB;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_subvenciones_pdf_procesado ON subvenciones(pdf_procesado) WHERE pdf_procesado = FALSE;
CREATE INDEX IF NOT EXISTS idx_subvenciones_pdf_disponible ON subvenciones(pdf_disponible) WHERE pdf_disponible = FALSE;

-- 2. Crear bucket de Storage para PDFs (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'convocatorias-pdf',
  'convocatorias-pdf',
  FALSE,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage
-- Service role tiene acceso total (ya viene por defecto)
-- Usuarios autenticados pueden leer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read convocatorias PDFs'
  ) THEN
    CREATE POLICY "Authenticated users can read convocatorias PDFs"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'convocatorias-pdf');
  END IF;
END
$$;

-- 4. Comentarios
COMMENT ON COLUMN subvenciones.pdf_url IS 'URL del PDF real descargado (puede ser BDNS extracto, bases reguladoras, o convocatoria)';
COMMENT ON COLUMN subvenciones.pdf_procesado IS 'TRUE si el PDF fue enviado a Gemini y los 15 campos fueron extraídos';
COMMENT ON COLUMN subvenciones.pdf_disponible IS 'FALSE si no se encontró PDF en ninguna fuente';
COMMENT ON COLUMN subvenciones.campos_extraidos IS 'JSONB con los 15 campos estructurados extraídos por Gemini del PDF real';
