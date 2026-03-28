# AyudaPyme — Documentación Técnica

> **v0.1 — Borrador inicial (2026-03-28)**
> Cimientos para iteraciones posteriores. Refleja el estado actual de producción.

---

## 1. Visión general

AyudaPyme es una plataforma SaaS B2B para PYMEs españolas. Automatiza la detección y tramitación de subvenciones públicas bajo un modelo de **éxito diferido**: el cliente no paga nada hasta que la subvención se concede (15% del importe, mínimo 300 €).

### Dos tipos de usuario

| Rol | Identificación | Acceso |
|-----|---------------|--------|
| **Admin / Gestor** | email `@ayudapyme.es` o `rol = 'admin'/'tramitador'` en `perfiles` | `/dashboard`, `/clientes`, `/expedientes`, etc. |
| **Cliente (PYME)** | `rol = 'cliente'` en `perfiles` | `/portal` únicamente |

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 15.1.6 |
| Runtime | React | 19 |
| Lenguaje | TypeScript | estricto |
| Base de datos | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth | — |
| Storage | Supabase Storage | — |
| Estilos | Tailwind CSS v4 + inline styles | — |
| Build | Turbopack (dev), Next.js build (prod) | — |
| IA — extracción PDF | Google Gemini 2.5 Flash | — |
| IA — títulos, chat | Anthropic Claude (Haiku/Sonnet) | — |
| Despliegue | Vercel | — |
| Agentes autónomos | LangGraph + cola `agent_tasks` en Supabase | — |

---

## 3. Estructura del proyecto

