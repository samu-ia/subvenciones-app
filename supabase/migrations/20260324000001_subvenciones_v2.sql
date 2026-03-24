-- ============================================================================
-- SUBVENCIONES V2: MULTI-DOCUMENTO, GROUNDING IA, ESTADO CALCULADO
-- Fecha: 2026-03-24
-- Amplía el pipeline v1 con:
--   · subvencion_documentos       — registro de cada documento (PDF) por tipo
--   · subvencion_campos_extraidos — grounding: qué campo, de qué doc, con qué fragmento
--   · subvencion_eventos          — timeline de eventos detectados (apertura, cierre, etc.)
--   · subvencion_estado_calculado — estado derivado de fechas + eventos (máquina de estados)
--   · subvencion_conflictos       — conflictos entre documentos o entre IA y BDNS
--   · subvencion_reanalisis_jobs  — cola de reprocesado manual/auto
-- ============================================================================

-- ─── 1. TABLA DOCUMENTOS ─────────────────────────────────────────────────────
-- Un registro por cada PDF descargado asociado a una subvención.
-- Tipos: extracto (BDNS), convocatoria, bases_reguladoras, correccion,
--        ampliacion, resolucion, otro

CREATE TABLE IF NOT EXISTS public.subvencion_documentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,
  tipo_documento    TEXT NOT NULL DEFAULT 'extracto'
                    CHECK (tipo_documento IN (
                      'extracto','convocatoria','bases_reguladoras',
                      'correccion','ampliacion','resolucion','otro'
                    )),
  titulo            TEXT,                         -- nombre descriptivo del doc
  url_origen        TEXT NOT NULL,                -- URL de donde se descargó
  storage_path      TEXT,                         -- ruta en Supabase Storage
  hash_pdf          TEXT,                         -- SHA256 del binario
  tamanio_bytes     BIGINT,
  num_paginas       INTEGER,
  texto_extraido    TEXT,                         -- texto limpio del PDF
  hash_texto        TEXT,                         -- SHA256 del texto
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN (
                      'pendiente','descargado','texto_extraido',
                      'ia_procesado','error','no_disponible'
                    )),
  error_msg         TEXT,
  intentos          INTEGER DEFAULT 0,
  es_principal      BOOLEAN DEFAULT false,        -- true = doc base para extracción
  fecha_documento   DATE,                         -- fecha del documento (si se extrae)
  orden             INTEGER DEFAULT 0,            -- orden de procesado (correccion > extracto)
  descargado_at     TIMESTAMPTZ,
  procesado_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subv_doc_sub_id  ON public.subvencion_documentos(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_subv_doc_bdns_id ON public.subvencion_documentos(bdns_id);
CREATE INDEX IF NOT EXISTS idx_subv_doc_tipo    ON public.subvencion_documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_subv_doc_estado  ON public.subvencion_documentos(estado);

-- ─── 2. TABLA CAMPOS EXTRAIDOS (GROUNDING) ───────────────────────────────────
-- Un registro por campo por documento por análisis.
-- Permite ver exactamente de dónde sacó la IA cada dato.

CREATE TABLE IF NOT EXISTS public.subvencion_campos_extraidos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  documento_id      UUID REFERENCES public.subvencion_documentos(id) ON DELETE SET NULL,
  bdns_id           TEXT NOT NULL,

  -- Identificación del campo
  nombre_campo      TEXT NOT NULL,               -- ej: 'plazo_fin', 'importe_maximo'
  valor_texto       TEXT,                        -- valor como string para display
  valor_json        JSONB,                       -- valor estructurado (arrays, objetos)

  -- Trazabilidad
  fragmento_texto   TEXT,                        -- fragmento del doc del que se extrajo
  pagina_estimada   INTEGER,                     -- página aproximada del PDF
  metodo            TEXT NOT NULL DEFAULT 'ia'
                    CHECK (metodo IN ('ia','regex','bdns_raw','manual','calculado')),
  modelo_ia         TEXT,                        -- modelo usado si metodo='ia'
  confidence        NUMERIC CHECK (confidence >= 0 AND confidence <= 1),

  -- Estado
  revisado          BOOLEAN DEFAULT false,       -- un admin confirmó este dato
  revisado_at       TIMESTAMPTZ,
  revisado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  override_manual   BOOLEAN DEFAULT false,       -- fue sobreescrito manualmente

  -- Versión (para historial)
  version           INTEGER DEFAULT 1,
  supersedido_por   UUID REFERENCES public.subvencion_campos_extraidos(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campo_sub_id   ON public.subvencion_campos_extraidos(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_campo_doc_id   ON public.subvencion_campos_extraidos(documento_id);
CREATE INDEX IF NOT EXISTS idx_campo_nombre   ON public.subvencion_campos_extraidos(nombre_campo);
CREATE INDEX IF NOT EXISTS idx_campo_bdns_id  ON public.subvencion_campos_extraidos(bdns_id);

-- ─── 3. TABLA EVENTOS ────────────────────────────────────────────────────────
-- Timeline de eventos detectados en la subvención.
-- Fuente: IA, BDNS, documentos, sistema.

CREATE TABLE IF NOT EXISTS public.subvencion_eventos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  documento_id      UUID REFERENCES public.subvencion_documentos(id) ON DELETE SET NULL,
  bdns_id           TEXT NOT NULL,

  tipo_evento       TEXT NOT NULL
                    CHECK (tipo_evento IN (
                      'publicacion','apertura_plazo','cierre_plazo',
                      'correccion','ampliacion_plazo','suspension',
                      'resolucion','pago','otro'
                    )),
  fecha_evento      DATE,                        -- fecha del evento (si se conoce)
  fecha_evento_fin  DATE,                        -- fecha fin (para rangos)
  titulo            TEXT,                        -- descripción breve
  descripcion       TEXT,                        -- descripción detallada
  fuente            TEXT NOT NULL DEFAULT 'ia'
                    CHECK (fuente IN ('ia','bdns','sistema','manual')),
  fragmento_texto   TEXT,                        -- evidencia del texto
  pagina_estimada   INTEGER,
  confidence        NUMERIC CHECK (confidence >= 0 AND confidence <= 1),

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evento_sub_id  ON public.subvencion_eventos(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_evento_tipo    ON public.subvencion_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_evento_fecha   ON public.subvencion_eventos(fecha_evento);
CREATE INDEX IF NOT EXISTS idx_evento_bdns_id ON public.subvencion_eventos(bdns_id);

-- ─── 4. TABLA ESTADO CALCULADO ───────────────────────────────────────────────
-- Estado derivado por la máquina de estados (no opinión de IA).
-- Se recalcula cada vez que hay nuevos eventos o cambio de fechas.

CREATE TABLE IF NOT EXISTS public.subvencion_estado_calculado (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL UNIQUE REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,

  estado            TEXT NOT NULL DEFAULT 'desconocido'
                    CHECK (estado IN (
                      'abierta','cerrada','proxima','suspendida','resuelta','desconocido'
                    )),
  razon             TEXT,                        -- explicación de por qué este estado
  dias_para_cierre  INTEGER,                     -- null si ya cerrada o sin fecha
  urgente           BOOLEAN DEFAULT false,       -- true si cierra en <= 15 días
  calculado_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Inputs usados para el cálculo
  plazo_inicio_usado DATE,
  plazo_fin_usado    DATE,
  tiene_evento_suspension BOOLEAN DEFAULT false,
  tiene_evento_resolucion BOOLEAN DEFAULT false,
  tiene_evento_ampliacion BOOLEAN DEFAULT false,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estado_calc_sub_id ON public.subvencion_estado_calculado(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_estado_calc_estado ON public.subvencion_estado_calculado(estado);
CREATE INDEX IF NOT EXISTS idx_estado_calc_urgente ON public.subvencion_estado_calculado(urgente);

-- ─── 5. TABLA CONFLICTOS ─────────────────────────────────────────────────────
-- Conflictos detectados entre documentos o entre IA y datos BDNS.

CREATE TABLE IF NOT EXISTS public.subvencion_conflictos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,

  tipo_conflicto    TEXT NOT NULL
                    CHECK (tipo_conflicto IN (
                      'fecha_inconsistente','importe_inconsistente',
                      'estado_inconsistente','documento_contradice_bdns',
                      'documento_contradice_documento','dato_dudoso','otro'
                    )),
  campo_afectado    TEXT,                        -- campo en conflicto (ej: 'plazo_fin')
  valor_a           TEXT,                        -- valor fuente A
  fuente_a          TEXT,                        -- descripción de fuente A
  valor_b           TEXT,                        -- valor fuente B
  fuente_b          TEXT,                        -- descripción de fuente B
  descripcion       TEXT,                        -- descripción del conflicto
  severidad         TEXT NOT NULL DEFAULT 'media'
                    CHECK (severidad IN ('baja','media','alta')),
  resuelto          BOOLEAN DEFAULT false,
  resolucion        TEXT,                        -- cómo se resolvió
  resuelto_at       TIMESTAMPTZ,
  resuelto_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicto_sub_id ON public.subvencion_conflictos(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_conflicto_tipo   ON public.subvencion_conflictos(tipo_conflicto);
CREATE INDEX IF NOT EXISTS idx_conflicto_resuelto ON public.subvencion_conflictos(resuelto);

-- ─── 6. TABLA JOBS DE REANÁLISIS ─────────────────────────────────────────────
-- Cola de reprocesado: admin o sistema encola subvenciones para reanalizar.

CREATE TABLE IF NOT EXISTS public.subvencion_reanalisis_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  bdns_id           TEXT NOT NULL,

  tipo_job          TEXT NOT NULL DEFAULT 'reanalisis_completo'
                    CHECK (tipo_job IN (
                      'reanalisis_completo','solo_ia','solo_estado','solo_documentos'
                    )),
  prioridad         INTEGER DEFAULT 5,           -- 1=alta, 10=baja
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','procesando','completado','error','cancelado')),
  motivo            TEXT,                        -- por qué se encoló
  solicitado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_msg         TEXT,
  intentos          INTEGER DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  iniciado_at       TIMESTAMPTZ,
  completado_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reanalisis_sub_id  ON public.subvencion_reanalisis_jobs(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_reanalisis_estado  ON public.subvencion_reanalisis_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_reanalisis_prioridad ON public.subvencion_reanalisis_jobs(prioridad);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.subvencion_documentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_campos_extraidos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_estado_calculado   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_conflictos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subvencion_reanalisis_jobs    ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados
CREATE POLICY "subv_docs_read" ON public.subvencion_documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_campos_read" ON public.subvencion_campos_extraidos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_eventos_read" ON public.subvencion_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_estado_calc_read" ON public.subvencion_estado_calculado
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_conflictos_read" ON public.subvencion_conflictos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subv_reanalisis_read" ON public.subvencion_reanalisis_jobs
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar jobs de reanálisis
CREATE POLICY "subv_reanalisis_insert" ON public.subvencion_reanalisis_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Trigger para updated_at en documentos
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subv_doc_updated_at'
  ) THEN
    CREATE TRIGGER trg_subv_doc_updated_at
      BEFORE UPDATE ON public.subvencion_documentos
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_estado_calc_updated_at'
  ) THEN
    CREATE TRIGGER trg_estado_calc_updated_at
      BEFORE UPDATE ON public.subvencion_estado_calculado
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
