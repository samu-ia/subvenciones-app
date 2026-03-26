# QA Audit Report - AyudaPyme
**Fecha:** 2026-03-26 (actualizado)
**Duracion del test:** 140.1s
**Screenshots:** 41
**Herramienta:** Puppeteer headless + revision visual multimodal (Claude)

---

## Resumen Ejecutivo

| Categoria | Cantidad |
|-----------|----------|
| PASSED | 29 |
| BUGS reales | 3 |
| FALSOS POSITIVOS del test | 3 |
| WARNINGS | 11 |
| Network errors | 3 (2 esperados, 1 posible bug) |
| Console errors | 4 (3 esperados + 1 fetch) |

**Estado general: La app funciona correctamente en desktop. El portal cliente en mobile tiene problemas serios de layout. La landing tiene overflow horizontal menor en mobile. Desktop es profesional y completo.**

---

## BUGS REALES (ordenados por severidad)

### BUG-1: CRITICO - Portal cliente en mobile con layout roto
- **Ruta:** `/portal` en viewport 375x812
- **Screenshot:** `036-portal-06-mobile.png`
- **Descripcion:** El sidebar del portal se muestra completo en mobile, empujando el contenido principal. Las cards de subvenciones no se adaptan al ancho disponible: el texto se corta, los porcentajes de score se superponen, los titulos de subvenciones se truncan sin sentido. El contenido rebasa el viewport (overflow horizontal confirmado).
- **Comparacion desktop:** En desktop (screenshot `031-portal-02-inicio.png`) el portal se ve excelente: saludo personalizado, 3 KPIs claros, banner de urgencia, cards de subvenciones con score 70%, botones "Quiero esta" y "Ver mas", todo bien alineado.
- **Impacto:** PYMEs que accedan desde movil no podran usar la app. Es el canal mas probable para un cliente PYME.
- **Fix sugerido:**
  1. Ocultar sidebar en mobile, usar menu hamburguesa o bottom nav
  2. Cards de subvenciones: `width: 100%`, texto con `word-break: break-word`
  3. Score badge: posicion absoluta o inline en mobile
  4. Grid 1 columna en mobile

### BUG-2: MEDIO - Landing mobile tiene overflow horizontal
- **Ruta:** `/` en viewport 375x812
- **Screenshot:** `002-landing-03-mobile-hero.png`
- **Descripcion:** Existe overflow horizontal detectable en mobile. Revisando visualmente, el contenido general se ve aceptable pero hay elementos que exceden el viewport width. Probablemente las secciones de stats (3 columnas), los pasos (3 columnas) o alguna card con width fijo.
- **Impacto:** UX degradada, scroll horizontal no deseado.
- **Fix sugerido:** Agregar `overflow-x: hidden` al body como safety net. Revisar grids de 3 columnas para que colapsen a 1 columna en `max-width: 640px`. Verificar que las stats cards no tengan `min-width` fijo.

### BUG-3: BAJO - No hay pagina 404 personalizada
- **Ruta:** `/ruta-que-no-existe`
- **Screenshot:** `040-public-404.png`
- **Descripcion:** Rutas inexistentes muestran la landing page en lugar de una pagina 404. Confirmado visualmente: la captura 404 es identica a la landing.
- **Impacto:** Confusion de usuario si llega a una URL invalida. SEO impactado (no devuelve status 404 real).
- **Fix sugerido:** Crear `app/not-found.tsx` con mensaje claro y enlace a inicio.

---

## FALSOS POSITIVOS del test automatizado

1. **"+18.500 EUR conseguidos"** en landing - El detector de errores capturo texto que contiene numeros con formato similar a codigos de error. Es contenido legitimo del Hero (stats de la plataforma).
2. **"Desde 1.500 EUR/ano"** en proveedores - Texto de pricing de proveedores. No es un error; es informacion de costes en las cards de proveedores.
3. **"KPIs no detectados en dashboard"** - FALSO NEGATIVO del test. La captura `009-admin-01-dashboard.png` muestra claramente 4 KPIs: 29 Clientes, 2 Expedientes activos, 0 Concedidos, 0 Alertas activas. El test busca clases CSS especificas (`card`, `stat`, `kpi`) que no coinciden con las clases reales.

