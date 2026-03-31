/**
 * self-improve.mjs
 *
 * Bucle autónomo de mejora continua.
 * En cada iteración:
 *   1. Analiza el codebase (TS errors, TODOs, calidad de datos, UX issues)
 *   2. Elige el problema de mayor impacto
 *   3. Llama a Claude Code CLI para implementarlo
 *   4. Hace git commit
 *   5. Espera un poco y vuelve a empezar
 *
 * Uso: node scripts/self-improve.mjs
 *       node scripts/self-improve.mjs --pausa 120  (segundos entre iteraciones)
 *       node scripts/self-improve.mjs --max 10     (máx iteraciones, 0=infinito)
 *       node scripts/self-improve.mjs --dry        (solo analiza, no implementa)
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOG_FILE = join(ROOT, 'scripts', '.self-improve.log');
const HEARTBEAT_FILE = join(ROOT, 'scripts', '.self-improve.heartbeat');
const CLAUDE_EXE = `"${process.env.USERPROFILE || 'C:\\Users\\ABC'}\\.local\\bin\\claude.exe"`;

// ─── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const pausaIdx = args.indexOf('--pausa');
const maxIdx = args.indexOf('--max');
const PAUSA_SEG = pausaIdx !== -1 ? parseInt(args[pausaIdx + 1]) : 90;
const MAX_ITER = maxIdx !== -1 ? parseInt(args[maxIdx + 1]) : 0; // 0 = infinito
const DRY = args.includes('--dry');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg, level = 'INFO') {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  try {
    const prev = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf-8') : '';
    writeFileSync(LOG_FILE, prev.split('\n').slice(-500).join('\n') + '\n' + line);
  } catch { /* ignore */ }
}

function heartbeat() {
  try {
    writeFileSync(HEARTBEAT_FILE, new Date().toISOString());
  } catch { /* ignore */ }
}

// ─── Diagnóstico del codebase ─────────────────────────────────────────────────

function diagnosticar() {
  const hallazgos = [];

  // 1. TypeScript errors (rápido, no compila todo)
  try {
    const tsc = execSync('npx tsc --noEmit 2>&1', { cwd: ROOT, encoding: 'utf-8', timeout: 60000 });
    const errores = tsc.match(/error TS\d+/g)?.length ?? 0;
    if (errores > 0) hallazgos.push({ prio: 8, tipo: 'typescript', desc: `${errores} errores TypeScript`, cmd: 'npx tsc --noEmit 2>&1' });
  } catch (e) {
    const errores = (e.stdout || '').match(/error TS\d+/g)?.length ?? 0;
    if (errores > 0) hallazgos.push({ prio: 8, tipo: 'typescript', desc: `${errores} errores TypeScript`, detalle: (e.stdout || '').split('\n').slice(0, 10).join('\n') });
  }

  // 2. TODOs críticos en el código
  try {
    const todos = execSync('grep -rn "TODO\\|FIXME\\|HACK\\|XXX\\|COMPLETAR" --include="*.ts" --include="*.tsx" app/ components/ 2>/dev/null | head -30', { cwd: ROOT, encoding: 'utf-8', timeout: 15000 });
    const count = todos.split('\n').filter(Boolean).length;
    if (count > 0) hallazgos.push({ prio: 5, tipo: 'todos', desc: `${count} TODOs/FIXMEs en el código`, detalle: todos.slice(0, 800) });
  } catch { /* grep vacío */ }

  // 3. Imports rotos o componentes no usados
  try {
    const lint = execSync('npx eslint app/ components/ --max-warnings 0 --format compact 2>&1 | head -20', { cwd: ROOT, encoding: 'utf-8', timeout: 45000 });
    const errLint = lint.match(/\d+ errors?/)?.[0];
    if (errLint) hallazgos.push({ prio: 6, tipo: 'eslint', desc: `ESLint: ${errLint}`, detalle: lint.slice(0, 600) });
  } catch (e) {
    const errLint = (e.stdout || '').match(/\d+ error/)?.[0];
    if (errLint) hallazgos.push({ prio: 6, tipo: 'eslint', desc: `ESLint: ${errLint}`, detalle: (e.stdout || '').slice(0, 600) });
  }

  // 4. APIs sin manejo de errores (pattern: .json() sin try/catch en route.ts)
  try {
    const noTryCatch = execSync('grep -rn "await.*\\.json()" --include="*.ts" app/api/ 2>/dev/null | grep -v "try" | grep -v "catch" | head -10', { cwd: ROOT, encoding: 'utf-8', timeout: 10000 });
    const count = noTryCatch.split('\n').filter(Boolean).length;
    if (count > 2) hallazgos.push({ prio: 4, tipo: 'error_handling', desc: `${count} llamadas .json() sin try/catch en API routes`, detalle: noTryCatch });
  } catch { /* ok */ }

  // 5. Componentes landing sin viewport meta / mobile issues
  try {
    const noMobile = execSync('grep -rn "grid-template-columns.*3" --include="*.tsx" components/landing/ 2>/dev/null | head -5', { cwd: ROOT, encoding: 'utf-8', timeout: 10000 });
    const count = noMobile.split('\n').filter(Boolean).length;
    if (count > 0) hallazgos.push({ prio: 3, tipo: 'mobile', desc: `${count} grids de 3 columnas en landing sin breakpoint mobile`, detalle: noMobile });
  } catch { /* ok */ }

  // 6. Expedientes sin subvencion_id (data quality)
  hallazgos.push({ prio: 4, tipo: 'data_quality', desc: 'Expedientes demo sin subvencion_id enlazado — memoria técnica ciega' });

  // 7. Rutas API sin validación de autenticación
  try {
    const sinAuth = execSync('grep -rL "getUser\\|auth\\." app/api/ --include="route.ts" 2>/dev/null | head -10', { cwd: ROOT, encoding: 'utf-8', timeout: 10000 });
    const count = sinAuth.split('\n').filter(Boolean).length;
    if (count > 0) hallazgos.push({ prio: 7, tipo: 'security', desc: `${count} routes API potencialmente sin autenticación`, detalle: sinAuth });
  } catch { /* ok */ }

  // Ordenar por prioridad desc
  return hallazgos.sort((a, b) => b.prio - a.prio);
}

