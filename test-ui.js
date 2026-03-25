const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  const filename = String(shotIndex++).padStart(2, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
  console.log('  [screenshot]', filename);
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function typeInto(page, selector, text) {
  await page.click(selector, { clickCount: 3 }); // select all
  await page.type(selector, text);
}

async function loginAsAdmin(page) {
  console.log('\n--- LOGIN ADMIN ---');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await shot(page, 'landing');

  // Click "Acceder" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim() === 'Acceder');
    if (btn) btn.click();
  });
  await wait(1500);
  await shot(page, 'login-modal-opened');

  // Check if modal appeared
  const emailInput = await page.$('input[type="email"]');
  if (!emailInput) {
    console.log('  ERROR: Modal did not open');
    return false;
  }

  await typeInto(page, 'input[type="email"]', 'admin@ayudapyme.es');
  await typeInto(page, 'input[type="password"]', 'Admin123456!');
  await shot(page, 'login-filled');

  // Click "Entrar"
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
    const btn = btns.find(b => /entrar|acceder|login/i.test(b.textContent));
    if (btn) btn.click();
  });

  await wait(4000);
  await shot(page, 'after-login');
  console.log('  URL after login:', page.url());
  return page.url().includes('clientes') || page.url().includes('dashboard');
}

async function checkPage(page, url, name) {
  console.log('\n--- PAGE:', name, '---');
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, name);

  const currentUrl = page.url();
  console.log('  URL:', currentUrl);

  // Check for visible errors
  const pageInfo = await page.evaluate(() => {
    const errors = [];
    document.querySelectorAll('*').forEach(el => {
      const text = el.childNodes.length === 1 && el.firstChild?.nodeType === 3
        ? el.textContent.trim() : '';
      if (/error|no autorizado|forbidden|404|500/i.test(text) && text.length < 200) {
        errors.push(text);
      }
    });
    // Check for loading stuck
    const loading = document.body.textContent.includes('Cargando...');
    // Get h1
    const h1 = document.querySelector('h1')?.textContent?.trim() || '';
    // Count list items / table rows
    const rows = document.querySelectorAll('[class*="table-row"], tr, [style*="grid"]').length;
    return { errors: [...new Set(errors)].slice(0, 5), loading, h1, rows };
  });

  if (pageInfo.loading) console.log('  WARNING: Page still shows "Cargando..."');
  if (pageInfo.h1) console.log('  H1:', pageInfo.h1);
  if (pageInfo.errors.length) console.log('  Errors found:', pageInfo.errors);
  if (pageInfo.rows > 0) console.log('  Data rows visible:', pageInfo.rows);

  return { url: currentUrl, ...pageInfo };
}

(async () => {
  // Delete old screenshots
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  try {
    // === ADMIN FLOW ===
    const adminLoggedIn = await loginAsAdmin(page);
    if (!adminLoggedIn) {
      console.log('Admin login FAILED - checking what happened');
    } else {
      console.log('Admin login SUCCESS');
    }

    // Admin pages
    const results = {};
    results.clientes = await checkPage(page, '/clientes', 'admin-clientes');
    results.expedientes = await checkPage(page, '/expedientes', 'admin-expedientes');
    results.reuniones = await checkPage(page, '/reuniones', 'admin-reuniones');
    results.novedades = await checkPage(page, '/novedades', 'admin-novedades');
    results.chat = await checkPage(page, '/chat', 'admin-chat');

    // Test nuevo expediente
    await checkPage(page, '/expedientes/nuevo', 'admin-nuevo-expediente');

    // Test novedades tabs
    console.log('\n--- NOVEDADES TABS ---');
    await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1000);
    const tabs = await page.$$('button');
    for (const tab of tabs) {
      const text = await tab.evaluate(el => el.textContent.trim());
      if (/solicitudes|oportunidades|mensajes/i.test(text)) {
        console.log('  Clicking tab:', text);
        await tab.click();
        await wait(800);
        await shot(page, 'novedades-tab-' + text.toLowerCase());
      }
    }

    // Test crear nuevo cliente
    await checkPage(page, '/clientes/nuevo', 'admin-nuevo-cliente');

    // === CLIENT PORTAL FLOW ===
    console.log('\n\n=== CLIENT PORTAL FLOW ===');
    // Logout first
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /cerrar sesión|logout|salir/i.test(b.textContent));
      if (btn) btn.click();
    });
    await wait(2000);

    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1000);

    // Click Acceder
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Acceder');
      if (btn) btn.click();
    });
    await wait(1500);

    const emailInput2 = await page.$('input[type="email"]');
    if (emailInput2) {
      // Use a test client email - using the same admin to check portal too
      await typeInto(page, 'input[type="email"]', 'admin@ayudapyme.es');
      await typeInto(page, 'input[type="password"]', 'Admin123456!');
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });
      await wait(4000);
      console.log('Client login URL:', page.url());
      await shot(page, 'client-after-login');

      // Check portal
      await checkPage(page, '/portal', 'client-portal');
    }

    // === SUMMARY ===
    console.log('\n\n=== SUMMARY ===');
    console.log('Console errors collected:', consoleErrors.length);
    consoleErrors.slice(0, 20).forEach(e => console.log('  -', e.substring(0, 150)));

    console.log('\nPage results:');
    for (const [name, result] of Object.entries(results)) {
      const status = result.url.includes(name.replace('admin-', '')) || result.h1 ? 'OK' : 'REDIRECTED';
      console.log(`  ${name}: ${status} | URL: ${result.url} | H1: "${result.h1}"`);
      if (result.errors.length) console.log(`    Errors: ${result.errors.join('; ')}`);
    }

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    console.error(err.stack);
    try { await shot(page, 'FATAL-ERROR'); } catch (e) {}
  } finally {
    await browser.close();
    console.log('\nScreenshots saved to:', OUT);
  }
})();