```
subvenciones-app/
│
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Login y reset de contraseña
│   ├── (dashboard)/             # Panel admin/gestor (protegido)
│   │   ├── layout.tsx           # Shell con sidebar
│   │   ├── dashboard/           # KPIs y resumen
│   │   ├── clientes/            # CRM de empresas
│   │   ├── expedientes/         # Expedientes en tramitación
│   │   ├── reuniones/           # Agenda de reuniones
│   │   ├── solicitudes/         # Solicitudes desde el portal
│   │   ├── subvenciones/        # Catálogo de convocatorias
│   │   ├── subvenciones-bd/     # Panel de pipeline BDNS
│   │   ├── matches/             # Vista global de matches
│   │   ├── novedades/           # Alertas y oportunidades nuevas
│   │   ├── prospectos/          # CRM de leads
│   │   ├── proveedores/         # Directorio de colaboradores
│   │   ├── sector-scan/         # Análisis de mercado por sector
│   │   ├── ajustes/             # Configuración de IA y cuenta
│   │   └── alertas/             # Centro de alertas de plazos
│   │
│   ├── (portal)/                # Portal del cliente (protegido)
│   │   ├── layout.tsx
│   │   └── portal/
│   │       ├── page.tsx         # Dashboard personal del cliente
│   │       ├── onboarding/      # Wizard de alta de empresa
│   │       └── expediente/[id]/ # Detalle de expediente del cliente
│   │
│   ├── (public)/                # Páginas públicas
│   │   ├── page.tsx             # Landing page
│   │   ├── contacto/
│   │   ├── privacidad/
│   │   └── terminos/
│   │
│   ├── api/                     # API Routes (Next.js Route Handlers)
│   │   ├── admin/               # Exclusivo para admin/tramitador
│   │   ├── portal/              # Exclusivo para clientes autenticados
│   │   ├── clientes/            # CRUD clientes
│   │   ├── expedientes/         # CRUD expedientes + alertas
│   │   ├── matching/            # Motor de matching
│   │   ├── subvenciones/        # Pipeline BDNS + catálogo
│   │   ├── ia/                  # Chat, notebook, deep search, agent
│   │   ├── alertas/             # Gestión de alertas
│   │   ├── archivos/            # Upload y extracción de texto
│   │   ├── reuniones/           # CRUD reuniones
│   │   └── solicitudes/         # CRUD solicitudes
│   │
│   ├── auth/callback/           # OAuth callback de Supabase
│   ├── layout.tsx               # Root layout (fuentes, metadata)
│   ├── globals.css              # Estilos globales + Tailwind
│   └── not-found.tsx
│
├── middleware.ts                # Auth guard + redirección por rol (edge)
│
├── components/
│   ├── landing/                 # Componentes de la landing pública
│   │   ├── Hero.tsx             # Sección principal con CTAs
│   │   ├── AuthModal.tsx        # Modal login/registro/recuperar
│   │   ├── LandingClient.tsx    # Orchestrator client-side de la landing
│   │   └── ...                  # BenefitsTicker, FAQ, Pricing, etc.
│   ├── layout/
│   │   ├── DashboardShell.tsx   # Wrapper del panel admin con sidebar
│   │   └── Sidebar.tsx          # Navegación lateral del admin
│   ├── ui/                      # Componentes base (shadcn/ui)
│   └── workspace/               # Panel IA (chat, notebook, deep search)
│       ├── ai/                  # Componentes del panel IA
│       ├── docs/                # Gestión de documentos
│       └── editor/              # Editor rich text
│
├── lib/
│   ├── matching/                # Motor de matching
│   │   ├── engine.ts            # Algoritmo determinista (scoring v2)
│   │   └── run-for-client.ts    # Orquestador: carga datos + llama engine
│   ├── subvenciones/            # Pipeline de ingestión BDNS
│   │   ├── pipeline.ts          # Orquestador de las 5 fases
│   │   ├── bdns-client.ts       # Cliente HTTP de la API BDNS
│   │   ├── pdf-gemini.ts        # Extracción PDF con Gemini (nativo)
│   │   ├── normalizer.ts        # Escribe resultado en tabla subvenciones
│   │   └── ...                  # ai-extractor, estado-calculator, etc.
│   ├── ai/providers/            # Abstracción multi-proveedor IA
│   │   ├── factory.ts           # Crea el provider según config DB
│   │   ├── anthropic.ts         # Claude (chat, títulos)
│   │   ├── google.ts            # Gemini (PDFs masivos)
│   │   └── openai.ts            # OpenAI + OpenRouter (compatible)
│   ├── supabase/
│   │   ├── client.ts            # Browser client (sesión del usuario, RLS)
│   │   ├── server.ts            # Server client (cookies SSR, RLS)
│   │   └── service.ts           # Service role (bypass RLS, solo API Routes)
│   ├── auth/helpers.ts          # requireRole(), requireAdminOrTramitador()
│   ├── einforma/client.ts       # API de datos empresariales (IP whitelist)
│   ├── billing/generate-invoice.ts
│   ├── email.ts                 # Envío de emails
│   ├── notifications.ts         # Sistema de notificaciones
│   └── types/                   # Tipos TypeScript compartidos
│
├── scripts/                     # Utilidades de mantenimiento (Node.js)
│   ├── pipeline-magistral.mjs   # Pipeline BDNS 5 fases (resumible)
│   ├── pipeline-pdf-real.mjs    # Descarga PDFs + extrae 15 campos
│   ├── run-matching.mjs         # Matching offline (sin servidor Next.js)
│   ├── seed-subvenciones.mjs    # Puebla la BD con datos BDNS
│   ├── generate-titulos-comerciales.mjs
│   ├── enrich-with-gemini.mjs
│   ├── deep-review.mjs          # Análisis profundo Gemini por match
│   ├── prospectar.mjs           # Generador de leads por sector/zona
│   ├── backup-db.mjs            # Backup SQL completo → backups/
│   ├── restore-db.mjs           # Restaurar backup
│   ├── run-migration.js         # Aplica una migración SQL
│   └── agents/                  # Sistema multi-agente
│       ├── orchestrator.ts      # Orquestador de agentes
│       ├── add-task.ts          # CLI para añadir tareas
│       └── langgraph/           # Implementación LangGraph
│
├── supabase/
│   ├── migrations/              # 32+ migraciones SQL en orden cronológico
│   ├── fixes/                   # SQLs de corrección puntuales (ya aplicados)
│   ├── DATABASE.md              # Descripción de tablas y relaciones
│   └── MIGRATIONS.md            # Log de migraciones y su propósito
│
├── docs/
│   ├── TECHNICAL.md             # Este documento
│   ├── architecture/            # Documentación de arquitectura
│   └── reports/                 # Auditorías, simulaciones y QA
│
├── public/                      # Assets estáticos
│   ├── logo-dark.png
│   ├── logo-light.png
│   └── logo-bimi.svg
│
├── prospection/                 # CSVs generados por scripts/prospectar.mjs
├── backups/                     # Backups SQL (gitignoreado)
│
├── CLAUDE.md                    # Instrucciones para Claude Code
├── README.md                    # Guía rápida de instalación
├── middleware.ts                # Auth middleware (edge)
├── next.config.ts
├── vercel.json                  # Crons y configuración de Vercel
└── package.json
```