// ─── Construcción del prompt para Claude ─────────────────────────────────────

function buildPrompt(hallazgos, iteracion) {
  const top = hallazgos.slice(0, 3);
  const topStr = top.map((h, i) => `${i + 1}. [${h.tipo}] (prio ${h.prio}/10) ${h.desc}${h.detalle ? '\n   Detalle:\n   ' + h.detalle.replace(/\n/g, '\n   ').slice(0, 400) : ''}`).join('\n\n');

  return `Eres un ingeniero senior trabajando en AyudaPyme (SaaS de subvenciones para PYMEs españolas).
Estás en la iteración ${iteracion} de un bucle de mejora autónoma.

Problemas detectados automáticamente (ordenados por impacto):

${topStr}

INSTRUCCIONES:
1. Escoge el problema de mayor impacto que puedas resolver COMPLETAMENTE en esta sesión.
2. Lee los archivos relevantes antes de modificarlos.
3. Implementa la solución completa — no dejes partes a medias.
4. Haz git add y git commit con mensaje descriptivo al terminar.
5. Si el problema ya está resuelto, elige el siguiente de la lista.
6. No toques lo que ya funciona — solo arregla lo roto o añade lo que claramente falta.
7. Prioriza calidad y funcionalidad real sobre estética.

Trabaja de forma autónoma. No pidas confirmación.`;
}

// ─── Ejecutar Claude CLI ───────────────────────────────────────────────────────

function ejecutarClaude(prompt) {
  return new Promise((resolve) => {
    log(`Lanzando Claude CLI...`);

    const child = spawn(CLAUDE_EXE, [
      '--print',
      '--max-turns', '30',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
      prompt,
    ], {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000, // 10 min max por iteración
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => {
      process.stdout.write(d);
      stdout += d.toString();
      heartbeat();
    });
    child.stderr.on('data', d => {
      process.stderr.write(d);
      stderr += d.toString();
    });

    child.on('close', (code) => {
      log(`Claude terminó con código ${code}`);
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      log(`Error lanzando Claude: ${err.message}`, 'ERROR');
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

// ─── Verificar cambios y commit ────────────────────────────────────────────────

function verificarYCommit() {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (!status) {
      log('Sin cambios en git — Claude no modificó nada');
      return false;
    }
    // Claude debería haber hecho el commit. Si no, lo hacemos nosotros.
    const uncommited = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
    if (uncommited) {
      execSync('git add -A && git commit -m "chore: mejoras automáticas self-improve loop"', { cwd: ROOT, encoding: 'utf-8' });
      log('Commit automático de respaldo realizado');
    }
    return true;
  } catch (e) {
    log(`Error en git: ${e.message}`, 'WARN');
    return false;
  }
}

// ─── Bucle principal ───────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     AyudaPyme — Self-Improve Loop v1.0            ║
║  Pausa: ${String(PAUSA_SEG + 's').padEnd(6)} | Max iter: ${String(MAX_ITER || '∞').padEnd(5)} | Dry: ${DRY ? 'sí' : 'no'}   ║
╚═══════════════════════════════════════════════════╝
`);

  log(`Iniciando bucle. PID: ${process.pid}`);
  heartbeat();

  let iteracion = 0;

  while (true) {
    iteracion++;
    if (MAX_ITER > 0 && iteracion > MAX_ITER) {
      log(`Máximo de ${MAX_ITER} iteraciones alcanzado. Fin.`);
      break;
    }

    console.log(`\n${'═'.repeat(60)}`);
    log(`ITERACIÓN ${iteracion} — Diagnosticando codebase...`);
    heartbeat();

    let hallazgos = [];
    try {
      hallazgos = diagnosticar();
    } catch (e) {
      log(`Error en diagnóstico: ${e.message}`, 'WARN');
    }

    if (hallazgos.length === 0) {
      log('Sin problemas detectados. Proyecto en perfecto estado. Durmiendo 5 min...');
      await sleep(5 * 60 * 1000);
      continue;
    }

    log(`Detectados ${hallazgos.length} problemas. Top: ${hallazgos[0].desc}`);

    if (DRY) {
      log('Modo dry — listando problemas sin implementar:');
      hallazgos.forEach((h, i) => log(`  ${i + 1}. [prio ${h.prio}] ${h.desc}`));
      log('Fin modo dry. Saliendo.');
      break;
    }

    const prompt = buildPrompt(hallazgos, iteracion);

    log(`Enviando tarea a Claude CLI...`);
    const result = await ejecutarClaude(prompt);

    if (result.code !== 0 && result.code !== null) {
      log(`Claude terminó con error (código ${result.code})`, 'WARN');
    }

    verificarYCommit();
    heartbeat();

    log(`Iteración ${iteracion} completada. Esperando ${PAUSA_SEG}s antes de la siguiente...`);
    await sleep(PAUSA_SEG * 1000);
  }
}

main().catch(err => {
  log(`Error fatal: ${err.message}`, 'ERROR');
  process.exit(1);
});
