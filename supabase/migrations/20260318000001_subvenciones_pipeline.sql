-- ============================================================================
-- PIPELINE DE INGESTIÓN DE SUBVENCIONES BDNS
-- Fecha: 2026-03-18
-- Flujo: BDNS raw → PDF → texto → IA → normalizado → actualizaciones
-- ============================================================================

-- ─── 1. TABLA RAW ────────────────────────────────────────────────────────────
-- Almacena la respuesta cruda de BDNS tal cual llega.
-- Nunca se modifica. Es el archivo histórico de lo que hemos recibido.

CREATE TABLE IF NOT EXISTS public.subvenciones_raw (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bdns_id         TEXT NOT NULL UNIQUE,        -- identificador oficial BDNS
  fuente          TEXT NOT NULL DEFAULT 'bdns', -- 'bdns' | 'boe' | 'mcp' | 'manual'
  raw_json        JSONB NOT NULL,               -- respuesta original de la API
  url_fuente      TEXT,                         -- URL de donde se obtuvo
  hash_raw        TEXT NOT NULL,                -- SHA256 del raw_json serializado
  fecha_ingesta   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_raw_bdns_id ON public.subvenciones_raw(bdns_id);
CREATE INDEX IF NOT EXISTS idx_subv_raw_hash    ON public.subvenciones_raw(hash_raw);

-- ─── 2. TABLA PDF ─────────────────────────────────────────────────────────────
-- Registro de cada PDF descargado asociado a una subvención raw.

CREATE TABLE IF NOT EXISTS public.subvenciones_pdf (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id          UUID NOT NULL REFERENCES public.subvenciones_raw(id) ON DELETE CASCADE,
  bdns_id         TEXT NOT NULL,
  url_pdf         TEXT NOT NULL,
  storage_path    TEXT,                         -- ruta en Supabase Storage
  hash_pdf        TEXT,                         -- SHA256 del binario del PDF
  tamanio_bytes   BIGINT,
  num_paginas     INTEGER,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','descargado','error_descarga','no_disponible')),
  error_msg       TEXT,
  intentos        INTEGER DEFAULT 0,
  descargado_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_pdf_raw_id  ON public.subvenciones_pdf(raw_id);
CREATE INDEX IF NOT EXISTS idx_subv_pdf_bdns_id ON public.subvenciones_pdf(bdns_id);
CREATE INDEX IF NOT EXISTS idx_subv_pdf_estado  ON public.subvenciones_pdf(estado);

-- ─── 3. TABLA TEXTO ──────────────────────────────────────────────────────────
-- Texto extraído del PDF (bruto y limpio), separado del binario.

CREATE TABLE IF NOT EXISTS public.subvenciones_texto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id          UUID NOT NULL REFERENCES public.subvenciones_pdf(id) ON DELETE CASCADE,
  raw_id          UUID NOT NULL REFERENCES public.subvenciones_raw(id) ON DELETE CASCADE,
  bdns_id         TEXT NOT NULL,
  texto_bruto     TEXT,                         -- texto tal cual sale de pdfjs
  texto_limpio    TEXT,                         -- texto con limpieza básica
  hash_texto      TEXT,                         -- SHA256 del texto_limpio
  num_caracteres  INTEGER,
  num_palabras    INTEGER,
  necesita_ocr    BOOLEAN DEFAULT false,        -- si el PDF está escaneado
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','extraido','error_extraccion','necesita_ocr')),
  error_msg       TEXT,
  extraido_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_texto_raw_id ON public.subvenciones_texto(raw_id);
CREATE INDEX IF NOT EXISTS idx_subv_texto_estado ON public.subvenciones_texto(estado);

-- ─── 4. TABLA PRINCIPAL NORMALIZADA ──────────────────────────────────────────
-- Dato final limpio y estructurado. Es la tabla que usa el producto.

CREATE TABLE IF NOT EXISTS public.subvenciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id                UUID REFERENCES public.subvenciones_raw(id) ON DELETE SET NULL,
  bdns_id               TEXT NOT NULL UNIQUE,
  fuente                TEXT NOT NULL DEFAULT 'bdns',

  -- Identificación
  titulo                TEXT NOT NULL,
  organismo             TEXT,
  departamento          TEXT,
  ambito_geografico     TEXT,         -- 'nacional' | 'autonomico' | 'local'
  comunidad_autonoma    TEXT,
  provincia             TEXT,

  -- Descripción
  objeto                TEXT,
  resumen_ia            TEXT,         -- resumen generado por IA, legible para producto
  puntos_clave          TEXT[],       -- array de bullets generados por IA
  para_quien            TEXT,         -- descripción general del beneficiario ideal (sin matching)

  -- Plazos e importes
  fecha_publicacion     DATE,
  plazo_inicio          DATE,
  plazo_fin             DATE,
  plazo_presentacion    TEXT,         -- texto libre si no es fecha exacta
  importe_maximo        NUMERIC,
  importe_minimo        NUMERIC,
  porcentaje_financiacion NUMERIC,    -- 0-100
  presupuesto_total     NUMERIC,

  -- URLs
  url_oficial           TEXT,
  url_pdf               TEXT,
  url_bases_reguladoras TEXT,

  -- Estado
  estado_convocatoria   TEXT NOT NULL DEFAULT 'desconocido'
                        CHECK (estado_convocatoria IN (
                          'abierta','cerrada','proxima','suspendida','resuelta','desconocido'
                        )),

  -- Control de calidad / pipeline
  pipeline_estado       TEXT NOT NULL DEFAULT 'raw'
                        CHECK (pipeline_estado IN (
                          'raw','pdf_descargado','texto_extraido','ia_procesado','normalizado','error'
                        )),
  pipeline_error        TEXT,
  ia_procesado_at       TIMESTAMPTZ,
  ia_modelo             TEXT,         -- modelo de IA usado en la extracción
  ia_confidence         NUMERIC,      -- 0-1, confianza media del análisis

  -- Deduplicación / cambios
  hash_contenido        TEXT,         -- hash del contenido normalizado para detectar cambios
  version               INTEGER NOT NULL DEFAULT 1,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_bdns_id       ON public.subvenciones(bdns_id);
CREATE INDEX IF NOT EXISTS idx_subv_estado_conv   ON public.subvenciones(estado_convocatoria);
CREATE INDEX IF NOT EXISTS idx_subv_pipeline      ON public.subvenciones(pipeline_estado);
CREATE INDEX IF NOT EXISTS idx_subv_plazo_fin     ON public.subvenciones(plazo_fin);
CREATE INDEX IF NOT EXISTS idx_subv_organismo     ON public.subvenciones(organismo);
CREATE INDEX IF NOT EXISTS idx_subv_ambito        ON public.subvenciones(ambito_geografico);
CREATE INDEX IF NOT EXISTS idx_subv_updated       ON public.subvenciones(updated_at);

-- ─── 5. TABLA REQUISITOS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvencion_requisitos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  tipo            TEXT,               -- 'juridico' | 'economico' | 'sector' | 'otro'
  descripcion     TEXT NOT NULL,
  obligatorio     BOOLEAN DEFAULT true,
  orden           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_req_subv_id ON public.subvencion_requisitos(subvencion_id);

-- ─── 6. TABLA GASTOS SUBVENCIONABLES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvencion_gastos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  categoria       TEXT,               -- 'personal' | 'equipamiento' | 'servicios' | 'otros'
  descripcion     TEXT NOT NULL,
  porcentaje_max  NUMERIC,
  notas           TEXT,
  orden           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_gastos_subv_id ON public.subvencion_gastos(subvencion_id);

-- ─── 7. TABLA DOCUMENTACIÓN REQUERIDA ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvencion_documentacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  obligatorio     BOOLEAN DEFAULT true,
  orden           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_docs_subv_id ON public.subvencion_documentacion(subvencion_id);

-- ─── 8. TABLA SECTORES ───────────────────────────────────────────────────────
-- Sectores o CNAE a los que aplica la subvención

CREATE TABLE IF NOT EXISTS public.subvencion_sectores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  cnae_codigo     TEXT,               -- código CNAE si lo hay
  nombre_sector   TEXT NOT NULL,
  excluido        BOOLEAN DEFAULT false, -- true = este sector está excluido
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_sect_subv_id ON public.subvencion_sectores(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_subv_sect_cnae     ON public.subvencion_sectores(cnae_codigo);

-- ─── 9. TABLA TIPOS DE EMPRESA ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvencion_tipos_empresa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,      -- 'pyme' | 'micropyme' | 'grande' | 'autonomo' | 'startup' | 'otro'
  descripcion     TEXT,
  excluido        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_tipos_subv_id ON public.subvencion_tipos_empresa(subvencion_id);

-- ─── 10. TABLA ACTUALIZACIONES (historial de cambios) ────────────────────────

CREATE TABLE IF NOT EXISTS public.subvencion_actualizaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id   UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id         TEXT NOT NULL,
  tipo_cambio     TEXT NOT NULL,      -- 'nuevo_pdf' | 'plazo_ampliado' | 'importe_cambiado' | 'estado_cambiado' | 'datos_actualizados'
  resumen_cambio  TEXT,
  campos_cambiados TEXT[],            -- lista de campos que cambiaron
  raw_before      JSONB,              -- snapshot del raw antes
  raw_after       JSONB,              -- snapshot del raw después
  hash_antes      TEXT,
  hash_despues    TEXT,
  detectada_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_upd_subv_id ON public.subvencion_actualizaciones(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_subv_upd_tipo    ON public.subvencion_actualizaciones(tipo_cambio);

-- ─── 11. TABLA LOG DE INGESTA (jobs diarios) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subvenciones_ingesta_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_ingesta   DATE NOT NULL DEFAULT CURRENT_DATE,
  fuente          TEXT NOT NULL DEFAULT 'bdns',
  estado          TEXT NOT NULL DEFAULT 'running'
                  CHECK (estado IN ('running','completado','error','parcial')),
  total_consultadas INTEGER DEFAULT 0,
  nuevas          INTEGER DEFAULT 0,
  actualizadas    INTEGER DEFAULT 0,
  sin_cambios     INTEGER DEFAULT 0,
  errores         INTEGER DEFAULT 0,
  duracion_ms     BIGINT,
  parametros      JSONB DEFAULT '{}'::jsonb,  -- parámetros usados (fecha_desde, etc.)
  error_msg       TEXT,
  iniciado_at     TIMESTAMPTZ DEFAULT NOW(),
  completado_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingesta_log_fecha  ON public.subvenciones_ingesta_log(fecha_ingesta);
CREATE INDEX IF NOT EXISTS idx_ingesta_log_estado ON public.subvenciones_ingesta_log(estado);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Las tablas de subvenciones son de lectura pública (datos oficiales)
-- Solo el sistema (service_role) puede escribir

ALTER TABLE public.subvenciones_raw              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_pdf              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_texto            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_requisitos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_gastos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_documentacion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_sectores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_tipos_empresa      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_actualizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvenciones_ingesta_log      ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados
CREATE POLICY "subvenciones_read" ON public.subvenciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_req_read" ON public.subvencion_requisitos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_gastos_read" ON public.subvencion_gastos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_docs_read" ON public.subvencion_documentacion
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_sectores_read" ON public.subvencion_sectores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_tipos_read" ON public.subvencion_tipos_empresa
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subvencion_upd_read" ON public.subvencion_actualizaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_raw_read" ON public.subvenciones_raw
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_pdf_read" ON public.subvenciones_pdf
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_texto_read" ON public.subvenciones_texto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ingesta_log_read" ON public.subvenciones_ingesta_log
  FOR SELECT TO authenticated USING (true);
