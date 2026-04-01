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
const POLL_INTERVAL_MS = 15_000; // 15 segundos en modo watch

// ─── Tipos ─────────────────────────────────────────────────────────────────

type AgentType = 'lead' | 'product' | 'programmer' | 'database' | 'security' | 'matching' | 'qa';

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

  qa: `Eres el agente de QA visual de AyudaPyme. Pruebas la aplicación como lo haría un usuario humano real.
Tienes visión multimodal: puedes tomar capturas de pantalla con Puppeteer y leerlas con el tool Read.

## Cómo trabajas

1. Escribe un script Puppeteer en /tmp/qa-test.mjs y ejecútalo con Bash
2. El script guarda screenshots en /tmp/qa-screenshots/
3. Lee los screenshots con el tool Read (puedes ver imágenes)
4. Anota los bugs visuales con exactitud: qué sección, qué problema, cómo reproducirlo
5. Escribe un informe detallado en docs/qa/qa-{fecha}.md con capturas embebidas

## Plantilla de script Puppeteer

\`\`\`js
import puppeteer from 'puppeteer';
import fs from 'fs';

fs.mkdirSync('/tmp/qa-screenshots', { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

// Navegar
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
await page.screenshot({ path: '/tmp/qa-screenshots/landing-desktop.png', fullPage: true });

// Mobile
await page.setViewport({ width: 375, height: 812 });
await page.screenshot({ path: '/tmp/qa-screenshots/landing-mobile.png', fullPage: true });

// Hacer clic en un botón
await page.click('button:has-text("Acceder")');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/qa-screenshots/modal-login.png' });

// Rellenar un formulario
await page.type('input[type="email"]', 'test@example.com');
await page.type('input[type="password"]', 'password123');

await browser.close();
console.log('Screenshots guardados en /tmp/qa-screenshots/');
\`\`\`

## Lo que debes probar siempre

- Landing page en desktop (1280px) y mobile (375px)
- Abrir modal de login/registro
- Scroll por todas las secciones de la landing
- Hover states en botones y links
- El formulario de contacto
- Que no haya elementos cortados o con overflow
- Que el texto sea legible (contraste, tamaño)
- Que los CTAs sean visibles y funcionen

## Al encontrar un bug

Documenta exactamente: sección, viewport, descripción visual, screenshot path.
Si es un bug de código arreglable, crea una tarea para el programmer:
  npx dotenvx run -f .env.local -- npx tsx scripts/agents/add-task.ts --agent programmer --title "Fix: <bug>" --desc "<descripción exacta con archivo y línea si la conoces>"

Puppeteer está instalado en el proyecto. El servidor de dev debe estar corriendo en localhost:3000 (o 3001/3002).`,
};

