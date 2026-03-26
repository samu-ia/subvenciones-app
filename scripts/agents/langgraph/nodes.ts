/**
 * Nodos del grafo LangGraph
 *
 * Cada nodo ejecuta un agente especializado usando Claude Agent SDK,
 * lee/escribe el estado compartido y devuelve un resultado estructurado.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { execAsync } from './utils';
import { AGENT_PROMPTS, AGENT_TOOLS } from './prompts';
import type { AgentType, GraphState, AgentMessage, AgentResult, LeadDecision } from './types';

const ROOT = process.cwd();
const MAX_TURNS = 80;
const MODEL = 'claude-opus-4-6';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(text: string): T | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : text).trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]) as T; } catch { return null; }
}

async function runAgentSDK(
  agentType: AgentType,
  prompt: string,
  cwd: string,
): Promise<string> {
  let output = '';

  for await (const message of query({
    prompt,
    options: {
      cwd,
      allowedTools: AGENT_TOOLS[agentType],
      systemPrompt: AGENT_PROMPTS[agentType],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: MAX_TURNS,
      model: MODEL,
    },
  })) {
    if ('result' in message) {
      output = message.result ?? '';
    } else if (message.type === 'assistant') {
      const textBlock = (message as { content?: Array<{ type: string; text?: string }> }).content?.find(
        (b) => b.type === 'text',
      );
      if (textBlock?.text) {
        process.stdout.write(`  [${agentType}] ${textBlock.text.slice(0, 100)}\n`);
      }
    }
  }

  return output;
}

function buildAgentPrompt(state: GraphState, extraInstructions: string): string {
  const history = state.messages
    .slice(-6) // últimos 6 mensajes para no saturar el contexto
    .map((m) => `[${m.agent.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  return `# Tarea: ${state.task_title}

## Descripción
${state.task_description}

## Instrucciones específicas
${extraInstructions}

## Historial reciente del equipo
${history || '(inicio de tarea)'}

## Archivos modificados hasta ahora
${state.context.files_modified.join(', ') || 'ninguno'}

## Decisiones tomadas
${state.context.decisions_made.join('\n') || 'ninguna'}

## Validaciones de dominio
${state.context.domain_validations.join('\n') || 'ninguna'}

---
Al terminar, haz commit de tus cambios con un mensaje descriptivo.
Si necesitas input humano (API keys, pagos, decisiones estratégicas), úsalo solo como último recurso.`;
}

// ─── Git worktree ─────────────────────────────────────────────────────────────

export async function createWorktree(taskId: string): Promise<string> {
  const branchName = `agent/lg/${taskId.slice(0, 8)}`;
  const worktreePath = `${ROOT}/.agent-worktrees/lg-${taskId.slice(0, 8)}`;

  const { execSync } = await import('child_process');
  execSync(`mkdir -p "${ROOT}/.agent-worktrees"`, { stdio: 'ignore' });

  try {
    await execAsync(`git -C "${ROOT}" worktree add "${worktreePath}" -b "${branchName}"`);
    console.log(`  Worktree creado: ${branchName}`);
  } catch {
    console.log(`  Usando worktree existente: ${branchName}`);
  }

  return worktreePath;
}

export async function mergeAndCleanWorktree(worktreePath: string, taskId: string): Promise<void> {
  const branchName = `agent/lg/${taskId.slice(0, 8)}`;
  try {
    const { stdout } = await execAsync(`git -C "${ROOT}" rev-list --count main..${branchName}`);
    if (parseInt(stdout.trim()) === 0) {
      console.log('  Sin cambios que mergear.');
    } else {
      await execAsync(
        `git -C "${ROOT}" merge --no-ff ${branchName} -m "merge: LangGraph task ${taskId.slice(0, 8)}"`,
      );
      console.log(`  Merge completado: ${branchName} → main`);
    }
    await execAsync(`git -C "${ROOT}" branch -d ${branchName}`).catch(() => {});
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  No se pudo hacer merge automático: ${msg}`);
  }
  try {
    await execAsync(`git worktree remove "${worktreePath}" --force`);
  } catch {
    /* ignore */
  }
}

// ─── NODO: LEAD ───────────────────────────────────────────────────────────────