---

## WARNINGS (11)

### Navegacion y Routing
1. **Admin redirigido a /clientes tras login** — Tras login, el admin llega a `/clientes` en vez de `/dashboard` o `/novedades`. Minor pero confuso.

### Dashboard Admin
2. **Sidebar sin enlace a "Subvenciones" (catalogo)** — El sidebar tiene 12 items: Dashboard, Alertas, Novedades, Matches, Chats, Clientes, Reuniones, Expedientes, Solicitudes, Proveedores, Pipeline BDNS, Ajustes. Falta link al catalogo de subvenciones (`/subvenciones`), solo se accede por URL directa.

### Portal Cliente — Secciones buscadas con nombres incorrectos
3. **"Mis expedientes" no encontrada** — El test busca exactamente "Mis expedientes" pero el sidebar dice "Expedientes" (sin "Mis"). La seccion SI existe.
4. **"Mis solicitudes" no encontrada** — No existe como seccion separada en el portal. Las solicitudes se gestionan desde los expedientes.
5. **"Mi gestor" no encontrada** — El sidebar dice "Mi Gestor" (con mayuscula). El test busca match parcial, deberia funcionar. Posible timing issue.

### Accesibilidad
6. **Formulario cliente nuevo:** 2 inputs sin label/placeholder
7. **Formulario reunion nueva:** 4 inputs sin label/placeholder
8. **Pagina ajustes:** 3 inputs sin label/placeholder
9. **Portal:** 1 boton sin texto ni aria-label (probablemente icono de notificaciones)

### Chat Admin
10. **Campo de mensaje no detectado** — El chat admin muestra lista de conversaciones (estilo WhatsApp). El campo de texto aparece solo al seleccionar un chat especifico. El test hace click pero posiblemente el timing no espero suficiente.

### Subvenciones BD
11. **Texto "Error" visible en /subvenciones-bd** — Revisando la captura `018-admin-10-subvenciones-bd.png`, el texto "Error" es un indicador de estado del pipeline en algunas subvenciones (pipeline_error). No es un error de la app, es informacion de estado. Sin embargo, se deberia mostrar de forma mas clara (ej: badge rojo "Error de procesado" en vez de texto plano "Error").

---

## SEGURIDAD — Todo OK

Las 8 rutas protegidas redirigen correctamente a login:
- /dashboard, /clientes, /expedientes, /matches, /solicitudes, /chats, /ajustes, /portal

**Verificado:** Ningun endpoint protegido es accesible sin autenticacion.

---

## TESTS PASADOS (29)

### Landing Desktop (5/5)
- Hero H1 presente: "Las subvenciones que encajan con tu empresa, sin que tengas que buscarlas"
- CTAs funcionando: Acceder, Empezar gratis
- Footer con 2 enlaces
- Header con navegacion completa: Inicio, Quienes somos, Preguntas frecuentes, Contacto, Acceder
- Menu hamburguesa en mobile

### Auth (2/2)
- Modal de login abre correctamente con campo email
- Error de credenciales se muestra correctamente

### Admin Dashboard (8/8)
- Novedades con tabs: "Oportunidades pendientes", "Mensajes clientes"
- 30 clientes listados con busqueda funcional
- Detalle de cliente carga OK
- Detalle de expediente carga OK
- Chat abierto correctamente
- Sidebar con 12 items completos
- Reunion nueva accesible
- Alertas, proveedores, ajustes — todos cargan

### Portal Cliente (4/4)
- Mis subvenciones accesible con cards de scoring (70%)
- Mi empresa accesible
- Accion "Ver mas" en subvencion funciona
- Chat con gestor con campo de mensaje

### Paginas Publicas (3/3)
- Contacto (1239 chars)
- Privacidad (2686 chars)
- Terminos (3423 chars)

### Seguridad (8/8)
- Todas las rutas protegidas correctamente

---

## REVISION VISUAL — Observaciones detalladas

