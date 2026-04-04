/**
 * scripts/telegram-bot.mjs
 *
 * Bot de Telegram para controlar AyudaPyme desde el móvil.
 * Ejecuta comandos en el servidor local sin gastar tokens de IA,
 * salvo que el mensaje sea texto libre (→ llama a Claude CLI).
 *
 * Uso: node scripts/telegram-bot.mjs
 */

import TelegramBot from 'node-telegram-bot-api';
import { execFile, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OWNER_FILE = path.join(__dirname, '.telegram-owner.json');

// ── Cargar .env.local ────────────────────────────────────────────────────────
const envFile = readFileSync(path.join(ROOT, '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const TOKEN = env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('❌ TELEGRAM_BOT_TOKEN no está en .env.local'); process.exit(1); }

// ── Owner (primer usuario en escribir al bot queda como dueño) ────────────────
let ownerId = null;
if (existsSync(OWNER_FILE)) {
  try { ownerId = JSON.parse(readFileSync(OWNER_FILE, 'utf-8')).id; } catch {}
}

function saveOwner(id) {
  ownerId = id;
  writeFileSync(OWNER_FILE, JSON.stringify({ id }));
}

// ── Bot ───────────────────────────────────────────────────────────────────────
const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot de Telegram arrancado. Escuchando mensajes...');

// Comando rápido: run en el directorio del proyecto
async function run(cmd, timeoutMs = 60000) {
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: ROOT,
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return (stdout + (stderr ? `\n⚠️ stderr:\n${stderr}` : '')).trim().slice(0, 3800);
}

// ── Menú de ayuda ─────────────────────────────────────────────────────────────
const HELP = `*AyudaPyme Bot* 🤖

*Comandos rápidos (sin tokens IA):*
/status — git log + rama actual
/pipeline — ejecutar pipeline BDNS
/matching — recalcular matches
/build — npm run build
/lint — npm run lint
/logs — últimas líneas de log
/db — stats de la BD
/push — git push origin main

*IA (gasta tokens):*
Cualquier otro mensaje → se envía a Claude CLI

/help — este menú`;

// ── Handler principal ─────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text ?? '').trim();

  // Registrar primer usuario como owner
  if (!ownerId) {
    saveOwner(userId);
    await bot.sendMessage(chatId, `✅ Eres el dueño del bot. Ya puedes usarlo.\n\n${HELP}`, { parse_mode: 'Markdown' });
    return;
  }

  // Solo el owner puede usar el bot
  if (userId !== ownerId) {
    await bot.sendMessage(chatId, '🚫 No autorizado.');
    return;
  }

  if (!text) return;

  // ── Comandos sin IA ──────────────────────────────────────────────────────────
  if (text === '/start' || text === '/help') {
    return bot.sendMessage(chatId, HELP, { parse_mode: 'Markdown' });
  }

  if (text === '/status') {
    await bot.sendMessage(chatId, '🔄 Consultando estado...');
    try {
      const [gitLog, branch] = await Promise.all([
        run('git log --oneline -8'),
        run('git branch --show-current'),
      ]);
      return bot.sendMessage(chatId,
        `🌿 Rama: \`${branch}\`\n\n📋 Últimos commits:\n\`\`\`\n${gitLog}\n\`\`\``,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  }

  if (text === '/pipeline') {
    await bot.sendMessage(chatId, '⚙️ Lanzando pipeline BDNS (puede tardar varios minutos)...');
    try {
      const out = await run('node scripts/pipeline-magistral.mjs --fase ingesta 2>&1 | tail -20', 120000);
      return bot.sendMessage(chatId, `✅ Pipeline completado:\n\`\`\`\n${out}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Error pipeline: ${e.message.slice(0, 500)}`);
    }
  }

  if (text === '/matching') {
    await bot.sendMessage(chatId, '🔄 Recalculando matches...');
    try {
      const out = await run('node scripts/run-matching.mjs 2>&1 | tail -15', 120000);
      return bot.sendMessage(chatId, `✅ Matching completado:\n\`\`\`\n${out}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Error: ${e.message.slice(0, 500)}`);
    }
  }

  if (text === '/build') {
    await bot.sendMessage(chatId, '🏗️ Ejecutando npm run build...');
    try {
      const out = await run('npm run build 2>&1 | tail -25', 180000);
      const ok = !out.includes('Error') && !out.includes('Failed');
      return bot.sendMessage(chatId,
        `${ok ? '✅' : '❌'} Build ${ok ? 'OK' : 'con errores'}:\n\`\`\`\n${out}\n\`\`\``,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Build falló:\n\`\`\`\n${e.message.slice(0, 1000)}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  }

  if (text === '/lint') {
    await bot.sendMessage(chatId, '🔍 Ejecutando linter...');
    try {
      const out = await run('npm run lint 2>&1 | tail -20', 60000);
      return bot.sendMessage(chatId, `\`\`\`\n${out || 'Sin errores de lint ✅'}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Lint:\n\`\`\`\n${e.message.slice(0, 1000)}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  }

  if (text === '/logs') {
    try {
      const out = await run('cat scripts/.bucle-maestro-stdout.log 2>/dev/null | tail -20 || echo "Sin logs"');
      return bot.sendMessage(chatId, `📋 Últimos logs:\n\`\`\`\n${out}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ ${e.message}`);
    }
  }

  if (text === '/db') {
    await bot.sendMessage(chatId, '🗄️ Consultando BD...');
    try {
      const out = await run(`node -e "
const {createClient}=require('@supabase/supabase-js');
const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const[{count:s},{count:c},{count:m},{count:e}]=await Promise.all([
    sb.from('subvenciones').select('*',{count:'exact',head:true}),
    sb.from('cliente').select('*',{count:'exact',head:true}),
    sb.from('cliente_subvencion_match').select('*',{count:'exact',head:true}).eq('es_hard_exclude',false),
    sb.from('expediente').select('*',{count:'exact',head:true}),
  ]);
  console.log('Subvenciones: '+s+'\\nClientes: '+c+'\\nMatches: '+m+'\\nExpedientes: '+e);
})().catch(e=>console.error(e.message))
"`, 30000);
      return bot.sendMessage(chatId, `🗄️ *Base de datos:*\n\`\`\`\n${out}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ ${e.message}`);
    }
  }

  if (text === '/push') {
    await bot.sendMessage(chatId, '📤 Haciendo push...');
    try {
      const out = await run('git push origin main 2>&1');
      return bot.sendMessage(chatId, `✅ Push OK:\n\`\`\`\n${out}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
      return bot.sendMessage(chatId, `❌ Push falló: ${e.message.slice(0, 500)}`);
    }
  }

  // ── Texto libre → Claude CLI (gasta tokens) ──────────────────────────────────
  await bot.sendMessage(chatId, '🤔 Consultando a Claude...');
  try {
    const claudePath = env.CLAUDE_CODE_PATH || 'claude';
    const prompt = text.replace(/"/g, '\\"');
    const out = await run(
      `"${claudePath}" --print --dangerously-skip-permissions -p "${prompt}" 2>&1 | tail -50`,
      300000
    );
    const chunks = out.match(/[\s\S]{1,3800}/g) || [out];
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk);
    }
  } catch (e) {
    await bot.sendMessage(chatId, `❌ Error Claude: ${e.message.slice(0, 500)}`);
  }
});

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Bot detenido.');
  bot.stopPolling();
  process.exit(0);
});
