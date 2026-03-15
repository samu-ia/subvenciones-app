-- ============================================================================
-- Migración: Módulos operativos (Reuniones, Documentos, Asistentes)
-- Descripción: Tablas para soportar reuniones, documentos y configuración
--              de asistentes IA operativos
-- ============================================================================

-- ============================================================================
-- Tabla de reuniones (operativa real, no solo metadata)
-- ============================================================================

-- Eliminar tabla anterior si existe (de migración previa)
DROP TABLE IF EXISTS reuniones CASCADE;

CREATE TABLE reuniones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relaciones
  cliente_nif TEXT NOT NULL REFERENCES cliente(nif) ON DELETE CASCADE,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  
  -- Datos básicos
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'exploratoria' CHECK (tipo IN ('exploratoria', 'seguimiento', 'presentacion', 'firma', 'otro')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'realizada', 'cancelada')),
  fecha_programada TIMESTAMPTZ NOT NULL,
  duracion_minutos INTEGER DEFAULT 60,
  ubicacion TEXT,
  modo TEXT CHECK (modo IN ('presencial', 'videollamada', 'telefonica')),
  
  -- Preparación y contexto
  objetivo TEXT,
  contexto_previo TEXT,
  preguntas_preparadas TEXT[],
  documentos_necesarios TEXT[],
  
  -- Resultados (tras la reunión)
  notas TEXT,
  conclusiones TEXT,
  proximos_pasos TEXT[],
  fecha_realizada TIMESTAMPTZ,
  asistentes TEXT[],
  
  -- Búsqueda profunda y análisis IA
  busqueda_profunda_realizada BOOLEAN DEFAULT false,
  busqueda_profunda_resultado JSONB,
  busqueda_profunda_fecha TIMESTAMPTZ,
  
  -- Documentos generados
  guion_generado TEXT,
  resumen_generado TEXT,
  presentacion_generada_url TEXT,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Índices para reuniones
CREATE INDEX IF NOT EXISTS reuniones_cliente_nif ON reuniones(cliente_nif);
CREATE INDEX IF NOT EXISTS reuniones_oportunidad_id ON reuniones(oportunidad_id);
CREATE INDEX IF NOT EXISTS reuniones_fecha_programada ON reuniones(fecha_programada DESC);
CREATE INDEX IF NOT EXISTS reuniones_estado ON reuniones(estado);

-- ============================================================================
-- Tabla de documentos
-- ============================================================================

-- Eliminar tabla anterior si existe (de migración previa)
DROP TABLE IF EXISTS documentos CASCADE;

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relaciones (un documento puede estar vinculado a varios contextos)
  cliente_nif TEXT REFERENCES cliente(nif) ON DELETE CASCADE,
  expediente_id UUID REFERENCES expediente(id) ON DELETE CASCADE,
  oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE,
  reunion_id UUID REFERENCES reuniones(id) ON DELETE CASCADE,
  
  -- Datos del documento
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'memoria_proyecto',
    'presupuesto',
    'cuentas_anuales',
    'certificado',
    'factura',
    'contrato',
    'presentacion',
    'email',
    'informe',
    'guion',
    'checklist',
    'otro'
  )),
  
  -- Almacenamiento
  url_storage TEXT,
  size_bytes BIGINT,
  mime_type TEXT,
  
  -- Generación IA
  generado_con_ia BOOLEAN DEFAULT false,
  asistente_id TEXT,
  prompt_usado TEXT,
  modelo_usado TEXT,
  
  -- Versionado
  version INTEGER NOT NULL DEFAULT 1,
  documento_padre_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  es_version_actual BOOLEAN DEFAULT true,
  
  -- Procesamiento y embeddings
  procesado BOOLEAN DEFAULT false,
  embedding_generado BOOLEAN DEFAULT false,
  texto_extraido TEXT,
  
  -- Estado
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'revision', 'aprobado', 'enviado', 'archivado')),
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS documentos_cliente_nif ON documentos(cliente_nif);
CREATE INDEX IF NOT EXISTS documentos_expediente_id ON documentos(expediente_id);
CREATE INDEX IF NOT EXISTS documentos_oportunidad_id ON documentos(oportunidad_id);
CREATE INDEX IF NOT EXISTS documentos_reunion_id ON documentos(reunion_id);
CREATE INDEX IF NOT EXISTS documentos_tipo ON documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS documentos_generado_ia ON documentos(generado_con_ia);

