const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const BASE = 'http://localhost:3333';
const OUT = path.join(__dirname, 'test-screenshots');
fs.readdirSync(OUT).forEach(f => fs.unlinkSync(path.join(OUT, f)));
let idx = 0;
const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, String(idx++).padStart(2,'0') + '-' + name + '.png'), fullPage: true });
  console.log(' [shot]', name);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errs = [];
  page.on('response', r => {
    if (r.status() >= 400 && !r.url().includes('_next') && !r.url().includes('favicon'))
      errs.push(r.status() + ' ' + r.url().split('/').slice(-3).join('/'));
  });

  // ── ADMIN LOGIN
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder')?.click());
  await wait(700);
  await page.waitForSelector('input[type=email]', { timeout: 5000 });
  await page.type('input[type=email]', 'admin@ayudapyme.es');
  await page.type('input[type=password]', 'Admin123456!');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await wait(1000);
  await shot(page, '01-admin-dashboard');
  console.log('Admin URL:', page.url());

  // Novedades: click en solicitud → ver si abre detalle inline
  await page.goto(BASE + '/novedades', { waitUntil: 'networkidle2', timeout: 12000 });
  await wait(1500);
  const clickedNov = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[style*="cursor: pointer"]'));
    const row = rows.find(r => r.textContent.includes('TechNova') || r.textContent.includes('CONVOCATORIA'));
    if (row) { row.click(); return true; }
    return false;
  });
  await wait(1500);
  await shot(page, '02-novedades-click-solicitud');
  console.log(' Novedades row click:', clickedNov);

  // Solicitudes admin
  await page.goto(BASE + '/solicitudes', { waitUntil: 'networkidle2', timeout: 12000 });
  await wait(1500);
  const clickedSol = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[style*="cursor: pointer"]'));
    const row = rows.find(r => r.textContent.includes('TechNova') || r.textContent.includes('CONVOCATORIA') || r.textContent.includes('Pago'));
    if (row) { row.click(); return row.textContent.trim().slice(0, 50); }
    return null;
  });
  await wait(1500);
  await shot(page, '03-solicitudes-detalle');
  console.log(' Sol row:', clickedSol);

  // ── PORTAL LOGIN
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Acceder')?.click());
  await wait(700);
  await page.waitForSelector('input[type=email]', { timeout: 5000 });
  await page.type('input[type=email]', 'demo.lamar@ayudapyme.es');
  await page.type('input[type=password]', 'Client123456!');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await wait(2000);
  await shot(page, '04-portal-inicio');

  // Mis subvenciones
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mis subvenciones')?.click());
  await wait(1500);
  await shot(page, '05-portal-mis-subvenciones');

  // Quiero esta → modal
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Quiero esta')?.click());
  await wait(3000);
  await shot(page, '06-portal-modal-preguntas');

  // Responder preguntas Sí/No clicando los botones correctos
  const answered = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    const siBtns = allBtns.filter(b => b.textContent.trim().includes('Sí') && !b.textContent.includes('subvenciones') && !b.textContent.includes('empresa'));
    siBtns.forEach(b => b.click());
    return siBtns.length;
  });
  console.log(' Preguntas Sí clicadas:', answered);
  await wait(300);

  // Rellenar textareas de proyecto (texto_largo)
  const textareas = await page.$$('textarea');
  for (const ta of textareas) {
    await ta.click({ clickCount: 3 });
    await ta.type('Implementación de sistema de gestión digital para mejorar la productividad y reducir costes operativos en nuestra empresa.');
  }
  // Rellenar inputs de texto corto y número dentro del modal usando Puppeteer type()
  const modalInputs = await page.$$('input[placeholder*="respuesta"], input[placeholder*="Tu respuesta"], input[type="number"]');
  for (const inp of modalInputs) {
    await inp.click({ clickCount: 3 });
    const inpType = await inp.evaluate(el => el.type);
    await inp.type(inpType === 'number' ? '25' : 'Buena rentabilidad y ahorro de costes operativos');
  }
  // También buscar cualquier input de texto que esté dentro del modal (visible, sin placeholder conocido)
  const allModalTextInputs = await page.$$('input[type="text"]');
  for (const inp of allModalTextInputs) {
    const val = await inp.evaluate(el => el.value);
    if (!val) {
      await inp.click({ clickCount: 3 });
      await inp.type('Resultado esperado: mejora de la eficiencia operativa');
    }
  }
  await wait(500);
  await shot(page, '07-portal-modal-respondido');

  // Esperar a que se habilite el botón Continuar (max 3s)
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continuar'));
      return btn && !btn.disabled;
    },
    { timeout: 3000 }
  ).catch(() => console.log(' [warn] Botón Continuar sigue deshabilitado — puede faltar respuesta obligatoria'));

  // Avanzar (Continuar)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continuar'));
    if (btn) btn.click();
  });
  await wait(1000);
  await shot(page, '08-portal-modal-paso2-contrato');

  // En paso 2: marcar checkbox de aceptación
  await page.evaluate(() => {
    const checkbox = document.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) checkbox.click();
  });
  await wait(300);

  // Avanzar paso 2 (Firmar y continuar)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Firmar'));
    if (btn) btn.click();
  });
  await wait(1000);
  await shot(page, '09-portal-modal-paso3-pago');

  // Paso 3: seleccionar método de pago (Transferencia)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Transferencia') || b.textContent.includes('transferencia'));
    if (btn) btn.click();
  });
  await wait(300);

  // Confirmar solicitud
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirmar solicitud'));
    if (btn && !btn.disabled) btn.click();
  });
  await wait(3000);
  await shot(page, '10-portal-solicitud-confirmada');

  // Cerrar modal
  await page.keyboard.press('Escape');
  await wait(500);

  // Mi empresa
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mi empresa')?.click());
  await wait(1000);
  await shot(page, '11-portal-mi-empresa');

  // Mi Gestor
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mi Gestor')?.click());
  await wait(800);
  await shot(page, '12-portal-mi-gestor');

  await browser.close();
  console.log('\n=== Network errors:', errs.length ? errs.join(' | ') : 'NINGUNO ✓');
})();
