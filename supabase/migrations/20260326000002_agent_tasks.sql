-- Agent tasks queue for autonomous AI agents
CREATE TABLE IF NOT EXISTS agent_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type  TEXT NOT NULL CHECK (agent_type IN ('lead','product','programmer','database','security','matching')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','failed','blocked')),
  priority    INT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  output      TEXT,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent escalations — when an agent needs human input
CREATE TABLE IF NOT EXISTS agent_escalations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_type  TEXT NOT NULL,
  question    TEXT NOT NULL,
  context     TEXT,
  answer      TEXT,           -- human fills this in to unblock the agent
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_tasks_status   ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_priority ON agent_tasks(priority DESC, created_at ASC);
CREATE INDEX idx_agent_escalations_task ON agent_escalations(task_id);

-- RLS: only service role can access (agents use service role key)
ALTER TABLE agent_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_escalations  ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed — accessed exclusively via service_role
