/**
 * bucle-maestro.mjs
 *
 * Sistema de mejora continua autónoma para AyudaPyme.
 * Corre indefinidamente. En cada ronda:
 *
 *  1. SALUD        — DB stats, pipeline state, data quality
 *  2. CÓDIGO       — TypeScript errors, TODOs, security patterns
 *  3. APIs         — Test endpoints clave (stats, matches, expedientes)
 *  4. PIPELINE     — Ingestar nuevas subvenciones si hace falta
 *  5. MATCHING     — Recalcular matches si hay nuevas subvenciones
 *  6. IA ANÁLISIS  — Claude analiza hallazgos y genera fixes concretos
 *  7. COMMIT       — Guarda todo, push si hay cambios
 *  8. INFORME      — Log detallado de la ronda
 *
 * Uso:
 *   node scripts/bucle-maestro.mjs
 *   node scripts/bucle-maestro.mjs --pausa 120    # segundos entre rondas
 *   node scripts/bucle-maestro.mjs --max 5        # máx 5 rondas
 *   node scripts/bucle-maestro.mjs --dry          # solo diagnóstico, no toca código
 *   node scripts/bucle-maestro.mjs --pipeline-solo # solo mantenimiento de pipeline
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    const env = {};
    raw.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).forEach(l => {
      const i = l.indexOf('=');
      env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    });
    return env;
  } catch { return {}; }
}

const ENV = loadEnv();
const sb = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

const args = process.argv.slice(2);
const PAUSA_SEG = parseInt(args[args.indexOf('--pausa') + 1] || '120');
const MAX_RONDAS = parseInt(args[args.indexOf('--max') + 1] || '0');
const DRY = args.includes('--dry');
const PIPELINE_SOLO = args.includes('--pipeline-solo');

const LOG_FILE = join(ROOT, 'scripts', '.bucle-maestro.log');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Logging ───────────────────────────────────────────────────────────────────

let rondaActual = 0;
const rondaLog = [];

function log(msg, nivel = 'INFO') {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const linea = `[${ts}][R${rondaActual}][${nivel}] ${msg}`;
  console.log(linea);
  rondaLog.push(linea);
  try { appendFileSync(LOG_FILE, linea + '\n'); } catch { /* ignore */ }
}

function sep(titulo) {
  const line = `${'═'.repeat(60)}`;
  console.log(`\n${line}\n  ${titulo}\n${line}`);
}

// ─── MÓDULO 1: SALUD DE BD ─────────────────────────────────────────────────────

async function checkSalud() {
  sep('MÓDULO 1 — Salud de BD');
  const hallazgos = [];

  try {
    const [
      { count: totalSubs },
      { count: sinPdf },
      { count: sinTitulo },
      { count: totalMatches },
      { count: sinMotivo },
      { count: erroresPipeline },
      { count: expTotal },
      { count: expSinFase },
    ] = await Promise.all([
      sb.from('subvenciones').select('*', { count: 'exact', head: true }),
      sb.from('subvenciones').select('*', { count: 'exact', head: true }).eq('pdf_procesado', false),
      sb.from('subvenciones').select('*', { count: 'exact', head: true }).is('titulo_comercial', null),
      sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true }),
      sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true }).is('motivos', null),
      sb.from('subvenciones').select('*', { count: 'exact', head: true }).eq('pipeline_fase', 'error'),
      sb.from('expediente').select('*', { count: 'exact', head: true }),
      sb.from('expediente').select('*', { count: 'exact', head: true }).is('fase', null),
    ]);

    log(`Subvenciones: ${totalSubs} | Sin PDF: ${sinPdf} | Sin título: ${sinTitulo}`);
    log(`Matches: ${totalMatches} | Sin motivo: ${sinMotivo}`);
    log(`Expedientes: ${expTotal} | Sin fase: ${expSinFase}`);
    log(`Pipeline errores: ${erroresPipeline}`);

    if (sinPdf > 0)
      hallazgos.push({ modulo: 'salud', prio: 8, tipo: 'pipeline', desc: `${sinPdf} subvenciones sin PDF procesado`, accion: 'run_pdf' });
    if (sinTitulo > 0)
      hallazgos.push({ modulo: 'salud', prio: 7, tipo: 'pipeline', desc: `${sinTitulo} subvenciones sin titulo_comercial`, accion: 'run_titulos' });
    if (erroresPipeline > 0) {
      const { data: errores } = await sb.from('subvenciones').select('bdns_id, pipeline_error').eq('pipeline_fase', 'error').limit(5);
      hallazgos.push({ modulo: 'salud', prio: 6, tipo: 'pipeline', desc: `${erroresPipeline} subvenciones en estado error`, detalle: errores?.map(e => `${e.bdns_id}: ${e.pipeline_error?.slice(0, 60)}`).join('\n') });
    }
    if (totalMatches < totalSubs * 5)
      hallazgos.push({ modulo: 'salud', prio: 5, tipo: 'matching', desc: `Solo ${totalMatches} matches para ${totalSubs} subvenciones — puede haber clientes sin matches`, accion: 'run_matching' });

    // Comprobar distribución de estados de convocatoria
    const { data: estados } = await sb.from('subvenciones').select('estado_convocatoria');
    const estadoCnt = {};
    estados?.forEach(r => estadoCnt[r.estado_convocatoria] = (estadoCnt[r.estado_convocatoria] || 0) + 1);
    log(`Estados convocatoria: ${JSON.stringify(estadoCnt)}`);
    if ((estadoCnt['abierta'] || 0) < 50)
      hallazgos.push({ modulo: 'salud', prio: 4, tipo: 'data', desc: `Solo ${estadoCnt['abierta'] || 0} convocatorias abiertas — ejecutar pipeline para actualizar` });

  } catch (err) {
    log(`Error en check salud: ${err.message}`, 'ERROR');
  }

  return hallazgos;
}

