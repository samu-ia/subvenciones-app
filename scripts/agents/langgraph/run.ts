/**
 * scripts/agents/langgraph/run.ts
 *
 * Entry point del sistema multi-agente LangGraph.
 *
 * Uso:
 *   npx tsx scripts/agents/langgraph/run.ts                     → interactivo
 *   npx tsx scripts/agents/langgraph/run.ts --task-id <uuid>    → desde Supabase
 *   npx tsx scripts/agents/langgraph/run.ts --title "X" --desc "Y" → directo
 *   npx tsx scripts/agents/langgraph/run.ts --list              → ver tareas pendientes
 */

import 'dotenv/config';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import { buildGraph, createWorktree, mergeAndCleanWorktree } from './graph';
import type { GraphState } from './types';

// Re-export para import circular
export { createWorktree, mergeAndCleanWorktree } from './nodes';

// ─── Config ───────────────────────────────────────────────────────────────────

// Cargar .env.local manualmente (para compatibilidad con dotenvx)
import { readFileSync } from 'fs';
const envFile = readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
// Inyectar en process.env
for (const [k, v] of Object.entries(envVars)) {
  if (!process.env[k]) process.env[k] = v;
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const LIST_FLAG     = args.includes('--list');
const TASK_ID_IDX   = args.indexOf('--task-id');
const TITLE_IDX     = args.indexOf('--title');
const DESC_IDX      = args.indexOf('--desc');
const MAX_ITER_IDX  = args.indexOf('--max-iter');

// ─── Listar tareas ────────────────────────────────────────────────────────────

async function listTasks(): Promise<void> {
  const { data } = await sb
    .from('agent_tasks')
    .select('id, agent_type, title, status, priority, created_at')
    .in('status', ['pending', 'in_progress', 'blocked'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (!data?.length) { console.log('No hay tareas activas.'); return; }

  console.log('\n📋 Tareas activas:\n');
  for (const t of data) {
    const emoji = t.status === 'in_progress' ? '🔄' : t.status === 'blocked' ? '⚠️' : '⏳';
    console.log(`${emoji} [${t.agent_type?.padEnd(12)}] ${t.title?.slice(0, 55)}`);
    console.log(`   ID: ${t.id} | Prioridad: ${t.priority} | ${t.status}`);
  }
}

// ─── Ejecutar grafo ───────────────────────────────────────────────────────────

async function runGraph(taskId: string, title: string, description: string, maxIter = 20): Promise<void> {
  console.log(`\n🚀 Iniciando LangGraph para: ${title}`);
  console.log(`   Task ID: ${taskId}`);
  console.log(`   Max iteraciones: ${maxIter}`);

  // Marcar como en progreso
  await sb.from('agent_tasks').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', taskId);

  // Crear git worktree aislado
  const worktreePath = await createWorktree(taskId);

  const initialState: Partial<GraphState> = {
    task_id:          taskId,
    task_title:       title,
    task_description: description,
    task_status:      'running',
    current_agent:    'lead',
    next_agent:       'lead',
    routing_reason:   'inicio',
    messages:         [],
    subtasks:         [],
    agent_outputs:    {},
    escalations:      [],
    iteration:        0,
    max_iterations:   maxIter,
    context: {
      files_modified:     [],
      decisions_made:     [],
      domain_validations: [],
      errors_found:       [],
      worktree_path:      worktreePath,
    },
  };

  const graph = buildGraph(true);
  const config = { configurable: { thread_id: taskId } };

  let finalState: GraphState | null = null;

  try {
    for await (const chunk of await graph.stream(initialState, config)) {
      const nodeName = Object.keys(chunk)[0];
      const nodeState = chunk[nodeName as keyof typeof chunk];

      // Persistir progreso en Supabase después de cada nodo
      await sb.from('agent_tasks').update({
        output: JSON.stringify({
          iteration: nodeState.iteration,
          last_agent: nodeName,
          messages_count: nodeState.messages?.length ?? 0,
          files_modified: nodeState.context?.files_modified ?? [],
        }),
      }).eq('id', taskId);

      finalState = nodeState as GraphState;
    }

    // Merge worktree → main
    await mergeAndCleanWorktree(worktreePath, taskId);

    // Marcar como done
    const summary = finalState
      ? `Completado en ${finalState.iteration ?? 0} iteraciones. ` +
        `Archivos: ${finalState.context?.files_modified?.join(', ') || 'ninguno'}. ` +
        `Errores encontrados: ${finalState.context?.errors_found?.length ?? 0}`
      : 'Completado';

    await sb.from('agent_tasks').update({
      status: 'done',
      output: summary,
      completed_at: new Date().toISOString(),
    }).eq('id', taskId);

    // Guardar escalaciones si las hay
    if (finalState?.escalations?.length) {
      for (const esc of finalState.escalations) {
        await sb.from('agent_escalations').insert({
          task_id: taskId,
          agent_type: esc.agent,
          question: esc.question,
          context: esc.context,
        });
      }
      console.log(`\n⚠️  ${finalState.escalations.length} escalación(es) pendiente(s) en Supabase.`);
    }

    console.log(`\n✅ Tarea completada: ${title}`);
    console.log(`   ${summary}`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Error: ${msg}`);
    await sb.from('agent_tasks').update({
      status: 'failed',
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq('id', taskId);
    try { await mergeAndCleanWorktree(worktreePath, taskId); } catch {}
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (LIST_FLAG) {
    await listTasks();
    return;
  }

  // Modo --task-id: cargar desde Supabase
  if (TASK_ID_IDX !== -1) {
    const taskId = args[TASK_ID_IDX + 1];
    const { data } = await sb.from('agent_tasks').select('*').eq('id', taskId).single();
    if (!data) { console.error(`Tarea no encontrada: ${taskId}`); process.exit(1); }
    const maxIter = MAX_ITER_IDX !== -1 ? parseInt(args[MAX_ITER_IDX + 1]) : 20;
    await runGraph(taskId, data.title, data.description, maxIter);
    return;
  }

  // Modo --title/--desc: directo
  if (TITLE_IDX !== -1 && DESC_IDX !== -1) {
    const title = args[TITLE_IDX + 1];
    const desc  = args[DESC_IDX + 1];
    const maxIter = MAX_ITER_IDX !== -1 ? parseInt(args[MAX_ITER_IDX + 1]) : 20;

    // Crear tarea en Supabase
    const { data } = await sb.from('agent_tasks').insert({
      agent_type: 'lead', title, description: desc, priority: 7,
    }).select('id').single();

    if (!data) { console.error('Error creando tarea'); process.exit(1); }
    await runGraph(data.id, title, desc, maxIter);
    return;
  }

  // Modo interactivo
  await listTasks();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

  console.log('\n─── Nueva tarea para el equipo ───\n');
  const title   = (await ask('Título: ')).trim();
  const desc    = (await ask('Descripción detallada: ')).trim();
  const iterStr = (await ask('Máx iteraciones (default 20): ')).trim();
  const maxIter = iterStr ? parseInt(iterStr) : 20;
  rl.close();

  const { data } = await sb.from('agent_tasks').insert({
    agent_type: 'lead', title, description: desc, priority: 7,
  }).select('id').single();

  if (!data) { console.error('Error creando tarea'); process.exit(1); }
  await runGraph(data.id, title, desc, maxIter);
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
