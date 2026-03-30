-- ================================================================
-- PRESUPUESTOS, CONTRATOS Y PLANTILLAS POR SUBVENCIÓN
-- Workflow: reunión → proveedor → presupuesto → contrato → expediente
-- ================================================================

-- Presupuestos (solicitudes de cotización a proveedores)
CREATE TABLE IF NOT EXISTS presupuestos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
  proveedor_id  UUID REFERENCES proveedores(id),
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  importe       NUMERIC(12,2),
  estado        TEXT NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','enviado','recibido','aprobado','rechazado')),
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_respuesta TIMESTAMPTZ,
  fecha_validez   DATE,
  archivo_url     TEXT,
  notas           TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos (vinculados a un presupuesto aprobado)
CREATE TABLE IF NOT EXISTS contratos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES expediente(id) ON DELETE CASCADE,
  proveedor_id    UUID REFERENCES proveedores(id),
  presupuesto_id  UUID REFERENCES presupuestos(id),
  titulo          TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'servicio'
                  CHECK (tipo IN ('servicio','suministro','colaboracion','confidencialidad','otro')),
  estado          TEXT NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador','enviado','firmado','rescindido')),
  importe         NUMERIC(12,2),
  fecha_firma     DATE,
  fecha_inicio    DATE,
  fecha_fin       DATE,
  archivo_url     TEXT,
  notas           TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas por tipo de subvención
-- Una plantilla puede estar ligada a una subvención concreta o solo a un organismo/categoría
CREATE TABLE IF NOT EXISTS subvencion_plantillas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  subvencion_id   UUID REFERENCES subvenciones(id) ON DELETE SET NULL,
  organismo       TEXT,       -- p.ej. 'Red.es', 'IDAE', 'CDTI'
  categoria       TEXT,       -- tag libre: 'digitalizacion', 'eficiencia_energetica', etc.
  checklist_items JSONB DEFAULT '[]'::jsonb,  -- [{nombre, tipo, categoria, obligatorio}]
  documentos_tipo TEXT[] DEFAULT '{}',
  notas_plantilla TEXT,
  activa          BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Proveedores recomendados por plantilla (con rol y orden)
CREATE TABLE IF NOT EXISTS plantilla_proveedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id    UUID NOT NULL REFERENCES subvencion_plantillas(id) ON DELETE CASCADE,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  rol             TEXT,           -- 'implementador', 'consultor', 'certificador', 'auditor', etc.
  obligatorio     BOOLEAN DEFAULT false,
  orden           INTEGER DEFAULT 0,
  notas           TEXT,
  UNIQUE(plantilla_id, proveedor_id)
);

-- RLS
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE subvencion_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantilla_proveedores ENABLE ROW LEVEL SECURITY;

-- Admins y gestores pueden hacer todo
CREATE POLICY "admin_all_presupuestos" ON presupuestos
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','gestor','tramitador')));

CREATE POLICY "admin_all_contratos" ON contratos
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','gestor','tramitador')));

CREATE POLICY "admin_all_plantillas" ON subvencion_plantillas
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','gestor','tramitador')));

CREATE POLICY "admin_all_plantilla_proveedores" ON plantilla_proveedores
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','gestor','tramitador')));

-- Triggers updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_presupuestos_updated_at') THEN
    CREATE TRIGGER trg_presupuestos_updated_at BEFORE UPDATE ON presupuestos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contratos_updated_at') THEN
    CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON contratos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_plantillas_updated_at') THEN
    CREATE TRIGGER trg_plantillas_updated_at BEFORE UPDATE ON subvencion_plantillas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_presupuestos_expediente ON presupuestos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_proveedor ON presupuestos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_contratos_expediente ON contratos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_plantilla_proveedores_plantilla ON plantilla_proveedores(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_subvencion_plantillas_subvencion ON subvencion_plantillas(subvencion_id);
