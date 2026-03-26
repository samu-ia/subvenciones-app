# AyudaPyme — Contexto para agentes de IA

> Leer este archivo ANTES de tocar cualquier cosa. Es la fuente de verdad del proyecto.

## Qué es AyudaPyme

Plataforma SaaS B2B para PYMEs españolas. Detecta subvenciones públicas que encajan con cada empresa y gestiona todo el proceso de solicitud. Modelo de negocio: **success fee** (cobran el 15% solo si la subvención se concede, mínimo 300€).

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
| AI/matching | Google Gemini (PDFs), Anthropic Claude (títulos, chat) |
| Agentes | LangGraph + sistema propio de `agent_tasks` en Supabase |

---

## ⚠️ NOTA SOBRE CSS — LEER OBLIGATORIO

En `app/globals.css` el reset está dentro de `@layer base`, lo que permite que Tailwind funcione. **Sin embargo**, en componentes de landing se usa inline styles por convención establecida — no mezcles los dos estilos en landing.

```tsx
// En landing: usa inline styles (convención establecida)
<div style={{ padding: '2rem', background: '#fff' }}>

// En dashboard/portal: puedes usar Tailwind normalmente
<div className="p-8 bg-white">
```

---

## Estructura del proyecto

```
app/
  (auth)/           # login, registro, callback
  (dashboard)/      # panel admin/gestor
  (portal)/         # portal del cliente (PYMEs)
  (public)/         # landing page
  api/              # API routes (37 endpoints)
  globals.css       # estilos globales

components/
  landing/          # Hero, AboutUs, FAQ, Pricing, etc. (13 componentes)
  ui/               # shadcn/ui base components
  layout/           # DashboardShell, Sidebar
  workspace/        # AI panel, editor rich text, documentos

scripts/
  agents/           # sistema multi-agente (orchestrator, add-task, langgraph)
  backup-db.mjs          # backup completo de la BD → backups/
  restore-db.mjs         # restaurar un backup
  generate-titulos-comerciales.mjs  # genera titulo_comercial con Claude Haiku
  enrich-with-gemini.mjs   # enriquece subvenciones con Gemini
  run-matching.mjs         # ejecuta el motor de matching
  run-migration.js         # aplica una migración SQL
  seed-subvenciones.mjs    # puebla la BD con datos BDNS
  pipeline-magistral.mjs   # pipeline completo de ingesta BDNS

backups/            # backups SQL (gitignoreado — nunca en el repo)

supabase/
  migrations/       # todas las migraciones SQL (en orden cronológico)
```

---

## Base de datos — tablas principales

| Tabla | Descripción |
|-------|-------------|
| `subvenciones` | Convocatorias de subvenciones (BDNS). Columna `titulo_comercial` = título IA-generado |
| `cliente_subvencion_match` | Matches entre clientes y subvenciones con score 0-100 |
| `perfiles` | Perfiles de usuario (rol: admin/gestor/cliente/tramitador) |
| `expediente` | Expedientes de tramitación. Columnas: `fee_amount`, `fee_estado`, `iban_cliente` |
| `expediente_fases` | Fases del expediente (documentación, presentación, resolución, etc.) |
| `mensajes_gestor` | Chat entre cliente y gestor |
| `alertas` | Alertas de plazos (generadas por cron diario) |
| `proveedores` | Proveedores/gestores externos |
| `reuniones` | Reuniones con clientes |
| `agent_tasks` | Cola de tareas para los agentes de IA |
| `agent_escalations` | Escalaciones que necesitan input humano |

**Columnas clave en `subvenciones`:** `id, bdns_id, titulo, titulo_comercial, organismo, importe_maximo, presupuesto_total, fecha_fin_solicitud, descripcion, beneficiarios, sectores_actividad, regiones, activa`

**Columnas clave en `cliente_subvencion_match`:** `id, cliente_id, subvencion_id, score, motivo, estado (pendiente/interesado/descartado/solicitando/concedida)`

