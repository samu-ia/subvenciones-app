#!/usr/bin/env node
/**
 * scripts/agent-loop.mjs
 *
 * Bucle autónomo de Claude Code — ejecuta tareas de la cola `agent_tasks`
 * una tras otra usando la CLI de Claude, hasta que no queden tareas o se
 * agoten los tokens.
 *
 * Uso:
 *   node scripts/agent-loop.mjs               # procesa todas las tareas pendientes
 *   node scripts/agent-loop.mjs --once        # una sola tarea y sale
 *   node scripts/agent-loop.mjs --watch       # watch: espera nuevas tareas
 *   node scripts/agent-loop.mjs --agent prog  # solo tareas del agente "programmer"
 *
 * La CLI de Claude se invoca con `claude -p "<prompt>"` en modo no-interactivo.
 * Cada tarea queda marcada como `in_progress` → `done` o `failed`.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { resolve } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const CLAUDE_BIN = env.CLAUDE_CODE_PATH || 'claude';
const PROJECT_DIR = resolve('.');

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const onceMode  = args.includes('--once');
const agenteFilter = args.find((a, i) => args[i - 1] === '--agent') ?? null;
const POLL_INTERVAL = 30_000; // 30s en watch mode

// ─── Obtener siguiente tarea ──────────────────────────────────────────────────

async function obtenerTarea() {
  let q = sb
    .from('agent_tasks')
    .select('id, title, description, agent_type, priority')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (agenteFilter) q = q.eq('agent_type', agenteFilter);

  const { data, error } = await q;
  if (error) { console.error('[agent-loop] Error leyendo tareas:', error.message); return null; }
  return data?.[0] ?? null;
}

// ─── Ejecutar tarea con Claude CLI (streaming) ────────────────────────────────

function ejecutarClaude(prompt) {
  return new Promise((resolveP, rejectP) => {
    const chunks = [];

    const child = spawn(CLAUDE_BIN, ['--no-interactive', '-p', prompt], {
      cwd: PROJECT_DIR,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', chunk => {
      process.stdout.write(chunk);
      chunks.push(chunk);
    });

    child.stderr.on('data', chunk => {
      process.stderr.write(chunk);
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      rejectP(new Error('Timeout: tarea superó 15 minutos'));
    }, 15 * 60 * 1000);

    child.on('close', code => {
      clearTimeout(timeout);
      const output = Buffer.concat(chunks).toString('utf-8').trim();
      if (code === 0 || code === null) {
        resolveP(output);
      } else {
        rejectP(new Error(`Claude salió con código ${code}\n${output.slice(-500)}`));
      }
    });

    child.on('error', err => {
      clearTimeout(timeout);
      rejectP(err);
    });
  });
}

async function ejecutarTarea(tarea) {
  const prompt = buildPrompt(tarea);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${tarea.agent_type}] ${tarea.title}`);
  console.log(`ID: ${tarea.id} | Prioridad: ${tarea.priority}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Marcar como in_progress
  await sb.from('agent_tasks').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', tarea.id);

  try {
    const salida = await ejecutarClaude(prompt);

    // Marcar done
    await sb.from('agent_tasks').update({
      status: 'done',
      output: salida.slice(0, 5000),
      completed_at: new Date().toISOString(),
    }).eq('id', tarea.id);

    console.log(`\n✅ Tarea completada: ${tarea.title}`);
    return true;

  } catch (err) {
    const msg = err.message ?? String(err);
    console.error(`\n❌ Error en tarea ${tarea.id}:`, msg.slice(0, 500));

    await sb.from('agent_tasks').update({
      status: 'failed',
      error: msg.slice(0, 2000),
      completed_at: new Date().toISOString(),
    }).eq('id', tarea.id);

    return false;
  }
}

// ─── Construir prompt ─────────────────────────────────────────────────────────

function buildPrompt(tarea) {
  return `Eres un agente de desarrollo autónomo trabajando en el proyecto AyudaPyme.
Es una plataforma SaaS B2B para PYMEs españolas que detecta subvenciones públicas y gestiona solicitudes.
Stack: Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS.

TAREA ASIGNADA
ID: ${tarea.id}
Agente: ${tarea.agent_type}
Título: ${tarea.title}

Descripción:
${tarea.description}

INSTRUCCIONES:
- Lee CLAUDE.md primero para entender el proyecto.
- Implementa la tarea completamente. No pidas confirmaciones.
- Lee los archivos relevantes antes de modificar.
- Haz commit al final con mensaje en español (formato: tipo: descripción).
- Si hay errores de compilación o TypeScript, corrígelos.
- Informa brevemente qué hiciste al terminar.

Directorio: ${PROJECT_DIR}`;
}

// ─── Loop principal ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n🤖 Agent Loop — AyudaPyme');
  console.log(`Modo: ${watchMode ? 'watch' : onceMode ? 'once' : 'batch'}`);
  if (agenteFilter) console.log(`Filtro agente: ${agenteFilter}`);
  console.log(`Directorio: ${PROJECT_DIR}`);
  console.log(`Claude CLI: ${CLAUDE_BIN}\n`);

  // Verificar que claude CLI existe
  try {
    await ejecutarClaude('echo ok').catch(() => null);
  } catch {
    // no pasa nada, la verificación es opcional
  }

  let procesadas = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tarea = await obtenerTarea();

    if (!tarea) {
      if (watchMode) {
        process.stdout.write(`\r⏳ Sin tareas pendientes. Esperando ${POLL_INTERVAL / 1000}s...  `);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }
      console.log(`\n📊 Completado: ${procesadas} tarea(s) procesadas. Sin más pendientes.`);
      break;
    }

    const ok = await ejecutarTarea(tarea);
    if (ok) procesadas++;

    if (onceMode) {
      console.log(`\n📊 Modo --once: saliendo.`);
      break;
    }

    // Pausa breve entre tareas
    await new Promise(r => setTimeout(r, 3000));
  }
}

main().catch(err => {
  console.error('\n💥 Agent loop fatal:', err.message);
  process.exit(1);
});
