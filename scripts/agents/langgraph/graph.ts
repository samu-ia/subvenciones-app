/**
 * Grafo LangGraph del sistema multi-agente AyudaPyme
 *
 * Arquitectura supervisor:
 *
 *  START → lead ──┬→ product
 *                 ├→ developer
 *                 ├→ database
 *                 ├→ security
 *                 ├→ matching
 *                 ├→ domain_expert
 *                 ├→ qa
 *                 └→ END
 *
 * Todos los agentes especializados devuelven el control al lead.
 * El lead decide qué sigue o marca END.
 */

import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import {
  leadNode,
  productNode,
  developerNode,
  databaseNode,
  securityNode,
  matchingNode,
  domainExpertNode,
  qaNode,
  leadRouter,
  createWorktree,
  mergeAndCleanWorktree,
} from './nodes';
import type { GraphState, AgentMessage, Subtask, AgentOutput, Escalation } from './types';

export { createWorktree, mergeAndCleanWorktree };

// ─── Estado compartido del grafo ─────────────────────────────────────────────

const StateAnnotation = Annotation.Root({
  // Tarea
  task_id:          Annotation<string>({ reducer: (_prev, next) => next }),
  task_title:       Annotation<string>({ reducer: (_prev, next) => next }),
  task_description: Annotation<string>({ reducer: (_prev, next) => next }),
  task_status:      Annotation<GraphState['task_status']>({ reducer: (_prev, next) => next }),

  // Routing
  current_agent:  Annotation<GraphState['current_agent']>({ reducer: (_prev, next) => next }),
  next_agent:     Annotation<GraphState['next_agent']>({ reducer: (_prev, next) => next }),
  routing_reason: Annotation<string>({ reducer: (_prev, next) => next }),

  // Mensajes acumulados
  messages: Annotation<AgentMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Subtareas
  subtasks: Annotation<Subtask[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // Outputs por agente
  agent_outputs: Annotation<Record<string, AgentOutput>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // Escalaciones
  escalations: Annotation<Escalation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Contexto acumulado
  context: Annotation<GraphState['context']>({
    reducer: (_prev, next) => next,
    default: () => ({
      files_modified: [],
      decisions_made: [],
      domain_validations: [],
      errors_found: [],
    }),
  }),

  // Control
  iteration:      Annotation<number>({ reducer: (_prev, next) => next, default: () => 0 }),
  max_iterations: Annotation<number>({ reducer: (_prev, next) => next, default: () => 20 }),
  error:          Annotation<string | undefined>({ reducer: (_prev, next) => next }),
});

// ─── Construcción del grafo ───────────────────────────────────────────────────

export function buildGraph(useMemorySaver = true) {
  const checkpointer = useMemorySaver ? new MemorySaver() : undefined;

  const graph = new StateGraph(StateAnnotation)
    // Nodos
    .addNode('lead',          leadNode)
    .addNode('product',       productNode)
    .addNode('developer',     developerNode)
    .addNode('database',      databaseNode)
    .addNode('security',      securityNode)
    .addNode('matching',      matchingNode)
    .addNode('domain_expert', domainExpertNode)
    .addNode('qa',            qaNode)

    // Entrada: siempre empieza en lead
    .addEdge(START, 'lead')

    // Lead decide a quién ir
    .addConditionalEdges('lead', leadRouter, {
      product:       'product',
      developer:     'developer',
      database:      'database',
      security:      'security',
      matching:      'matching',
      domain_expert: 'domain_expert',
      qa:            'qa',
      lead:          'lead',
      __end__:       END,
    })

    // Todos los agentes vuelven al lead
    .addEdge('product',       'lead')
    .addEdge('developer',     'lead')
    .addEdge('database',      'lead')
    .addEdge('security',      'lead')
    .addEdge('matching',      'lead')
    .addEdge('domain_expert', 'lead')
    .addEdge('qa',            'lead');

  return graph.compile({ checkpointer });
}

export type CompiledGraph = ReturnType<typeof buildGraph>;
export { StateAnnotation };