**Columnas clave en `expediente`:** `id, cliente_id, subvencion_id, fase, fee_amount, fee_estado (pendiente/facturado/cobrado), iban_cliente`

---

## Comandos npm disponibles

```bash
# Desarrollo
npm run dev              # servidor de desarrollo
npm run build            # build de producción
npm run lint             # linter

# Base de datos
npm run db:backup        # backup completo → backups/YYYY-MM-DD_HH-mm.sql
npm run db:restore       # restaurar un backup (interactivo)
npm run db:migrate       # aplicar una migración SQL

# Pipeline de datos
npm run pipeline         # ingestar subvenciones de BDNS
npm run pipeline:all     # ingestar todo (workers paralelos)
npm run enrich           # enriquecer con Gemini
npm run matching         # recalcular matches
npm run titulos          # regenerar titulo_comercial con Claude Haiku

# Agentes IA
npm run agents           # ejecutar agentes pendientes (una vez)
npm run agents:watch     # modo continuo cada 30s
npm run agents:add       # añadir tarea al equipo
npm run team             # LangGraph runner
```

---

## Motor de alertas (cron)

`/api/expedientes/check-alertas` se ejecuta diariamente a las 08:00 (configurado en `vercel.json`).

Alertas automáticas:
- Plazo de solicitud ≤ 7 días
- Plazo de aceptación ≤ 5 días
- Alegaciones ≤ 3 días
- Justificación ≤ 14 días
- Sin actividad > 90 días

Cuando un expediente alcanza la fase `cobro`: calcula el fee (15%, mín. 300€), lo guarda en `fee_amount`, crea alerta "Emitir factura".

---

## Landing page — estado actual (2026-03-27)

La landing está en `app/(public)/page.tsx` y `components/landing/`.

**Secciones:**
1. `Hero` — CTA + stats (120k€ máximo / 0€ coste / 24h respuesta)
2. `BenefitsTicker` — ticker scrolling con ejemplos reales de subvenciones
3. `AboutUs` — quiénes somos, 4 feature cards
4. `HowItWorks` — "Tres pasos. Tú haces uno."
5. `Testimonials` — 3 casos de éxito con importes grandes destacados
6. `Pricing` — success fee 15%, ejemplo: 40k€ → 6k€ comisión → 34k€ netos
7. `FAQ` — 7 preguntas escépticas de PYME
8. `FinalCTA` — urgencia antes del formulario
9. `ContactSection` — formulario de contacto
10. `LandingHeader` / `LandingFooter`

**Pendiente en landing:**
- Mobile: revisar grids 3-col en 375px
- Animaciones fade-in en scroll

---

## Sistema multi-agente

Los agentes leen tareas de Supabase (`agent_tasks`) y las procesan.

```bash
# Añadir tarea:
npm run agents:add -- --agent programmer --title "Título" --desc "Descripción"

# Tipos de agente:
# lead       — orquesta, divide tareas, prioriza
# product    — investiga, propone mejoras UX/producto
# programmer — implementa código
# database   — schema, migraciones, RLS
# security   — auditorías de seguridad
# matching   — motor de matching y pipeline BDNS
# qa         — prueba con Puppeteer, detecta bugs visuales (multimodal)
```

---

## Convenciones de código

- **Commits**: formato `tipo: descripción en español` (feat, fix, refactor, docs)
- **Componentes**: PascalCase, un componente por archivo
- **API routes**: en `app/api/`, usan `createClient` de `@supabase/ssr`
- **Auth server-side**: `supabase.auth.getUser()` — nunca `getSession()`
- **Landing styles**: inline styles para padding/margin/background
- **Dashboard/portal styles**: Tailwind normal

---

## Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                  # para scripts de BD y backups
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
- Guardar credenciales hardcodeadas en scripts (usar `process.env`)
- Hacer commit de la carpeta `backups/` (datos de clientes, gitignoreado)
