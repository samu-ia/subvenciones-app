-- Migración: RLS para tablas ia_providers, ia_tool_configs, ia_tool_executions
-- Fecha: 2026-04-01
-- Cada usuario solo puede ver/modificar sus propias configs de IA

-- ia_providers
ALTER TABLE ia_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ia_providers"
  ON ia_providers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ia_tool_configs
ALTER TABLE ia_tool_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ia_tool_configs"
  ON ia_tool_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ia_tool_executions
ALTER TABLE ia_tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ia_tool_executions"
  ON ia_tool_executions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