-- ============================================================================
-- Tabla de asistentes IA (configuración de bots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS asistentes_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_color TEXT DEFAULT '#667eea',
  
  -- Configuración del modelo
  provider TEXT NOT NULL DEFAULT 'OpenAI',
  model_id TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature DECIMAL(2,1) NOT NULL DEFAULT 0.2,
  max_tokens INTEGER DEFAULT 4000,
  
  -- Fuentes de datos que consulta
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Acciones que puede realizar
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Prompts del sistema
  system_prompt TEXT,
  prompt_templates JSONB DEFAULT '{}'::jsonb,
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar asistentes por defecto
INSERT INTO asistentes_ia (code, name, description, icon_color, provider, model_id, temperature, sources, actions) VALUES
  ('reuniones', 'Asistente de Reuniones', 'Prepara reuniones, genera guiones y resume contexto del cliente', '#667eea', 'OpenAI', 'gpt-4o', 0.2, 
   '["cliente", "reuniones_previas", "notas", "ayudas", "documentos"]'::jsonb,
   '["preparar_reunion", "resumir_cliente", "generar_guion", "sacar_checklist"]'::jsonb),
   
  ('busqueda_profunda', 'Búsqueda Profunda', 'Investiga empresas, analiza ayudas y detecta riesgos', '#10b981', 'Google', 'gemini-2.5-pro', 0.1,
   '["cliente", "reuniones", "ayudas", "expedientes", "documentos", "web"]'::jsonb,
   '["investigar_empresa", "analizar_ayuda", "detectar_riesgos", "preparar_estrategia"]'::jsonb),
   
  ('documentos', 'Asistente Documental', 'Genera presentaciones, emails, guiones y propuestas', '#f59e0b', 'Anthropic', 'claude-sonnet-4', 0.4,
   '["cliente", "ayuda", "expediente", "reuniones"]'::jsonb,
   '["generar_presentacion", "generar_email", "generar_propuesta", "generar_checklist"]'::jsonb),
   
  ('clientes', 'Asistente de Clientes', 'Analiza perfil, detecta oportunidades y sugiere ayudas', '#3b82f6', 'OpenAI', 'gpt-4o', 0.2,
   '["cliente", "einforma", "ayudas", "expedientes", "reuniones"]'::jsonb,
   '["analizar_perfil", "detectar_oportunidades", "sugerir_ayudas", "evaluar_viabilidad"]'::jsonb),
   
  ('oportunidades', 'Asistente de Oportunidades', 'Analiza encaje, requisitos y probabilidad de éxito', '#8b5cf6', 'OpenAI', 'gpt-4o', 0.1,
   '["cliente", "ayuda", "oportunidad", "requisitos"]'::jsonb,
   '["analizar_encaje", "revisar_requisitos", "calcular_probabilidad", "generar_resumen"]'::jsonb),
   
  ('expedientes', 'Asistente de Expedientes', 'Revisa documentación, genera memorias y detecta incoherencias', '#ec4899', 'Anthropic', 'claude-sonnet-4', 0.3,
   '["expediente", "cliente", "ayuda", "documentos", "requisitos"]'::jsonb,
   '["revisar_documentacion", "generar_memoria", "detectar_incoherencias", "preparar_respuestas"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Tabla de historial de actividad (auditoría)
-- ============================================================================
CREATE TABLE IF NOT EXISTS historial_actividad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contexto
  entidad_tipo TEXT NOT NULL CHECK (entidad_tipo IN ('cliente', 'reunion', 'oportunidad', 'expediente', 'documento')),
  entidad_id UUID NOT NULL,
  
  -- Acción
  accion TEXT NOT NULL,
  descripcion TEXT,
  cambios JSONB,
  
  -- Asistente IA involucrado (opcional)
  asistente_id TEXT,
  
  -- Usuario
  user_id TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para historial
CREATE INDEX IF NOT EXISTS historial_entidad ON historial_actividad(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS historial_fecha ON historial_actividad(created_at DESC);
CREATE INDEX IF NOT EXISTS historial_asistente ON historial_actividad(asistente_id) WHERE asistente_id IS NOT NULL;

-- ============================================================================
-- Triggers para updated_at
-- ============================================================================

CREATE TRIGGER update_reuniones_updated_at BEFORE UPDATE ON reuniones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_asistentes_ia_updated_at BEFORE UPDATE ON asistentes_ia
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_actividad ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir acceso a usuarios autenticados
CREATE POLICY "Permitir acceso a reuniones" ON reuniones
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Permitir acceso a documentos" ON documentos
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Permitir lectura de asistentes IA" ON asistentes_ia
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir actualización de asistentes IA" ON asistentes_ia
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir inserción en historial" ON historial_actividad
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir lectura de historial" ON historial_actividad
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Comentarios
-- ============================================================================

COMMENT ON TABLE reuniones IS 'Reuniones operativas con clientes, preparación y resultados';
COMMENT ON TABLE documentos IS 'Documentos subidos o generados con IA, con versionado y embeddings';
COMMENT ON TABLE asistentes_ia IS 'Configuración de bots/asistentes IA especializados';
COMMENT ON TABLE historial_actividad IS 'Auditoría de acciones en el sistema';