---

## 4. Base de datos

Supabase (PostgreSQL). Row Level Security activo en todas las tablas. Las operaciones del admin siempre van por `createServiceClient()` (bypassa RLS); las del cliente van por `createClient()` (RLS filtrado por NIF o user_id).

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `perfiles` | Rol de cada usuario autenticado. FK `nif → cliente.nif` |
| `cliente` | Empresas registradas: NIF, CNAE, CCAA, tamaño, facturación |
| `subvenciones` | Catálogo de convocatorias BDNS con campos extraídos por IA |
| `subvencion_sectores` | Sectores elegibles/excluidos por convocatoria |
| `subvencion_tipos_empresa` | Tipos de empresa elegibles/excluidos por convocatoria |
| `subvencion_requisitos` | Requisitos extraídos del PDF |
| `subvencion_gastos` | Gastos subvencionables por convocatoria |
| `subvencion_campos_extraidos` | Grounding: campo → fragmento PDF de origen |
| `cliente_subvencion_match` | Score de matching (0–1) con motivos y detalle por dimensión |
| `expediente` | Expedientes en tramitación. Incluye `fee_amount`, `fee_estado`, `iban_cliente` |
| `expediente_fases` | Fases del expediente con checklist |
| `solicitudes` | Flujo cliente: cuestionario → contrato → pago |
| `mensajes_gestor` | Chat entre cliente y gestor (realtime) |
| `alertas` | Alertas automáticas de plazos |
| `reuniones` | Agenda de reuniones con clientes |
| `proveedores` | Directorio de colaboradores externos |
| `prospectos` | CRM de leads pre-conversión |
| `agent_tasks` | Cola de tareas para agentes IA autónomos |
| `agent_escalations` | Escalaciones que requieren decisión humana |
| `grant_documents` | PDFs descargados por convocatoria (pipeline v3) |
| `grant_field_values` | Valores extraídos con grounding por versión de análisis |

### Roles en `perfiles`

| Valor | Descripción |
|-------|-------------|
| `admin` | Acceso completo al dashboard |
| `tramitador` | Acceso al dashboard (sin algunas acciones de admin) |
| `cliente` | Acceso solo al portal |

---

## 5. Flujos clave

### 5.1 Pipeline de ingestión BDNS

```
BDNS API
  │
  ├─ Fase 1: INGESTA       → Fetch de convocatorias, upsert en subvenciones
  ├─ Fase 2: DESCARGA      → Descarga PDFs oficiales, registra en grant_documents
  ├─ Fase 3: EXTRACCIÓN IA → Gemini analiza PDF → 15 campos estructurados
  ├─ Fase 4: NORMALIZACIÓN → Escribe campos en subvenciones, sectores, tipos
  └─ Fase 5: VALIDACIÓN    → Calcula estado, detecta conflictos, cierra versión

subvenciones.pipeline_fase: pendiente → ingesta → descarga → extraccion_ia → normalizacion → completado | error
```

**Comandos:**
```bash
npm run pipeline         # completo (últimos 7 días)
npm run pdf              # solo pipeline PDF real
node scripts/pipeline-magistral.mjs --fase descarga --id 893737  # una fase + ID
```

### 5.2 Motor de matching

Algoritmo determinista en `lib/matching/engine.ts`. No usa IA. Puntuación 0–115 normalizada a 0–1.

| Dimensión | Puntos | Notas |
|-----------|--------|-------|
| CNAE / Sector | 40 | Coincidencia exacta de código CNAE vs sectores eligibles |
| Tipo de empresa | 30 | Tamaño (micro/pequeña/mediana/grande) + forma jurídica |
| Importe | 20 | Importe razonable para el tamaño de empresa |
| Gastos | 10 | Gastos subvencionables compatibles con la actividad |
| Bonus geográfico | +15 | Ámbito nacional/europeo suma puntos extra |

**Hard excludes** (score → 0, guardado como `es_hard_exclude = true`):
- Ámbito autonómico + CCAA del cliente diferente
- Sector del cliente explícitamente excluido
- Tipo de empresa explícitamente excluido
- Nº empleados fuera del límite
- Antigüedad insuficiente

**Umbral de visualización:** score ≥ 0.28 (configurable en `run-for-client.ts`)

```bash
npm run matching         # recalcular todos los clientes
```

### 5.3 Alta de cliente (self-service)

