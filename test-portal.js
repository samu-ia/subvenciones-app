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

async function signOut(page) {
  // Clear cookies and storage to sign out
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const cookies = await page.cookies();
  if (cookies.length > 0) await page.deleteCookie(...cookies);
  await wait(500);
}

async function login(page, email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000); // Wait for auth check redirect

  const url = page.url();
  if (url !== BASE + '/' && !url.endsWith('/')) {
    // Was redirected (already logged in) - sign out first
    console.log('  Already redirected to', url, '- need to be on landing first');
  }

  // Click Acceder
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder');
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!clicked) {
    console.log('  Acceder button not found, URL:', page.url());
    return page.url();
  }

  await wait(1500);

  const emailInput = await page.$('input[type="email"]');
  if (!emailInput) {
    console.log('  Modal did not open, URL:', page.url());
    return page.url();
  }

  await typeInto(page, 'input[type="email"]', email);
  await typeInto(page, 'input[type="password"]', password);
  await page.click('button[type="submit"]');
  await wait(4000);
  return page.url();
}

(async () => {
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const netErrors = [];
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('localhost')) {
      netErrors.push(`${r.status()} ${r.url().split('?')[0]}`);
    }
  });

  try {
    // === 1. ADMIN FLOW ===
    console.log('=== ADMIN LOGIN ===');
    const adminUrl = await login(page, 'admin@ayudapyme.es', 'Admin123456!');
    console.log('Admin URL:', adminUrl);
    await shot(page, 'admin-dashboard');

    if (!adminUrl.includes('clientes')) {
      console.log('PROBLEM: Admin not at /clientes');
    }

    // Check clientes list
    console.log('\n--- Clientes list ---');
    await page.goto(BASE + '/clientes', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'clientes-list');

    const clientStats = await page.evaluate(() => {
      const rows = document.querySelectorAll('a[href*="/clientes/"]');
      const links = Array.from(rows).filter(a => !a.href.includes('/nuevo')).map(a => a.href);
      return { count: links.length, first: links[0] };
    });
    console.log('Client rows:', clientStats.count, '| First link:', clientStats.first);

    // Visit a real client
    if (clientStats.first) {
      await page.goto(clientStats.first, { waitUntil: 'networkidle2', timeout: 15000 });
      await wait(2000);
      await shot(page, 'cliente-detail');

      const pageInfo = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const sections = Array.from(document.querySelectorAll('h2, h3')).map(h => h.textContent.trim()).slice(0, 8);
        const hasExpedientes = document.body.textContent.includes('Expedientes') || document.body.textContent.includes('expediente');
        const hasReuniones = document.body.textContent.includes('Reuniones') || document.body.textContent.includes('reunion');
        return { h1, sections, hasExpedientes, hasReuniones };
      });
      console.log('Client detail H1:', pageInfo.h1);
      console.log('Sections:', pageInfo.sections.join(' | '));
      console.log('Has expedientes:', pageInfo.hasExpedientes, '| Has reuniones:', pageInfo.hasReuniones);
    }

    // Check novedades with actual content
    console.log('\n--- Novedades ---');
    await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    await shot(page, 'novedades-full');

    const novInfo = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      const hasSolicitudes = /solicitudes|No hay solicitudes/i.test(bodyText);
      const hasMatches = /oportunidades|matches|subvenciones/i.test(bodyText);
      return { hasSolicitudes, hasMatches, bodyLength: bodyText.length };
    });
    console.log('Novedades - has solicitudes:', novInfo.hasSolicitudes, '| has matches:', novInfo.hasMatches);

    // Click oportunidades tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => /oportunidades/i.test(b.textContent));
      if (btn) btn.click();
    });
    await wait(1500);
    await shot(page, 'novedades-oportunidades');

    // Check chat page
    console.log('\n--- Chats ---');
    await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'chats-admin');
    const chatInfo = await page.evaluate(() => {
      const noConv = document.body.textContent.includes('No hay conversaciones');
      const hasInput = !!document.querySelector('textarea, input[placeholder*="mensaje"]');
      return { noConv, hasInput };
    });
    console.log('Chats: no conversations =', chatInfo.noConv, '| has input =', chatInfo.hasInput);

    // === 2. CLIENT PORTAL FLOW ===
    console.log('\n\n=== CLIENT PORTAL FLOW ===');
    await signOut(page);
    console.log('Signed out admin');

    await wait(1000);
    const clientUrl = await login(page, 'demo.lamar@ayudapyme.es', 'Client123456!');
    console.log('Client URL:', clientUrl);

    if (clientUrl.includes('/portal')) {
      console.log('OK: Client in portal');
      await shot(page, 'portal-main');

      const portalInfo = await page.evaluate(() => {
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const sections = Array.from(document.querySelectorAll('h2, h3, [style*="fontWeight: 700"], [style*="font-weight: 700"]'))
          .map(h => h.textContent.trim()).filter(t => t.length > 3 && t.length < 80).slice(0, 10);
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 50).slice(0, 15);
        return { h1, sections, buttons };
      });
      console.log('Portal H1:', portalInfo.h1);
      console.log('Portal sections:', portalInfo.sections.join(' | '));
      console.log('Portal buttons:', portalInfo.buttons.join(', '));

      // Try different sections
      const sectionsToClick = ['Mis subvenciones', 'Subvenciones', 'Oportunidades', 'Chat', 'Perfil', 'Mensajes'];
      for (const sectionText of sectionsToClick) {
        const found = await page.evaluate((text) => {
          const els = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
          const el = els.find(e => e.textContent.trim() === text || e.textContent.includes(text));
          if (el) { el.click(); return el.textContent.trim(); }
          return null;
        }, sectionText);
        if (found) {
          await wait(1500);
          await shot(page, 'portal-section-' + sectionText.toLowerCase().replace(/\s+/g, '-'));
          console.log('Clicked portal section:', found);
          break;
        }
      }

    } else {
      console.log('PROBLEM: Client at:', clientUrl);
      await shot(page, 'client-wrong-url');

      const errInfo = await page.evaluate(() => {
        const err = document.querySelector('[style*="red"], [class*="error"]');
        return err?.textContent?.trim() || document.title;
      });
      console.log('Page info:', errInfo);
    }

    // === 3. Summary ===
    console.log('\n=== NETWORK ERRORS ===');
    const uniqueErrors = [...new Set(netErrors)];
    if (uniqueErrors.length === 0) {
      console.log('No network errors!');
    } else {
      uniqueErrors.forEach(e => console.log(' -', e));
    }

  } catch (err) {
    console.error('\nFATAL:', err.message);
    console.error(err.stack?.split('\n').slice(0,5).join('\n'));
    try { await shot(page, 'FATAL'); } catch (e) {}
  } finally {
    await browser.close();
    console.log('\nDone. Screenshots:', OUT);
  }
})();
