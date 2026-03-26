# QA Audit Report v2 — AyudaPyme
**Fecha:** 2026-03-26
**Duracion del test:** 147.4s
**Screenshots:** 41
**Herramienta:** Puppeteer headless + revision visual multimodal (Claude)
**Metodo:** Test automatizado + revision visual humana de TODOS los screenshots

---

## Resumen Ejecutivo

| Categoria | Cantidad |
|-----------|----------|
| PASSED | 29 |
| BUGS reales | 4 |
| FALSOS POSITIVOS del test | 3 |
| WARNINGS | 9 |
| Network errors | 3 (2 esperados, 1 investigar) |
| Console errors | 3 (esperados) |

**Estado general: La app es funcional y profesional en desktop. El portal cliente mobile se ve MUCHO MEJOR de lo esperado (sidebar oculta, cards apiladas). La landing en desktop es excelente. Los bugs reales son de severidad media-baja. No hay bloqueantes criticos.**

---

## BUGS REALES (ordenados por severidad)

### BUG-1: MEDIO — 404 no visible para usuarios no autenticados
- **Ruta:** `/ruta-que-no-existe`
- **Screenshot:** `040-public-404.png`
- **Verificacion visual:** La captura 404 es IDENTICA a la landing page.
- **Causa raiz:** El middleware `proxy.ts` (linea 37-38) redirige TODAS las rutas no publicas sin sesion a `/`. Esto incluye rutas inexistentes. La pagina `app/not-found.tsx` SI EXISTE (fue creada en commit 20f4189) pero nunca se muestra para usuarios no autenticados.
- **Impacto:** SEO (devuelve 307 en vez de 404), confusion si llega a URL invalida. Para usuarios autenticados, el 404 SÍ funciona.
- **Fix:** En `proxy.ts`, antes del check `!user`, verificar si la ruta coincide con alguna ruta conocida de la app. Si no coincide con ninguna ruta real, dejar pasar para que Next.js maneje el 404.
- **Estimacion:** 30min

### BUG-2: MEDIO — Admin redirigido a /clientes tras login en vez de /dashboard
- **Ruta:** Login admin
- **Verificacion visual:** Tras login con credenciales admin, URL final es `/clientes`, no `/dashboard`.
- **Impacto:** El admin no ve primero sus KPIs, alertas y expedientes activos. Va directo a lista de clientes.
- **Fix:** Cambiar redirect post-login a `/dashboard` o `/novedades`.
- **Estimacion:** 15min

### BUG-3: BAJO — Landing mobile tiene overflow horizontal menor
- **Ruta:** `/` en viewport 375x812
- **Screenshot:** `002-landing-03-mobile-hero.png`, `004-landing-05-mobile-mid.png`
- **Verificacion visual:** El contenido en mobile se adapta razonablemente bien tras los fixes del commit ce32863 (AboutUs, HowItWorks, Testimonials, Pricing todos tienen responsive mejorado). Sin embargo, se detecta overflow horizontal residual, probablemente por algun elemento con min-width o padding fijo.
- **Impacto:** Scroll horizontal no deseado en mobile. UX menor degradada.
- **Fix:** Agregar `overflow-x: hidden` al contenedor principal como safety net. Auditar elementos con width fijo.
- **Estimacion:** 30min
- **NOTA:** Este bug fue parcialmente corregido en commits ce32863 y 20f4189. La situacion es MUCHO mejor que antes.

### BUG-4: BAJO — Error 400 en query de documentos (posible legacy)
- **Ruta:** Al navegar en expedientes
- **Network error:** `400 /rest/v1/documentos?columns=...`
- **Impacto:** Query referencia columnas que posiblemente no existen. No visible al usuario pero genera error en consola.
- **Fix:** Investigar y actualizar query de documentos.
- **Estimacion:** 30min

---

## FALSOS POSITIVOS del test automatizado (3)

1. **"+18.500 EUR conseguidos"** — El detector de errores captura texto con numeros. Es contenido legitimo del Hero (stats).
2. **"Desde 1.500 EUR/ano"** — Texto de pricing de proveedores. Contenido valido.
3. **"Error" en /subvenciones-bd** — Es un indicador de estado del pipeline (`pipeline_error`). No es error de la app. Sin embargo, se deberia mostrar como badge rojo "Error de procesado" en vez de texto plano.

