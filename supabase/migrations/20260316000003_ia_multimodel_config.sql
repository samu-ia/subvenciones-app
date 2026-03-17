-- Migración: Sistema de configuración multi-modelo y multi-proveedor de IA
-- Fecha: 2026-03-16
-- Descripción: Configuración modular de IA con soporte para múltiples proveedores y herramientas

-- Tabla de configuración de proveedores de IA
CREATE TABLE IF NOT EXISTS ia_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'openrouter', 'azure', 'custom')),
  api_key TEXT,
  base_url TEXT,
  organization TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Tabla de configuración de herramientas de IA
CREATE TABLE IF NOT EXISTS ia_tool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_type VARCHAR(20) CHECK (workspace_type IN ('expediente', 'reunion', 'global')),
  tool VARCHAR(50) NOT NULL CHECK (tool IN ('notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search')),
  enabled BOOLEAN DEFAULT true,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  stream_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_type, tool)
);

-- Tabla de ejecuciones de herramientas (analytics)
CREATE TABLE IF NOT EXISTS ia_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  workspace_type VARCHAR(20) NOT NULL,
  tool VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  tokens_used INTEGER,
  execution_time_ms INTEGER,
  sources_used JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para ia_providers
CREATE INDEX IF NOT EXISTS idx_ia_providers_user ON ia_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_providers_enabled ON ia_providers(user_id, enabled);

-- Índices para ia_tool_configs
CREATE INDEX IF NOT EXISTS idx_ia_tool_configs_user ON ia_tool_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_tool_configs_tool ON ia_tool_configs(tool);
CREATE INDEX IF NOT EXISTS idx_ia_tool_configs_user_workspace ON ia_tool_configs(user_id, workspace_type);

-- Índices para ia_tool_executions
CREATE INDEX IF NOT EXISTS idx_ia_tool_executions_user ON ia_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_tool_executions_workspace ON ia_tool_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ia_tool_executions_tool ON ia_tool_executions(tool);
CREATE INDEX IF NOT EXISTS idx_ia_tool_executions_created ON ia_tool_executions(created_at DESC);

-- Comentarios
COMMENT ON TABLE ia_providers IS 'Configuración de proveedores de IA (OpenAI, Anthropic, etc) por usuario';
COMMENT ON TABLE ia_tool_configs IS 'Configuración específica de cada herramienta de IA (notebook, summary, etc)';
COMMENT ON TABLE ia_tool_executions IS 'Historial y analytics de ejecuciones de herramientas de IA';

COMMENT ON COLUMN ia_tool_configs.config IS 'Configuración JSON específica de la herramienta (notebookConfig, deepSearchConfig, etc)';
COMMENT ON COLUMN ia_tool_executions.sources_used IS 'Array JSON de fuentes usadas en la ejecución (documentos, archivos, notas)';
COMMENT ON COLUMN ia_tool_executions.metadata IS 'Metadatos adicionales de la ejecución (timestamps, versiones, etc)';
