-- ============================================================================
-- Migración: Configuración IA
-- Descripción: Tablas para gestionar proveedores, modelos, credenciales,
--              parámetros RAG y asignación por tarea
-- ============================================================================

-- Tabla principal de configuración de IA
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Proveedor y modelo
  provider TEXT NOT NULL DEFAULT 'OpenAI',
  model_id TEXT NOT NULL DEFAULT 'gpt-4o',
  mode TEXT NOT NULL DEFAULT 'simple' CHECK (mode IN ('simple', 'avanzado')),
  endpoint_base TEXT,
  organization_id TEXT,
  project_id TEXT,
  
  -- Parámetros del modelo
  temperature DECIMAL(2,1) NOT NULL DEFAULT 0.2 CHECK (temperature >= 0.0 AND temperature <= 2.0),
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  top_p DECIMAL(2,1) NOT NULL DEFAULT 1.0 CHECK (top_p >= 0.0 AND top_p <= 1.0),
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  streaming_enabled BOOLEAN NOT NULL DEFAULT true,
  strict_mode BOOLEAN NOT NULL DEFAULT false,
  
  -- Configuración RAG
  embeddings_provider TEXT NOT NULL DEFAULT 'OpenAI',
  embeddings_model TEXT NOT NULL DEFAULT 'text-embedding-3-large',
  chunk_size INTEGER NOT NULL DEFAULT 800,
  chunk_overlap INTEGER NOT NULL DEFAULT 120,
  top_k INTEGER NOT NULL DEFAULT 6,
  min_score DECIMAL(3,2) NOT NULL DEFAULT 0.75 CHECK (min_score >= 0.0 AND min_score <= 1.0),
  answer_only_with_evidence BOOLEAN NOT NULL DEFAULT false,
  show_citations BOOLEAN NOT NULL DEFAULT true,
  source_priority JSONB NOT NULL DEFAULT '["cliente", "reuniones", "anotaciones", "expedientes", "documentos_subidos", "documentos_generados", "ayudas"]'::jsonb,
  auto_reindex BOOLEAN NOT NULL DEFAULT true,
  
  -- Estado y validación
  status TEXT NOT NULL DEFAULT 'sin_configurar' CHECK (status IN ('sin_configurar', 'conectando', 'correcto', 'error_auth', 'error_endpoint', 'timeout')),
  last_validated_at TIMESTAMPTZ,
  connection_test_result TEXT,
  embeddings_test_result TEXT,
  rag_test_result TEXT,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Solo permitimos una fila de configuración (singleton)
CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_singleton ON ai_settings ((true));

-- Insertar configuración por defecto
INSERT INTO ai_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Tabla de credenciales cifradas
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  
  -- Credenciales cifradas (se cifran en el backend antes de guardar)
  api_key_encrypted TEXT,
  secondary_credential_encrypted TEXT,
  
  -- Headers personalizados
  custom_headers JSONB DEFAULT '{}'::jsonb,
  
  -- Información de la clave (sin exponer el valor)
  key_prefix TEXT, -- Primeros 8 caracteres para identificar (ej: "sk-proj-")
  key_masked TEXT, -- Versión enmascarada para UI (ej: "sk-...xyz")
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_success BOOLEAN,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una credencial activa por proveedor
CREATE UNIQUE INDEX IF NOT EXISTS ai_credentials_active_provider 
  ON ai_provider_credentials (provider) 
  WHERE is_active = true;

-- ============================================================================
-- Tabla de asignación de modelos por tarea
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_task_model_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tarea
  task_name TEXT NOT NULL,
  task_label TEXT NOT NULL,
  task_description TEXT,
  
  -- Modelo asignado
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature DECIMAL(2,1) NOT NULL DEFAULT 0.2,
  max_tokens INTEGER,
  
  -- Orden de prioridad
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una tarea activa con el mismo nombre
CREATE UNIQUE INDEX IF NOT EXISTS ai_task_mapping_unique 
  ON ai_task_model_mapping (task_name) 
  WHERE is_active = true;

-- Insertar tareas por defecto
INSERT INTO ai_task_model_mapping (task_name, task_label, provider, model_id, temperature, sort_order) VALUES
  ('chat_general', 'Chat general', 'OpenAI', 'gpt-4o', 0.2, 1),
  ('preparacion_reuniones', 'Preparación de reuniones', 'OpenAI', 'gpt-4o', 0.2, 2),
  ('busqueda_profunda', 'Búsqueda profunda', 'Google', 'gemini-2.5-pro', 0.1, 3),
  ('generacion_presentacion', 'Generación de presentación', 'Anthropic', 'claude-sonnet', 0.4, 4),
  ('generacion_guion', 'Generación de guion', 'Anthropic', 'claude-sonnet', 0.4, 5),
  ('resumen_ejecutivo', 'Resumen ejecutivo', 'OpenAI', 'gpt-4o-mini', 0.2, 6),
  ('extraccion_requisitos', 'Extracción de requisitos', 'OpenAI', 'gpt-4o-mini', 0.0, 7),
  ('clasificacion_rentabilidad', 'Clasificación rentable/dudoso/no rentable', 'OpenAI', 'gpt-4o-mini', 0.0, 8),
  ('redaccion_emails', 'Redacción de emails', 'OpenAI', 'gpt-4o', 0.3, 9),
  ('checklist_documental', 'Checklist documental', 'OpenAI', 'gpt-4o-mini', 0.0, 10)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Tabla de presets rápidos
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  
  -- Configuración del preset (JSON con todos los campos)
  config JSONB NOT NULL,
  
  -- Orden
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- Estado
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo un preset puede ser el default
CREATE UNIQUE INDEX IF NOT EXISTS ai_presets_default 
  ON ai_presets ((true)) 
  WHERE is_default = true;

