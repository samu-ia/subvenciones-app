/**
 * Agent Orchestrator — AyudaPyme
 *
 * Lee tareas de Supabase, las despacha a agentes especializados en paralelo.
 * Cada agente trabaja en un git worktree separado para evitar conflictos.
 *
 * Uso:
 *   npx tsx scripts/agents/orchestrator.ts           # corre tareas pendientes
 *   npx tsx scripts/agents/orchestrator.ts --watch   # modo continuo
 */

import { query, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { createClient } from '@supabase/supabase-js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// ─── Config ────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../..');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WATCH_MODE = process.argv.includes('--watch');
const MAX_PARALLEL_AGENTS = 3; // agentes simultáneos máximo
const POLL_INTERVAL_MS = 30_000; // 30 segundos en modo watch

// ─── Tipos ─────────────────────────────────────────────────────────────────

type AgentType = 'lead' | 'product' | 'programmer' | 'database' | 'security' | 'matching';

interface AgentTask {
  id: string;
  title: string;
  description: string;
  agent_type: AgentType;
  status: string;
  priority: number;
}

// ─── System prompts por agente ─────────────────────────────────────────────

const AGENT_PROMPTS: Record<AgentType, string> = {
  lead: `Eres el agente líder del proyecto AyudaPyme. EMPIEZA SIEMPRE leyendo CLAUDE.md para entender el proyecto.

Tu trabajo:
- Entender el estado del proyecto leyendo CLAUDE.md, el código y el historial git
- Dividir tareas complejas en subtareas concretas y delegarlas a agentes especializados
- Priorizar por impacto real en el negocio
- Hacer commits ordenados con mensajes descriptivos
- Solo escalar al humano cuando sea estrictamente necesario (pagos, credenciales externas, decisiones de negocio clave)

Para crear subtareas para otros agentes usa este comando desde bash:
  npx dotenvx run -f .env.local -- npx tsx scripts/agents/add-task.ts --agent <tipo> --title "<título>" --desc "<descripción detallada>"
Tipos disponibles: lead, product, programmer, database, security, matching

Sé específico en las descripciones: incluye qué archivos tocar, qué cambiar exactamente, y qué NO hacer.`,

  product: `Eres el agente de producto e investigación de AyudaPyme. EMPIEZA SIEMPRE leyendo CLAUDE.md.

Tu trabajo:
- Analizar el código existente para entender el estado actual
- Buscar en internet soluciones, librerías, mejores prácticas relevantes
- Proponer mejoras de UX concretas basadas en lo que ves en el código
- Investigar APIs, servicios externos, comparar opciones
- Escribir análisis y propuestas en /docs/proposals/ (crea el directorio si no existe)
- NO implementar código directamente — escribir especificaciones claras para el agente programador

Formato de propuesta: título, problema actual, solución propuesta, código de ejemplo, pros/contras, esfuerzo estimado.`,

  programmer: `Eres el agente programador de AyudaPyme. EMPIEZA SIEMPRE leyendo CLAUDE.md — contiene el bug crítico de CSS que DEBES conocer antes de tocar cualquier componente.

Tu trabajo:
- Implementar funcionalidades según las especificaciones
- Arreglar bugs detectados
- Hacer commits frecuentes con mensajes descriptivos (en español, formato: tipo: descripción)
- Trabajas en tu propio branch (nunca en main directamente)

Stack: Next.js 16.1.6, TypeScript, Supabase, Tailwind CSS v4, React 19.
⚠️ BUG CRÍTICO: Los utilitarios de padding/margin/background de Tailwind NO funcionan en la landing — usa inline styles. Lee CLAUDE.md para entender por qué.
Antes de implementar, leer el código existente del área que vas a tocar.`,

  database: `Eres el agente de base de datos de AyudaPyme. Tu trabajo es:
- Revisar y optimizar el schema de Supabase
- Escribir migraciones cuando haga falta
- Asegurarte de que los índices están bien puestos para las queries más comunes
- Revisar RLS (Row Level Security) y políticas
- Identificar queries lentas
- Documentar el schema en /docs/database/

Las tablas principales: subvenciones, cliente_subvencion_match, perfiles, expediente, ia_providers.
Nunca ejecutes DROP sin confirmación humana.`,

  security: `Eres el agente de seguridad y calidad de AyudaPyme. Tu trabajo es:
- Revisar código en busca de vulnerabilidades (XSS, SQL injection, IDOR, etc.)
- Verificar que las rutas API tienen autenticación correcta
- Revisar que RLS está correctamente configurado en Supabase
- Comprobar que no hay secrets en el código
- Revisar dependencias con vulnerabilidades conocidas (npm audit)
- Escribir un informe en /docs/security/audit-{fecha}.md

Sé específico: indica archivo, línea y cómo arreglarlo.`,

  matching: `Eres el agente especializado en el sistema de matching de subvenciones de AyudaPyme. Tu trabajo es:
- Mantener y mejorar el motor de matching entre subvenciones y clientes
- Revisar la lógica de scoring y mejorarla si hay casos edge
- Parsear y estructurar datos de BDNS
- Asegurarte de que los hard-excludes geográficos funcionan bien
- Mejorar la extracción de información de PDFs
- Mantener el pipeline de datos ordenado

Scripts clave: scripts/enrich-with-gemini.mjs, scripts/run-matching.mjs, scripts/seed-subvenciones.mjs
La URL de PDFs de BDNS: https://www.infosubvenciones.es/bdnstrans/api/convocatorias/pdf?id={bdns_id}&vpd=GE`,
};