```
1. Usuario se registra → Supabase Auth crea auth.users
2. Portal detecta perfil sin NIF → muestra SetupEmpresa
3. POST /api/portal/setup
   → upsert en perfiles (nif, rol='cliente')
   → upsert en cliente con datos básicos
   → llama runMatchingForClient(nif) en background
4. Redirect a /portal/onboarding (wizard de datos de empresa)
5. POST /api/portal/onboarding → perfiles.onboarding_data = {...}
6. Portal carga GET /api/portal/matches → devuelve matches calculados
```

### 5.4 Flujo de solicitud (portal del cliente)

```
Cliente en /portal → ve subvenciones recomendadas con score
  │
  ├─ Pulsa "Solicitar"
  │
  ├─ Paso 1: Cuestionario IA (POST /api/portal/preguntas)
  │   → Claude genera 6-9 preguntas específicas a la convocatoria
  │
  ├─ Paso 2: Contrato de éxito
  │   → Cliente firma nombre + NIF + checkbox
  │
  └─ Paso 3: Confirmación de pago
      → POST /api/portal/solicitudes: crea solicitud en DB
      → Background: Claude genera informe de viabilidad (JSON)
      → Admin ve la solicitud en /novedades
```

### 5.5 Gestión de expediente

```
Admin crea expediente desde /clientes/{nif}
  │
  ├─ Expediente avanza por fases: documentación → presentación → resolución → cobro
  ├─ Cron diario (08:00): /api/expedientes/check-alertas
  │   → Genera alertas automáticas de plazos
  │   → En fase "cobro": calcula fee (15%, mín 300€) → perfiles.fee_amount
  └─ Admin cierra expediente + genera factura
```

---

## 6. API Routes — referencia rápida

### Admin (requieren `requireAdminOrTramitador()`)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/clientes` | GET, POST | Listar y crear clientes |
| `/api/clientes/[nif]` | GET, PUT, DELETE | Detalle de cliente |
| `/api/expedientes` | GET, POST | Listar y crear expedientes |
| `/api/expedientes/[id]` | GET, PUT | Detalle de expediente |
| `/api/expedientes/check-alertas` | GET | Cron de alertas (Vercel cron) |
| `/api/matching/run` | POST | Lanzar matching para un NIF o todos |
| `/api/admin/dashboard-stats` | GET | KPIs del dashboard |
| `/api/admin/novedades` | GET | Matches + solicitudes recientes |
| `/api/admin/sector-scan` | POST | Análisis de sector con IA |
| `/api/subvenciones/ingest` | POST | Lanzar pipeline BDNS |
| `/api/subvenciones/catalogo` | GET | Catálogo con filtros |

### Portal del cliente (requieren sesión autenticada)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/portal/matches` | GET | Matches del cliente (service client, sin RLS) |
| `/api/portal/setup` | POST | Alta de empresa + lanzar matching |
| `/api/portal/onboarding` | POST | Completar wizard de empresa |
| `/api/portal/solicitudes` | POST | Crear solicitud + informe de viabilidad |
| `/api/portal/preguntas` | POST | Generar cuestionario IA |
| `/api/portal/gestor` | GET | Datos del gestor asignado |
| `/api/portal/expediente/[id]` | GET | Detalle de expediente del cliente |

---

## 7. Middleware y seguridad

`middleware.ts` (edge, antes de cualquier renderizado):

1. Supabase refresca el token de sesión en cada request
2. Si la ruta es pública (`/`, `/login`, `/contacto`, etc.) → pasa
3. Si no hay sesión y la ruta es protegida → redirect a `/`
4. Si el usuario no tiene email `@ayudapyme.es` e intenta acceder al dashboard → redirect a `/portal`

En las API Routes, la autorización se verifica explícitamente:
- `requireRole('admin')` — solo admin
- `requireAdminOrTramitador()` — admin o tramitador
- `createServiceClient()` — bypass de RLS para operaciones admin

---

## 8. Variables de entorno

```env
# Supabase (obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Base de datos directa (para scripts Node.js)
DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres

# IA
ANTHROPIC_API_KEY=sk-ant-...     # Claude (chat, títulos, agent loop)
GEMINI_API_KEY=AIza...           # Gemini (extracción PDF masiva)

# Opcionales
NEXT_PUBLIC_SITE_URL=https://ayudapyme.es
INGEST_SECRET=<32 bytes hex>     # Protege endpoints de ingestión y crons
GALICIA_FOCUS=true               # Solo subvenciones de Galicia (testing local)
CLAUDE_CODE_PATH=C:\...\claude   # Ruta al CLI de Claude para agent-loop
```

