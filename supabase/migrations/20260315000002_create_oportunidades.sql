-- Crear tabla de oportunidades (fase de análisis y validación)
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nif VARCHAR(9) NOT NULL REFERENCES cliente(nif) ON DELETE CASCADE,
  ayuda_id UUID REFERENCES ayudas(id) ON DELETE SET NULL,
  
  -- Información básica de la oportunidad
  nombre_ayuda TEXT NOT NULL,
  organismo TEXT,
  importe_estimado DECIMAL(12,2),
  probabilidad_estimada INTEGER CHECK (probabilidad_estimada >= 0 AND probabilidad_estimada <= 100),
  
  -- Estado de la oportunidad
  estado VARCHAR(50) DEFAULT 'detectada' CHECK (estado IN (
    'detectada',
    'en_analisis',
    'pendiente_reunion',
    'presentada_cliente',
    'interesada',
    'descartada',
    'convertida_expediente'
  )),
  
  -- Análisis y research
  resumen_ayuda TEXT,
  requisitos TEXT,
  analisis_encaje TEXT,
  notebook JSONB, -- Notas estructuradas del análisis
  
  -- Reuniones explorativas asociadas
  reuniones_explorativas JSONB, -- Array de reuniones: [{fecha, asistentes, notas}]
  
  -- Documentación preliminar
  documentacion_preliminar TEXT[], -- URLs o referencias a docs
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  convertida_a_expediente_id UUID, -- Referencia al expediente si fue convertida
  
  CONSTRAINT fk_expediente FOREIGN KEY (convertida_a_expediente_id) 
    REFERENCES expediente(id) ON DELETE SET NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_oportunidades_cliente ON oportunidades(cliente_nif);
CREATE INDEX idx_oportunidades_ayuda ON oportunidades(ayuda_id);
CREATE INDEX idx_oportunidades_estado ON oportunidades(estado);
CREATE INDEX idx_oportunidades_convertida ON oportunidades(convertida_a_expediente_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_oportunidades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_oportunidades_updated_at
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION update_oportunidades_updated_at();

-- Modificar tabla expediente para incluir origen desde oportunidad
ALTER TABLE expediente 
  ADD COLUMN IF NOT EXISTS oportunidad_origen_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contrato_firmado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_fecha_firma DATE,
  ADD COLUMN IF NOT EXISTS contrato_porcentaje_exito DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS contrato_documento_url TEXT,
  ADD COLUMN IF NOT EXISTS partner_asignado TEXT,
  ADD COLUMN IF NOT EXISTS partner_fecha_envio DATE,
  ADD COLUMN IF NOT EXISTS partner_estado VARCHAR(50) CHECK (partner_estado IN (
    'pendiente',
    'enviado',
    'en_revision',
    'aprobado',
    'rechazado'
  )),
  ADD COLUMN IF NOT EXISTS partner_comentarios TEXT,
  ADD COLUMN IF NOT EXISTS seguimiento_estado VARCHAR(50) DEFAULT 'preparacion' CHECK (seguimiento_estado IN (
    'preparacion',
    'presentada',
    'en_revision',
    'subsanacion_requerida',
    'concedida',
    'denegada',
    'cobrada',
    'justificada'
  )),
  ADD COLUMN IF NOT EXISTS tareas JSONB, -- Array de tareas: [{descripcion, responsable, fecha_limite, completada}]
  ADD COLUMN IF NOT EXISTS documentos_fiscales TEXT[],
  ADD COLUMN IF NOT EXISTS documentos_legales TEXT[],
  ADD COLUMN IF NOT EXISTS presupuestos TEXT[],
  ADD COLUMN IF NOT EXISTS memoria_url TEXT,
  ADD COLUMN IF NOT EXISTS anexos TEXT[],
  ADD COLUMN IF NOT EXISTS justificantes TEXT[];

-- Índice para oportunidad origen
CREATE INDEX IF NOT EXISTS idx_expediente_oportunidad_origen ON expediente(oportunidad_origen_id);

-- Crear tabla de reuniones (separando explorativas de concretas)
CREATE TABLE IF NOT EXISTS reuniones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('exploratoria', 'concreta')),
  
  -- Relaciones según tipo
  cliente_nif VARCHAR(9) NOT NULL REFERENCES cliente(nif) ON DELETE CASCADE,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  expediente_id UUID REFERENCES expediente(id) ON DELETE SET NULL,
  
  -- Datos de la reunión
  fecha TIMESTAMPTZ NOT NULL,
  asistentes TEXT[],
  objetivo TEXT,
  notas TEXT,
  acuerdos TEXT,
  proximos_pasos TEXT,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: exploratoria va con oportunidad o solo cliente, concreta va con expediente
  CONSTRAINT chk_reunion_tipo CHECK (
    (tipo = 'exploratoria' AND expediente_id IS NULL) OR
    (tipo = 'concreta' AND expediente_id IS NOT NULL)
  )
);

-- Índices para reuniones
CREATE INDEX idx_reuniones_cliente ON reuniones(cliente_nif);
CREATE INDEX idx_reuniones_oportunidad ON reuniones(oportunidad_id);
CREATE INDEX idx_reuniones_expediente ON reuniones(expediente_id);
CREATE INDEX idx_reuniones_tipo ON reuniones(tipo);
CREATE INDEX idx_reuniones_fecha ON reuniones(fecha DESC);

-- Trigger para actualizar updated_at en reuniones
CREATE OR REPLACE FUNCTION update_reuniones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reuniones_updated_at
  BEFORE UPDATE ON reuniones
  FOR EACH ROW
  EXECUTE FUNCTION update_reuniones_updated_at();

-- Habilitar Row Level Security
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para oportunidades (permitir todo por ahora)
CREATE POLICY "Permitir todo en oportunidades" ON oportunidades
  FOR ALL USING (true) WITH CHECK (true);

-- Políticas RLS para reuniones (permitir todo por ahora)
CREATE POLICY "Permitir todo en reuniones" ON reuniones
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE oportunidades IS 'Oportunidades detectadas para clientes - Fase de análisis y validación';
COMMENT ON TABLE reuniones IS 'Reuniones explorativas (cliente/oportunidad) y concretas (expediente)';
COMMENT ON COLUMN oportunidades.estado IS 'detectada | en_analisis | pendiente_reunion | presentada_cliente | interesada | descartada | convertida_expediente';
COMMENT ON COLUMN expediente.seguimiento_estado IS 'preparacion | presentada | en_revision | subsanacion_requerida | concedida | denegada | cobrada | justificada';
