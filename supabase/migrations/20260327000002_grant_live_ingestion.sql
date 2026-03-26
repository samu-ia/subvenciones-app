-- ============================================================================
-- GRANT LIVE INGESTION: Arquitectura de ingestión viva por fases
-- Fecha: 2026-03-27
--
-- Nuevas tablas para el pipeline por fases:
--   · grant_documents       — documentos asociados a una convocatoria (PDFs)
--   · grant_versions        — versiones del análisis IA (snapshots)
--   · grant_field_values    — valores extraídos con grounding por versión
--   · grant_change_events   — log de cambios detectados entre versiones
--
-- Las tablas existentes (subvencion_documentos, subvencion_campos_extraidos,
-- subvencion_eventos, etc.) permanecen intactas. Este esquema coexiste.
-- ============================================================================

-- ─── 1. GRANT_DOCUMENTS ────────────────────────────────────────────────────────
-- Cada PDF descargado de una subvención, con estado propio del ciclo.
-- Reemplaza conceptualmente subvencion_documentos para el nuevo pipeline.

CREATE TABLE IF NOT EXISTS public.grant_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,

  tipo              TEXT NOT NULL DEFAULT 'extracto'
                    CHECK (tipo IN (
                      'extracto','convocatoria','bases_reguladoras',
                      'correccion','ampliacion','resolucion','otro'
                    )),
  titulo            TEXT,
  url_origen        TEXT NOT NULL,
  hash_pdf          TEXT,
  tamanio_bytes     BIGINT,
  num_paginas       INTEGER,
  texto_extraido    TEXT,
  hash_texto        TEXT,

  -- Estado del documento dentro del ciclo de fases
  fase_estado       TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (fase_estado IN (
                      'pendiente','descargado','texto_listo',
                      'ia_enviado','ia_procesado','error'
                    )),
  error_msg         TEXT,
  intentos          INTEGER DEFAULT 0,
  es_principal      BOOLEAN DEFAULT false,
  orden             INTEGER DEFAULT 0,

  descargado_at     TIMESTAMPTZ,
  texto_extraido_at TIMESTAMPTZ,
  ia_procesado_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdoc_subvencion ON public.grant_documents(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_gdoc_bdns       ON public.grant_documents(bdns_id);
CREATE INDEX IF NOT EXISTS idx_gdoc_fase       ON public.grant_documents(fase_estado);
CREATE INDEX IF NOT EXISTS idx_gdoc_tipo       ON public.grant_documents(tipo);

-- ─── 2. GRANT_VERSIONS ────────────────────────────────────────────────────────
-- Cada ejecución del pipeline para una subvención crea una versión.
-- Permite comparar entre ejecuciones y detectar drift.

CREATE TABLE IF NOT EXISTS public.grant_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,
  version_number    INTEGER NOT NULL DEFAULT 1,

  -- Qué fase del ciclo completó esta versión
  ciclo             INTEGER NOT NULL DEFAULT 1,
  fase_alcanzada    TEXT NOT NULL DEFAULT 'ingesta'
                    CHECK (fase_alcanzada IN (
                      'ingesta','descarga','extraccion_ia','normalizacion','validacion'
                    )),

  -- Modelo IA y métricas
  ia_modelo         TEXT,
  ia_confidence     NUMERIC CHECK (ia_confidence >= 0 AND ia_confidence <= 1),
  num_campos        INTEGER DEFAULT 0,
  num_conflictos    INTEGER DEFAULT 0,
  hash_snapshot     TEXT,          -- hash de todos los field_values → detectar cambios

  -- Estado de la versión
  estado            TEXT NOT NULL DEFAULT 'en_progreso'
                    CHECK (estado IN ('en_progreso','completada','error','supersedida')),
  error_msg         TEXT,

  documento_ids     UUID[],        -- documentos procesados en esta versión

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completada_at     TIMESTAMPTZ,

  UNIQUE(subvencion_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_gver_subvencion ON public.grant_versions(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_gver_bdns       ON public.grant_versions(bdns_id);
CREATE INDEX IF NOT EXISTS idx_gver_estado     ON public.grant_versions(estado);
CREATE INDEX IF NOT EXISTS idx_gver_ciclo      ON public.grant_versions(ciclo);

-- ─── 3. GRANT_FIELD_VALUES ─────────────────────────────────────────────────────
-- Cada valor extraído de un campo, vinculado a una versión y documento.
-- Grounding: fragmento, página, confianza, método.

CREATE TABLE IF NOT EXISTS public.grant_field_values (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id        UUID NOT NULL REFERENCES public.grant_versions(id) ON DELETE CASCADE,
  documento_id      UUID REFERENCES public.grant_documents(id) ON DELETE SET NULL,
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,

  -- Campo
  nombre_campo      TEXT NOT NULL,
  valor_texto       TEXT,
  valor_json        JSONB,

  -- Grounding (trazabilidad)
  fragmento_texto   TEXT,
  pagina_estimada   INTEGER,
  metodo            TEXT NOT NULL DEFAULT 'ia'
                    CHECK (metodo IN ('ia','regex','bdns_raw','manual','calculado')),
  modelo_ia         TEXT,
  confidence        NUMERIC CHECK (confidence >= 0 AND confidence <= 1),

  -- ¿Cambió vs versión anterior?
  es_cambio         BOOLEAN DEFAULT false,
  valor_anterior    TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gfv_version     ON public.grant_field_values(version_id);
CREATE INDEX IF NOT EXISTS idx_gfv_subvencion  ON public.grant_field_values(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_gfv_campo       ON public.grant_field_values(nombre_campo);
CREATE INDEX IF NOT EXISTS idx_gfv_documento   ON public.grant_field_values(documento_id);

-- ─── 4. GRANT_CHANGE_EVENTS ───────────────────────────────────────────────────
-- Log de cambios detectados entre versiones o entre fuentes.
-- Cubre: cambios de valor, conflictos, eventos de timeline.

CREATE TABLE IF NOT EXISTS public.grant_change_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  version_id        UUID REFERENCES public.grant_versions(id) ON DELETE SET NULL,
  bdns_id           TEXT NOT NULL,

  tipo_evento       TEXT NOT NULL
                    CHECK (tipo_evento IN (
                      -- Cambios de datos
                      'campo_nuevo','campo_actualizado','campo_eliminado',
                      -- Conflictos
                      'conflicto_fecha','conflicto_importe','conflicto_estado',
                      'dato_dudoso','documento_contradice',
                      -- Timeline
                      'apertura_plazo','cierre_plazo','suspension',
                      'ampliacion_plazo','resolucion','correccion',
                      -- Pipeline
                      'version_creada','fase_completada','error_fase',
                      'reanalisis_solicitado'
                    )),

  -- Detalle del cambio
  campo_afectado    TEXT,
  valor_anterior    TEXT,
  valor_nuevo       TEXT,
  fuente_anterior   TEXT,
  fuente_nueva      TEXT,
  descripcion       TEXT,

  -- Grounding del evento
  fragmento_texto   TEXT,
  pagina_estimada   INTEGER,
  confidence        NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  fuente            TEXT DEFAULT 'sistema'
                    CHECK (fuente IN ('ia','bdns','sistema','manual')),

  severidad         TEXT DEFAULT 'info'
                    CHECK (severidad IN ('info','baja','media','alta','critica')),

  -- ¿Procesado?
  procesado         BOOLEAN DEFAULT false,
  procesado_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gce_subvencion  ON public.grant_change_events(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_gce_version     ON public.grant_change_events(version_id);
CREATE INDEX IF NOT EXISTS idx_gce_tipo        ON public.grant_change_events(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_gce_severidad   ON public.grant_change_events(severidad);
CREATE INDEX IF NOT EXISTS idx_gce_created     ON public.grant_change_events(created_at);

-- ─── Columna de fase en subvenciones ───────────────────────────────────────────
-- Añadir columna pipeline_fase para el nuevo sistema por fases

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subvenciones' AND column_name = 'pipeline_fase'
  ) THEN
    ALTER TABLE public.subvenciones ADD COLUMN pipeline_fase TEXT DEFAULT 'pendiente'
      CHECK (pipeline_fase IN (
        'pendiente','ingesta','descarga','extraccion_ia','normalizacion','validacion','completado','error'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subvenciones' AND column_name = 'pipeline_ciclo'
  ) THEN
    ALTER TABLE public.subvenciones ADD COLUMN pipeline_ciclo INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subvenciones' AND column_name = 'version_actual_id'
  ) THEN
    ALTER TABLE public.subvenciones ADD COLUMN version_actual_id UUID
      REFERENCES public.grant_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.grant_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_field_values   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_change_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grant_docs_read" ON public.grant_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grant_versions_read" ON public.grant_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grant_field_values_read" ON public.grant_field_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "grant_change_events_read" ON public.grant_change_events
  FOR SELECT TO authenticated USING (true);

-- Service role: full access para el pipeline
CREATE POLICY "grant_docs_service" ON public.grant_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "grant_versions_service" ON public.grant_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "grant_field_values_service" ON public.grant_field_values
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "grant_change_events_service" ON public.grant_change_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Triggers updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_grant_doc_updated_at'
  ) THEN
    CREATE TRIGGER trg_grant_doc_updated_at
      BEFORE UPDATE ON public.grant_documents
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