// Herramientas permitidas por agente
const AGENT_TOOLS: Record<AgentType, string[]> = {
  lead:        ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit', 'Agent'],
  product:     ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Write'],
  programmer:  ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'],
  database:    ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
  security:    ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
  matching:    ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'],
};

// ─── Git worktree helpers ───────────────────────────────────────────────────

async function createWorktree(taskId: string, agentType: AgentType): Promise<string> {
  const branchName = `agent/${agentType}/${taskId.slice(0, 8)}`;
  const worktreePath = path.join(ROOT, '.agent-worktrees', taskId);

  fs.mkdirSync(path.join(ROOT, '.agent-worktrees'), { recursive: true });

  try {
    await execAsync(`git -C "${ROOT}" worktree add "${worktreePath}" -b "${branchName}"`, {
      cwd: ROOT,
    });
    console.log(`[${agentType}] Worktree creado: ${worktreePath} (branch: ${branchName})`);
  } catch {
    // Si ya existe, usarlo tal cual
    console.log(`[${agentType}] Usando worktree existente: ${worktreePath}`);
  }

  return worktreePath;
}

async function cleanupWorktree(worktreePath: string): Promise<void> {
  try {
    await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: ROOT });
    console.log(`Worktree eliminado: ${worktreePath}`);
  } catch (e) {
    console.warn(`No se pudo eliminar worktree: ${worktreePath}`);
  }
}

async function mergeWorktreeBranch(taskId: string, agentType: AgentType): Promise<void> {
  const branchName = `agent/${agentType}/${taskId.slice(0, 8)}`;
  try {
    // Check if branch has commits ahead of main
    const { stdout: aheadCount } = await execAsync(
      `git -C "${ROOT}" rev-list --count main..${branchName}`,
    );
    if (parseInt(aheadCount.trim()) === 0) {
      console.log(`[${agentType}] Sin cambios que mergear.`);
      return;
    }

    // Merge into main with a merge commit
    await execAsync(`git -C "${ROOT}" merge --no-ff ${branchName} -m "merge: agente ${agentType} — tarea ${taskId.slice(0, 8)}"`, { cwd: ROOT });
    console.log(`✅ [${agentType}] Merge a main completado: ${branchName}`);

    // Delete the branch
    await execAsync(`git -C "${ROOT}" branch -d ${branchName}`, { cwd: ROOT });
  } catch (e: any) {
    console.warn(`[${agentType}] No se pudo hacer merge automático: ${e.message}`);
    console.warn(`  → Mergea manualmente: git merge ${branchName}`);
  }
}

// ─── Escalation hook ────────────────────────────────────────────────────────

