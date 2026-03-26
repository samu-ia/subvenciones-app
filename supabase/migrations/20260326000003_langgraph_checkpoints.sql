-- LangGraph checkpoint tables
-- Permiten reanudar ejecuciones interrumpidas y ver el historial completo

CREATE TABLE IF NOT EXISTS lg_checkpoints (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id            TEXT NOT NULL,          -- = task_id de agent_tasks
  checkpoint_id        TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  checkpoint           JSONB NOT NULL,         -- estado completo serializado
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS lg_checkpoint_writes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  channel       TEXT NOT NULL,
  value         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lg_cp_thread   ON lg_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_lg_cp_created  ON lg_checkpoints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lg_cpw_thread  ON lg_checkpoint_writes(thread_id, checkpoint_id);

-- RLS (solo service_role)
ALTER TABLE lg_checkpoints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lg_checkpoint_writes  ENABLE ROW LEVEL SECURITY;

-- Añadir campo agent_type = 'qa' y 'domain_expert' si no existen en agent_tasks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_tasks' AND column_name = 'agent_type'
  ) THEN
    -- Actualizar el CHECK constraint para incluir los nuevos tipos
    -- (En Supabase esto se hace eliminando y recreando el constraint si es posible)
    -- Por seguridad, simplemente intentamos hacer un ALTER TABLE
    BEGIN
      ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_agent_type_check;
      ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_agent_type_check
        CHECK (agent_type IN ('lead','product','programmer','developer','database','security','matching','qa','domain_expert'));
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorar si falla (puede que el constraint ya incluya los valores)
    END;
  END IF;
END $$;
