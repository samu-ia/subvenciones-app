-- ================================================================
-- PORTAL PROVEEDOR + FEE INFRASTRUCTURE (3% dormido)
-- ================================================================

-- 1. Añadir rol proveedor a perfiles
ALTER TABLE perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('admin','gestor','tramitador','cliente','proveedor'));

-- 2. Fee proveedor en contratos (dormido — se activa cuando quieran cobrar)
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS fee_proveedor_porcentaje NUMERIC(5,2) DEFAULT 3.00,
  ADD COLUMN IF NOT EXISTS fee_proveedor_importe    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS fee_proveedor_estado     TEXT DEFAULT 'pendiente'
    CHECK (fee_proveedor_estado IN ('pendiente','facturado','cobrado','exento')),
  ADD COLUMN IF NOT EXISTS fee_activo               BOOLEAN DEFAULT false;

-- Trigger: cuando contrato se marca firmado y fee_activo=true,
-- calcular fee_proveedor_importe automáticamente
CREATE OR REPLACE FUNCTION calcular_fee_proveedor()
RETURNS TRIGGER LANGUAGE plpgsql AS $func$
BEGIN
  IF NEW.estado = 'firmado' AND NEW.fee_activo = true AND NEW.importe IS NOT NULL THEN
    NEW.fee_proveedor_importe := ROUND(NEW.importe * NEW.fee_proveedor_porcentaje / 100, 2);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_fee_proveedor ON contratos;
CREATE TRIGGER trg_fee_proveedor
  BEFORE UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION calcular_fee_proveedor();

-- 3. Vincular proveedores a usuarios auth (para portal)
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS anos_experiencia INTEGER,
  ADD COLUMN IF NOT EXISTS zona_geografica TEXT[],
  ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_proveedores_user_id ON proveedores(user_id);

-- 4. RLS: proveedor ve sus propios datos
-- expediente_proveedores: proveedor ve las filas donde él está
CREATE POLICY IF NOT EXISTS "proveedor_ve_sus_asignaciones"
  ON expediente_proveedores
  FOR SELECT
  USING (
    proveedor_id IN (
      SELECT id FROM proveedores WHERE user_id = auth.uid()
    )
  );

-- presupuestos: proveedor ve y edita los suyos
CREATE POLICY IF NOT EXISTS "proveedor_ve_sus_presupuestos"
  ON presupuestos FOR SELECT
  USING (
    proveedor_id IN (SELECT id FROM proveedores WHERE user_id = auth.uid())
  );

CREATE POLICY IF NOT EXISTS "proveedor_edita_sus_presupuestos"
  ON presupuestos FOR UPDATE
  USING (
    proveedor_id IN (SELECT id FROM proveedores WHERE user_id = auth.uid())
  );

-- contratos: proveedor ve los suyos
CREATE POLICY IF NOT EXISTS "proveedor_ve_sus_contratos"
  ON contratos FOR SELECT
  USING (
    proveedor_id IN (SELECT id FROM proveedores WHERE user_id = auth.uid())
  );

-- 5. Vista útil para el portal proveedor
CREATE OR REPLACE VIEW vista_proveedor_expedientes AS
SELECT
  ep.id AS asignacion_id,
  ep.expediente_id,
  ep.proveedor_id,
  ep.estado AS estado_asignacion,
  ep.motivo_match,
  e.titulo,
  e.organismo,
  e.fase,
  e.importe_solicitado,
  e.importe_concedido,
  c.nombre_normalizado AS cliente_nombre,
  p.nombre AS proveedor_nombre,
  pr.titulo AS presupuesto_titulo,
  pr.importe AS presupuesto_importe,
  pr.estado AS presupuesto_estado,
  ct.titulo AS contrato_titulo,
  ct.estado AS contrato_estado,
  ct.importe AS contrato_importe,
  ct.fee_proveedor_importe,
  ct.fee_proveedor_estado,
  ct.fee_activo
FROM expediente_proveedores ep
JOIN expediente e ON e.id = ep.expediente_id
JOIN proveedores p ON p.id = ep.proveedor_id
LEFT JOIN cliente c ON c.nif = e.nif
LEFT JOIN presupuestos pr ON pr.expediente_id = e.id AND pr.proveedor_id = ep.proveedor_id
LEFT JOIN contratos ct ON ct.expediente_id = e.id AND ct.proveedor_id = ep.proveedor_id;