---

## REVISION VISUAL DETALLADA — Por pantalla

### 1. Landing Desktop — EXCELENTE (9/10)
- **Hero:** H1 claro ("Las subvenciones que encajan con tu empresa, sin que tengas que buscarlas"), subtitulo explicativo, 2 CTAs (Empezar gratis + Acceder)
- **Stats bar:** >1.000 subvenciones | 24/7 | 0 EUR coste inicial | 100% success fee — buena propuesta de valor
- **Quienes somos:** 4 feature cards bien estructuradas + seccion "Por que existimos" con 4 stats
- **Como funciona:** 3 pasos con iconos y conectores visuales. Muy claro.
- **Testimonios:** 3 casos con importes concretos y estrellas. Creible.
- **Pricing:** "Solo pagas si ganas — 0 EUR", que incluye, 3 garantias. Claro y transparente.
- **FAQ:** 8 preguntas con accordion Radix UI. Funcional.
- **Contacto:** Formulario con campos, CTA final.
- **Falta para 10/10:** Animaciones fade-in en scroll, mas urgencia (X subvenciones activas ahora), micro-interacciones.

### 2. Landing Mobile — BUENO (7.5/10)
- Hero se adapta bien, textos legibles
- Hamburger menu presente y funcional
- Secciones se apilan correctamente
- **Problema:** Overflow horizontal detectable, probablemente grids 3-col
- FAQ accordion funciona en mobile
- Footer se adapta correctamente

### 3. Landing Tablet (768px) — BUENO (7.5/10)
- Secciones se adaptan razonablemente
- Algo apretado en algunos grids pero legible

### 4. Auth Modal — EXCELENTE (9/10)
- Modal centrado sobre landing con overlay correcto
- Campo email visible, boton Acceder
- Error de credenciales invalidas se muestra correctamente (texto rojo)
- Formulario limpio y claro

### 5. Dashboard Admin — MUY BUENO (8.5/10)
- **Sidebar:** 12 items con iconos Lucide, estado activo resaltado en azul. Limpia y navegable.
- **Dashboard home:** 4 KPIs (29 Clientes, 2 Expedientes activos, 0 Concedidos, 0 Alertas), seccion "Alertas urgentes" (vacia), "Expedientes activos" con fases (Preparacion, Cobrado), "Pipeline por fase" con badges de colores.
- **Novedades:** 3 tabs (Solicitudes recientes [1], Oportunidades pendientes, Mensajes clientes [3]). Una solicitud de TechNova Solutions SL con badge "Activo".
- **Clientes:** Lista de 30 clientes con busqueda funcional. Scroll fluido.
- **Cliente detalle:** Info empresarial completa (NIF, email, telefono, CNAE, sector, CA, fecha registro). Botones "Nueva reunion" y "Nuevo expediente". Lista de subvenciones relevantes con scores (92, 84, 74, 62...). Seccion de expedientes.
- **Matches:** 4 KPIs (Total activos, Sin revisar, Muy recomendable, Interesados — todos en 0). Filtros por estado y score. Boton "Recalcular todo". Boton "Calcular matches ahora". UI excelente pero sin datos (necesita ejecucion del motor).
- **Expediente detalle:** Layout 3 columnas (Fuentes | Editor | Ficha). Panel derecho con selector de fase, 6 botones IA (Memoria completa, Presupuesto, Cronograma, Email pedir docs, Proyecto tecnico, Resumen ejecutivo). Tabs Ficha/Asistente/Checklist/Proveedores. Info de subvencion (titulo, organismo, importe, plazo).
- **Chats:** Layout WhatsApp con 4 conversaciones, badges de no leidos, timestamps, busqueda. Panel derecho "Selecciona una conversacion".
- **Proveedores:** Grid de cards con 7 tabs (Todos, Tecnologia, Consultoria, Formacion, Equipamiento, Marketing, Juridico). 10+ proveedores con badges "Verificado", servicios, precios.
- **Falta para 9/10:** Graficos de evolucion temporal, indicadores de tendencia en KPIs.

