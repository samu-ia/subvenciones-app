/**
 * keep-alive.mjs
 *
 * Wrapper que mantiene self-improve.mjs corriendo indefinidamente.
 * Si el proceso muere (crash, timeout, error), lo reinicia automáticamente.
 * También escribe un heartbeat cada 30s para detectar si está vivo.
 *
 * Uso: node scripts/keep-alive.mjs
 *       node scripts/keep-alive.mjs --pausa 120 --max 0
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HEARTBEAT_FILE = join(__dirname, '.self-improve.heartbeat');
const STATUS_FILE = join(__dirname, '.self-improve.status');

const args = process.argv.slice(2).join(' ');
const REINICIO_DELAY_MS = 15_000; // 15s entre reinicios
const HEARTBEAT_CHECK_MS = 3 * 60 * 1000; // si sin heartbeat 3min → reiniciar
const HEARTBEAT_INTERVAL_MS = 30_000;

let reinicios = 0;
let proceso = null;

function writeStatus(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    writeFileSync(STATUS_FILE, line);
  } catch { /* ignore */ }
}

function lanzarProceso() {
  reinicios++;
  writeStatus(`Lanzando self-improve.mjs (intento #${reinicios}) ${args}`);

  proceso = spawn('node', [
    join(__dirname, 'self-improve.mjs'),
    ...args.split(' ').filter(Boolean),
  ], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  });

  proceso.on('close', (code) => {
    writeStatus(`self-improve.mjs salió con código ${code}. Reiniciando en ${REINICIO_DELAY_MS / 1000}s...`);
    proceso = null;
    setTimeout(lanzarProceso, REINICIO_DELAY_MS);
  });

  proceso.on('error', (err) => {
    writeStatus(`Error lanzando proceso: ${err.message}. Reiniciando en ${REINICIO_DELAY_MS / 1000}s...`);
    proceso = null;
    setTimeout(lanzarProceso, REINICIO_DELAY_MS);
  });
}

// Heartbeat checker: si lleva más de 3min sin heartbeat → kill + restart
setInterval(() => {
  if (!existsSync(HEARTBEAT_FILE)) return;
  try {
    const lastBeat = new Date(readFileSync(HEARTBEAT_FILE, 'utf-8').trim());
    const elapsed = Date.now() - lastBeat.getTime();
    if (elapsed > HEARTBEAT_CHECK_MS && proceso) {
      writeStatus(`Sin heartbeat por ${Math.round(elapsed / 1000)}s. Matando proceso bloqueado y reiniciando...`);
      proceso.kill('SIGTERM');
      proceso = null;
    }
  } catch { /* ignore */ }
}, HEARTBEAT_CHECK_MS);

// Heartbeat propio
setInterval(() => {
  writeStatus(`keep-alive vivo | reinicios: ${reinicios} | proceso: ${proceso ? proceso.pid : 'muerto'}`);
}, HEARTBEAT_INTERVAL_MS);

// Señales de cierre
process.on('SIGINT', () => {
  writeStatus('keep-alive recibió SIGINT. Parando todo...');
  if (proceso) proceso.kill('SIGTERM');
  process.exit(0);
});
process.on('SIGTERM', () => {
  writeStatus('keep-alive recibió SIGTERM. Parando todo...');
  if (proceso) proceso.kill('SIGTERM');
  process.exit(0);
});

console.log(`
╔═══════════════════════════════════════════════════╗
║     AyudaPyme — Keep-Alive Wrapper                ║
║  Reinicio automático si self-improve muere        ║
║  Ctrl+C para parar todo                           ║
╚═══════════════════════════════════════════════════╝
`);

lanzarProceso();
