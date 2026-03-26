/**
 * test-qa-recheck.js — QA Recheck: verifica fixes + audit completo
 * Verifica: (1) Portal mobile responsive, (2) Landing mobile overflow, (3) Custom 404
 * Luego re-ejecuta audit completo: Landing, Auth, Dashboard Admin, Portal, Public, Security
 * Uso: node test-qa-recheck.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'test-screenshots-recheck');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Clean previous screenshots
fs.readdirSync(OUT).forEach(f => {
  if (f.endsWith('.png') || f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));
});

let shotIndex = 0;
const report = {
  date: new Date().toISOString(),
  fixVerifications: [],
  bugs: [],
  warnings: [],
  networkErrors: [],
  consoleErrors: [],
  screenshots: [],
  passed: [],
};

function log(msg) { console.log(`  ${msg}`); }
function logSection(msg) { console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`); }

async function shot(page, name) {
  const filename = String(shotIndex++).padStart(3, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, filename), fullPage: true });
  report.screenshots.push(filename);
  log(`[SHOT] ${filename}`);
  return filename;
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function addBug(section, desc, severity = 'medium') {
  report.bugs.push({ section, desc, severity });
  log(`[BUG ${severity.toUpperCase()}] ${desc}`);
}

function addWarning(section, desc) {
  report.warnings.push({ section, desc });
  log(`[WARN] ${desc}`);
}

function addPass(section, desc) {
  report.passed.push({ section, desc });
  log(`[PASS] ${desc}`);
}

function addFixVerification(bugId, desc, status, details) {
  report.fixVerifications.push({ bugId, desc, status, details });
  const icon = status === 'FIXED' ? '[FIX OK]' : '[FIX FAIL]';
  log(`${icon} ${bugId}: ${desc} => ${status} | ${details}`);
}

// ---- Helpers ----

async function checkForErrors(page, section) {
  const errorTexts = await page.evaluate(() => {
    const leafNodes = Array.from(document.querySelectorAll('*'))
      .filter(e => e.children.length === 0)
      .filter(e => {
        const t = e.textContent.trim();
        return t.length > 0 && t.length < 300 && (
          /error|Error|ERROR/.test(t) ||
          t.includes('500') ||
          t.includes('Something went wrong') ||
          t.includes('Algo salió mal')
        );
      })
      .map(e => e.textContent.trim())
      .slice(0, 5);
    return leafNodes;
  }).catch(() => []);

  const realErrors = errorTexts.filter(t =>
    !t.includes('0 error') &&
    !t.includes('Console error') &&
    !t.includes('error de') &&
    t.length > 3
  );

  if (realErrors.length > 0) {
    addBug(section, `Visible error text: ${realErrors[0].slice(0, 100)}`, 'high');
  }

  const bodyText = await page.evaluate(() => document.body?.innerText?.trim()?.length || 0).catch(() => 0);
  if (bodyText < 10) {
    addBug(section, 'Empty or near-empty page (possible broken route)', 'critical');
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
    addBug(section, `${broken.length} broken image(s): ${broken[0].slice(0, 80)}`, 'medium');
  }
  return broken;
}

async function checkAccessibility(page, section) {
  const issues = await page.evaluate(() => {
    const problems = [];
    const emptyButtons = Array.from(document.querySelectorAll('button'))
      .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg title'));
    if (emptyButtons.length > 0) problems.push(`${emptyButtons.length} button(s) without text/aria-label`);

    const noAltImages = Array.from(document.querySelectorAll('img'))
      .filter(img => !img.getAttribute('alt'));
    if (noAltImages.length > 0) problems.push(`${noAltImages.length} image(s) without alt`);

    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
    const noLabel = inputs.filter(i => {
      const id = i.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = i.getAttribute('aria-label') || i.getAttribute('placeholder');
      return !hasLabel && !hasAriaLabel;
    });
    if (noLabel.length > 0) problems.push(`${noLabel.length} input(s) without label/placeholder`);

    return problems;
  }).catch(() => []);

  issues.forEach(i => addWarning(section, `Accessibility: ${i}`));
  return issues;
}

async function checkOverflow(page, section) {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  }).catch(() => false);
  if (hasOverflow) {
    addBug(section, 'Horizontal overflow detected (content bleeds past viewport)', 'medium');
  }
  return hasOverflow;
}

// ---- Auth helpers ----

async function logout(page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const cookies = await page.cookies();
  if (cookies.length) await page.deleteCookie(...cookies);
  await wait(300);
}

async function loginAs(page, email, password, label) {
  await logout(page);
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

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
    addBug('auth', `Could not find email field for login ${label}`, 'critical');
    return false;
  }

  await page.click('input[type="email"]', { clickCount: 3 });
  await page.type('input[type="email"]', email);
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', password);
  await page.keyboard.press('Enter');
  await wait(3000);
  log(`Login ${label}: URL -> ${page.url()}`);
  return true;
}

// ======================================================================
// FIX VERIFICATION #1: Portal mobile responsive (P0 CRITICAL)
// ======================================================================

async function verifyFix1_PortalMobile(page) {
  logSection('FIX #1: Portal mobile responsive (P0 CRITICAL)');

  // Must login as CLIENT (not admin) -- admin gets redirected to /clientes
  // Try demo.lamar@ayudapyme.es first, fallback to admin and note
  let loggedIn = await loginAs(page, 'demo.lamar@ayudapyme.es', 'Client123456!', 'client-portal');
  let usedClientAccount = true;

  // Check if we actually reached the portal
  await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);

  // If not on portal (redirected away), try admin but note it
  if (!page.url().includes('/portal')) {
    log(`Client login redirected to ${page.url()}, trying admin...`);
    loggedIn = await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin-for-portal-check');
    usedClientAccount = false;
    await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
  }

  if (!loggedIn) {
    addFixVerification('P0', 'Portal mobile responsive', 'UNABLE_TO_TEST', 'Could not login');
    return;
  }

  // If admin, they get redirected to /clientes (admin dashboard) - note this
  if (!usedClientAccount && !page.url().includes('/portal')) {
    log(`Admin redirected from /portal to ${page.url()} -- testing admin dashboard mobile instead`);
    addWarning('fix1', `Admin is redirected from /portal to ${page.url()} -- portal mobile test requires client account`);
  }

  // Set mobile viewport
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);

  await shot(page, 'fix1-portal-mobile-375');

  // Check: sidebar should NOT be visible (hidden or hamburger)
  // Note: the portal page has a top <nav> bar (sticky, full-width) which is NOT a sidebar.
  // We look specifically for a sidebar-like element that is vertical navigation on the left.
  const sidebarState = await page.evaluate(() => {
    // Look for aside, or vertical nav-like elements (not the top navbar)
    const candidates = Array.from(document.querySelectorAll('aside, [class*="sidebar"], [class*="Sidebar"]'));
    // Also check navs that are positioned as a sidebar (not top bar)
    const navs = Array.from(document.querySelectorAll('nav'));
    for (const nav of navs) {
      const rect = nav.getBoundingClientRect();
      // A sidebar nav would be tall and narrow, not wide and short (top bar)
      if (rect.height > 200 && rect.width < rect.height && rect.width < window.innerWidth * 0.7) {
        candidates.push(nav);
      }
    }
    if (candidates.length === 0) return { found: false };
    const sidebar = candidates[0];
    const rect = sidebar.getBoundingClientRect();
    const style = window.getComputedStyle(sidebar);
    return {
      found: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      offscreen: rect.right <= 0 || rect.left >= window.innerWidth,
      display: style.display,
      position: style.position,
      transform: style.transform,
      tag: sidebar.tagName,
    };
  });

  log(`Sidebar state: ${JSON.stringify(sidebarState)}`);

  // Check for hamburger/menu button
  const hasHamburger = await page.evaluate(() => {
    const menuBtn = document.querySelector('[class*="menu"], [aria-label*="menu"], [aria-label*="Menu"]');
    const svgBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const svg = b.querySelector('svg');
      return svg && b.getBoundingClientRect().width < 60;
    });
    return !!(menuBtn || svgBtn);
  });

  // Check cards responsive
  const cardsOverflow = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"]'));
    const overflowing = cards.filter(c => {
      const rect = c.getBoundingClientRect();
      return rect.right > window.innerWidth || rect.width > window.innerWidth;
    });
    return { total: cards.length, overflowing: overflowing.length };
  });

  log(`Cards: ${cardsOverflow.total} total, ${cardsOverflow.overflowing} overflowing`);

  // Check horizontal overflow
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  const sidebarHidden = !sidebarState.found || !sidebarState.visible || sidebarState.offscreen;
  const cardsOk = cardsOverflow.overflowing === 0;
  const noOverflow = !hasOverflow;

  if (sidebarHidden && cardsOk && noOverflow) {
    addFixVerification('P0', 'Portal mobile responsive', 'FIXED',
      `Sidebar hidden=${sidebarHidden}, cards overflow=0/${cardsOverflow.total}, no horizontal overflow`);
  } else {
    const issues = [];
    if (!sidebarHidden) issues.push('sidebar still visible');
    if (!cardsOk) issues.push(`${cardsOverflow.overflowing} cards overflow`);
    if (!noOverflow) issues.push('horizontal overflow detected');
    addFixVerification('P0', 'Portal mobile responsive', 'NOT_FIXED', issues.join('; '));
  }

  if (hasHamburger) addPass('fix1', 'Hamburger menu button detected in mobile');
  else addWarning('fix1', 'No hamburger menu button detected in mobile');

  // Also test at 390px (iPhone 14 Pro)
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'fix1-portal-mobile-390');

  // Test admin dashboard mobile as well (separate check)
  logSection('FIX #1b: Admin Dashboard mobile sidebar check');
  await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin-mobile-check');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2', timeout: 20000 });
  await wait(2000);
  await shot(page, 'fix1b-admin-dashboard-mobile');

  const adminSidebarState = await page.evaluate(() => {
    const sidebar = document.querySelector('aside, nav:not(:first-of-type), [class*="sidebar"], [class*="Sidebar"]');
    if (!sidebar) return { found: false };
    const rect = sidebar.getBoundingClientRect();
    const style = window.getComputedStyle(sidebar);
    return {
      found: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
      width: rect.width,
    };
  });
  log(`Admin dashboard sidebar on mobile: ${JSON.stringify(adminSidebarState)}`);

  const adminOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (adminSidebarState.found && adminSidebarState.visible && adminSidebarState.width > 200) {
    addBug('admin-dashboard-mobile', 'Admin dashboard sidebar is NOT responsive on mobile (full width sidebar visible)', 'high');
  }
  if (adminOverflow) {
    addBug('admin-dashboard-mobile', 'Admin dashboard has horizontal overflow on mobile', 'medium');
  }

  // Reset
  await page.setViewport({ width: 1280, height: 900 });
}

// ======================================================================
// FIX VERIFICATION #2: Landing mobile overflow (P1)
// ======================================================================

async function verifyFix2_LandingMobile(page) {
  logSection('FIX #2: Landing mobile overflow (P1)');

  await logout(page);
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2000);

  await shot(page, 'fix2-landing-mobile-hero');

  // Check overflow at top
  const overflowTop = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  // Scroll through the page in segments to check overflow at different points
  const overflowPoints = await page.evaluate(() => {
    const results = [];
    const totalHeight = document.body.scrollHeight;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, (totalHeight / steps) * i);
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      results.push({ scrollY: Math.round((totalHeight / steps) * i), overflow });
    }
    return results;
  });

  log(`Overflow check points: ${JSON.stringify(overflowPoints)}`);

  // Scroll to middle and screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await wait(500);
  await shot(page, 'fix2-landing-mobile-mid');

  // Scroll to bottom and screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  await shot(page, 'fix2-landing-mobile-bottom');

  const anyOverflow = overflowPoints.some(p => p.overflow);

  if (!anyOverflow && !overflowTop) {
    addFixVerification('P1', 'Landing mobile horizontal overflow', 'FIXED',
      'No horizontal overflow at any scroll position');
  } else {
    const overflowAt = overflowPoints.filter(p => p.overflow).map(p => p.scrollY);
    addFixVerification('P1', 'Landing mobile horizontal overflow', 'NOT_FIXED',
      `Overflow at scroll positions: ${overflowAt.join(', ')}`);
  }

  // Also check elements that commonly cause overflow
  const wideElements = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const problematic = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > vw + 5 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
        problematic.push({
          tag: el.tagName,
          class: el.className?.toString()?.slice(0, 60) || '',
          width: Math.round(rect.width),
        });
      }
    });
    return problematic.slice(0, 5);
  });

  if (wideElements.length > 0) {
    log(`Elements wider than viewport: ${JSON.stringify(wideElements)}`);
    addWarning('fix2', `${wideElements.length} element(s) wider than mobile viewport`);
  }

  await page.setViewport({ width: 1280, height: 900 });
}

// ======================================================================
// FIX VERIFICATION #3: Custom 404 page (P3)
// ======================================================================

async function verifyFix3_Custom404(page) {
  logSection('FIX #3: Custom 404 page (P3)');

  await logout(page);
  await page.setViewport({ width: 1280, height: 900 });

  // Navigate to a non-existent route
  const response = await page.goto(BASE + '/ruta-que-no-existe', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);

  await shot(page, 'fix3-404-page');

  const statusCode = response ? response.status() : 0;
  log(`HTTP status: ${statusCode}`);

  const pageContent = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText.trim().slice(0, 500),
      has404: /404/.test(document.body.innerText),
      hasNotFound: /no encontrada|not found/i.test(document.body.innerText),
      hasBackLink: !!document.querySelector('a[href="/"]'),
      hasAyudaPyme: /AyudaPyme/i.test(document.body.innerText),
      h1Text: document.querySelector('h1')?.textContent?.trim() || '',
      isLanding: !!(document.querySelector('h1') && /subvenciones|ayuda|pyme/i.test(document.querySelector('h1').textContent || '')),
    };
  });

  log(`Page content: ${JSON.stringify(pageContent)}`);

  // The fix means: shows 404 page (not landing), has "404" text, has "no encontrada" text
  const isCustom404 = pageContent.has404 && pageContent.hasNotFound && !pageContent.isLanding;

  if (isCustom404) {
    addFixVerification('P3', 'Custom 404 page', 'FIXED',
      `Shows "404" + "no encontrada", h1="${pageContent.h1Text}", has back link=${pageContent.hasBackLink}`);
  } else if (pageContent.isLanding) {
    addFixVerification('P3', 'Custom 404 page', 'NOT_FIXED',
      'Still showing landing page instead of 404');
  } else {
    addFixVerification('P3', 'Custom 404 page', 'PARTIAL',
      `has404=${pageContent.has404}, hasNotFound=${pageContent.hasNotFound}, h1="${pageContent.h1Text}"`);
  }

  // Also test mobile 404
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE + '/ruta-que-no-existe-mobile', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'fix3-404-mobile');

  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (!mobileOverflow) addPass('fix3', '404 page has no mobile overflow');
  else addWarning('fix3', '404 page has horizontal overflow on mobile');

  await page.setViewport({ width: 1280, height: 900 });
}

// ======================================================================
// FULL AUDIT SECTIONS
// ======================================================================

async function testLanding(page) {
  logSection('AUDIT 1: LANDING PAGE - Desktop (1280x900)');
  await logout(page);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 120000 });
  await wait(2000);

  await shot(page, 'landing-01-hero');
  await checkForErrors(page, 'landing');
  await checkBrokenImages(page, 'landing');
  await checkOverflow(page, 'landing');

  const heroExists = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent.trim().slice(0, 60) : null;
  });
  if (heroExists) addPass('landing', `Hero H1 present: "${heroExists}"`);
  else addBug('landing', 'No H1 in Hero', 'high');

  const ctaButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a'))
      .filter(b => /Acceder|Empezar|Solicitar|Contáctanos|Quiero/.test(b.textContent))
      .map(b => b.textContent.trim())
      .slice(0, 5);
  });
  if (ctaButtons.length > 0) addPass('landing', `CTAs found: ${ctaButtons.join(', ')}`);
  else addBug('landing', 'No CTA buttons found on landing', 'high');

  const sections = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('section, [id]'))
      .map(s => s.id || s.tagName)
      .filter(Boolean)
      .slice(0, 15);
  });
  log(`Sections: ${sections.join(', ')}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(1000);
  await shot(page, 'landing-02-footer');

  const footerLinks = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    if (!footer) return [];
    return Array.from(footer.querySelectorAll('a')).map(a => a.textContent.trim()).slice(0, 10);
  });
  if (footerLinks.length > 0) addPass('landing', `Footer with ${footerLinks.length} links`);
  else addWarning('landing', 'Footer without links or not found');

  // Mobile
  logSection('AUDIT 1b: LANDING - Mobile (375x812)');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'landing-03-mobile');
  await checkOverflow(page, 'landing-mobile');

  // Tablet
  logSection('AUDIT 1c: LANDING - Tablet (768x1024)');
  await page.setViewport({ width: 768, height: 1024 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'landing-04-tablet');
  await checkOverflow(page, 'landing-tablet');

  await page.setViewport({ width: 1280, height: 900 });
}

async function testAuth(page) {
  logSection('AUDIT 2: AUTH FLOW');

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1000);

  const modalOpened = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, a'))
      .find(b => /Acceder|Iniciar sesión/.test(b.textContent.trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });
  await wait(800);

  if (modalOpened) {
    await shot(page, 'auth-01-modal');
    const hasEmailField = await page.$('input[type="email"]');
    if (hasEmailField) addPass('auth', 'Login modal opened with email field');
    else addBug('auth', 'Modal opened but no email field', 'high');
  } else {
    addBug('auth', 'Could not open login modal/page', 'critical');
  }

  // Wrong credentials
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  if (emailInput && passInput) {
    await emailInput.type('test@fake.com');
    await passInput.type('wrongpassword');
    await page.keyboard.press('Enter');
    await wait(2000);
    await shot(page, 'auth-02-error');

    const errorShown = await page.evaluate(() => {
      return /error|inválid|incorrect|no existe|credenciales/i.test(document.body.innerText);
    });
    if (errorShown) addPass('auth', 'Login error message shown correctly');
    else addWarning('auth', 'No error message detected for wrong credentials');
  }

  await page.keyboard.press('Escape');
  await wait(500);

  // Admin login
  logSection('AUDIT 2b: AUTH - Admin login');
  const adminLogin = await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin');
  if (adminLogin) {
    await shot(page, 'auth-03-admin-logged');
    const isOnDashboard = page.url().includes('/dashboard') || page.url().includes('/novedades');
    if (isOnDashboard) addPass('auth', 'Admin redirected to dashboard correctly');
    else addWarning('auth', `Admin redirected to: ${page.url()}`);
  }
}

async function testAdminDashboard(page) {
  logSection('AUDIT 3: ADMIN DASHBOARD - All routes');

  if (!page.url().includes('/dashboard') && !page.url().includes('/novedades')) {
    await loginAs(page, 'admin@ayudapyme.es', 'Admin123456!', 'admin');
  }

  const routes = [
    { path: '/dashboard', name: 'dashboard' },
    { path: '/novedades', name: 'novedades' },
    { path: '/clientes', name: 'clientes' },
    { path: '/matches', name: 'matches' },
    { path: '/subvenciones', name: 'subvenciones' },
    { path: '/subvenciones-bd', name: 'subvenciones-bd' },
    { path: '/solicitudes', name: 'solicitudes' },
    { path: '/expedientes', name: 'expedientes' },
    { path: '/chats', name: 'chats' },
    { path: '/reuniones', name: 'reuniones' },
    { path: '/alertas', name: 'alertas' },
    { path: '/proveedores', name: 'proveedores' },
    { path: '/ajustes', name: 'ajustes' },
  ];

  for (const route of routes) {
    log(`\n--- ${route.name} ---`);
    await page.goto(BASE + route.path, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(1500);
    await shot(page, `admin-${route.name}`);
    await checkForErrors(page, `admin-${route.name}`);
  }

  // Dashboard-specific checks
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await checkAccessibility(page, 'admin-dashboard');

  // Clientes check
  await page.goto(BASE + '/clientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  const clientCount = await page.evaluate(() => {
    return document.querySelectorAll('table tbody tr, a[href*="/clientes/"]').length;
  });
  log(`Visible clients: ${clientCount}`);
  if (clientCount > 0) addPass('admin-clientes', `${clientCount} clients in list`);
  else addWarning('admin-clientes', 'Client list empty');

  // Click first client detail
  const clienteUrl = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href*="/clientes/"]'))
      .find(l => !l.href.includes('/nuevo'));
    return link ? link.href : null;
  });
  if (clienteUrl) {
    await page.goto(clienteUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(1500);
    await shot(page, 'admin-cliente-detalle');
    await checkForErrors(page, 'admin-cliente-detalle');
    addPass('admin-clientes', 'Client detail page loads');
  }

  // New client form
  await page.goto(BASE + '/clientes/nuevo', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'admin-cliente-nuevo');
  await checkForErrors(page, 'admin-cliente-nuevo');
  await checkAccessibility(page, 'admin-cliente-nuevo');

  // Expediente detail
  await page.goto(BASE + '/expedientes', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  const expUrl = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a[href*="/expedientes/"]'))
      .find(l => !l.href.includes('/nuevo'));
    return link ? link.href : null;
  });
  if (expUrl) {
    await page.goto(expUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await wait(2000);
    await shot(page, 'admin-expediente-detalle');
    await checkForErrors(page, 'admin-expediente-detalle');
    addPass('admin-expedientes', 'Expediente detail loads');
  }

  // Sidebar check
  const sidebarItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('nav a, aside a, [class*="sidebar"] a'));
    return links.map(l => ({ text: l.textContent.trim(), href: l.getAttribute('href') })).filter(l => l.text.length > 0);
  });
  log(`Sidebar items: ${sidebarItems.length}`);
  if (sidebarItems.length >= 5) addPass('admin-nav', `Sidebar with ${sidebarItems.length} items`);
  else addWarning('admin-nav', `Sidebar with only ${sidebarItems.length} items`);
}

async function testPortal(page) {
  logSection('AUDIT 4: PORTAL CLIENTE');

  // Login as client to access portal (admin gets redirected to /clientes)
  const loggedIn = await loginAs(page, 'demo.lamar@ayudapyme.es', 'Client123456!', 'client-portal-audit');
  if (!loggedIn) {
    addBug('portal', 'Could not login for portal check', 'critical');
    return;
  }

  await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(2000);
  await shot(page, 'portal-01-desktop');
  await checkForErrors(page, 'portal');
  await checkOverflow(page, 'portal');
  await checkAccessibility(page, 'portal');

  // Portal sections
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
      await shot(page, `portal-${safeName}`);
      await checkForErrors(page, `portal-${safeName}`);
      addPass('portal', `Section "${sec}" accessible`);
    } else {
      addWarning('portal', `Section "${sec}" not found`);
    }
  }

  // Portal mobile (part of full audit, complements fix verification)
  logSection('AUDIT 4b: PORTAL - Mobile (375x812)');
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(BASE + '/portal', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1500);
  await shot(page, 'portal-02-mobile');
  await checkOverflow(page, 'portal-mobile');

  await page.setViewport({ width: 1280, height: 900 });
}

async function testPublicPages(page) {
  logSection('AUDIT 5: PUBLIC PAGES');
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
    if (bodyLength > 50) addPass(`public-${route.name}`, `Page loads with content (${bodyLength} chars)`);
    else addBug(`public-${route.name}`, 'Page with little or no content', 'medium');
  }

  // 404 (covered in fix verification but also part of full audit)
  await page.goto(BASE + '/ruta-random-xyz-abc', { waitUntil: 'networkidle2', timeout: 15000 });
  await wait(1000);
  await shot(page, 'public-404-audit');
  const has404 = await page.evaluate(() => /404|no encontrada|not found/i.test(document.body.innerText));
  if (has404) addPass('public-404', '404 page shown correctly');
  else addWarning('public-404', 'No 404 page for non-existent routes');
}

async function testSecurity(page) {
  logSection('AUDIT 6: SECURITY - Unauthenticated access');
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
      addPass('security', `${route} redirects when not authenticated`);
    } else if (finalUrl.includes(route)) {
      addBug('security', `${route} accessible without authentication!`, 'critical');
      await shot(page, `security-unprotected${route.replace(/\//g, '-')}`);
    } else {
      addWarning('security', `${route} redirects to ${finalUrl}`);
    }
  }
}

// ======================================================================
// MAIN
// ======================================================================

(async () => {
  console.log('================================================================');
  console.log('  QA RECHECK - AyudaPyme');
  console.log('  Date: ' + new Date().toISOString().slice(0, 10));
  console.log('  Verifying 3 bug fixes + full audit');
  console.log('================================================================');

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

  // Capture JS crashes
  page.on('pageerror', err => {
    report.bugs.push({ section: 'js-crash', desc: `JS Error: ${err.message.slice(0, 150)}`, severity: 'high' });
  });

  const startTime = Date.now();

  try {
    // ---- Phase 1: Verify the 3 fixes ----
    logSection('PHASE 1: FIX VERIFICATIONS');

    // Need initial page load to warm up Turbopack
    log('Warming up server (first load may compile)...');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 120000 });
    await wait(2000);

    await verifyFix2_LandingMobile(page);   // Fix #2 first (no auth needed)
    await verifyFix3_Custom404(page);         // Fix #3 (no auth needed)
    await verifyFix1_PortalMobile(page);     // Fix #1 (needs auth)

    // ---- Phase 2: Full audit ----
    logSection('PHASE 2: FULL AUDIT');

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

  // ---- FINAL REPORT ----
  console.log('\n\n');
  console.log('================================================================');
  console.log('  QA RECHECK REPORT');
  console.log('================================================================');
  console.log(`\nDuration: ${elapsed}s`);
  console.log(`Screenshots: ${report.screenshots.length}`);

  // Fix verifications
  console.log('\n--- FIX VERIFICATIONS ---');
  report.fixVerifications.forEach(f => {
    const marker = f.status === 'FIXED' ? 'OK' : 'FAIL';
    console.log(`  [${marker}] ${f.bugId}: ${f.desc} => ${f.status}`);
    console.log(`         ${f.details}`);
  });

  // Bugs by severity
  const critical = report.bugs.filter(b => b.severity === 'critical');
  const high = report.bugs.filter(b => b.severity === 'high');
  const medium = report.bugs.filter(b => b.severity === 'medium');

  console.log(`\nBUGS: ${report.bugs.length} total`);
  if (critical.length) {
    console.log(`  CRITICAL (${critical.length}):`);
    critical.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }
  if (high.length) {
    console.log(`  HIGH (${high.length}):`);
    high.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }
  if (medium.length) {
    console.log(`  MEDIUM (${medium.length}):`);
    medium.forEach(b => console.log(`     [${b.section}] ${b.desc}`));
  }

  console.log(`\nWARNINGS: ${report.warnings.length}`);
  report.warnings.forEach(w => console.log(`   [${w.section}] ${w.desc}`));

  console.log(`\nNetwork errors (4xx/5xx): ${report.networkErrors.length}`);
  report.networkErrors.slice(0, 15).forEach(e => console.log(`   ${e.status} ${e.url}`));

  console.log(`\nConsole errors: ${report.consoleErrors.length}`);
  report.consoleErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));

  console.log(`\nPASSED: ${report.passed.length}`);
  report.passed.forEach(p => console.log(`   [${p.section}] ${p.desc}`));

  console.log(`\nScreenshots in: ${OUT}`);

  // Write JSON report
  const reportPath = path.join(OUT, 'qa-recheck-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${reportPath}`);

  // Exit code
  const fixesFailed = report.fixVerifications.filter(f => f.status !== 'FIXED');
  if (fixesFailed.length > 0 || critical.length > 0) {
    console.log('\nRESULT: FIXES OR CRITICAL BUGS NEED ATTENTION');
    process.exit(1);
  } else if (high.length > 0) {
    console.log('\nRESULT: High priority bugs exist');
    process.exit(0);
  } else {
    console.log('\nRESULT: All fixes verified, no critical bugs');
    process.exit(0);
  }
})();