export async function leadNode(state: GraphState): Promise<Partial<GraphState>> {
  console.log(`\n🎯 [LEAD] Iteración ${state.iteration + 1}/${state.max_iterations}`);

  const cwd = state.context.worktree_path ?? ROOT;

  // Contexto completo para el Lead
  const agentOutputsSummary = Object.entries(state.agent_outputs)
    .map(([agent, out]) => `### ${agent.toUpperCase()}\n${out.output.slice(0, 500)}`)
    .join('\n\n');

  const prompt = buildAgentPrompt(
    state,
    `Eres el coordinador. Revisa todo lo que ha pasado y decide el siguiente paso.

## Outputs de agentes anteriores
${agentOutputsSummary || '(ninguno aún — esta es la primera iteración)'}

## Subtareas pendientes
${state.subtasks.filter((t) => t.status === 'pending').map((t) => `- [${t.agent}] ${t.title}`).join('\n') || 'ninguna'}

## Tu trabajo ahora
1. Analiza el estado de la tarea
2. Decide quién trabaja a continuación y qué hace exactamente
3. Si la tarea está completa, indica next: "END"
4. Si necesitas input humano IMPRESCINDIBLE, indica next: "WAIT_FOR_HUMAN"

Termina SIEMPRE con el JSON de decisión.`,
  );

  const output = await runAgentSDK('lead', prompt, cwd);
  const decision = parseJson<LeadDecision>(output);

  const newMessage: AgentMessage = {
    agent: 'lead',
    content: output.slice(0, 1000),
    timestamp: now(),
  };

  if (!decision) {
    console.warn('  Lead no devolvió JSON válido. Reintentando en siguiente iteración.');
    return {
      iteration: state.iteration + 1,
      messages: [...state.messages, newMessage],
      next_agent: 'lead',
    };
  }

  console.log(`  → ${decision.next} (${decision.priority}): ${decision.reasoning.slice(0, 80)}`);

  return {
    iteration: state.iteration + 1,
    messages: [...state.messages, newMessage],
    next_agent: decision.next as GraphState['next_agent'],
    routing_reason: decision.reasoning,
    agent_outputs: {
      ...state.agent_outputs,
      lead: { agent: 'lead', output, success: true, timestamp: now() },
    },
  };
}

// ─── FACTORY: nodo genérico para agentes especializados ──────────────────────

function makeAgentNode(agentType: AgentType) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    console.log(`\n🤖 [${agentType.toUpperCase()}] Iniciando...`);

    const cwd = state.context.worktree_path ?? ROOT;

    // Buscar la subtarea asignada a este agente
    const pendingSubtask = state.subtasks.find(
      (t) => t.agent === agentType && t.status === 'pending',
    );

    const instructions = pendingSubtask
      ? `## Tu subtarea asignada\n${pendingSubtask.title}\n\n${pendingSubtask.description}`
      : `## Instrucciones del Lead\n${state.routing_reason}\n\nTarea específica: ${
          state.agent_outputs['lead']
            ? parseJson<LeadDecision>(state.agent_outputs['lead'].output)?.task_for_next_agent ?? ''
            : ''
        }`;

    const prompt = buildAgentPrompt(state, instructions);
    const output = await runAgentSDK(agentType, prompt, cwd);

    // Parsear resultado estructurado
    const result = parseJson<AgentResult>(output);

    const newMessage: AgentMessage = {
      agent: agentType,
      content: output.slice(0, 1000),
      timestamp: now(),
    };

    // Actualizar subtarea si existe
    const updatedSubtasks = state.subtasks.map((t) =>
      t.agent === agentType && t.status === 'pending'
        ? { ...t, status: 'done' as const, output: output.slice(0, 500), completed_at: now() }
        : t,
    );

    // Actualizar contexto con lo que el agente hizo
    const newContext = { ...state.context };
    if (result?.files_modified?.length) {
      newContext.files_modified = [...new Set([...newContext.files_modified, ...result.files_modified])];
    }
    if (result?.decisions_made?.length) {
      newContext.decisions_made = [...newContext.decisions_made, ...result.decisions_made];
    }
    if (result?.errors_found?.length) {
      newContext.errors_found = [...newContext.errors_found, ...result.errors_found];
    }
    if (agentType === 'domain_expert' && result?.decisions_made?.length) {
      newContext.domain_validations = [...newContext.domain_validations, ...result.decisions_made];
    }

    // Escalación si el agente la necesita
    const newEscalations = [...state.escalations];
    if (result?.escalation) {
      newEscalations.push({
        id: Math.random().toString(36).slice(2),
        agent: agentType,
        question: result.escalation.question,
        context: result.escalation.context,
        resolved: false,
        created_at: now(),
      });
    }

    console.log(`  ✅ [${agentType.toUpperCase()}] ${result?.summary?.slice(0, 80) ?? 'Completado'}`);

    return {
      messages: [...state.messages, newMessage],
      agent_outputs: {
        ...state.agent_outputs,
        [agentType]: { agent: agentType, output, success: result?.success ?? true, timestamp: now() },
      },
      subtasks: updatedSubtasks,
      context: newContext,
      escalations: newEscalations,
      // Siempre vuelve al lead
      next_agent: 'lead',
      current_agent: agentType,
    };
  };
}

// Exportar nodos de todos los agentes especializados
export const productNode       = makeAgentNode('product');
export const developerNode     = makeAgentNode('developer');
export const databaseNode      = makeAgentNode('database');
export const securityNode      = makeAgentNode('security');
export const matchingNode      = makeAgentNode('matching');
export const domainExpertNode  = makeAgentNode('domain_expert');
export const qaNode            = makeAgentNode('qa');

// ─── Router: decide a qué nodo ir tras el Lead ───────────────────────────────

export function leadRouter(state: GraphState): string {
  if (state.iteration >= state.max_iterations) {
    console.log('  ⏱️ Máximo de iteraciones alcanzado. Finalizando.');
    return '__end__';
  }

  const next = state.next_agent;
  if (!next || next === 'END') return '__end__';
  if (next === 'WAIT_FOR_HUMAN') return '__end__'; // marcará como blocked en Supabase

  const validNodes = ['product', 'developer', 'database', 'security', 'matching', 'domain_expert', 'qa', 'lead'];
  if (validNodes.includes(next)) return next;

  console.warn(`  Router: agente desconocido "${next}", volviendo al lead`);
  return 'lead';
}
