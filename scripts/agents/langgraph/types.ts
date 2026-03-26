/**
 * Tipos del sistema multi-agente LangGraph
 */

export type AgentType =
  | 'lead'
  | 'product'
  | 'developer'
  | 'database'
  | 'security'
  | 'matching'
  | 'domain_expert'
  | 'qa';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_human'
  | 'done'
  | 'failed'
  | 'blocked';

export interface AgentMessage {
  agent: AgentType | 'human' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Subtask {
  id: string;
  agent: AgentType;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
  created_at: string;
  completed_at?: string;
}

export interface Escalation {
  id: string;
  agent: AgentType;
  question: string;
  context: string;
  answer?: string;
  resolved: boolean;
  created_at: string;
}

export interface AgentOutput {
  agent: AgentType;
  output: string;
  success: boolean;
  timestamp: string;
}

/** Estado compartido del grafo LangGraph */
export interface GraphState {
  // Tarea principal
  task_id: string;
  task_title: string;
  task_description: string;
  task_status: TaskStatus;

  // Routing
  current_agent: AgentType;
  next_agent: AgentType | 'END' | 'WAIT_FOR_HUMAN';
  routing_reason: string;

  // Mensajes e historial
  messages: AgentMessage[];

  // Subtareas generadas por el Lead
  subtasks: Subtask[];

  // Outputs de cada agente
  agent_outputs: Record<string, AgentOutput>;

  // Escalaciones al humano
  escalations: Escalation[];

  // Contexto acumulado (memoria de trabajo)
  context: {
    files_modified: string[];
    decisions_made: string[];
    domain_validations: string[];
    errors_found: string[];
    branch_name?: string;
    worktree_path?: string;
  };

  // Control de iteración
  iteration: number;
  max_iterations: number;

  // Error si algo falla
  error?: string;
}

/** Decisión del Lead sobre qué hacer a continuación */
export interface LeadDecision {
  next: AgentType | 'END' | 'WAIT_FOR_HUMAN';
  reasoning: string;
  task_for_next_agent: string;
  context_for_next_agent: string;
  files_to_focus: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/** Resultado que devuelve cada agente al Lead */
export interface AgentResult {
  success: boolean;
  summary: string;
  files_modified: string[];
  decisions_made: string[];
  errors_found: string[];
  needs_domain_validation: boolean;
  escalation?: {
    question: string;
    context: string;
    alternatives: string[];
  };
}