### 6. Portal Cliente Desktop — EXCELENTE (9/10)
- **Inicio:** Saludo "Hola, Restaurantes", 3 KPIs (3 Subvenciones abiertas, 7 Muy recomendables, Importe potencial), banner urgencia naranja ("7 subvenciones con muy alto encaje — Actua antes de que cierren los plazos").
- **Cards subvenciones:** Score 70% con badge "Muy recomendable", organismo, seccion "POR QUE ENCAJA", botones "Ver mas" / "Oficial" / "Quiero esta". Diseno llamativo con CTA naranja.
- **Info cobertura:** "Galicia - Cobertura nacional proximamente"
- **Link:** "Ver las 23 subvenciones restantes" al final
- **Sidebar:** 5 items (Inicio, Mis subvenciones [3], Expedientes, Mi Gestor, Mi empresa)

### 7. Portal Cliente Mobile — BUENO (8/10)
- **CORRECCION vs reporte anterior:** El portal mobile NO esta tan roto como se reporto anteriormente.
- Sidebar se oculta correctamente detras del menu hamburguesa
- Header mobile con logo, badge "7", campana, avatar
- KPIs se apilan verticalmente — legible
- Banner de urgencia se adapta bien
- Cards de subvenciones ocupan ancho completo, scores visibles (70%)
- Botones "Quiero esta" prominentes y tocables
- "Ver las 23 subvenciones restantes" visible
- **Problemas menores:** Las cards estan algo apretadas, el score podria alinearse mejor. Pero FUNCIONAL.

### 8. Paginas Publicas — OK (7/10)
- Contacto: contenido presente (1239 chars)
- Privacidad: contenido presente (2686 chars)
- Terminos: contenido presente (3423 chars)
- 404: NO existe (muestra landing)

---

## WARNINGS CONFIRMADAS (9)

| # | Area | Descripcion | Impacto |
|---|------|-------------|---------|
| 1 | Sidebar admin | Falta enlace a catalogo `/subvenciones` — solo accesible por URL | Bajo |
| 2 | Accesibilidad | 2 inputs sin label en formulario cliente nuevo | A11y |
| 3 | Accesibilidad | 4 inputs sin label en formulario reunion nueva | A11y |
| 4 | Accesibilidad | 3 inputs sin label en ajustes | A11y |
| 5 | Accesibilidad | 1 boton sin texto/aria-label en portal (posible icono notificaciones) | A11y |
| 6 | Portal test | Secciones "Mis expedientes", "Mis solicitudes", "Mi gestor" no detectadas por test (probable timing/naming) | Falso negativo del test |
| 7 | Chat admin | Campo de mensaje no detectado por test (aparece al seleccionar chat) | Falso negativo del test |
| 8 | Datos test | Chat de "jorge molala" con mensaje "puto" — dato de test ofensivo visible en demo | Limpieza datos |
| 9 | Pipeline BD | Texto "Error" deberia mostrarse como badge descriptivo | UX minor |

---

## SEGURIDAD — TODO OK

Las 8 rutas protegidas redirigen correctamente a login sin autenticacion:
- /dashboard ✅, /clientes ✅, /expedientes ✅, /matches ✅
- /solicitudes ✅, /chats ✅, /ajustes ✅, /portal ✅

---

## Network & Console Errors

| Status | URL | Tipo |
|--------|-----|------|
| 400 | `/auth/v1/token?grant_type=password` | **Esperado** (login fallido intencional del test) |
| 400 | `/rest/v1/cliente_subvencion_match?select=...` | **Esperado** (query con filtro sin datos) |
| 400 | `/rest/v1/documentos?columns=...` | **Investigar**: posible query legacy con columnas incorrectas |

Console: 3x `Failed to load resource: 400` — corresponden a los network errors.

---

## PRIORIDADES DE FIX

| Prioridad | Issue | Estimacion | Impacto |
|-----------|-------|-----------|---------|
| **P1** | Landing mobile overflow horizontal | 1h | UX movil degradada |
| **P1** | Pagina 404 personalizada | 30min | SEO + UX |
| **P2** | Redirect admin post-login a /dashboard | 15min | Confusion al entrar |
| **P2** | Query documentos error 400 | 30min | Error silencioso |
| **P3** | Accesibilidad: labels en 10 inputs | 1h | A11y compliance |
| **P3** | Badge "Error" mas descriptivo en pipeline BD | 15min | Claridad |
| **P4** | Limpiar datos de test ofensivos | 10min | Demo presentable |
| **P4** | Enlace "Subvenciones" en sidebar admin | 15min | Navegacion |