-- Insertar presets por defecto
INSERT INTO ai_presets (name, label, description, sort_order, is_default, config) VALUES
  ('economico', 'Económico', 'Modelo barato, top_k moderado, embeddings simples', 1, false, '{
    "provider": "OpenAI",
    "model_id": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 2000,
    "embeddings_provider": "OpenAI",
    "embeddings_model": "text-embedding-3-small",
    "top_k": 4,
    "min_score": 0.70,
    "answer_only_with_evidence": false,
    "show_citations": false
  }'::jsonb),
  
  ('equilibrado', 'Equilibrado', 'Calidad aceptable, coste medio, citas activadas', 2, true, '{
    "provider": "OpenAI",
    "model_id": "gpt-4o",
    "temperature": 0.2,
    "max_tokens": 4000,
    "embeddings_provider": "OpenAI",
    "embeddings_model": "text-embedding-3-large",
    "top_k": 6,
    "min_score": 0.75,
    "answer_only_with_evidence": false,
    "show_citations": true
  }'::jsonb),
  
  ('maxima_calidad', 'Máxima calidad', 'Mejor modelo disponible, top_k alto, modo estricto', 3, false, '{
    "provider": "OpenAI",
    "model_id": "gpt-4.1",
    "temperature": 0.1,
    "max_tokens": 8000,
    "embeddings_provider": "OpenAI",
    "embeddings_model": "text-embedding-3-large",
    "top_k": 10,
    "min_score": 0.80,
    "answer_only_with_evidence": true,
    "show_citations": true,
    "strict_mode": true
  }'::jsonb),
  
  ('estricto_fuentes', 'Estricto con fuentes', 'Responder solo con evidencia, citas visibles, temperatura baja', 4, false, '{
    "provider": "OpenAI",
    "model_id": "gpt-4o",
    "temperature": 0.1,
    "max_tokens": 4000,
    "embeddings_provider": "OpenAI",
    "embeddings_model": "text-embedding-3-large",
    "top_k": 8,
    "min_score": 0.85,
    "answer_only_with_evidence": true,
    "show_citations": true,
    "strict_mode": true
  }'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Tabla de logs de pruebas
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  test_type TEXT NOT NULL CHECK (test_type IN ('connection', 'embeddings', 'rag', 'chat')),
  provider TEXT NOT NULL,
  model_id TEXT,
  
  -- Resultado
  success BOOLEAN NOT NULL,
  result_message TEXT,
  error_message TEXT,
  response_time_ms INTEGER,
  
  -- Detalles adicionales
  test_input TEXT,
  test_output TEXT,
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice por tipo de prueba y fecha
CREATE INDEX IF NOT EXISTS ai_test_logs_type_date 
  ON ai_test_logs (test_type, created_at DESC);

-- ============================================================================
-- Funciones de ayuda
-- ============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_credentials_updated_at BEFORE UPDATE ON ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_task_mapping_updated_at BEFORE UPDATE ON ai_task_model_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_presets_updated_at BEFORE UPDATE ON ai_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_model_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_test_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir lectura a usuarios autenticados
CREATE POLICY "Permitir lectura de configuración IA" ON ai_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura de tareas IA" ON ai_task_model_mapping
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura de presets IA" ON ai_presets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura de logs de prueba" ON ai_test_logs
  FOR SELECT TO authenticated USING (true);

-- Credenciales: solo lectura del estado, no del contenido cifrado
CREATE POLICY "Permitir lectura estado credenciales" ON ai_provider_credentials
  FOR SELECT TO authenticated USING (true);

-- Políticas de escritura (requieren autenticación)
CREATE POLICY "Permitir actualización configuración IA" ON ai_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir inserción credenciales" ON ai_provider_credentials
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualización credenciales" ON ai_provider_credentials
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Permitir gestión de tareas" ON ai_task_model_mapping
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Permitir inserción logs de prueba" ON ai_test_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- Comentarios
-- ============================================================================

COMMENT ON TABLE ai_settings IS 'Configuración global de IA: proveedor, modelo, parámetros y RAG';
COMMENT ON TABLE ai_provider_credentials IS 'Credenciales cifradas de proveedores de IA';
COMMENT ON TABLE ai_task_model_mapping IS 'Asignación de modelos específicos por tipo de tarea';
COMMENT ON TABLE ai_presets IS 'Presets rápidos de configuración IA';
COMMENT ON TABLE ai_test_logs IS 'Logs de pruebas de conexión, embeddings y RAG';