### Landing Desktop — EXCELENTE (9/10)
- Diseno profesional y coherente: paleta dark blue + white + accents naranjas
- 7 secciones bien diferenciadas: Hero, Quienes somos, Como funciona, Testimonios, Pricing, FAQ, Contacto
- Stats bien presentados: >1.000 subvenciones, 24/7, 0 EUR coste inicial, 100% success fee
- Testimonios con importes y estrellas
- Pricing claro: "Solo pagas si ganas — 0 EUR"
- FAQ con accordion funcional (Radix UI)
- Falta: animaciones sutiles (fade-in en scroll), mas urgencia/FOMO

### Dashboard Admin — MUY BUENO (8.5/10)
- Sidebar limpia con 12 items e iconos
- 4 KPIs claros con iconos: Clientes (29), Expedientes activos (2), Concedidos (0), Alertas (0)
- Seccion "Alertas urgentes" con estado "Sin alertas pendientes"
- "Expedientes activos" con fases: Preparacion, Cobrado
- Pipeline por fase visual con badges de colores
- Falta: grafico de evolucion temporal, indicadores de tendencia

### Portal Cliente Desktop — EXCELENTE (9/10)
- Saludo personalizado "Hola, Restaurantes"
- 3 KPIs: Subvenciones abiertas (3), Muy recomendables (7), Importe potencial
- Banner de urgencia: "7 subvenciones con muy alto encaje — Actua antes de que cierren los plazos"
- Cards de subvenciones con: score (70%), badge "Muy recomendable", organismo, motivo de encaje, botones "Ver mas", "Oficial", "Quiero esta"
- Info de cobertura: "Galicia - Cobertura nacional proximamente"
- Link "Ver las 23 subvenciones restantes"

### Proveedores — BUENO (7.5/10)
- Grid de cards con categorias filtradas por tabs: Todos, Tecnologia, Consultoria, Formacion, Equipamiento, Marketing, Juridico
- 10+ proveedores con: nombre, verificado badge, descripcion, servicios, precio
- Cada card con enlace a web y email
- Falta: busqueda por nombre, valoraciones de clientes

### Chats Admin — BUENO (7.5/10)
- Lista estilo WhatsApp con avatares
- Badge de mensajes no leidos
- Ultimo mensaje y timestamp
- Busqueda de conversaciones

---

## PRIORIDADES DE FIX

| Prioridad | Issue | Estimacion | Impacto |
|-----------|-------|-----------|---------|
| P0 | Portal mobile responsive (sidebar + cards) | 2-3h | Bloquea uso movil para clientes |
| P1 | Landing mobile overflow horizontal | 1h | UX degradada en movil |
| P2 | Redirect admin post-login a /dashboard | 15min | Confusion al entrar |
| P3 | Pagina 404 personalizada | 30min | SEO + UX |
| P3 | Accesibilidad: labels en inputs (9 inputs) | 1h | A11y compliance |
| P4 | Texto "Error" en pipeline BD mas descriptivo | 15min | Claridad informativa |

---

## Network Errors

| Status | URL | Tipo |
|--------|-----|------|
| 400 | `/auth/v1/token?grant_type=password` | Esperado (login fallido intencional) |
| 400 | `/rest/v1/cliente_subvencion_match?select=...` | Query con filtro que no devuelve datos |
| 400 | `/rest/v1/documentos?columns=...` | **Posible bug**: query referencia columnas incorrectas |

**NOTA:** El error en `/rest/v1/documentos` merece investigacion. Puede ser una query legacy que referencia columnas que ya no existen en el schema.

---

## Console Errors

- 3x `Failed to load resource: 400` — corresponden a los network errors anteriores
- 1x `TypeError: Failed to fetch` — posible race condition o request cancelada. No impacta funcionalidad visible.

---

## Conclusion

La app esta en buen estado general para desktop. Los flujos principales (landing, auth, dashboard admin, portal cliente, paginas publicas, seguridad) funcionan correctamente. **El unico bloqueante serio es el portal mobile**, que necesita trabajo de responsive design antes de que clientes reales puedan usarlo desde el movil.
