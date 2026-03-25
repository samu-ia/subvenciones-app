/**
 * test-full.js — Test completo de todos los flujos admin + portal
 * Uso: node test-full.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Limpiar screenshots anteriores
fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));

let shotIndex = 0;
const issues = [];

async function shot(page, name) {
  const filename = String(shotIndex++).padStart(3, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
  console.log('  [shot]', filename);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkPageErrors(page, context) {
  // Check for JS errors shown in page
  const errTexts = await page.$$eval('*', els =>
    els.filter(e => e.textContent.includes('Error') || e.textContent.includes('error') || e.textContent.includes('404') || e.textContent.includes('500'))
       .filter(e => e.children.length === 0) // leaf nodes only
       .map(e => e.textContent.trim())
       .filter(t => t.length > 0 && t.length < 200)
       .slice(0, 5)
  ).catch(() => []);
  if (errTexts.length > 0) {
    issues.push({ context, type: 'page-text-error', texts: errTexts });
  }
}

async function loginAdmin(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(1500);

  // Click Acceder button
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(b => b.textContent.trim() === 'Acceder' || b.textContent.trim() === 'Iniciar sesión');
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!clicked) {
    // Maybe already on login page
    if (!page.url().includes('/login')) {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 10000 });
    }
  }
  await wait(1000);

  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 8000 });
  await page.type('input[type="email"], input[name="email"]', 'admin@ayudapyme.es');
  await page.type('input[type="password"], input[name="password"]', 'Admin123456!');
  await page.keyboard.press('Enter');
  await wait(3000);
  console.log('  Admin URL after login:', page.url());
}

async function loginPortal(page) {
  // Logout first
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await wait(300);

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(1500);

  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(b => b.textContent.trim() === 'Acceder' || b.textContent.trim() === 'Iniciar sesión');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked && !page.url().includes('/login')) {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 10000 });
  }
  await wait(1000);

  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', 'demo.lamar@ayudapyme.es');
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', 'Client123456!');
  await page.keyboard.press('Enter');
  await wait(3000);
  console.log('  Portal URL after login:', page.url());
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

async function testAdmin(page) {
  console.log('\n=== ADMIN: Login ===');
  await loginAdmin(page);
  await shot(page, 'admin-00-login-result');

  // ── Novedades
  console.log('\n=== ADMIN: Novedades ===');
  await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-01-novedades');
  await checkPageErrors(page, 'novedades');

  // Tab Oportunidades
  const tabOp = await page.$eval('button, [role="tab"]', () => null).catch(() => null);
  const clickedTab = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const t = tabs.find(b => b.textContent.includes('Oportunidades'));
    if (t) { t.click(); return true; }
    return false;
  });
  if (clickedTab) {
    await wait(1000);
    await shot(page, 'admin-02-novedades-oportunidades');
  }

  // Tab Mensajes
  const clickedMsg = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const t = tabs.find(b => b.textContent.includes('Mensaje'));
    if (t) { t.click(); return true; }
    return false;
  });
  if (clickedMsg) {
    await wait(1000);
    await shot(page, 'admin-03-novedades-mensajes');
  }

  // ── Clientes lista
  console.log('\n=== ADMIN: Clientes ===');
  await page.goto(BASE + '/clientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-04-clientes');

  const nClientRows = await page.$$eval('table tbody tr, [data-testid="cliente-row"]', els => els.length).catch(() => 0);
  const nClientCards = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/clientes/"]'));
    return links.filter(l => !l.href.includes('/nuevo')).length;
  });
  console.log(`  Clientes en lista: ~${Math.max(nClientRows, nClientCards)}`);

  // Buscar cliente
  const searchInput = await page.$('input[placeholder*="buscar"], input[placeholder*="Buscar"], input[type="search"]');
  if (searchInput) {
    await searchInput.type('Tech');
    await wait(600);
    await shot(page, 'admin-05-clientes-search');
    await searchInput.click({ clickCount: 3 });
    await searchInput.type(' ');
    await wait(400);
  }

  // Click primer cliente
  const primerCliente = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/clientes/"]'));
    const l = links.find(l => !l.href.includes('/nuevo'));
    return l ? l.href : null;
  });
  if (primerCliente) {
    await page.goto(primerCliente, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'admin-06-cliente-detalle');
    await checkPageErrors(page, 'cliente-detalle');
  }

  // ── Reuniones
  console.log('\n=== ADMIN: Reuniones ===');
  await page.goto(BASE + '/reuniones', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-07-reuniones');

  // Nueva reunión (formulario)
  await page.goto(BASE + '/reuniones/nueva', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-08-reunion-nueva');
  await checkPageErrors(page, 'reunion-nueva');

  // ── Expedientes
  console.log('\n=== ADMIN: Expedientes ===');
  await page.goto(BASE + '/expedientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-09-expedientes');

  const primerExpediente = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/expedientes/"]'));
    const l = links.find(l => !l.href.includes('/nuevo'));
    return l ? l.href : null;
  });
  if (primerExpediente) {
    await page.goto(primerExpediente, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'admin-10-expediente-detalle');
    await checkPageErrors(page, 'expediente-detalle');
  }

  // ── Solicitudes
  console.log('\n=== ADMIN: Solicitudes ===');
  await page.goto(BASE + '/solicitudes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-11-solicitudes');
  await checkPageErrors(page, 'solicitudes');

  // ── Chats
  console.log('\n=== ADMIN: Chats ===');
  await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-12-chats');

  // Click primera conversación si existe
  const clickedConv = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[class*="conv"], [class*="chat"], [class*="item"]'));
    if (items.length > 0) { items[0].click(); return true; }
    // Try clicking any div that looks like a chat item
    const divs = Array.from(document.querySelectorAll('div')).filter(d =>
      d.children.length > 0 && d.textContent.length > 10 && d.textContent.length < 100
    );
    return false;
  });

  // Buscar la primera conversación clicable
  const firstChat = await page.evaluate(() => {
    // Look for empresa names in chats panel
    const panel = document.querySelector('[style*="overflow"]') || document.body;
    const clickable = panel.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"]');
    if (clickable.length > 0) { clickable[0].click(); return true; }
    return false;
  });
  if (firstChat) {
    await wait(1000);
    await shot(page, 'admin-13-chat-abierto');

    // Send a message
    const msgInput = await page.$('textarea, input[placeholder*="mensaje"], input[placeholder*="Mensaje"]');
    if (msgInput) {
      await msgInput.type('Hola, ¿en qué podemos ayudarle?');
      await wait(300);
      const sendBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(b => b.textContent.includes('Enviar') || b.querySelector('svg'));
        if (b) { b.click(); return true; }
        return false;
      });
      await wait(1500);
      await shot(page, 'admin-14-chat-mensaje-enviado');
    }
  }

  // ── Subvenciones pipeline
  console.log('\n=== ADMIN: Pipeline BDNS ===');
  await page.goto(BASE + '/subvenciones-bd', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'admin-15-pipeline-bdns');
  await checkPageErrors(page, 'pipeline-bdns');

  // ── Ajustes
  console.log('\n=== ADMIN: Ajustes ===');
  await page.goto(BASE + '/ajustes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-16-ajustes');
  await checkPageErrors(page, 'ajustes');
}

async function testPortal(page) {
  console.log('\n=== PORTAL: Login ===');
  await loginPortal(page);
  await shot(page, 'portal-00-login-result');

  const url = page.url();
  if (!url.includes('/portal')) {
    issues.push({ context: 'portal-login', type: 'redirect-fail', url });
    console.log('  AVISO: No redirigió al portal, URL:', url);
    await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
  }

  await shot(page, 'portal-01-inicio');
  await checkPageErrors(page, 'portal-inicio');

  // Contar subvenciones
  const nMatch = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[class*="card"], [class*="item"]'));
    return els.length;
  });
  console.log('  Elementos en portal:', nMatch);

  // Navegar secciones del portal
  const sections = ['Mis subvenciones', 'Mi empresa', 'Mis expedientes', 'Mis solicitudes'];
  for (const sec of sections) {
    const clicked = await page.evaluate((name) => {
      const btns = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      const b = btns.find(b => b.textContent.trim().includes(name));
      if (b) { b.click(); return true; }
      return false;
    }, sec);
    if (clicked) {
      await wait(1200);
      const safeName = sec.replace(/\s+/g, '-').toLowerCase();
      await shot(page, `portal-02-${safeName}`);
      await checkPageErrors(page, `portal-${safeName}`);
    }
  }

  // Abrir una subvención y ver detalles
  console.log('\n=== PORTAL: Ver detalle subvención ===');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const b = btns.find(b => b.textContent.includes('Mis subvenciones') || b.textContent.includes('subvenciones'));
    if (b) b.click();
  });
  await wait(1000);

  const clickedSubv = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.textContent.includes('Quiero') || b.textContent.includes('Ver más') || b.textContent.includes('Solicitar'));
    if (b) { b.click(); return true; }
    return false;
  });
  if (clickedSubv) {
    await wait(1500);
    await shot(page, 'portal-03-subvencion-detalle');
    await checkPageErrors(page, 'portal-subvencion-detalle');

    // Close modal if open
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // Sección Mi empresa / perfil
  console.log('\n=== PORTAL: Mi empresa ===');
  const clickedEmpresa = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
    const b = btns.find(b => b.textContent.trim().includes('Mi empresa') || b.textContent.trim().includes('empresa'));
    if (b) { b.click(); return true; }
    return false;
  });
  if (clickedEmpresa) {
    await wait(1200);
    await shot(page, 'portal-04-mi-empresa');
  }

  // Chat con gestor en portal
  console.log('\n=== PORTAL: Chat gestor ===');
  const clickedChat = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const b = btns.find(b => b.textContent.includes('Chat') || b.textContent.includes('Preguntar') || b.textContent.includes('Gestor'));
    if (b) { b.click(); return true; }
    return false;
  });
  if (clickedChat) {
    await wait(1200);
    await shot(page, 'portal-05-chat');

    const msgInput = await page.$('textarea, input[placeholder*="pregunta"], input[placeholder*="mensaje"]');
    if (msgInput) {
      await msgInput.type('¿Cuándo cierran las solicitudes de la AECA?');
      await wait(300);
      await page.keyboard.press('Enter');
      await wait(2000);
      await shot(page, 'portal-06-chat-respuesta');
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const networkErrors = [];
  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('favicon') && !url.includes('_next')) {
      networkErrors.push({ url, status });
    }
  });
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await testAdmin(page);
    await testPortal(page);
  } catch (err) {
    console.error('\n[ERROR FATAL]', err.message);
    await shot(page, 'error-fatal').catch(() => {});
    issues.push({ context: 'fatal', error: err.message });
  }

  await browser.close();

  // Reporte final
  console.log('\n' + '═'.repeat(60));
  console.log('REPORTE FINAL');
  console.log('═'.repeat(60));
  console.log(`Screenshots: ${shotIndex}`);
  console.log(`Network errors (4xx/5xx): ${networkErrors.length}`);
  if (networkErrors.length) {
    networkErrors.forEach(e => console.log('  ', e.status, e.url.slice(0, 100)));
  }
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) {
    consoleErrors.slice(0, 10).forEach(e => console.log('  ', e.slice(0, 150)));
  }
  console.log(`Issues detectados: ${issues.length}`);
  if (issues.length) {
    issues.forEach(i => console.log('  ', JSON.stringify(i)));
  }
  console.log('\nScreenshots en:', OUT);
})();
