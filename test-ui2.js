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
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function typeInto(page, selector, text) {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, text);
}

(async () => {
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const networkErrors = [];
  page.on('response', resp => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // ---- Login as admin ----
    console.log('=== ADMIN LOGIN ===');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder');
      if (btn) btn.click();
    });
    await wait(1500);
    await typeInto(page, 'input[type="email"]', 'admin@ayudapyme.es');
    await typeInto(page, 'input[type="password"]', 'Admin123456!');
    await page.click('button[type="submit"]');
    await wait(4000);
    console.log('URL after login:', page.url());
    await shot(page, 'admin-after-login');

    if (!page.url().includes('clientes')) {
      console.log('PROBLEM: Admin did not redirect to /clientes, went to:', page.url());
    } else {
      console.log('OK: Admin redirected to /clientes');
    }

    // ---- Check each admin page and capture network errors ----
    const adminPages = [
      '/clientes',
      '/expedientes',
      '/reuniones',
      '/novedades',
      '/chats',
      '/clientes/nuevo',
      '/expedientes/nuevo',
    ];

    for (const p of adminPages) {
      networkErrors.length = 0;
      console.log('\n--- PAGE:', p, '---');
      await page.goto(BASE + p, { waitUntil: 'networkidle2', timeout: 15000 });
      await wait(2000);
      await shot(page, 'admin-' + p.replace(/\//g, '-').replace(/^-/, ''));

      // Check content
      const info = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const hasError = document.body.textContent.includes('error') && !document.body.textContent.includes('Error');
        const isEmpty = document.querySelector('[style*="No hay"], [style*="no hay"]') !== null;
        const bodyText = document.body.textContent.substring(0, 300);
        return { h1, bodyText };
      });
      console.log('  H1:', info.h1 || '(none)');
      if (networkErrors.length) {
        console.log('  Network errors:');
        networkErrors.forEach(e => console.log('    ', e.status, e.url));
      } else {
        console.log('  No network errors');
      }
    }

    // ---- Test creating a new expediente ----
    console.log('\n--- CREATE EXPEDIENTE ---');
    await page.goto(BASE + '/expedientes/nuevo', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);

    // Check if clients loaded in select
    const clientOptions = await page.evaluate(() => {
      const sel = document.querySelector('select');
      if (!sel) return 'NO SELECT FOUND';
      return Array.from(sel.options).map(o => o.text).join(', ');
    });
    console.log('  Client options:', clientOptions.substring(0, 200));
    await shot(page, 'nuevo-expediente-with-clients');

    // ---- Test chats page detail ----
    console.log('\n--- CHATS DETAIL ---');
    await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    const chatContent = await page.evaluate(() => document.body.textContent.substring(0, 400));
    console.log('  Chat content:', chatContent.replace(/\s+/g, ' ').substring(0, 300));
    await shot(page, 'chats-page');

    // Try clicking first chat if any
    const firstChat = await page.$('a[href*="/chats/"]');
    if (firstChat) {
      await firstChat.click();
      await wait(2000);
      await shot(page, 'chat-detail');
      console.log('  Chat detail URL:', page.url());
    } else {
      console.log('  No chat items found');
    }

    // ---- Test novedades tabs ----
    console.log('\n--- NOVEDADES TABS ---');
    await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    const tabButtons = await page.$$('button');
    for (const btn of tabButtons) {
      const text = await btn.evaluate(el => el.textContent.trim());
      if (/solicitudes|oportunidades|mensajes/i.test(text)) {
        await btn.click();
        await wait(800);
        const content = await page.evaluate(() => {
          const main = document.querySelector('main, [style*="padding"]');
          return main?.textContent?.substring(0, 200) || '';
        });
        console.log(`  Tab "${text}": ${content.replace(/\s+/g, ' ').substring(0, 150)}`);
        await shot(page, 'novedades-' + text.toLowerCase().replace(/\s+/g, '-'));
      }
    }

    // ---- Admin looks at a client detail ----
    console.log('\n--- CLIENT DETAIL ---');
    await page.goto(BASE + '/clientes', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    const firstClientLink = await page.$('a[href*="/clientes/"]');
    if (firstClientLink) {
      const href = await firstClientLink.evaluate(el => el.href);
      console.log('  Clicking client:', href);
      await firstClientLink.click();
      await wait(2000);
      await shot(page, 'cliente-detail');
      console.log('  Client detail URL:', page.url());

      // Check tabs in client detail
      const tabs = await page.$$('button');
      for (const tab of tabs) {
        const text = await tab.evaluate(el => el.textContent.trim());
        if (text.length > 0 && text.length < 30) {
          await tab.click();
          await wait(500);
        }
      }
      await shot(page, 'cliente-detail-tabs');
    }

    // ---- Portal client flow ----
    console.log('\n=== PORTAL CLIENT FLOW ===');
    // Logout
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /cerrar|logout|salir/i.test(b.textContent));
      if (btn) { btn.click(); return btn.textContent; }
      return null;
    });
    await wait(2000);
    await shot(page, 'after-admin-logout');
    console.log('URL after logout:', page.url());

    // Find a client user to test portal
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder');
      if (btn) btn.click();
    });
    await wait(1500);
    await typeInto(page, 'input[type="email"]', 'demo.lamar@ayudapyme.es');
    await typeInto(page, 'input[type="password"]', 'Admin123456!'); // We'll try this password
    await page.click('button[type="submit"]');
    await wait(3000);
    console.log('Client portal URL:', page.url());
    await shot(page, 'portal-client-login-attempt');

    // Check if we got an error or succeeded
    const loginError = await page.evaluate(() => {
      const errEl = document.querySelector('[style*="red"], [class*="error"]');
      return errEl?.textContent?.trim() || null;
    });
    if (loginError) {
      console.log('  Login error:', loginError);
      // Try without password - maybe client accounts have a different password
    } else {
      console.log('  Portal URL:', page.url());
      await shot(page, 'portal-page');

      const portalContent = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const h2s = Array.from(document.querySelectorAll('h2, h3')).map(h => h.textContent.trim()).slice(0, 5);
        return { h1, h2s };
      });
      console.log('  Portal H1:', portalContent.h1);
      console.log('  Portal H2s:', portalContent.h2s.join(' | '));
    }

    // ---- SUMMARY ----
    console.log('\n\n=== FINAL SUMMARY ===');
    console.log('Console errors:', consoleErrors.length);
    consoleErrors.forEach(e => console.log(' -', e.substring(0, 200)));

  } catch (err) {
    console.error('\nFATAL:', err.message);
    try { await shot(page, 'FATAL'); } catch (e) {}
  } finally {
    await browser.close();
    console.log('\nDone. Screenshots:', OUT);
  }
})();
