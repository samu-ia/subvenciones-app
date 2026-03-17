-- ============================================================================
-- RLS POLICIES para archivos y documentos
-- Fecha: 2026-03-17
-- Problema: archivos tenía RLS activado pero sin políticas → bloqueaba todo
-- ============================================================================

-- ─── TABLA archivos ───────────────────────────────────────────────────────────

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "archivos_select" ON public.archivos;
DROP POLICY IF EXISTS "archivos_insert" ON public.archivos;
DROP POLICY IF EXISTS "archivos_update" ON public.archivos;
DROP POLICY IF EXISTS "archivos_delete" ON public.archivos;

-- Cualquier usuario autenticado puede ver/crear/editar/borrar archivos
CREATE POLICY "archivos_select"
  ON public.archivos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "archivos_insert"
  ON public.archivos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "archivos_update"
  ON public.archivos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "archivos_delete"
  ON public.archivos FOR DELETE
  TO authenticated
  USING (true);

-- ─── TABLA documentos (asegurar que también tiene políticas) ──────────────────

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_select" ON public.documentos;
DROP POLICY IF EXISTS "documentos_insert" ON public.documentos;
DROP POLICY IF EXISTS "documentos_update" ON public.documentos;
DROP POLICY IF EXISTS "documentos_delete" ON public.documentos;

CREATE POLICY "documentos_select"
  ON public.documentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "documentos_insert"
  ON public.documentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "documentos_update"
  ON public.documentos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "documentos_delete"
  ON public.documentos FOR DELETE
  TO authenticated
  USING (true);

-- ─── STORAGE bucket 'archivos' ────────────────────────────────────────────────
-- Asegurar que el bucket existe y es accesible

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archivos',
  'archivos',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'text/markdown',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de storage para el bucket 'archivos'
DROP POLICY IF EXISTS "storage_archivos_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_archivos_delete" ON storage.objects;

CREATE POLICY "storage_archivos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'archivos');

CREATE POLICY "storage_archivos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'archivos');

CREATE POLICY "storage_archivos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'archivos');

CREATE POLICY "storage_archivos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'archivos');