Los proveedores IA adicionales (OpenAI, OpenRouter) se configuran desde `/ajustes` y se almacenan cifrados en `ia_providers`.

---

## 9. Configuración de IA

El sistema soporta múltiples proveedores configurables desde la UI:

| Provider | Uso recomendado |
|----------|----------------|
| `anthropic` (Claude Haiku/Sonnet) | Chat, títulos comerciales, cuestionarios |
| `google` (Gemini 2.5 Flash) | Extracción masiva de PDFs (nativo PDF, barato) |
| `openai` (GPT-4o-mini) | Alternativa general |
| `openrouter` | Acceso a modelos alternativos |

La fábrica `lib/ai/providers/factory.ts` lee la config de `ia_tool_configs` en DB y devuelve la instancia correcta. Si no hay config, hace fallback a las variables de entorno.

---

## 10. Sistema multi-agente

Los agentes autónomos leen la tabla `agent_tasks` en Supabase y ejecutan las tareas usando Claude Code CLI.

```
agent_tasks
  ├── agent_type: programmer | lead | database | security | matching | qa | product
  ├── status: pending → in_progress → done | failed | blocked
  ├── title + description: el prompt del agente
  └── output + error: resultado de la ejecución
```

```bash
npm run loop              # ejecuta tareas pendientes una vez
npm run loop:watch        # modo continuo (cada 30s)
npm run agents:add -- --agent programmer --title "..." --desc "..."
```

El LangGraph en `scripts/agents/langgraph/` implementa un grafo multi-nodo con estados persistidos en Supabase (`langgraph_checkpoints`).

---

## 11. Comandos de desarrollo

```bash
# Desarrollo
npm run dev              # servidor local (Turbopack)
npm run build            # build de producción
npm run lint

# Base de datos
npm run db:backup        # backup → backups/YYYY-MM-DD_HH-mm.sql
npm run db:restore       # restaurar backup (interactivo)
npm run db:migrate       # aplicar migración SQL

# Pipeline de datos
npm run pipeline         # ingestar subvenciones BDNS (5 fases)
npm run pdf              # pipeline PDF: 15 campos desde PDF oficial
npm run pdf:all          # todas las subvenciones sin procesar
npm run matching         # recalcular matches de todos los clientes
npm run titulos          # regenerar titulo_comercial con Claude Haiku

# Agentes IA
npm run loop             # ejecutar agentes pendientes
npm run loop:watch       # modo continuo
```

---

## 12. Despliegue

### Vercel (producción)

```bash
vercel --prod
```

Variables de entorno en el dashboard de Vercel. Los crons están configurados en `vercel.json`:
- `0 8 * * *` → `/api/expedientes/check-alertas` (alertas de plazos diarias)

### Base de datos

Supabase cloud. Para aplicar migraciones en una instancia nueva, ejecutar los archivos de `supabase/migrations/` en orden numérico desde el SQL Editor de Supabase.

---

## 13. Convenciones de código

- **Commits**: `tipo: descripción en español` (feat, fix, refactor, docs, chore)
- **Componentes**: PascalCase, un componente por archivo
- **API Routes**: siempre verificar auth al inicio con helpers de `lib/auth/helpers.ts`
- **Admin queries**: `createServiceClient()` — nunca el cliente de sesión en API Routes
- **Auth server-side**: `supabase.auth.getUser()` — nunca `getSession()` (inseguro)
- **Estilos landing**: inline styles (`style={{ }}`) — convención establecida
- **Estilos dashboard/portal**: Tailwind CSS
- **No**: `getSession()`, `git push --force`, `DROP TABLE` sin confirmación, credenciales hardcodeadas

---

## 14. Estructura de la documentación

```
docs/
├── TECHNICAL.md          # Este documento (referencia técnica principal)
├── architecture/
│   ├── ia-architecture.md      # Sistema IA multi-modelo
│   ├── workspace-plan.md       # Diseño del workspace unificado
│   └── matching-engine.md      # Revisión técnica del motor de matching
└── reports/
    ├── security-audit-2026-03-26.md
    ├── code-audit-2026-03-27.md
    ├── visual-audit-2026-03-27.md
    └── audit-cycle-2026-03-27.md
```

---

*Documento mantenido por el equipo técnico de AyudaPyme. Para proponer cambios, abrir un PR con la modificación en `docs/`.*
