-- ============================================================================
-- LIMPIEZA Y REORGANIZACIÓN DE BASE DE DATOS
-- Fecha: 2026-03-16
-- Descripción: Eliminar tablas obsoletas y mantener solo lo esencial
-- ============================================================================

-- 1. ELIMINAR TABLAS OBSOLETAS QUE YA NO SE USAN
-- ============================================================================

-- Tablas de funcionalidad eliminada (oportunidades, matches, ayudas)
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS oportunidades CASCADE;
DROP TABLE IF EXISTS ayudas CASCADE;

-- Tablas de configuración IA que ya no se usan
DROP TABLE IF EXISTS asistentes CASCADE;
DROP TABLE IF EXISTS configuracion_ia CASCADE;
DROP TABLE IF EXISTS proveedores_ia CASCADE;

-- Tablas de documentos duplicadas/obsoletas
DROP TABLE IF EXISTS checklist_items CASCADE;


-- 2. MANTENER Y LIMPIAR TABLAS ESENCIALES
-- ============================================================================

-- Tabla CLIENTE: Información básica del cliente (SE MANTIENE)
-- Ya existe, solo aseguramos que tenga los campos correctos
ALTER TABLE public.cliente 
  DROP COLUMN IF EXISTS acepta_terminos,
  DROP COLUMN IF EXISTS origen;

-- Agregar campos faltantes si no existen
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'cliente' AND column_name = 'ubicacion') THEN
    ALTER TABLE public.cliente ADD COLUMN ubicacion TEXT;
  END IF;
END $$;

-- Tabla EINFORMA: Datos empresariales enriquecidos (SE MANTIENE)
-- Ya existe y está bien estructurada

-- Tabla EXPEDIENTE: Gestión de expedientes de subvenciones (SE MANTIENE)
-- Ya existe y está bien estructurada

-- Tabla REUNIONES: Sistema de reuniones operativo (SE MANTIENE Y LIMPIA)
-- Eliminar campos que referencian tablas borradas
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'reuniones' AND column_name = 'oportunidad_id') THEN
    ALTER TABLE public.reuniones DROP COLUMN oportunidad_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'reuniones' AND column_name = 'busqueda_profunda_realizada') THEN
    ALTER TABLE public.reuniones 
      DROP COLUMN busqueda_profunda_realizada,
      DROP COLUMN busqueda_profunda_resultado,
      DROP COLUMN busqueda_profunda_fecha,
      DROP COLUMN guion_generado,
      DROP COLUMN resumen_generado,
      DROP COLUMN presentacion_generada_url;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'reuniones' AND column_name = 'created_by') THEN
    ALTER TABLE public.reuniones 
      DROP COLUMN created_by,
      DROP COLUMN updated_by;
  END IF;
END $$;

-- Tabla DOCUMENTOS: Sistema simple de documentos (SE LIMPIA Y SIMPLIFICA)
-- Eliminar referencias a tablas borradas
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'documentos' AND column_name = 'oportunidad_id') THEN
    ALTER TABLE public.documentos 
      DROP COLUMN oportunidad_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'documentos' AND column_name = 'reunion_id') THEN
    ALTER TABLE public.documentos 
      DROP COLUMN reunion_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'documentos' AND column_name = 'autor_id') THEN
    ALTER TABLE public.documentos 
      DROP COLUMN autor_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'documentos' AND column_name = 'storage_path') THEN
    ALTER TABLE public.documentos 
      DROP COLUMN storage_path,
      DROP COLUMN mime_type,
      DROP COLUMN tamano_bytes;
  END IF;
  
  -- Agregar campo de contenido si no existe (para editor inline)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'documentos' AND column_name = 'contenido') THEN
    ALTER TABLE public.documentos ADD COLUMN contenido TEXT;
  END IF;
END $$;

-- Tabla NOTAS: Sistema de notas (SE LIMPIA)
-- Eliminar referencias a tablas borradas
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'notas' AND column_name = 'ayuda_id') THEN
    ALTER TABLE public.notas 
      DROP COLUMN ayuda_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'notas' AND column_name = 'autor_id') THEN
    ALTER TABLE public.notas 
      DROP COLUMN autor_id;
  END IF;
END $$;


-- 3. LIMPIAR ÍNDICES OBSOLETOS
-- ============================================================================

DROP INDEX IF EXISTS idx_matches_nif;
DROP INDEX IF EXISTS idx_matches_ayuda_id;
DROP INDEX IF EXISTS idx_checklist_expediente;
DROP INDEX IF EXISTS idx_notas_ayuda;
DROP INDEX IF EXISTS reuniones_oportunidad_id;


-- 4. CREAR ÍNDICES OPTIMIZADOS
-- ============================================================================

-- Índices para cliente
CREATE INDEX IF NOT EXISTS idx_cliente_nombre ON public.cliente(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_cliente_ciudad ON public.cliente(ciudad);

-- Índices para reuniones
CREATE INDEX IF NOT EXISTS idx_reuniones_cliente ON public.reuniones(cliente_nif);
CREATE INDEX IF NOT EXISTS idx_reuniones_fecha ON public.reuniones(fecha_programada DESC);
CREATE INDEX IF NOT EXISTS idx_reuniones_estado ON public.reuniones(estado);

-- Índices para expedientes
CREATE INDEX IF NOT EXISTS idx_expediente_nif ON public.expediente(nif);
CREATE INDEX IF NOT EXISTS idx_expediente_estado ON public.expediente(estado);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_documentos_expediente ON public.documentos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON public.documentos(cliente_nif);

-- Índices para notas
CREATE INDEX IF NOT EXISTS idx_notas_expediente ON public.notas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_notas_cliente ON public.notas(nif);


-- 5. RESUMEN DE LA ESTRUCTURA FINAL
-- ============================================================================

COMMENT ON TABLE public.cliente IS 'Información básica de clientes';
COMMENT ON TABLE public.einforma IS 'Datos empresariales enriquecidos de eInforma';
COMMENT ON TABLE public.expediente IS 'Gestión de expedientes de subvenciones';
COMMENT ON TABLE public.reuniones IS 'Sistema de gestión de reuniones con clientes';
COMMENT ON TABLE public.documentos IS 'Documentos asociados a clientes y expedientes';
COMMENT ON TABLE public.notas IS 'Notas y anotaciones sobre clientes y expedientes';


-- 6. VERIFICAR ROW LEVEL SECURITY
-- ============================================================================

-- Asegurarse de que RLS está habilitado en tablas importantes
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- FIN DE LA MIGRACIÓN DE LIMPIEZA
-- ============================================================================
