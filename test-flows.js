/**
 * test-flows.js — Test en profundidad de flujos críticos
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');
fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));

let idx = 0;
async function shot(page, name) {
  const file = String(idx++).padStart(2, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  console.log('  [shot]', file);
}
async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function openLoginModal(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1000);
  // Click Acceder button to open modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent.trim() === 'Acceder');
    if (btn) btn.click();
  });
  await wait(800);
  await page.waitForSelector('input[type="email"]', { timeout: 6000 });
}

async function loginAdmin(page) {
  await openLoginModal(page);
  await page.type('input[type="email"]', 'admin@ayudapyme.es');
  await page.type('input[type="password"]', 'Admin123456!');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await wait(1000);
}

async function loginPortal(page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await openLoginModal(page);
  await page.type('input[type="email"]', 'demo.lamar@ayudapyme.es');
  await page.type('input[type="password"]', 'Client123456!');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await wait(1500);
}

const bugs = [];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const netErrors = [];
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('_next') && !r.url().includes('favicon')) netErrors.push({ s: r.status(), u: r.url() }); });

  // ══════════════════════════════════════════════════════════
  // ADMIN — Solicitudes: abrir detalle y cambiar estado
  // ══════════════════════════════════════════════════════════
  console.log('\n═══ ADMIN: Solicitudes detalle ═══');
  await loginAdmin(page);
  await page.goto(BASE + '/solicitudes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'sol-01-lista');

  // Expandir la solicitud existente
  const expandida = await page.evaluate(() => {
    // Buscar botón expandir/ver detalle
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(b => b.textContent.includes('Ver') || b.textContent.includes('Detalle') || b.textContent.includes('Expandir'));
    if (b) { b.click(); return b.textContent.trim(); }
    // intentar click directo en la fila
    const rows = document.querySelectorAll('tr[class*="cursor"], [style*="cursor: pointer"], [style*="cursor:pointer"]');
    if (rows.length > 0) { rows[0].click(); return 'fila clickada'; }
    return null;
  });
  await wait(1500);
  await shot(page, 'sol-02-expandida');
  console.log('  Expandida:', expandida);

  // Buscar botones de acción
  const acciones = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 40);
  });
  console.log('  Botones visibles:', acciones.slice(0, 15).join(' | '));

  // ══════════════════════════════════════════════════════════
  // ADMIN — Chats: abrir conversación y responder
  // ══════════════════════════════════════════════════════════
  console.log('\n═══ ADMIN: Chat con cliente ═══');
  await page.goto(BASE + '/chats', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'chat-01-lista');

  // Click en la conversación (usar eval para encontrar elemento con texto TechNova)
  const clickedConv = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const techDiv = allDivs.find(d =>
      d.textContent.includes('TechNova') &&
      d.children.length > 0 &&
      window.getComputedStyle(d).cursor === 'pointer'
    );
    if (techDiv) { techDiv.click(); return 'TechNova div clicked'; }
    // fallback: click en cualquier elemento clickable con texto de empresa
    const anyConv = allDivs.find(d =>
      d.textContent.length > 10 &&
      d.textContent.length < 200 &&
      window.getComputedStyle(d).cursor === 'pointer' &&
      !d.tagName.match(/BUTTON|INPUT|A/)
    );
    if (anyConv) { anyConv.click(); return `fallback clicked: ${anyConv.textContent.slice(0, 50)}`; }
    return null;
  });
  await wait(2000);
  await shot(page, 'chat-02-conversacion-abierta');
  console.log('  Click conv:', clickedConv);

  // Ver si se cargaron mensajes
  const mensajesVisibles = await page.evaluate(() => {
    const msgs = document.querySelectorAll('[style*="background: #eff6ff"], [style*="background:#eff6ff"], [style*="background: #f1f5f9"], [style*="background:#f1f5f9"]');
    return msgs.length;
  });
  console.log('  Mensajes visibles:', mensajesVisibles);

  if (mensajesVisibles > 0 || clickedConv) {
    // Enviar respuesta del gestor
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('Hola, hemos revisado su solicitud. ¿Tiene alguna duda?');
      await wait(300);
      await page.keyboard.press('Enter');
      await wait(2000);
      await shot(page, 'chat-03-respuesta-enviada');
      console.log('  Mensaje enviado');
    } else {
      bugs.push('ADMIN CHAT: No se encontró textarea para responder');
      console.log('  BUG: No hay textarea en el chat admin');
    }
  }

  // ══════════════════════════════════════════════════════════
  // ADMIN — Novedades: click en solicitud → ver detalle
  // ══════════════════════════════════════════════════════════
  console.log('\n═══ ADMIN: Novedades → detalle solicitud ═══');
  await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);

  const clickedSol = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"]'));
    if (rows.length > 0) { rows[0].click(); return true; }
    return false;
  });
  await wait(1500);
  await shot(page, 'nov-01-solicitud-abierta');

  // ══════════════════════════════════════════════════════════
  // ADMIN — Cliente detalle: ver matches y reunión
  // ══════════════════════════════════════════════════════════
  console.log('\n═══ ADMIN: Cliente detalle ═══');
  const clientes = await fetch(BASE + '/api/clientes').then(r => r.json()).catch(() => []);
  const firstNif = Array.isArray(clientes) && clientes[0]?.nif;
  if (firstNif) {
    await page.goto(BASE + '/clientes/' + firstNif, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    await shot(page, 'cli-01-detalle');

    // Buscar botón de matching/ejecutar
    const matchBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.includes('Matching') || b.textContent.includes('Ejecutar') || b.textContent.includes('Recalcular'));
      if (b) { b.click(); return b.textContent.trim(); }
      return null;
    });
    if (matchBtn) {
      await wait(3000);
      await shot(page, 'cli-02-matching');
      console.log('  Matching ejecutado:', matchBtn);
    }
  }

  // ══════════════════════════════════════════════════════════
  // PORTAL — Flujo completo "Quiero esta"
  // ══════════════════════════════════════════════════════════
  console.log('\n═══ PORTAL: Flujo solicitar subvención ═══');
  await loginPortal(page);
  await wait(1000);
  const portalUrl = page.url();
  console.log('  Portal URL:', portalUrl);

  if (portalUrl.includes('/portal')) {
    await shot(page, 'por-01-inicio');

    // Ir a Mis subvenciones
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.trim() === 'Mis subvenciones');
      if (b) b.click();
    });
    await wait(1500);
    await shot(page, 'por-02-mis-subvenciones');

    // Contar matches
    const nMatches = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.filter(b => b.textContent.trim() === 'Quiero esta' || b.textContent.includes('Solicitud enviada')).length;
    });
    console.log('  Matches con botón:', nMatches);

    // Click "Quiero esta" en el PRIMER match disponible (no ya solicitado)
    const clickedQuiero = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.trim() === 'Quiero esta');
      if (b) { b.click(); return true; }
      return false;
    });
    await wait(1500);
    await shot(page, 'por-03-modal-paso1');
    console.log('  Abierto modal:', clickedQuiero);

    if (clickedQuiero) {
      // Responder preguntas del modal (paso 1)
      await wait(1500); // esperar a que carguen las preguntas

      // Responder preguntas sí/no (hacer click en "Sí" para todas)
      const preguntasRespondidas = await page.evaluate(() => {
        let count = 0;
        const labels = Array.from(document.querySelectorAll('label, [role="radio"], button'));
        const siLabels = labels.filter(l => l.textContent.trim() === 'Sí');
        siLabels.forEach(l => { l.click(); count++; });
        return count;
      });
      console.log('  Preguntas sí respondidas:', preguntasRespondidas);

      // Rellenar textareas (preguntas de texto)
      const textareas = await page.$$('textarea');
      for (const ta of textareas) {
        await ta.click({ clickCount: 3 });
        await ta.type('Nuestra empresa planea implementar este proyecto para mejorar la competitividad y generar empleo en la región.');
      }
      await wait(500);
      await shot(page, 'por-04-preguntas-respondidas');

      // Siguiente paso
      const nextBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(b => b.textContent.includes('Siguiente') || b.textContent.includes('Continuar'));
        if (b) { b.click(); return b.textContent.trim(); }
        return null;
      });
      await wait(1500);
      await shot(page, 'por-05-paso2');
      console.log('  Siguiente:', nextBtn);

      if (nextBtn) {
        // Rellenar datos del contrato (paso 2)
        const inputs = await page.$$('input[type="text"], input:not([type="radio"]):not([type="checkbox"])');
        for (const inp of inputs) {
          const placeholder = await inp.evaluate(el => el.placeholder || '');
          if (placeholder.includes('nombre') || placeholder.includes('Nombre')) {
            await inp.click({ clickCount: 3 });
            await inp.type('Juan García López');
          } else if (placeholder.includes('DNI') || placeholder.includes('dni')) {
            await inp.click({ clickCount: 3 });
            await inp.type('12345678Z');
          }
        }

        // Seleccionar método de pago si está visible
        const pagoClick = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, [role="radio"]'));
          const b = btns.find(b => b.textContent.includes('Tarjeta') || b.textContent.includes('Transferencia'));
          if (b) { b.click(); return b.textContent.trim(); }
          return null;
        });
        console.log('  Pago seleccionado:', pagoClick);
        await wait(500);
        await shot(page, 'por-06-datos-contrato');

        // Siguiente paso 3
        const next2 = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(b => b.textContent.includes('Siguiente') || b.textContent.includes('Continuar') || b.textContent.includes('Confirmar'));
          if (b && !b.disabled) { b.click(); return b.textContent.trim(); }
          return null;
        });
        await wait(1500);
        await shot(page, 'por-07-paso3');
        console.log('  Paso 3:', next2);

        // Confirmar solicitud final
        const confirmar = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const b = btns.find(b => b.textContent.includes('Confirmar') || b.textContent.includes('Enviar'));
          if (b && !b.disabled) { b.click(); return b.textContent.trim(); }
          return null;
        });
        await wait(3000);
        await shot(page, 'por-08-solicitud-enviada');
        console.log('  Confirmada:', confirmar);
      }
    }

    // Ver Expedientes en portal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.trim() === 'Expedientes');
      if (b) b.click();
    });
    await wait(1200);
    await shot(page, 'por-09-expedientes');

    // Ver Mi empresa
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.textContent.trim() === 'Mi empresa');
      if (b) b.click();
    });
    await wait(1200);
    await shot(page, 'por-10-mi-empresa');
  }

  await browser.close();

  // Reporte
  console.log('\n' + '═'.repeat(50));
  console.log('REPORTE');
  console.log('═'.repeat(50));
  console.log('Network errors:', netErrors.length);
  netErrors.forEach(e => console.log(' ', e.s, e.u.slice(0, 100)));
  console.log('Bugs detectados:', bugs.length);
  bugs.forEach(b => console.log(' ', b));
  console.log('Screenshots:', idx, '→', OUT);
})();
