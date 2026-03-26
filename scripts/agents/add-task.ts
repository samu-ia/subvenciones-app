/**
 * Añadir tarea al queue de agentes
 *
 * Uso:
 *   npx tsx scripts/agents/add-task.ts
 *
 * O directamente con args:
 *   npx tsx scripts/agents/add-task.ts --agent programmer --title "Arreglar bug X" --desc "Descripción detallada"
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AgentType = 'lead' | 'product' | 'programmer' | 'database' | 'security' | 'matching' | 'qa';

const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  lead:        'Orquesta, divide tareas, prioriza, escala solo lo importante',
  product:     'Investiga, propone mejoras UX/producto, analiza soluciones',
  programmer:  'Implementa código, arregla bugs, hace commits',
  database:    'Schema, migraciones, índices, RLS',
  security:    'Revisa vulnerabilidades, permisos, calidad de código',
  matching:    'Motor de matching, parseo BDNS, scoring de subvenciones',
  qa:          'Prueba la app con Puppeteer como usuario real, detecta bugs visuales',
};

async function addTask(
  agentType: AgentType,
  title: string,
  description: string,
  priority: number = 5,
): Promise<void> {
  const { data, error } = await supabase.from('agent_tasks').insert({
    agent_type: agentType,
    title,
    description,
    priority,
  }).select().single();

  if (error) {
    console.error('Error añadiendo tarea:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Tarea añadida:`);
  console.log(`   ID:     ${data.id}`);
  console.log(`   Agente: ${agentType}`);
  console.log(`   Título: ${title}`);
  console.log(`   Estado: pending`);
  console.log(`\nEjecuta el orquestador para procesar:`);
  console.log(`   npx tsx scripts/agents/orchestrator.ts`);
}

async function listPendingTasks(): Promise<void> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, agent_type, title, status, priority, created_at')
    .in('status', ['pending', 'in_progress', 'blocked'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error || !data?.length) {
    console.log('No hay tareas activas.');
    return;
  }

  console.log('\n📋 Tareas activas:\n');
  for (const t of data) {
    const emoji = t.status === 'in_progress' ? '🔄' : t.status === 'blocked' ? '⚠️' : '⏳';
    console.log(`${emoji} [${t.agent_type.padEnd(10)}] ${t.title.slice(0, 60)}`);
    console.log(`   ID: ${t.id} | Prioridad: ${t.priority} | ${t.status}`);
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Modo args directos
  const agentIdx = args.indexOf('--agent');
  const titleIdx = args.indexOf('--title');
  const descIdx = args.indexOf('--desc');
  const listFlag = args.includes('--list');

  if (listFlag) {
    await listPendingTasks();
    return;
  }

  if (agentIdx !== -1 && titleIdx !== -1 && descIdx !== -1) {
    const agent = args[agentIdx + 1] as AgentType;
    const title = args[titleIdx + 1];
    const desc = args[descIdx + 1];
    await addTask(agent, title, desc);
    return;
  }

  // Modo interactivo
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  console.log('\n🤖 Añadir tarea al queue de agentes\n');

  // Mostrar tareas actuales
  await listPendingTasks();

  console.log('\n─── Nuevo tarea ───\n');
  console.log('Agentes disponibles:');
  for (const [key, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
    console.log(`  ${key.padEnd(10)} — ${desc}`);
  }

  const agentInput = (await ask('\nAgente: ')).trim() as AgentType;
  if (!AGENT_DESCRIPTIONS[agentInput]) {
    console.error(`Agente inválido: ${agentInput}`);
    rl.close();
    process.exit(1);
  }

  const title = (await ask('Título corto: ')).trim();
  console.log('Descripción detallada (termina con una línea vacía):');

  const descLines: string[] = [];
  while (true) {
    const line = await ask('');
    if (line === '') break;
    descLines.push(line);
  }

  const priorityStr = (await ask('Prioridad (1-10, default 5): ')).trim();
  const priority = priorityStr ? parseInt(priorityStr) : 5;

  rl.close();

  await addTask(agentInput, title, descLines.join('\n'), priority);
}

main().catch(console.error);
