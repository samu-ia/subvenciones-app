# AyudaPyme — Contexto para agentes de IA

> Leer este archivo ANTES de tocar cualquier cosa. Es la fuente de verdad del proyecto.

## Qué es AyudaPyme

Plataforma SaaS B2B para PYMEs españolas. Detecta subvenciones públicas que encajan con cada empresa y gestiona todo el proceso de solicitud. Modelo de negocio: **success fee** (solo cobran si la subvención se concede).

**Usuarios:**
- **Clientes (PYMEs)**: ven sus matches de subvenciones, pueden chatear con el gestor, subir documentos
- **Administradores/gestores**: gestionan expedientes, ven todos los clientes, recalculan matches

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16.1.6 (App Router), React 19, TypeScript |
| Estilos | Tailwind CSS v4 + inline styles (ver nota crítica abajo) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Build | Turbopack (dev), Next.js build (prod) |
| Despliegue | Vercel |
| AI/matching | Google Gemini (PDFs), scripts Node.js |

---

## ⚠️ BUG CRÍTICO DE CSS — LEER OBLIGATORIO

**El problema:** En `app/globals.css` hay un reset CSS sin layer:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
```
Este reset está fuera de cualquier `@layer`, por lo que tiene más prioridad que `@layer utilities` (donde vive Tailwind). Resultado: **todas las clases de Tailwind que afectan padding, margin, y algunos backgrounds NO FUNCIONAN** en el landing.

**La regla:** Siempre que necesites padding, margin, o background en componentes de landing, usa **inline styles**:
```tsx
// ❌ No funciona en landing
<div className="p-8 bg-white">

// ✅ Correcto
<div style={{ padding: '2rem', background: '#fff' }}>
```

Esto afecta: `p-*`, `m-*`, `px-*`, `py-*`, `bg-*` (parcialmente). Las clases de color de texto, flex, grid, etc. sí funcionan.

---

## Estructura del proyecto

```
app/
  (auth)/           # login, registro
  (dashboard)/      # panel admin/gestor
  (portal)/         # portal del cliente
  (public)/         # landing page
  api/              # API routes
  globals.css       # estilos globales (ver bug CSS arriba)

components/
  landing/          # Hero, AboutUs, FAQ, Header, Footer, etc.
  ui/               # componentes shadcn/ui
  dashboard/        # componentes del panel admin
  portal/           # componentes del portal cliente

scripts/
  agents/           # sistema multi-agente (orchestrator + add-task)
  enrich-with-gemini.mjs   # enriquece subvenciones con Gemini
  run-matching.mjs         # ejecuta el motor de matching
  seed-subvenciones.mjs    # puebla la BD con datos BDNS

supabase/
  migrations/       # todas las migraciones SQL
```

---

## Base de datos — tablas principales

| Tabla | Descripción |
|-------|-------------|
| `subvenciones` | Convocatorias de subvenciones (BDNS) |
| `cliente_subvencion_match` | Matches entre clientes y subvenciones con score |
| `perfiles` | Perfiles de usuario (rol: admin/cliente) |
| `expediente` | Expedientes de tramitación de subvenciones |
| `expediente_fases` | Fases del expediente (documentación, presentación, etc.) |
| `mensajes_gestor` | Chat entre cliente y gestor |
| `agent_tasks` | Cola de tareas para los agentes de IA |
| `agent_escalations` | Escalaciones de agentes que necesitan input humano |

Columnas clave en `subvenciones`: `id, bdns_id, titulo, organismo, importe_maximo, fecha_fin_solicitud, descripcion, beneficiarios, sectores_actividad, regiones, activa`

Columnas clave en `cliente_subvencion_match`: `id, cliente_id, subvencion_id, score, motivo, estado (pendiente/interesado/descartado/solicitando/concedida)`

---

## Landing page — estado actual

La landing está en `app/(public)/page.tsx` y `components/landing/`.

**Secciones:**
1. `Hero` — CTA principal, botón → abre modal de login
2. `AboutUs` — quiénes somos, 4 feature cards, sección "Por qué existimos"
3. `FAQ` — preguntas frecuentes con accordion
4. `ContactSection` — formulario de contacto
5. `LandingHeader` — nav fija, se vuelve opaca al hacer scroll
6. `LandingFooter`

**Estado visual actual (2026-03-26):**
- Globalmente funcional pero mejorable
- Feature cards en AboutUs usan inline styles (fix del bug CSS)
- Header funciona correctamente con `scrollbar-gutter: stable`
- La página no tiene testimonios, no tiene pricing, no tiene demo/video
- El copy es correcto pero genérico, falta personalización

**Lo que falta para tener una landing de 10:**
- Sección de testimonios o casos de éxito
- Sección de pricing (aunque sea "contacta para precio")
- Un indicador visual más claro del proceso (steps 1-2-3)
- Más urgencia/FOMO (ej: "X subvenciones activas ahora")
- Mobile: revisar que todo se vea bien en 375px
- Métricas reales o más creíbles en los stats
- Animaciones sutiles (fade-in en scroll)

---

## Sistema multi-agente

Los agentes leen tareas de Supabase (`agent_tasks`) y las procesan.

**Para crear una tarea nueva:**
```bash
npm run agents:add
# o con args:
npm run agents:add -- --agent programmer --title "Título" --desc "Descripción detallada"
```

**Para correr los agentes:**
```bash
npm run agents           # procesa pendientes y sale
npm run agents:watch     # modo continuo cada 30s
```

**El agente lead** puede crear subtareas para otros agentes usando:
```bash
npx dotenvx run -f .env.local -- npx tsx scripts/agents/add-task.ts --agent <tipo> --title "<título>" --desc "<descripción>"
```

**Tipos de agente:**
- `lead` — orquesta, divide tareas, prioriza
- `product` — investiga, propone mejoras UX/producto
- `programmer` — implementa código
- `database` — schema, migraciones, RLS
- `security` — auditorías de seguridad
- `matching` — motor de matching y pipeline BDNS

---

## Convenciones de código

- **Commits**: formato `tipo: descripción en español` (feat, fix, refactor, docs)
- **Componentes**: PascalCase, un componente por archivo
- **Funciones API**: en `app/api/`, usan `createClient` de `@supabase/ssr`
- **Autenticación**: `supabase.auth.getUser()` server-side para rutas protegidas
- **No usar**: `getSession()` en server (inseguro), `@apply` en CSS (roto por bug de layers)
- **Inline styles**: obligatorio para padding/margin/background en landing

---

## Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

---

## Cosas que NO hacer

- `git push --force` nunca
- `DROP TABLE` sin confirmación humana
- Modificar `.env.local` (no está en git)
- Usar `getSession()` server-side (inseguro, usar `getUser()`)
- Añadir dependencias pesadas sin justificación
- Romper las rutas de auth existentes (`/login`, `/auth/callback`)