// Herramientas permitidas por agente
const AGENT_TOOLS: Record<AgentType, string[]> = {
  lead:        ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit', 'Agent'],
  product:     ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Write'],
  programmer:  ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'],
  database:    ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
  security:    ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
  qa:          ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
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
  const hook: HookCallback = async (input) => {
    const toolInput = input as { tool_name?: string; tool_input?: { question?: string; options?: unknown } };
    if (toolInput.tool_name === 'AskUserQuestion') {
      const question = toolInput.tool_input?.question ?? 'El agente necesita input';
      const context = toolInput.tool_input?.options ? JSON.stringify(toolInput.tool_input.options) : '';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any;
  };
  return hook;
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
        pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH ?? 'C:\\Users\\ABC\\.local\\bin\\claude.exe',
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

// ─── Auto-generador de tareas cuando la cola está vacía ────────────────────

let _lastAutoGen = 0;
const AUTO_GEN_COOLDOWN_MS = 5 * 60_000; // mínimo 5 min entre auto-generaciones

async function autoGenerateTasks(): Promise<void> {
  const now = Date.now();
  if (now - _lastAutoGen < AUTO_GEN_COOLDOWN_MS) {
    console.log('   (auto-gen en cooldown, esperando...)');
    return;
  }
  _lastAutoGen = now;

  console.log('\n🧠 Cola vacía — generando nuevas tareas automáticamente...');

  // Recopilar contexto del proyecto para el agente lead
  const { data: recentDone } = await supabase
    .from('agent_tasks')
    .select('title, output')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(10);

  const { data: recentFailed } = await supabase
    .from('agent_tasks')
    .select('title, error')
    .eq('status', 'failed')
    .order('completed_at', { ascending: false })
    .limit(5);

  // Leer git log para ver qué se hizo recientemente
  let gitLog = '';
  try {
    gitLog = execSync('git -C ' + ROOT + ' log --oneline -10', { encoding: 'utf8' });
  } catch (_) {}

  const contexto = `
PROYECTO: AyudaPyme — SaaS de subvenciones para PYMEs españolas.
MODELO: success fee 15%. Gestor externo ~100€. Sin papeleo para el cliente.
PRIORIDAD: conseguir clientes YA. Pipeline BDNS+PDF real. Matching determinista.

COMMITS RECIENTES:
${gitLog}

TAREAS COMPLETADAS RECIENTEMENTE:
${(recentDone || []).map(t => `- ${t.title}`).join('\n')}

TAREAS FALLIDAS:
${(recentFailed || []).map(t => `- ${t.title}: ${t.error?.slice(0, 100)}`).join('\n')}

PRIORIDAD DE MEJORAS (en orden):
1. Corregir errores técnicos
2. Mejorar pipeline BDNS+PDF real (extracción de campos)
3. Mejorar matching (más preciso, más útil)
4. Herramientas de ventas (CRM, guiones, prospección)
5. UX del portal y dashboard
6. Automatizaciones que ahorren tiempo al gestor
7. Tests y calidad de datos
`;

  const prompt = `${contexto}

Eres el agente lead de AyudaPyme. La cola de tareas está vacía.
Analiza el estado del proyecto y genera EXACTAMENTE 3 nuevas tareas concretas y útiles.

Para cada tarea, llama a la herramienta add_task con:
- agent_type: programmer | database | qa | product
- title: título concreto (max 60 chars)
- description: descripción detallada de exactamente qué hacer, qué archivos tocar, qué resultado esperar

IMPORTANTE: Las tareas deben ser ejecutables directamente. Sin investigación vaga.
Prioriza cosas que broken, que mejoren datos reales, o que ayuden a vender.`;

  // Usar Anthropic API directamente (native fetch) para generar las tareas
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        system: 'Eres el agente lead de AyudaPyme. Generas tareas concretas y ejecutables para el equipo técnico.',
        tools: [{
          name: 'add_task',
          description: 'Añade una nueva tarea a la cola de agentes',
          input_schema: {
            type: 'object',
            properties: {
              agent_type: { type: 'string', enum: ['programmer', 'database', 'qa', 'product', 'matching'] },
              title: { type: 'string', description: 'Título concreto (max 60 chars)' },
              description: { type: 'string', description: 'Descripción detallada: qué hacer, qué archivos tocar, qué resultado esperar' },
            },
            required: ['agent_type', 'title', 'description'],
          },
        }],
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json() as { content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }> };
    const toolUses = (data.content ?? []).filter(b => b.type === 'tool_use' && b.name === 'add_task');

    for (const tu of toolUses) {
      const input = tu.input as { agent_type: string; title: string; description: string };
      const { error } = await supabase.from('agent_tasks').insert({
        agent_type: input.agent_type,
        title: input.title,
        description: input.description,
        status: 'pending',
        priority: 5,
      });
      if (error) console.error('  Error creando tarea:', error.message);
      else console.log(`  ✅ Tarea creada: [${input.agent_type}] ${input.title}`);
    }

    if (toolUses.length === 0) {
      console.log('  ⚠️ No se generaron tareas nuevas');
    }
  } catch (e: any) {
    console.error('  ❌ Error auto-generando tareas:', e.message);
  }
}

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
    if (WATCH_MODE) {
      await autoGenerateTasks();
    } else {
      console.log('No hay tareas pendientes.');
    }
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