function makeEscalationHook(taskId: string, agentType: AgentType): HookCallback {
  // Guarda en Supabase cuando el agente pide input humano via AskUserQuestion
  return async (input: any) => {
    if (input.tool_name === 'AskUserQuestion') {
      const question = input.tool_input?.question ?? 'El agente necesita input';
      const context = input.tool_input?.options ? JSON.stringify(input.tool_input.options) : '';

      await supabase.from('agent_escalations').insert({
        task_id: taskId,
        agent_type: agentType,
        question,
        context,
      });

      console.log(`\n⚠️  [${agentType}] ESCALACIÓN: ${question}`);

      // Respuesta default para no bloquear (el humano puede responder en Supabase)
      return { content: 'Continúa con tu mejor criterio. Si no puedes avanzar, marca la tarea como "blocked".' };
    }
    return {};
  };
}

// ─── Ejecutar un agente ─────────────────────────────────────────────────────

async function runAgent(task: AgentTask): Promise<void> {
  const { id, title, description, agent_type } = task;

  console.log(`\n🤖 Iniciando agente [${agent_type}]: ${title}`);

  // Marcar como en progreso
  await supabase.from('agent_tasks').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', id);

  let worktreePath: string | null = null;

  try {
    // Crear worktree aislado para agentes que modifican código
    const needsWorktree = ['programmer', 'database', 'matching', 'lead'].includes(agent_type);
    if (needsWorktree) {
      worktreePath = await createWorktree(id, agent_type);
    }

    const cwd = worktreePath ?? ROOT;
    const prompt = `# Tarea: ${title}\n\n${description}\n\n---\nAl terminar, haz commit de todos los cambios con un mensaje descriptivo. Si necesitas input humano (credenciales, decisiones de pago, accesos), usa AskUserQuestion una sola vez y explica exactamente qué necesitas y por qué.`;

    let fullOutput = '';
    let lastActivity = Date.now();

    for await (const message of query({
      prompt,
      options: {
        cwd,
        allowedTools: AGENT_TOOLS[agent_type],
        systemPrompt: AGENT_PROMPTS[agent_type],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxTurns: 80,
        model: 'claude-opus-4-6',
        hooks: {
          PreToolUse: [{
            matcher: 'AskUserQuestion',
            hooks: [makeEscalationHook(id, agent_type)],
          }],
        },
      },
    })) {
      if ('result' in message) {
        fullOutput = message.result ?? '';
        console.log(`✅ [${agent_type}] Completado: ${title}`);
      } else if (message.type === 'assistant') {
        lastActivity = Date.now();
        // Log progreso cada vez que el agente habla
        const textBlock = (message as any).content?.find((b: any) => b.type === 'text');
        if (textBlock?.text) {
          process.stdout.write(`[${agent_type}] ${textBlock.text.slice(0, 120)}\n`);
        }
      }
    }

    // Merge cambios a main antes de limpiar el worktree
    if (worktreePath) {
      await mergeWorktreeBranch(id, agent_type);
    }

    // Guardar resultado
    await supabase.from('agent_tasks').update({
      status: 'done',
      output: fullOutput,
      completed_at: new Date().toISOString(),
    }).eq('id', id);

  } catch (error: any) {
    console.error(`❌ [${agent_type}] Error en tarea ${id}:`, error.message);
    await supabase.from('agent_tasks').update({
      status: 'failed',
      error: error.message,
      completed_at: new Date().toISOString(),
    }).eq('id', id);
  } finally {
    if (worktreePath) {
      await cleanupWorktree(worktreePath);
    }
  }
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function processPendingTasks(): Promise<void> {
  const { data: tasks, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(MAX_PARALLEL_AGENTS);

  if (error) {
    console.error('Error leyendo tareas:', error.message);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log('No hay tareas pendientes.');
    return;
  }

  console.log(`\n📋 ${tasks.length} tarea(s) pendiente(s). Ejecutando en paralelo...`);

  // Ejecutar todos los agentes en paralelo
  await Promise.allSettled(tasks.map(runAgent));
}

async function main(): Promise<void> {
  console.log('🚀 Agent Orchestrator iniciado');
  console.log(`   Modo: ${WATCH_MODE ? 'watch (continuo)' : 'one-shot'}`);
  console.log(`   Agentes paralelos: ${MAX_PARALLEL_AGENTS}`);
  console.log(`   Proyecto: ${ROOT}\n`);

  if (WATCH_MODE) {
    while (true) {
      await processPendingTasks();
      console.log(`\n⏳ Esperando ${POLL_INTERVAL_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  } else {
    await processPendingTasks();
    process.exit(0);
  }
}

main().catch(console.error);