// ─── MÓDULO 2: CALIDAD DE CÓDIGO ───────────────────────────────────────────────

function checkCodigo() {
  sep('MÓDULO 2 — Calidad de código');
  const hallazgos = [];

  // TypeScript errors (rápido)
  try {
    const result = spawnSync('npx', ['tsc', '--noEmit', '--skipLibCheck'], {
      cwd: ROOT, encoding: 'utf-8', timeout: 90000, shell: true,
    });
    const out = result.stdout + result.stderr;
    const errores = (out.match(/error TS\d+/g) || []).length;
    if (errores > 0) {
      log(`TypeScript: ${errores} errores`, 'WARN');
      hallazgos.push({ modulo: 'codigo', prio: 9, tipo: 'typescript', desc: `${errores} errores TypeScript`, detalle: out.split('\n').filter(l => l.includes('error TS')).slice(0, 8).join('\n') });
    } else {
      log('TypeScript: OK (0 errores)');
    }
  } catch (e) {
    log(`TypeScript check falló: ${e.message}`, 'WARN');
  }

  // TODOs críticos
  try {
    const todos = execSync(
      'grep -rn "TODO\\|FIXME\\|HACK\\|BUG\\|COMPLETAR\\|PENDIENTE" --include="*.ts" --include="*.tsx" app/ components/ 2>/dev/null | grep -v node_modules | head -20',
      { cwd: ROOT, encoding: 'utf-8', timeout: 15000 }
    );
    const count = todos.split('\n').filter(Boolean).length;
    log(`TODOs/FIXMEs: ${count}`);
    if (count > 0)
      hallazgos.push({ modulo: 'codigo', prio: 4, tipo: 'todos', desc: `${count} TODOs/FIXMEs en el código`, detalle: todos.slice(0, 600) });
  } catch { /* grep vacío = OK */ }

  // console.log en producción (no crítico pero limpia el código)
  try {
    const consoleLogs = execSync(
      'grep -rn "console\\.log\\|console\\.error\\|console\\.warn" --include="*.ts" --include="*.tsx" app/ 2>/dev/null | grep -v "\\[" | grep -v "// " | head -15',
      { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
    );
    const count = consoleLogs.split('\n').filter(Boolean).length;
    if (count > 5) {
      log(`console.log en producción: ${count}`, 'WARN');
      hallazgos.push({ modulo: 'codigo', prio: 2, tipo: 'logs', desc: `${count} console.log sin prefijo en app/ (limpiar en producción)`, detalle: consoleLogs.slice(0, 400) });
    }
  } catch { /* ok */ }

  // Rutas API sin autenticación
  try {
    const sinAuth = execSync(
      'grep -rL "getUser\\|createServiceClient\\|Authorization" --include="route.ts" app/api/ 2>/dev/null | grep -v "public\\|callback\\|auth" | head -10',
      { cwd: ROOT, encoding: 'utf-8', timeout: 10000 }
    );
    const rutas = sinAuth.split('\n').filter(Boolean);
    if (rutas.length > 0) {
      log(`Rutas posiblemente sin auth: ${rutas.length}`, 'WARN');
      hallazgos.push({ modulo: 'codigo', prio: 7, tipo: 'security', desc: `${rutas.length} rutas API sin getUser visible`, detalle: rutas.join('\n') });
    }
  } catch { /* ok */ }

  return hallazgos;
}

// ─── MÓDULO 3: TEST DE APIs ────────────────────────────────────────────────────

async function checkAPIs() {
  sep('MÓDULO 3 — Test de APIs (Supabase directo)');
  const hallazgos = [];

  // Test 1: Portal matches endpoint logic
  try {
    const { data: testMatch, error } = await sb
      .from('cliente_subvencion_match')
      .select('id, score, estado, nif')
      .eq('es_hard_exclude', false)
      .gte('score', 0.28)
      .order('score', { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    log(`✓ Query matches: ${testMatch?.length ?? 0} resultados`);
  } catch (e) {
    log(`✗ Query matches falló: ${e.message}`, 'ERROR');
    hallazgos.push({ modulo: 'api', prio: 9, tipo: 'query', desc: `Query de matches falla: ${e.message}` });
  }

  // Test 2: Subvenciones activas (para stats público)
  try {
    const { count, error } = await sb
      .from('subvenciones')
      .select('*', { count: 'exact', head: true })
      .eq('estado_convocatoria', 'abierta');
    if (error) throw new Error(error.message);
    log(`✓ Convocatorias abiertas: ${count}`);
    if (count === 0) hallazgos.push({ modulo: 'api', prio: 8, tipo: 'data', desc: '0 convocatorias abiertas — landing mostrará 0', accion: 'run_pipeline' });
  } catch (e) {
    log(`✗ Query subvenciones abiertas: ${e.message}`, 'ERROR');
  }

  // Test 3: Expedientes con campos críticos
  try {
    const { data: exps, error } = await sb
      .from('expediente')
      .select('id, fase, importe_concedido, importe_subvencion')
      .eq('fase', 'cobro')
      .is('importe_concedido', null);
    if (error) throw new Error(error.message);
    if ((exps?.length ?? 0) > 0) {
      log(`Expedientes en cobro sin importe_concedido: ${exps.length}`, 'WARN');
      hallazgos.push({ modulo: 'api', prio: 6, tipo: 'data', desc: `${exps.length} expedientes en fase cobro sin importe_concedido registrado` });
    } else {
      log('✓ Expedientes en cobro: todos tienen importe_concedido');
    }
  } catch (e) {
    log(`✗ Query expedientes cobro: ${e.message}`, 'ERROR');
  }

  // Test 4: Perfiles sin NIF (clientes con onboarding incompleto)
  try {
    const { count } = await sb
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'cliente')
      .is('nif', null);
    log(`Clientes sin NIF (onboarding incompleto): ${count}`);
  } catch { /* ok */ }

  // Test 5: Alertas activas sin resolver
  try {
    const { count } = await sb
      .from('alertas')
      .select('*', { count: 'exact', head: true })
      .eq('leida', false);
    log(`Alertas sin leer: ${count}`);
  } catch { /* ok */ }

  return hallazgos;
}

// ─── MÓDULO 4: MANTENIMIENTO DE PIPELINE ──────────────────────────────────────

async function mantenimientoPipeline() {
  sep('MÓDULO 4 — Mantenimiento de Pipeline');
  const acciones = [];

  // Verificar si hay subvenciones sin procesar
  const { count: sinPdf } = await sb
    .from('subvenciones').select('*', { count: 'exact', head: true }).eq('pdf_procesado', false);
  const { count: sinTitulo } = await sb
    .from('subvenciones').select('*', { count: 'exact', head: true }).is('titulo_comercial', null);

  if (sinPdf > 0) {
    log(`Procesando ${sinPdf} PDFs pendientes...`);
    try {
      const r = spawnSync('node', ['scripts/pipeline-pdf-real.mjs', '--all'], {
        cwd: ROOT, encoding: 'utf-8', timeout: 300000, env: { ...process.env, ...Object.fromEntries(Object.entries(ENV)) },
      });
      const lines = (r.stdout || '').split('\n').filter(l => l.includes('Resumen') || l.includes('Procesadas') || l.includes('Errores'));
      log(`PDF pipeline: ${lines.join(' | ') || 'completado'}`);
      acciones.push('pdf_procesado');
    } catch (e) { log(`PDF pipeline error: ${e.message}`, 'WARN'); }
  }

  if (sinTitulo > 0) {
    log(`Generando ${sinTitulo} títulos comerciales...`);
    try {
      const r = spawnSync('node', ['scripts/generate-titulos-gemini.mjs'], {
        cwd: ROOT, encoding: 'utf-8', timeout: 180000, env: { ...process.env, ...Object.fromEntries(Object.entries(ENV)) },
      });
      log(`Títulos: ${(r.stdout || '').split('\n').filter(l => l.includes('✅') || l.includes('generados')).join(' | ') || 'completado'}`);
      acciones.push('titulos_generados');
    } catch (e) { log(`Títulos error: ${e.message}`, 'WARN'); }
  }

  // Verificar si han pasado >6h desde el último matching y hay nuevas subvenciones
  const { data: ultimoMatch } = await sb
    .from('cliente_subvencion_match')
    .select('calculado_at')
    .order('calculado_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const horasDesdeMatch = ultimoMatch?.calculado_at
    ? (Date.now() - new Date(ultimoMatch.calculado_at).getTime()) / 3_600_000
    : 999;

  if (horasDesdeMatch > 6 || acciones.length > 0) {
    log(`Re-calculando matches (última vez hace ${horasDesdeMatch.toFixed(1)}h)...`);
    try {
      const r = spawnSync('node', ['scripts/run-matching.mjs'], {
        cwd: ROOT, encoding: 'utf-8', timeout: 300000, env: { ...process.env, ...Object.fromEntries(Object.entries(ENV)) },
      });
      const summary = (r.stdout || '').split('\n').find(l => l.includes('Matches relevantes'));
      log(`Matching: ${summary || 'completado'}`);
      acciones.push('matching_completado');
    } catch (e) { log(`Matching error: ${e.message}`, 'WARN'); }
  } else {
    log(`Matching reciente (hace ${horasDesdeMatch.toFixed(1)}h) — skip`);
  }

  // Ingestar nuevas subvenciones si han pasado >4h
  const { data: ultimaSubvencion } = await sb
    .from('subvenciones')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const horasDesdeIngesta = ultimaSubvencion?.created_at
    ? (Date.now() - new Date(ultimaSubvencion.created_at).getTime()) / 3_600_000
    : 999;

  if (horasDesdeIngesta > 6) {
    log(`Ejecutando pipeline BDNS (última ingesta hace ${horasDesdeIngesta.toFixed(1)}h)...`);
    try {
      const r = spawnSync('node', ['scripts/pipeline-magistral.mjs', '--dias', '7'], {
        cwd: ROOT, encoding: 'utf-8', timeout: 600000, env: { ...process.env, ...Object.fromEntries(Object.entries(ENV)) },
      });
      const lines = (r.stdout || '').split('\n').filter(l => l.includes('OK:') || l.includes('Errores:')).slice(-2);
      log(`Pipeline BDNS: ${lines.join(' | ') || 'completado'}`);
      acciones.push('pipeline_ejecutado');
    } catch (e) { log(`Pipeline BDNS error: ${e.message}`, 'WARN'); }
  } else {
    log(`Pipeline BDNS reciente (hace ${horasDesdeIngesta.toFixed(1)}h) — skip`);
  }

  return acciones;
}

// ─── MÓDULO 5: ANÁLISIS CON CLAUDE + GENERACIÓN DE FIXES ──────────────────────

async function analizarYMejorar(todosHallazgos) {
  sep('MÓDULO 5 — Análisis IA + Generación de mejoras');

  if (todosHallazgos.length === 0) {
    log('Sin hallazgos — sistema en buen estado');
    return null;
  }

  // Seleccionar los top 3 por prioridad
  const top = todosHallazgos.sort((a, b) => b.prio - a.prio).slice(0, 3);

  log(`Analizando ${top.length} hallazgos top con Claude...`);
  log(`Top hallazgo: [prio ${top[0].prio}] ${top[0].desc}`);

  // Solo actuar sobre hallazgos de alta prioridad (>=6) que tienen solución de código
  const accionable = top.find(h => h.prio >= 6 && ['typescript', 'security', 'api', 'query'].includes(h.tipo));
  if (!accionable) {
    log('Ningún hallazgo requiere cambio de código urgente esta ronda');
    return null;
  }

  if (DRY) {
    log(`[DRY] Hallazgo seleccionado: ${accionable.desc}`);
    return null;
  }

  // Contexto del codebase para Claude
  let contextoExtra = '';
  try {
    if (accionable.tipo === 'typescript') {
      const tscOut = spawnSync('npx', ['tsc', '--noEmit', '--skipLibCheck'], {
        cwd: ROOT, encoding: 'utf-8', timeout: 90000, shell: true,
      });
      contextoExtra = `\nOutput TypeScript completo:\n${(tscOut.stdout + tscOut.stderr).slice(0, 2000)}`;
    }
  } catch { /* ok */ }

  const prompt = `Eres un ingeniero senior en AyudaPyme (SaaS de subvenciones para PYMEs españolas).
Stack: Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind + inline styles.

HALLAZGO DETECTADO (ronda ${rondaActual}):
Tipo: ${accionable.tipo}
Prioridad: ${accionable.prio}/10
Descripción: ${accionable.desc}
${accionable.detalle ? `\nDetalle:\n${accionable.detalle}` : ''}
${contextoExtra}

TAREA:
1. Lee los archivos relevantes
2. Implementa el fix completo — no dejes nada a medias
3. Verifica que el build sigue limpio después
4. Haz git add y git commit con mensaje en español formato "fix: descripción"
5. Si ya está resuelto, responde "RESUELTO" y para

Trabaja de forma completamente autónoma. No pidas confirmación.`;

  try {
    const claudeExe = ENV.CLAUDE_CODE_PATH || `"${process.env.USERPROFILE || 'C:\\Users\\ABC'}\\.local\\bin\\claude.exe"`;

    const result = spawnSync(claudeExe, [
      '--print',
      '--max-turns', '25',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
      prompt,
    ], {
      cwd: ROOT, shell: true, encoding: 'utf-8',
      timeout: 8 * 60 * 1000, // 8 minutos max
      env: { ...process.env, ...Object.fromEntries(Object.entries(ENV)) },
    });

    const salida = result.stdout || '';
    if (salida.includes('RESUELTO')) {
      log('Hallazgo ya estaba resuelto');
    } else {
      log('Fix aplicado por Claude CLI');
    }
    return salida;
  } catch (e) {
    log(`Error ejecutando Claude CLI: ${e.message}`, 'WARN');
    return null;
  }
}

// ─── MÓDULO 6: COMMIT Y PUSH ───────────────────────────────────────────────────

function commitYPush() {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (!status) { log('Sin cambios en git'); return false; }

    // Ver si Claude ya hizo commit
    const diff = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (diff) {
      execSync('git add -A', { cwd: ROOT });
      const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
      execSync(`git commit -m "chore: bucle-maestro ronda ${rondaActual} — ${ts}"`, { cwd: ROOT });
      log('Commit de respaldo realizado');
    }

    execSync('git push origin main 2>&1', { cwd: ROOT, encoding: 'utf-8', timeout: 30000 });
    log('Push a origin/main OK');
    return true;
  } catch (e) {
    log(`Git error: ${e.message}`, 'WARN');
    return false;
  }
}

// ─── INFORME FINAL DE RONDA ────────────────────────────────────────────────────

async function informeRonda(hallazgos, accionesPipeline, duracionMs) {
  const durS = (duracionMs / 1000).toFixed(0);

  // Stats actuales
  const [
    { count: totalSubs },
    { count: totalMatches },
    { count: abiertas },
  ] = await Promise.all([
    sb.from('subvenciones').select('*', { count: 'exact', head: true }),
    sb.from('cliente_subvencion_match').select('*', { count: 'exact', head: true }),
    sb.from('subvenciones').select('*', { count: 'exact', head: true }).eq('estado_convocatoria', 'abierta'),
  ]);

  const lineas = [
    ``,
    `╔${'═'.repeat(58)}╗`,
    `║  RONDA ${String(rondaActual).padEnd(4)} — INFORME FINAL  (${durS}s)${' '.repeat(Math.max(0, 26 - durS.length))}║`,
    `╠${'═'.repeat(58)}╣`,
    `║  Subvenciones: ${String(totalSubs).padEnd(5)} | Abiertas: ${String(abiertas).padEnd(5)} | Matches: ${String(totalMatches).padEnd(6)}║`,
    `║  Hallazgos detectados: ${String(hallazgos.length).padEnd(4)} | Acciones pipeline: ${String(accionesPipeline.length).padEnd(3)}║`,
    `╠${'═'.repeat(58)}╣`,
  ];

  if (hallazgos.length > 0) {
    lineas.push(`║  TOP HALLAZGOS:${' '.repeat(43)}║`);
    hallazgos.slice(0, 3).forEach(h => {
      const txt = `[p${h.prio}] ${h.desc}`.slice(0, 54);
      lineas.push(`║    ${txt.padEnd(54)}║`);
    });
  } else {
    lineas.push(`║  ✅ Sin hallazgos críticos — sistema saludable     ║`);
  }

  lineas.push(`╚${'═'.repeat(58)}╝`);
  lineas.push('');

  lineas.forEach(l => console.log(l));

  // Guardar resumen en log
  try {
    appendFileSync(LOG_FILE, lineas.join('\n') + '\n');
  } catch { /* ignore */ }
}

// ─── BUCLE PRINCIPAL ───────────────────────────────────────────────────────────

async function ronda() {
  rondaActual++;
  rondaLog.length = 0;
  const inicio = Date.now();

  console.log(`\n${'█'.repeat(60)}`);
  log(`INICIANDO RONDA ${rondaActual}`);
  console.log(`${'█'.repeat(60)}`);

  let todosHallazgos = [];
  let accionesPipeline = [];

  try {
    if (!PIPELINE_SOLO) {
      // Módulo 1: Salud de BD
      const hallazgosSalud = await checkSalud();
      todosHallazgos.push(...hallazgosSalud);

      // Módulo 2: Calidad de código
      const hallazgosCodigo = checkCodigo();
      todosHallazgos.push(...hallazgosCodigo);

      // Módulo 3: APIs
      const hallazgosAPI = await checkAPIs();
      todosHallazgos.push(...hallazgosAPI);
    }

    // Módulo 4: Pipeline maintenance
    accionesPipeline = await mantenimientoPipeline();

    if (!PIPELINE_SOLO) {
      // Módulo 5: Análisis IA + fixes
      await analizarYMejorar(todosHallazgos);

      // Módulo 6: Commit
      commitYPush();
    }

  } catch (err) {
    log(`Error en ronda ${rondaActual}: ${err.message}`, 'ERROR');
  }

  // Informe
  const duracion = Date.now() - inicio;
  await informeRonda(todosHallazgos, accionesPipeline, duracion);

  return { hallazgos: todosHallazgos.length, acciones: accionesPipeline.length };
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║       AyudaPyme — Bucle Maestro de Mejora Continua       ║
║  Pausa: ${String(PAUSA_SEG + 's').padEnd(6)} | Max: ${String(MAX_RONDAS || '∞').padEnd(5)} | Modo: ${DRY ? 'dry     ' : PIPELINE_SOLO ? 'pipeline' : 'completo'}       ║
╚══════════════════════════════════════════════════════════╝
`);

  log(`PID: ${process.pid} | ANTHROPIC_KEY: ${ENV.ANTHROPIC_API_KEY ? 'OK' : 'FALTA'} | SUPABASE: ${ENV.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'FALTA'}`);

  let numRonda = 0;

  while (true) {
    numRonda++;
    if (MAX_RONDAS > 0 && numRonda > MAX_RONDAS) {
      log(`Máximo de ${MAX_RONDAS} rondas alcanzado. Finalizando.`);
      break;
    }

    try {
      await ronda();
    } catch (err) {
      log(`Error fatal en ronda ${numRonda}: ${err.message}`, 'ERROR');
    }

    if (MAX_RONDAS > 0 && numRonda >= MAX_RONDAS) break;

    log(`Siguiente ronda en ${PAUSA_SEG}s... (Ctrl+C para parar)`);
    await sleep(PAUSA_SEG * 1000);
  }

  log('Bucle maestro finalizado.');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
