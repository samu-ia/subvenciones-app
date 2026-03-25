const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let i = 0;
const shot = async (page, name) => {
  const f = String(i++).padStart(2, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, f), fullPage: true });
  console.log('  [screenshot]', f);
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const typeInto = async (page, sel, text) => { await page.click(sel, { clickCount: 3 }); await page.type(sel, text); };
const signOut = async (page) => {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await wait(500);
};
const login = async (page, email, password) => {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder');
    if (btn) btn.click();
  });
  await wait(1500);
  await typeInto(page, 'input[type="email"]', email);
  await typeInto(page, 'input[type="password"]', password);
  await page.click('button[type="submit"]');
  await wait(4000);
  return page.url();
};

(async () => {
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('localhost')) errors.push(`${r.status()} ${r.url().split('?')[0]}`); });

  try {
    // --- Client login ---
    console.log('=== CLIENT LOGIN ===');
    const url = await login(page, 'demo.lamar@ayudapyme.es', 'Client123456!');
    console.log('URL:', url);
    await shot(page, 'portal-home');

    // --- Portal sections ---
    console.log('\n--- Portal: Inicio (default) ---');
    const homeInfo = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      const matchCards = document.querySelectorAll('[style*="border-radius"][style*="border"]').length;
      return { h1, matchCards };
    });
    console.log('H1:', homeInfo.h1, '| Match cards approx:', homeInfo.matchCards);

    // --- Mis subvenciones ---
    console.log('\n--- Portal: Mis subvenciones ---');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mis subvenciones');
      if (btn) btn.click();
    });
    await wait(2000);
    await shot(page, 'portal-mis-subvenciones');

    // --- Mi Gestor (chat) ---
    console.log('\n--- Portal: Mi Gestor ---');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mi Gestor');
      if (btn) btn.click();
    });
    await wait(2000);
    await shot(page, 'portal-mi-gestor');

    const chatInfo = await page.evaluate(() => {
      const hasMessages = document.body.textContent.includes('No hay mensajes') || document.body.textContent.includes('mensaje');
      const hasInput = !!document.querySelector('textarea, input[placeholder*="mensaje"]');
      const textareaPlaceholder = document.querySelector('textarea')?.placeholder || '';
      return { hasMessages, hasInput, textareaPlaceholder };
    });
    console.log('Chat - has input:', chatInfo.hasInput, '| placeholder:', chatInfo.textareaPlaceholder);

    // Send a test message from portal
    if (chatInfo.hasInput) {
      await page.type('textarea', 'Hola, tengo una pregunta sobre las subvenciones disponibles');
      await shot(page, 'portal-chat-message-typed');

      // Find send button
      const sent = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]') ||
          Array.from(document.querySelectorAll('button')).find(b => /enviar|send/i.test(b.title || b.textContent));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await wait(2000);
      if (sent) {
        await shot(page, 'portal-chat-after-send');
        console.log('Message sent!');
      }
    }

    // --- Mi empresa ---
    console.log('\n--- Portal: Mi empresa ---');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mi empresa');
      if (btn) btn.click();
    });
    await wait(1500);
    await shot(page, 'portal-mi-empresa');

    const empresaInfo = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('h2, h3')).map(h => h.textContent.trim()).slice(0, 5);
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).length;
      return { sections, inputs };
    });
    console.log('Mi empresa sections:', empresaInfo.sections.join(' | '));
    console.log('Mi empresa inputs:', empresaInfo.inputs);

    // --- Admin: Check message received ---
    console.log('\n=== ADMIN: Check received messages ===');
    await signOut(page);
    const adminUrl = await login(page, 'admin@ayudapyme.es', 'Admin123456!');
    console.log('Admin URL:', adminUrl);

    await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    await shot(page, 'admin-chats-after-client-message');

    const chatsInfo = await page.evaluate(() => {
      const noConv = document.body.textContent.includes('No hay conversaciones');
      const convs = Array.from(document.querySelectorAll('button')).filter(b => {
        const style = window.getComputedStyle(b);
        return b.querySelector('span') || b.textContent.length > 20;
      }).map(b => b.textContent.trim().substring(0, 60)).filter(t => t.length > 5);
      return { noConv, convs: convs.slice(0, 5) };
    });
    console.log('Admin chats - no conv:', chatsInfo.noConv);
    if (!chatsInfo.noConv) {
      console.log('Conversations:', chatsInfo.convs.join(' | '));
    }

    // --- Summary ---
    console.log('\n=== SUMMARY ===');
    const unique = [...new Set(errors)];
    if (unique.length === 0) {
      console.log('No network errors!');
    } else {
      console.log('Network errors:');
      unique.forEach(e => console.log(' -', e));
    }

  } catch (err) {
    console.error('\nFATAL:', err.message);
    try { await shot(page, 'FATAL'); } catch (e) {}
  } finally {
    await browser.close();
    console.log('\nDone. Screenshots:', OUT);
  }
})();