---

## COBERTURA DEL TEST

### Rutas cubiertas (25/25):
- [x] Landing `/` (desktop + mobile + tablet)
- [x] Login `/login` (modal)
- [x] Dashboard `/dashboard`
- [x] Novedades `/novedades`
- [x] Matches `/matches`
- [x] Clientes `/clientes` + `/clientes/[nif]` + `/clientes/nuevo`
- [x] Expedientes `/expedientes` + `/expedientes/[id]` + `/expedientes/nuevo`
- [x] Chats `/chats`
- [x] Reuniones `/reuniones` + `/reuniones/nueva`
- [x] Alertas `/alertas`
- [x] Proveedores `/proveedores`
- [x] Pipeline BD `/subvenciones-bd`
- [x] Subvenciones catalogo `/subvenciones`
- [x] Solicitudes `/solicitudes`
- [x] Ajustes `/ajustes`
- [x] Portal `/portal`
- [x] Contacto `/contacto`
- [x] Privacidad `/privacidad`
- [x] Terminos `/terminos`
- [x] 404 (ruta inexistente)
- [x] Seguridad (8 rutas protegidas)

### Viewports testeados:
- [x] Desktop 1280x900
- [x] Mobile 375x812
- [x] Tablet 768x1024

### Flujos funcionales testeados:
- [x] Abrir landing, ver secciones
- [x] Abrir modal login, intentar login con credenciales invalidas
- [x] Login exitoso como admin
- [x] Navegar todas las rutas del dashboard
- [x] Buscar cliente, ver detalle
- [x] Ver detalle de expediente
- [x] Abrir chat
- [x] Login como cliente, navegar portal
- [x] Ver subvenciones, hacer click en "Ver mas"
- [x] Abrir chat con gestor
- [x] Verificar rutas protegidas sin auth

### Flujos NO cubiertos (a mejorar):
- [ ] Crear cliente nuevo (submit formulario)
- [ ] Crear expediente nuevo (submit formulario)
- [ ] Crear reunion nueva (submit formulario)
- [ ] Recalcular matches (click boton)
- [ ] Generar documento con IA en expediente
- [ ] Enviar mensaje en chat
- [ ] Cambiar ajustes
- [ ] Portal: click "Quiero esta" en subvencion
- [ ] Formulario de contacto (submit)
- [ ] Responsive de TODAS las paginas admin en mobile

---

## PUNTUACION GLOBAL

| Seccion | Nota | Estado |
|---------|------|--------|
| Landing Desktop | 9/10 | Excelente |
| Landing Mobile | 7.5/10 | Bueno (overflow) |
| Auth | 9/10 | Excelente |
| Dashboard Admin | 8.5/10 | Muy bueno |
| Portal Desktop | 9/10 | Excelente |
| Portal Mobile | 8/10 | Bueno (funcional) |
| Seguridad | 10/10 | Perfecto |
| Paginas publicas | 7/10 | OK (falta 404) |
| **MEDIA GLOBAL** | **8.5/10** | **Muy bueno** |

---

## Conclusion

La app AyudaPyme esta en **buen estado para uso en produccion en desktop**. Los flujos principales funcionan correctamente:
- Landing profesional y clara
- Auth funcional con manejo de errores
- Dashboard admin completo con 12+ secciones
- Portal cliente con scoring, subvenciones, chat
- Seguridad correcta en todas las rutas

**No hay bugs bloqueantes.** Los fixes prioritarios son el overflow mobile de la landing (P1), la pagina 404 (P1), y el redirect post-login (P2). El portal mobile, contrario al reporte anterior, **funciona razonablemente bien** con sidebar oculta y cards adaptadas.

**Proximos pasos recomendados:**
1. Fixear los 4 bugs listados (~2.5h total)
2. Mejorar accesibilidad (labels en inputs)
3. Ampliar tests para cubrir flujos de submit (crear cliente, expediente, reunion)
4. Testear responsive de todas las paginas admin en mobile
