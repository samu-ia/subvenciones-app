-- ============================================================================
-- MATCHING Y SOLICITUDES
-- Fecha: 2026-03-24
-- · Amplía tabla cliente con campos de matching
-- · Tabla solicitudes: flujo Quiero esta → encaje → contrato → pago
-- ============================================================================

-- ─── 1. AMPLIAR TABLA CLIENTE ─────────────────────────────────────────────────

ALTER TABLE public.cliente
  ADD COLUMN IF NOT EXISTS nombre_empresa       TEXT,
  ADD COLUMN IF NOT EXISTS cnae_codigo          TEXT,         -- ej: '6201' (programación)
  ADD COLUMN IF NOT EXISTS cnae_descripcion     TEXT,
  ADD COLUMN IF NOT EXISTS comunidad_autonoma   TEXT,         -- ej: 'Madrid', 'Cataluña'
  ADD COLUMN IF NOT EXISTS provincia            TEXT,
  ADD COLUMN IF NOT EXISTS num_empleados        INTEGER,
  ADD COLUMN IF NOT EXISTS facturacion_anual    NUMERIC,      -- en euros
  ADD COLUMN IF NOT EXISTS forma_juridica       TEXT,         -- SL, SA, autonomo, cooperativa
  ADD COLUMN IF NOT EXISTS anos_antiguedad      INTEGER,
  ADD COLUMN IF NOT EXISTS descripcion_actividad TEXT,
  ADD COLUMN IF NOT EXISTS user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cliente_user_id  ON public.cliente(user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_cnae     ON public.cliente(cnae_codigo);
CREATE INDEX IF NOT EXISTS idx_cliente_ca       ON public.cliente(comunidad_autonoma);

-- ─── 2. AMPLIAR cliente_subvencion_match ──────────────────────────────────────

ALTER TABLE public.cliente_subvencion_match
  ADD COLUMN IF NOT EXISTS detalle_scoring JSONB,   -- breakdown del score por dimensión
  ADD COLUMN IF NOT EXISTS es_hard_exclude BOOLEAN DEFAULT false; -- descartada por hard filter

-- ─── 3. TABLA SOLICITUDES ────────────────────────────────────────────────────
-- Flujo completo desde que el cliente dice "Quiero esta" hasta expediente activo

CREATE TABLE IF NOT EXISTS public.solicitudes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nif                     TEXT NOT NULL,
  subvencion_id           UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  match_id                UUID REFERENCES public.cliente_subvencion_match(id) ON DELETE SET NULL,

  -- Estado del flujo
  estado                  TEXT NOT NULL DEFAULT 'pendiente_encaje'
                          CHECK (estado IN (
                            'pendiente_encaje',
                            'encaje_confirmado',
                            'contrato_pendiente',
                            'contrato_firmado',
                            'pago_pendiente',
                            'activo',
                            'rechazado',
                            'cancelado'
                          )),

  -- Paso 1: verificación de encaje (respuestas a 5 preguntas Sí/No)
  respuestas_encaje       JSONB,            -- [{pregunta, respuesta: true/false}]
  encaje_score            INTEGER,          -- 0-5 preguntas respondidas positivamente
  encaje_confirmado_at    TIMESTAMPTZ,

  -- Paso 2: contrato de éxito
  porcentaje_exito        NUMERIC DEFAULT 15,  -- % del importe subvencionado
  nombre_firmante         TEXT,
  dni_firmante            TEXT,
  contrato_firmado        BOOLEAN DEFAULT false,
  contrato_firmado_at     TIMESTAMPTZ,
  contrato_ip             TEXT,             -- IP del firmante (trazabilidad)
  contrato_texto_hash     TEXT,             -- hash del texto del contrato firmado

  -- Paso 3: método de pago
  metodo_pago             TEXT CHECK (metodo_pago IN ('tarjeta','transferencia','pendiente')),
  metodo_pago_referencia  TEXT,
  metodo_pago_ok          BOOLEAN DEFAULT false,
  metodo_pago_ok_at       TIMESTAMPTZ,

  -- Expediente generado (cuando admin activa)
  expediente_id           UUID REFERENCES public.expediente(id) ON DELETE SET NULL,

  -- Notas internas
  notas_admin             TEXT,
  rechazado_motivo        TEXT,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(nif, subvencion_id)   -- un cliente solo puede solicitar cada subvención una vez
);

ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- Cliente ve solo sus solicitudes
CREATE POLICY "solicitudes_cliente_select" ON public.solicitudes
  FOR SELECT USING (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND nif IS NOT NULL
    )
    OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Cliente puede insertar sus propias solicitudes
CREATE POLICY "solicitudes_cliente_insert" ON public.solicitudes
  FOR INSERT WITH CHECK (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND nif IS NOT NULL
    )
  );

-- Cliente puede actualizar sus propias solicitudes (para pasos del flujo)
CREATE POLICY "solicitudes_cliente_update" ON public.solicitudes
  FOR UPDATE USING (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND nif IS NOT NULL
    )
    OR EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_sol_nif          ON public.solicitudes(nif);
CREATE INDEX IF NOT EXISTS idx_sol_subv_id      ON public.solicitudes(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_sol_user_id      ON public.solicitudes(user_id);
CREATE INDEX IF NOT EXISTS idx_sol_estado       ON public.solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_sol_created      ON public.solicitudes(created_at DESC);

-- Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_solicitudes_updated_at'
  ) THEN
    CREATE TRIGGER trg_solicitudes_updated_at
      BEFORE UPDATE ON public.solicitudes
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
