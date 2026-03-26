/**
 * test-qa-audit.js — Auditoría QA completa: visual + funcional
 * Cubre: Landing, Auth, Dashboard Admin (todas las rutas), Portal Cliente, Mobile
 * Uso: node test-qa-audit.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Limpiar screenshots anteriores
fs.readdirSync(OUT).forEach(f => {
  if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
});

let shotIndex = 0;
const report = {
  bugs: [],
  warnings: [],
  networkErrors: [],
  consoleErrors: [],
  screenshots: [],
  passed: [],
};

function log(msg) { console.log(`  ${msg}`); }
function logSection(msg) { console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`); }

async function shot(page, name) {
  const filename = String(shotIndex++).padStart(3, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
  report.screenshots.push(filename);
  log(`[📸] ${filename}`);
  return filename;
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function addBug(section, desc, severity = 'medium') {
  report.bugs.push({ section, desc, severity });
  log(`[🐛 ${severity.toUpperCase()}] ${desc}`);
}

function addWarning(section, desc) {
  report.warnings.push({ section, desc });
  log(`[⚠️] ${desc}`);
}

function addPass(section, desc) {
  report.passed.push({ section, desc });
  log(`[✅] ${desc}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function checkForErrors(page, section) {
  // Check visible error text on page
  const errorTexts = await page.evaluate(() => {
    const leafNodes = Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0)
      .filter(e => {
        const t = e.textContent.trim();
        return t.length > 0 && t.length < 300 && (
          /error|Error|ERROR/.test(t) ||
          t.includes('404') ||
          t.includes('500') ||
          t.includes('Something went wrong') ||
          t.includes('Algo salió mal') ||
          t.includes('no encontrada') ||
          t.includes('not found')
        );
      })
      .map(e => e.textContent.trim())
      .slice(0, 5);
    return leafNodes;
  }).catch(() => []);

  // Filter out false positives
  const realErrors = errorTexts.filter(t =>
    !t.includes('0 error') &&
    !t.includes('Console error') &&
    !t.includes('error de') && // Spanish context
    t.length > 3
  );

  if (realErrors.length > 0) {
    addBug(section, `Texto de error visible: ${realErrors[0].slice(0, 100)}`, 'high');
  }

  // Check for empty page (possible broken route)
  const bodyText = await page.evaluate(() => document.body?.innerText?.trim()?.length || 0).catch(() => 0);
  if (bodyText < 10) {
    addBug(section, 'Página vacía o casi vacía (posible ruta rota)', 'critical');
  }

  return realErrors;
}

async function checkBrokenImages(page, section) {
  const broken = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => img.src)
      .slice(0, 5);
  }).catch(() => []);
  if (broken.length > 0) {
    addBug(section, `${broken.length} imagen(es) rota(s): ${broken[0].slice(0, 80)}`, 'medium');
  }
  return broken;
}

async function checkAccessibility(page, section) {
  const issues = await page.evaluate(() => {
    const problems = [];
    // Buttons without text
    const emptyButtons = Array.from(document.querySelectorAll('button'))
      .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg title'));
    if (emptyButtons.length > 0) problems.push(`${emptyButtons.length} botón(es) sin texto/aria-label`);

    // Images without alt
    const noAltImages = Array.from(document.querySelectorAll('img'))
      .filter(img => !img.getAttribute('alt'));
    if (noAltImages.length > 0) problems.push(`${noAltImages.length} imagen(es) sin alt`);

    // Inputs without label
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
    const noLabel = inputs.filter(i => {
      const id = i.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = i.getAttribute('aria-label') || i.getAttribute('placeholder');
      return !hasLabel && !hasAriaLabel;
    });
    if (noLabel.length > 0) problems.push(`${noLabel.length} input(s) sin label/placeholder`);

    return problems;
  }).catch(() => []);

  issues.forEach(i => addWarning(section, `Accesibilidad: ${i}`));
  return issues;
}

async function checkOverflow(page, section) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  }).catch(() => false);
  if (hasOverflow) {
    addBug(section, 'Overflow horizontal detectado (contenido se sale del viewport)', 'medium');
  }
  return hasOverflow;
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ──────────────────────────────────────────────────────────────────────────────

async function logout(page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await wait(300);
}

async function loginAs(page, email, password, label) {
  await logout(page);
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(1500);

  // Click Acceder
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(b => /Acceder|Iniciar sesión/.test(b.textContent.trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked && !page.url().includes('/login')) {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 10000 });
  }
  await wait(1000);

  try {
    await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  } catch {
    addBug('auth', `No se encontró campo email para login ${label}`, 'critical');
    return false;
  }

  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', email);
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', password);
  await page.keyboard.press('Enter');
  await wait(3000);
  log(`Login ${label}: URL → ${page.url()}`);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. LANDING PAGE
// ══════════════════════════════════════════════════════════════════════════════

async function testLanding(page) {
  logSection('1. LANDING PAGE — Desktop (1280x900)');

  await page.setViewport({ width: 1280, height: 900 });
  // First load takes long (Turbopack compiles on demand)
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 120000 });
  await wait(2000);

  await shot(page, 'landing-01-hero');
  await checkForErrors(page, 'landing');
  await checkBrokenImages(page, 'landing');
  await checkOverflow(page, 'landing');

  // Check key elements exist
  const heroExists = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent.trim().slice(0, 60) : null;
  });
  if (heroExists) addPass('landing', `Hero H1 presente: "${heroExists}"`);
  else addBug('landing', 'No se encontró H1 en Hero', 'high');

  // Check CTA buttons
  const ctaButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a'))
      .filter(b => /Acceder|Empezar|Solicitar|Contáctanos|Quiero/.test(b.textContent))
      .map(b => b.textContent.trim())
      .slice(0, 5);
  });
  if (ctaButtons.length > 0) addPass('landing', `CTAs encontrados: ${ctaButtons.join(', ')}`);
  else addBug('landing', 'No se encontraron botones CTA en landing', 'high');

  // Check all sections
  const sections = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('section, [id]'))
      .map(s => s.id || s.tagName)
      .filter(Boolean);
    return ids.slice(0, 15);
  });
  log(`Secciones detectadas: ${sections.join(', ')}`);

  // Scroll down and capture full page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(1000);
  await shot(page, 'landing-02-footer');

  // Check footer
  const footerLinks = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    if (!footer) return [];
    return Array.from(footer.querySelectorAll('a')).map(a => a.textContent.trim()).slice(0, 10);
  });
  if (footerLinks.length > 0) addPass('landing', `Footer con ${footerLinks.length} enlaces`);
  else addWarning('landing', 'Footer sin enlaces o no encontrado');

  // Check header nav
  const headerNav = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return [];
    return Array.from(header.querySelectorAll('a, button')).map(e => e.textContent.trim()).filter(t => t.length > 0 && t.length < 30);
  });
  if (headerNav.length > 0) addPass('landing', `Header con navegación: ${headerNav.join(', ')}`);

  // ── Mobile viewport test
  logSection('1b. LANDING PAGE — Mobile (375x812)');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);

  await shot(page, 'landing-03-mobile-hero');
  await checkOverflow(page, 'landing-mobile');

  // Check mobile menu
  const hasMobileMenu = await page.evaluate(() => {
    const hamburger = document.querySelector('[class*="menu"], [class*="hamburger"], button svg');
    return !!hamburger;
  });
  if (hasMobileMenu) addPass('landing-mobile', 'Menú hamburguesa detectado');
  else addWarning('landing-mobile', 'No se detectó menú hamburguesa en mobile');

  // Scroll to bottom on mobile
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(1000);
  await shot(page, 'landing-04-mobile-footer');

  // Mid-page on mobile
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await wait(500);
  await shot(page, 'landing-05-mobile-mid');

  // Tablet viewport
  logSection('1c. LANDING PAGE — Tablet (768x1024)');
  await page.setViewport({ width: 768, height: 1024 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'landing-06-tablet');
  await checkOverflow(page, 'landing-tablet');

  // Reset viewport
  await page.setViewport({ width: 1280, height: 900 });
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. AUTH FLOW
// ══════════════════════════════════════════════════════════════════════════════

async function testAuth(page) {
  logSection('2. AUTH — Login modal & flujos');

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1000);

  // Open login modal
  const modalOpened = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(b => /Acceder|Iniciar sesión/.test(b.textContent.trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });
  await wait(800);

  if (modalOpened) {
    await shot(page, 'auth-01-modal-abierto');
    const hasEmailField = await page.$('input[type="email"]');
    if (hasEmailField) addPass('auth', 'Modal de login abierto con campo email');
    else addBug('auth', 'Modal abierto pero sin campo email', 'high');
  } else {
    addBug('auth', 'No se pudo abrir modal/página de login', 'critical');
  }

  // Test wrong password
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  if (emailInput && passInput) {
    await emailInput.type('test@fake.com');
    await passInput.type('wrongpassword');
    await page.keyboard.press('Enter');
    await wait(2000);
    await shot(page, 'auth-02-login-error');

    // Check for error message
    const errorShown = await page.evaluate(() => {
      const body = document.body.innerText;
      return /error|inválid|incorrect|no existe|credenciales/i.test(body);
    });
    if (errorShown) addPass('auth', 'Error de login mostrado correctamente');
    else addWarning('auth', 'No se detectó mensaje de error con credenciales incorrectas');
  }

  // Close modal
  await page.keyboard.press('Escape');
  await wait(500);

  // Test admin login
  logSection('2b. AUTH — Login admin');
  const adminLogin = await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin');
  if (adminLogin) {
    await shot(page, 'auth-03-admin-logueado');
    const isOnDashboard = page.url().includes('/dashboard') || page.url().includes('/novedades');
    if (isOnDashboard) addPass('auth', 'Admin redirigido al dashboard correctamente');
    else addWarning('auth', `Admin redirigido a: ${page.url()}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. DASHBOARD ADMIN — Todas las rutas
// ══════════════════════════════════════════════════════════════════════════════

async function testAdminDashboard(page) {
  logSection('3. ADMIN DASHBOARD — Todas las rutas');

  // Ensure logged in as admin
  if (!page.url().includes('/dashboard') && !page.url().includes('/novedades')) {
    await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin');
  }

  // ── Dashboard principal
  log('\n--- Dashboard principal ---');
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'admin-01-dashboard');
  await checkForErrors(page, 'admin-dashboard');
  await checkAccessibility(page, 'admin-dashboard');

  // Check KPIs
  const kpis = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="stat"], [class*="kpi"]'));
    return cards.map(c => c.textContent.trim().slice(0, 50)).slice(0, 6);
  });
  if (kpis.length > 0) addPass('admin-dashboard', `KPIs detectados: ${kpis.length}`);
  else addWarning('admin-dashboard', 'No se detectaron KPIs en dashboard');

  // ── Novedades
  log('\n--- Novedades ---');
  await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-02-novedades');
  await checkForErrors(page, 'admin-novedades');

  // Check tabs
  const tabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="tab"]'))
      .map(b => b.textContent.trim())
      .filter(t => /Oportunidades|Mensaje|Alerta|Todo/i.test(t));
  });
  if (tabs.length > 0) {
    addPass('admin-novedades', `Tabs: ${tabs.join(', ')}`);
    // Click each tab
    for (const tabName of tabs.slice(0, 3)) {
      await page.evaluate((name) => {
        const b = Array.from(document.querySelectorAll('button, [role="tab"]'))
          .find(b => b.textContent.trim() === name);
        if (b) b.click();
      }, tabName);
      await wait(800);
    }
    await shot(page, 'admin-03-novedades-tabs');
  }

  // ── Clientes
  log('\n--- Clientes ---');
  await page.goto(BASE + '/clientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-04-clientes');
  await checkForErrors(page, 'admin-clientes');

  const clientCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr, a[href*="/clientes/"]');
    return rows.length;
  });
  log(`Clientes visibles: ${clientCount}`);
  if (clientCount > 0) addPass('admin-clientes', `${clientCount} clientes en lista`);
  else addWarning('admin-clientes', 'Lista de clientes vacía');

  // Search
  const searchInput = await page.$('input[placeholder*="uscar"], input[type="search"]');
  if (searchInput) {
    await searchInput.type('Tech');
    await wait(800);
    await shot(page, 'admin-05-clientes-busqueda');
    addPass('admin-clientes', 'Búsqueda funciona');
    await searchInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await wait(400);
  }

  // Click first client
  const clienteUrl = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href*="/clientes/"]'))
      .find(l => !l.href.includes('/nuevo'));
    return link ? link.href : null;
  });
  if (clienteUrl) {
    await page.goto(clienteUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'admin-06-cliente-detalle');
    await checkForErrors(page, 'admin-cliente-detalle');
    addPass('admin-clientes', 'Detalle de cliente carga correctamente');
  }

  // ── Clientes nuevo
  log('\n--- Crear cliente ---');
  await page.goto(BASE + '/clientes/nuevo', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-07-cliente-nuevo');
  await checkForErrors(page, 'admin-cliente-nuevo');
  await checkAccessibility(page, 'admin-cliente-nuevo');

  // ── Matches
  log('\n--- Matches ---');
  await page.goto(BASE + '/matches', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-08-matches');
  await checkForErrors(page, 'admin-matches');

  // ── Subvenciones
  log('\n--- Subvenciones catálogo ---');
  await page.goto(BASE + '/subvenciones', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-09-subvenciones');
  await checkForErrors(page, 'admin-subvenciones');

  // ── Subvenciones BD (pipeline)
  log('\n--- Subvenciones BD / Pipeline ---');
  await page.goto(BASE + '/subvenciones-bd', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'admin-10-subvenciones-bd');
  await checkForErrors(page, 'admin-subvenciones-bd');

  // ── Solicitudes
  log('\n--- Solicitudes ---');
  await page.goto(BASE + '/solicitudes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-11-solicitudes');
  await checkForErrors(page, 'admin-solicitudes');

  // Try expanding a solicitud
  const expandedSol = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => /Ver|Detalle|Expandir/i.test(b.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  });
  if (expandedSol) {
    await wait(1000);
    await shot(page, 'admin-12-solicitud-detalle');
    addPass('admin-solicitudes', 'Detalle de solicitud expandido');
  }

  // ── Expedientes
  log('\n--- Expedientes ---');
  await page.goto(BASE + '/expedientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-13-expedientes');
  await checkForErrors(page, 'admin-expedientes');

  // Click first expediente
  const expUrl = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href*="/expedientes/"]'))
      .find(l => !l.href.includes('/nuevo'));
    return link ? link.href : null;
  });
  if (expUrl) {
    await page.goto(expUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    await shot(page, 'admin-14-expediente-detalle');
    await checkForErrors(page, 'admin-expediente-detalle');
    addPass('admin-expedientes', 'Detalle de expediente carga correctamente');
  }

  // ── Expediente nuevo
  log('\n--- Crear expediente ---');
  await page.goto(BASE + '/expedientes/nuevo', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-15-expediente-nuevo');
  await checkForErrors(page, 'admin-expediente-nuevo');

  // ── Chats
  log('\n--- Chats ---');
  await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-16-chats');
  await checkForErrors(page, 'admin-chats');

  // Click first chat
  const chatClicked = await page.evaluate(() => {
    const clickable = document.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"]');
    if (clickable.length > 0) { clickable[0].click(); return true; }
    const divs = Array.from(document.querySelectorAll('div'))
      .filter(d => d.onclick || d.getAttribute('role') === 'button');
    if (divs.length > 0) { divs[0].click(); return true; }
    return false;
  });
  if (chatClicked) {
    await wait(1500);
    await shot(page, 'admin-17-chat-abierto');
    addPass('admin-chats', 'Chat abierto correctamente');

    // Check for message input
    const hasInput = await page.$('textarea, input[placeholder*="ensaje"]');
    if (hasInput) addPass('admin-chats', 'Campo de mensaje disponible');
    else addWarning('admin-chats', 'No se encontró campo de entrada de mensaje');
  }

  // ── Reuniones
  log('\n--- Reuniones ---');
  await page.goto(BASE + '/reuniones', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-18-reuniones');
  await checkForErrors(page, 'admin-reuniones');

  // Nueva reunión
  await page.goto(BASE + '/reuniones/nueva', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-19-reunion-nueva');
  await checkForErrors(page, 'admin-reunion-nueva');
  await checkAccessibility(page, 'admin-reunion-nueva');

  // ── Alertas
  log('\n--- Alertas ---');
  await page.goto(BASE + '/alertas', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-20-alertas');
  await checkForErrors(page, 'admin-alertas');

  // ── Proveedores
  log('\n--- Proveedores ---');
  await page.goto(BASE + '/proveedores', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-21-proveedores');
  await checkForErrors(page, 'admin-proveedores');

  // ── Ajustes
  log('\n--- Ajustes ---');
  await page.goto(BASE + '/ajustes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-22-ajustes');
  await checkForErrors(page, 'admin-ajustes');
  await checkAccessibility(page, 'admin-ajustes');

  // ── Sidebar check
  log('\n--- Sidebar navigation ---');
  const sidebarItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('nav a, aside a, [class*="sidebar"] a'));
    return links.map(l => ({ text: l.textContent.trim(), href: l.getAttribute('href') })).filter(l => l.text.length > 0);
  });
  log(`Sidebar items: ${sidebarItems.length}`);
  sidebarItems.forEach(s => log(`  → ${s.text}: ${s.href}`));
  if (sidebarItems.length >= 5) addPass('admin-nav', `Sidebar con ${sidebarItems.length} items`);
  else addWarning('admin-nav', `Sidebar con solo ${sidebarItems.length} items`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PORTAL CLIENTE
// ══════════════════════════════════════════════════════════════════════════════

async function testPortal(page) {
  logSection('4. PORTAL CLIENTE');

  const loggedIn = await loginAs(page, 'demo.lamar@ayudapyme.es', 'Client123456!', 'portal');
  if (!loggedIn) {
    addBug('portal', 'No se pudo hacer login como cliente', 'critical');
    return;
  }

  await shot(page, 'portal-01-login-result');

  const url = page.url();
  if (!url.includes('/portal')) {
    addWarning('portal', `Login no redirigió a /portal, URL: ${url}`);
    await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
  }

  await shot(page, 'portal-02-inicio');
  await checkForErrors(page, 'portal-inicio');
  await checkOverflow(page, 'portal');
  await checkAccessibility(page, 'portal');

  // Check portal sections
  const portalSections = ['Mis subvenciones', 'Mi empresa', 'Mis expedientes', 'Mis solicitudes', 'Mi gestor'];
  for (const sec of portalSections) {
    const clicked = await page.evaluate((name) => {
      const btns = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      const b = btns.find(b => b.textContent.trim().includes(name));
      if (b) { b.click(); return true; }
      return false;
    }, sec);

    if (clicked) {
      await wait(1200);
      const safeName = sec.replace(/\s+/g, '-').toLowerCase();
      await shot(page, `portal-03-${safeName}`);
      await checkForErrors(page, `portal-${safeName}`);
      addPass('portal', `Sección "${sec}" accesible`);
    } else {
      addWarning('portal', `Sección "${sec}" no encontrada`);
    }
  }

  // Test: click on a subvención
  log('\n--- Portal: interacción con subvención ---');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const b = btns.find(b => b.textContent.includes('Mis subvenciones') || b.textContent.includes('subvenciones'));
    if (b) b.click();
  });
  await wait(1000);

  const clickedSubv = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => /Quiero|Ver más|Solicitar|Me interesa|Detalle/i.test(b.textContent));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  });

  if (clickedSubv) {
    await wait(1500);
    await shot(page, 'portal-04-subvencion-accion');
    addPass('portal', `Acción en subvención: "${clickedSubv}"`);
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // Chat con gestor
  log('\n--- Portal: chat con gestor ---');
  const chatOpened = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const b = btns.find(b => /Chat|Preguntar|Gestor|Mi gestor/i.test(b.textContent.trim()));
    if (b) { b.click(); return true; }
    return false;
  });

  if (chatOpened) {
    await wait(1200);
    await shot(page, 'portal-05-chat');

    const msgInput = await page.$('textarea, input[placeholder*="pregunta"], input[placeholder*="mensaje"], input[placeholder*="Mensaje"]');
    if (msgInput) {
      addPass('portal', 'Campo de chat con gestor disponible');
    } else {
      addWarning('portal', 'No se encontró campo de mensaje en chat');
    }
  }

  // Portal mobile
  logSection('4b. PORTAL — Mobile (375x812)');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'portal-06-mobile');
  await checkOverflow(page, 'portal-mobile');

  // Reset viewport
  await page.setViewport({ width: 1280, height: 900 });
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. RUTAS PÚBLICAS ADICIONALES
// ══════════════════════════════════════════════════════════════════════════════

async function testPublicPages(page) {
  logSection('5. PÁGINAS PÚBLICAS');
  await logout(page);

  const publicRoutes = [
    { path: '/contacto', name: 'contacto' },
    { path: '/privacidad', name: 'privacidad' },
    { path: '/terminos', name: 'terminos' },
  ];

  for (const route of publicRoutes) {
    await page.goto(BASE + route.path, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1000);
    await shot(page, `public-${route.name}`);
    await checkForErrors(page, `public-${route.name}`);

    const bodyLength = await page.evaluate(() => document.body.innerText.trim().length);
    if (bodyLength > 50) addPass(`public-${route.name}`, `Página carga con contenido (${bodyLength} chars)`);
    else addBug(`public-${route.name}`, 'Página con poco o ningún contenido', 'medium');
  }

  // 404 test
  log('\n--- Test 404 ---');
  await page.goto(BASE + '/ruta-que-no-existe', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1000);
  await shot(page, 'public-404');
  const has404 = await page.evaluate(() => /404|no encontrada|not found/i.test(document.body.innerText));
  if (has404) addPass('public-404', 'Página 404 mostrada correctamente');
  else addWarning('public-404', 'No se muestra página 404 para rutas inexistentes');
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. SECURITY CHECKS
// ══════════════════════════════════════════════════════════════════════════════

async function testSecurity(page) {
  logSection('6. SECURITY — Acceso sin autenticación');
  await logout(page);

  const protectedRoutes = [
    '/dashboard', '/clientes', '/expedientes', '/matches',
    '/solicitudes', '/chats', '/ajustes', '/portal'
  ];

  for (const route of protectedRoutes) {
    await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    const finalUrl = page.url();
    const isProtected = finalUrl.includes('/login') || finalUrl === BASE + '/' || finalUrl.includes('auth');
    if (isProtected) {
      addPass('security', `${route} redirige a login (protegida)`);
    } else if (finalUrl.includes(route)) {
      addBug('security', `${route} accesible sin autenticación!`, 'critical');
      await shot(page, `security-unprotected-${route.replace(/\//g, '-')}`);
    } else {
      addWarning('security', `${route} redirige a ${finalUrl}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     QA AUDIT COMPLETO — AyudaPyme                      ║');
  console.log('║     Fecha: ' + new Date().toISOString().slice(0, 10) + '                                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Capture network errors
  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('favicon') && !url.includes('_next/static') && !url.includes('hot-update')) {
      report.networkErrors.push({ url: url.slice(0, 120), status });
    }
  });

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('Download the React DevTools')) {
        report.consoleErrors.push(text.slice(0, 200));
      }
    }
  });

  // Capture page crashes
  page.on('pageerror', err => {
    report.bugs.push({ section: 'js-crash', desc: `JS Error: ${err.message.slice(0, 150)}`, severity: 'high' });
  });

  const startTime = Date.now();

  try {
    await testLanding(page);
    await testAuth(page);
    await testAdminDashboard(page);
    await testPortal(page);
    await testPublicPages(page);
    await testSecurity(page);
  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message);
    await shot(page, 'error-fatal').catch(() => {});
    report.bugs.push({ section: 'fatal', desc: err.message, severity: 'critical' });
  }

  await browser.close();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── REPORTE FINAL ──────────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║               REPORTE QA — RESUMEN                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n⏱  Duración: ${elapsed}s`);
  console.log(`📸 Screenshots: ${report.screenshots.length}`);

  // Bugs by severity
  const critical = report.bugs.filter(b => b.severity === 'critical');
  const high = report.bugs.filter(b => b.severity === 'high');
  const medium = report.bugs.filter(b => b.severity === 'medium');

  console.log(`\n🐛 BUGS: ${report.bugs.length} total`);
  if (critical.length) {
    console.log(`  🔴 CRITICAL (${critical.length}):`);
    critical.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }
  if (high.length) {
    console.log(`  🟠 HIGH (${high.length}):`);
    high.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }
  if (medium.length) {
    console.log(`  🟡 MEDIUM (${medium.length}):`);
    medium.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }

  console.log(`\n⚠️  WARNINGS: ${report.warnings.length}`);
  report.warnings.forEach(w => console.log(`   [${w.section}] ${w.desc}`));

  console.log(`\n🌐 Network errors (4xx/5xx): ${report.networkErrors.length}`);
  report.networkErrors.slice(0, 15).forEach(e => console.log(`   ${e.status} ${e.url}`));

  console.log(`\n💻 Console errors: ${report.consoleErrors.length}`);
  report.consoleErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));

  console.log(`\n✅ PASSED: ${report.passed.length}`);
  report.passed.forEach(p => console.log(`   [${p.section}] ${p.desc}`));

  console.log(`\n📁 Screenshots en: ${OUT}`);

  // Write JSON report
  const reportPath = path.join(__dirname, 'qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Reporte JSON: ${reportPath}`);

  // Exit code based on bugs
  if (critical.length > 0) {
    console.log('\n❌ HAY BUGS CRÍTICOS — requiere atención inmediata');
    process.exit(1);
  } else if (high.length > 0) {
    console.log('\n⚠️  Hay bugs de prioridad alta');
    process.exit(0);
  } else {
    console.log('\n✅ Sin bugs críticos');
    process.exit(0);
  }
})();
