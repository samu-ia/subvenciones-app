# AyudaPyme — Mapa del Código Fuente

> Referencia archivo a archivo. Para cada directorio: propósito del bloque. Para cada archivo: qué hace y en qué flujos participa.
>
> **Flujos de referencia:** `pipeline` · `matching` · `portal` · `dashboard` · `auth` · `workspace` · `agentes` · `notificaciones`

---

## Raíz del proyecto

Configuración global, punto de entrada de Next.js y el middleware de autenticación.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `middleware.ts` | Auth guard ejecutado en el edge antes de cada request. Refresca el token de Supabase, protege rutas del dashboard y del portal, redirige según rol. **Crítico: sin este archivo las rutas protegidas son accesibles sin sesión.** | `auth` |
| `next.config.ts` | Configuración de Next.js: build standalone, tolerancia a errores TS en producción. | — |
| `vercel.json` | Define el cron diario (`0 8 * * *`) que llama a `/api/expedientes/check-alertas` para generar alertas de plazos. | `notificaciones` |
| `package.json` | Dependencias y scripts npm. Los scripts `pipeline`, `pdf`, `matching`, `titulos`, `loop`, `agents:*` son los comandos de operación diaria. | — |
| `components.json` | Config de shadcn/ui (rutas de alias, estilos). | — |
| `tsconfig.json` | TypeScript estricto con path aliases (`@/`). | — |
| `eslint.config.mjs` | Reglas ESLint para Next.js. | — |
| `postcss.config.mjs` | PostCSS para Tailwind CSS v4. | — |
| `CLAUDE.md` | Instrucciones para el agente Claude Code: permisos, convenciones, stack, comandos. No afecta el runtime. | — |
| `README.md` | Guía rápida de instalación y descripción del proyecto. | — |

---

## `app/`

Toda la aplicación Next.js bajo App Router. Las carpetas entre paréntesis son grupos de rutas (no añaden segmento a la URL).

### `app/` — archivos raíz

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `layout.tsx` | Root layout: carga fuentes (Inter/Geist), aplica el `TooltipProvider` global, establece metadata base. Envuelve toda la app. | — |
| `globals.css` | Variables de color del design system (navy, teal), reset de Tailwind en `@layer base`, animaciones (`spin`, `slide-up`). | — |
| `not-found.tsx` | Página 404 personalizada. | — |

---

### `app/(auth)/` — Autenticación

Páginas de acceso. No requieren sesión activa.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `login/page.tsx` | Redirige a la landing (`/`) donde el AuthModal gestiona el login. Existe para URLs directas a `/login`. | `auth` |
| `reset-password/page.tsx` | Formulario de cambio de contraseña. Lee el token del hash de la URL (flujo de Supabase Auth). | `auth` |
| `auth/callback/route.ts` | Handler OAuth/magic-link de Supabase. Intercambia el code por sesión y redirige al destino correcto. | `auth` |

---

### `app/(public)/` — Landing pública

Páginas accesibles sin autenticación.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `layout.tsx` | Layout mínimo para páginas públicas (sin sidebar ni auth guard). | — |
| `page.tsx` | Landing principal. Renderiza `<LandingClient>` con metadatos SEO. | `portal` |
| `contacto/page.tsx` | Página de contacto estática. | — |
| `privacidad/page.tsx` | Política de privacidad. | — |
| `terminos/page.tsx` | Términos y condiciones. | — |

---

### `app/(dashboard)/` — Panel de administración

Área privada para admins y tramitadores. El layout verifica el rol.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `layout.tsx` | Envuelve el dashboard con `<DashboardShell>`. Redirige a `/portal` si el usuario no es admin/tramitador. | `auth`, `dashboard` |
| `dashboard/page.tsx` | Vista de KPIs: clientes activos, expedientes en curso, tasa de conversión, pipeline de ingresos. | `dashboard` |
| `bandeja/page.tsx` | Bandeja de entrada operativa: solicitudes pendientes, expedientes urgentes, matches nuevos. | `dashboard` |
| `clientes/page.tsx` | Listado de empresas clientes con búsqueda y filtros. Columnas: empresa, NIF, sector/CNAE, tamaño, ubicación. | `dashboard` |
| `clientes/[nif]/page.tsx` | Ficha completa de un cliente: datos empresa, matches top, expedientes, reuniones, solicitudes. | `dashboard`, `matching` |
| `clientes/[nif]/ClienteMatchesSection.tsx` | Subcomponente que muestra los matches del cliente con score, estado y motivos. Se usa dentro de la ficha. | `matching` |
| `clientes/nuevo/page.tsx` | Formulario de alta manual de cliente (NIF, nombre, sector, tamaño, ubicación). | `dashboard` |
| `expedientes/page.tsx` | Listado de expedientes con toggle grid/lista y filtros por estado/fase. | `dashboard` |
| `expedientes/[id]/page.tsx` | Workspace del expediente: notebook IA, checklist de documentación, panel IA, documentos adjuntos y timeline. Página más compleja del dashboard. | `dashboard`, `workspace` |
| `expedientes/nuevo/page.tsx` | Formulario de creación de expediente (cliente, subvención, fecha límite). | `dashboard` |
| `matches/page.tsx` | Vista global de todos los matches con filtros de score, estado y metodología de puntuación visible. | `matching`, `dashboard` |
| `novedades/page.tsx` | Feed de novedades: matches nuevos pendientes de notificar al cliente y solicitudes recientes. | `dashboard`, `notificaciones` |
| `alertas/page.tsx` | Centro de alertas: plazos próximos, matches sin gestionar, expedientes sin actividad. Con niveles de severidad. | `dashboard` |
| `reuniones/layout.tsx` | Layout compartido para las rutas de reuniones. | — |
| `reuniones/page.tsx` | Listado de reuniones con cliente y estado. | `dashboard` |
| `reuniones/nueva/page.tsx` | Formulario de nueva reunión (cliente, fecha, tipo, notas). | `dashboard` |
| `reuniones/[id]/page.tsx` | Detalle/workspace de una reunión con notas, documentos y accionables. | `dashboard`, `workspace` |
| `solicitudes/page.tsx` | Listado de solicitudes enviadas desde el portal con estado e informe de viabilidad. | `dashboard` |
| `subvenciones/page.tsx` | Catálogo de convocatorias con búsqueda, filtros y detalle expandido de cada subvención. | `pipeline`, `dashboard` |
| `subvenciones-bd/page.tsx` | Panel de control del pipeline BDNS: estado de ingestión, logs, lanzar reprocesado. | `pipeline`, `dashboard` |
| `prospectos/page.tsx` | CRM de leads: empresas contactadas antes de convertirse en clientes. | `dashboard` |
| `proveedores/page.tsx` | Directorio de colaboradores externos (asesoras, consultoras) con especialidades. | `dashboard` |
| `sector-scan/page.tsx` | Radar pre-ventas: busca subvenciones activas filtrando por CNAE + comunidad autónoma. Útil para prospección. | `matching`, `dashboard` |
| `chats/page.tsx` | Bandeja de mensajes con clientes: conversaciones con badges de no leídos. | `dashboard` |
| `ajustes/page.tsx` | Configuración del sistema: proveedores IA, canales de notificación, parámetros del pipeline. | `dashboard` |

---

### `app/(portal)/` — Portal del cliente

Área privada del cliente (empresa PYME). Solo accesible con `rol = 'cliente'`.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `layout.tsx` | Layout del portal. Redirige a `/` si no hay sesión activa. | `auth` |
| `portal/page.tsx` | Dashboard personal del cliente. Muestra matches recomendados, expedientes activos, solicitudes y chat con gestor. Carga matches vía `/api/portal/matches` (service client, sin dependencia de RLS). | `portal`, `matching` |
| `portal/onboarding/page.tsx` | Wizard de alta de empresa (4 pasos): datos básicos → sector/empleados → prioridades → confirmación. Llama a `/api/portal/onboarding` al completar. | `portal` |
| `portal/expediente/[id]/page.tsx` | Vista del cliente de su expediente: estado, fases, documentos que debe aportar, chat con el gestor. | `portal` |

---

### `app/api/` — API Routes

Backend de la aplicación. Todos los handlers usan el patrón: verificar auth → operación con `createServiceClient()` (admin) o `createClient()` (cliente).

#### `api/auth/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `callback/route.ts` | Endpoint de retorno OAuth. Canjea el `code` de Supabase por una sesión y redirige. | `auth` |

#### `api/cliente/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `perfil/route.ts` | `GET`/`PUT` del perfil del cliente autenticado (datos de empresa, CNAE, empleados). | `portal` |

#### `api/clientes/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `route.ts` | `GET` lista de clientes (admin/tramitador). `POST` crea cliente nuevo. | `dashboard` |
| `lookup/route.ts` | `GET` búsqueda de cliente por NIF. Usado en el formulario de nuevo expediente. | `dashboard` |

#### `api/portal/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `setup/route.ts` | `POST` al registrar empresa por primera vez: crea registro en `cliente`, vincula NIF al perfil, llama a eInforma (async), lanza `runMatchingForClient` en background. | `portal`, `matching` |
| `onboarding/route.ts` | `POST` guarda respuestas del wizard en `perfiles.onboarding_data`. También actualiza `cliente` con correcciones del usuario. `GET` comprueba si el onboarding está pendiente. | `portal` |
| `matches/route.ts` | `GET` matches del cliente usando service client (sin RLS). Si el NIF no tiene matches calculados, los calcula en el momento. Punto de entrada principal del portal para subvenciones. | `portal`, `matching` |
| `preguntas/route.ts` | `POST` genera cuestionario personalizado con Claude para una subvención concreta (6-9 preguntas de encaje, proyecto, empresa y documentación). | `portal` |
| `solicitudes/route.ts` | `POST` crea la solicitud del cliente con respuestas del cuestionario y método de pago. Lanza informe de viabilidad en background con Claude. | `portal` |
| `gestor/route.ts` | `GET` datos del gestor asignado al cliente (nombre, foto, teléfono). | `portal` |
| `expediente/[id]/route.ts` | `GET` detalle del expediente del cliente, verificando que el NIF del perfil coincide. | `portal` |
| `expediente/[id]/checklist/route.ts` | `GET`/`POST` checklist de documentos del expediente visible desde el portal. | `portal` |

#### `api/expedientes/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `route.ts` | `GET` lista de expedientes (admin/tramitador). `POST` crea nuevo expediente. | `dashboard` |
| `[id]/route.ts` | `GET` detalle. `PATCH` actualiza estado, fase, fee, IBAN. | `dashboard` |
| `[id]/setup/route.ts` | `POST` auto-configura un expediente nuevo: genera checklist con IA, crea documento de memoria, asocia proveedores relevantes. | `dashboard`, `workspace` |
| `[id]/fases/route.ts` | `GET` transiciones de fase disponibles según el estado actual. | `dashboard` |
| `check-alertas/route.ts` | `GET` disparado por cron diario (Vercel). Revisa plazos y genera alertas automáticas. En fase `cobro` calcula el fee (15%, mín 300 €). Requiere `INGEST_SECRET`. | `dashboard`, `notificaciones` |

#### `api/subvenciones/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `route.ts` | `GET` subvenciones detectadas asociadas a un expediente o reunión. | `dashboard` |
| `ingest/route.ts` | `POST` lanza el pipeline completo de ingestión BDNS. Llama a `lib/subvenciones/pipeline.ts`. Requiere `INGEST_SECRET`. | `pipeline` |
| `catalogo/route.ts` | `GET` catálogo paginado con filtros (estado, ámbito, organismo, búsqueda). | `dashboard`, `pipeline` |
| `catalogo/[id]/route.ts` | `GET` detalle de una subvención del catálogo. | `dashboard` |
| `catalogo/[id]/reprocesar/route.ts` | `POST` fuerza reprocesado de una subvención por el pipeline. | `pipeline` |
| `refresh-estados/route.ts` | `POST` recalcula el `estado_convocatoria` de todas las subvenciones según fechas. | `pipeline` |
| `process-jobs/route.ts` | `POST` procesa la cola de jobs pendientes del pipeline. | `pipeline` |
| `ingesta-log/route.ts` | `GET` logs de ejecución del pipeline (para el panel `subvenciones-bd`). | `pipeline`, `dashboard` |

#### `api/matching/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `run/route.ts` | `POST` lanza el motor de matching. Admite un NIF específico o todos los clientes. Llama a `runMatchingForClient`. | `matching` |
| `validar/route.ts` | `POST` validación profunda de elegibilidad usando `deep-validator.ts` (4 fuentes de datos). | `matching` |

#### `api/alertas/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `route.ts` | `GET` lista de alertas activas. `POST` crea alerta manual. | `dashboard` |
| `[id]/resolver/route.ts` | `POST` marca una alerta como resuelta. | `dashboard` |

#### `api/reuniones/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `route.ts` | `GET`/`POST` gestión de reuniones. | `dashboard` |

#### `api/solicitudes/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `[id]/accion/route.ts` | `POST` acciones del admin sobre una solicitud: activar expediente, rechazar, cambiar estado. | `dashboard` |

#### `api/archivos/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `extract-text/route.ts` | `POST` extrae texto de un PDF subido usando `pdfjs-dist`. Devuelve el texto limpio para su procesado posterior. | `pipeline`, `workspace` |

#### `api/ia/`

Endpoints de IA para el workspace. Todos requieren sesión autenticada.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `chat/route.ts` | `POST` chat contextual del expediente usando OpenAI/Anthropic. | `workspace` |
| `notebook/route.ts` | `POST` conversación en el notebook con RAG sobre los documentos seleccionados. | `workspace` |
| `generar/route.ts` | `POST` generación de contenido libre (documentos, correos, resúmenes) con el proveedor IA configurado. | `workspace` |
| `tool/route.ts` | `POST` ejecuta una herramienta IA específica: `summary`, `missing-info`, `checklist`, `email`. | `workspace` |
| `agent/route.ts` | `POST` agente IA que puede ejecutar acciones en el notebook: generar documentos, actualizar checklist. | `workspace`, `agentes` |
| `deep-search/route.ts` | `POST` búsqueda profunda de subvenciones para un cliente: busca en BDNS, analiza con IA, guarda en `subvenciones_detectadas`. | `matching`, `workspace` |
| `config/providers/route.ts` | `GET`/`POST` configuración de proveedores IA del usuario. | `dashboard` |
| `config/test/route.ts` | `POST` prueba la conexión con un proveedor IA. | `dashboard` |
| `config/tools/route.ts` | `GET`/`POST` configuración de herramientas IA por workspace. | `dashboard` |

#### `api/admin/`

Rutas exclusivas para admins. Todas llaman a `requireAdminOrTramitador()` o `requireRole('admin')`.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `dashboard-stats/route.ts` | `GET` KPIs agregados para el dashboard principal. | `dashboard` |
| `stats/route.ts` | `GET` estadísticas generales (clientes, expedientes, matches, conversión). | `dashboard` |
| `novedades/route.ts` | `GET` solicitudes recientes (últimos 7 días) y matches sin notificar. | `dashboard` |
| `novedades/[matchId]/notificar/route.ts` | `POST` marca un match como notificado al cliente y envía notificación. | `notificaciones` |
| `deep-review/route.ts` | `GET`/`POST` análisis profundo Gemini de los matches top de un cliente: descarga el PDF real y extrae viabilidad, documentación necesaria y preguntas de venta. Guarda en `cliente_subvencion_match.deep_review`. | `matching` |
| `sector-scan/route.ts` | `POST` escanea subvenciones activas para un sector CNAE + CCAA. Herramienta de prospección. | `matching` |
| `gestor/route.ts` | `GET` lista de conversaciones del gestor con clientes. | `dashboard` |
| `gestor/[nif]/route.ts` | `GET`/`POST` mensajes del chat con un cliente concreto. | `dashboard` |
| `prospectos/route.ts` | `GET`/`POST` gestión del CRM de leads. | `dashboard` |
| `prospectos/[id]/route.ts` | `GET`/`PATCH` detalle y actualización de un lead. | `dashboard` |
| `ia-providers/route.ts` | `GET`/`POST` configuración global de proveedores IA (con enmascaramiento de API keys). | `dashboard` |
| `ia-providers/[id]/route.ts` | `GET`/`PATCH`/`DELETE` proveedor individual. | `dashboard` |
| `ia-providers/[id]/test/route.ts` | `POST` test de conectividad del proveedor. | `dashboard` |
| `notif-channels/route.ts` | `GET` canales de notificación configurados (email, WhatsApp). | `notificaciones` |
| `notif-channels/[canal]/route.ts` | `GET`/`PATCH` un canal concreto. | `notificaciones` |
| `notif-channels/[canal]/test/route.ts` | `POST` envía un mensaje de prueba por el canal. | `notificaciones` |
| `notificaciones/digest/route.ts` | `POST` envía resumen periódico de actividad. | `notificaciones` |
| `ingesta-logs/route.ts` | `GET` logs detallados del pipeline de ingestión. | `pipeline` |
| `seguimiento/route.ts` | `GET` datos de seguimiento comercial de clientes. | `dashboard` |
| `calculadora/route.ts` | `POST` calcula el fee estimado de una subvención para presentar al cliente. | `dashboard` |

---

## `components/`

Componentes React reutilizables. Ninguno tiene lógica de negocio directa — leen props o llaman a APIs vía fetch.

### `components/landing/`

Todos los bloques visuales de la landing pública. Usan **inline styles** por convención (no Tailwind), para máxima portabilidad.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `LandingClient.tsx` | Componente cliente que orquesta toda la landing: importa y compone todas las secciones, gestiona el estado del `AuthModal` (open/close, modo login vs registro) y distingue entre `openLogin` y `openRegister` para los diferentes CTAs. | `portal`, `auth` |
| `Hero.tsx` | Sección hero: titular, subtítulo, pills de confianza, CTAs principales y stats (120.000€ / 0€ / 24h). | `portal` |
| `AuthModal.tsx` | Modal de autenticación con tres modos: `login`, `register` y `forgot`. Gestiona el formulario, errores y llamadas a Supabase Auth. Acepta `initialMode` para abrir directamente en registro desde los CTAs de la landing. | `auth` |
| `LandingHeader.tsx` | Cabecera con logo, navegación por anclas y botón de login. Se vuelve opaca al hacer scroll. | `portal` |
| `LandingFooter.tsx` | Pie de página con enlaces legales y redes. | `portal` |
| `BenefitsTicker.tsx` | Ticker horizontal animado con ejemplos reales de subvenciones conseguidas. | `portal` |
| `AboutUs.tsx` | Sección "quiénes somos" con las 4 propuestas de valor. | `portal` |
| `HowItWorks.tsx` | Sección "3 pasos": metes el NIF → nosotros hacemos todo → pagas si cobras. | `portal` |
| `Testimonials.tsx` | Tres casos de éxito con importes destacados. | `portal` |
| `Pricing.tsx` | Tabla de precios: success fee 15%, ejemplo (40k€ → 6k€ comisión → 34k€ netos). | `portal` |
| `FAQ.tsx` | 7 preguntas frecuentes de PYME escéptica en acordeón. | `portal` |
| `FinalCTA.tsx` | Última llamada a la acción antes del formulario de contacto. | `portal` |
| `ContactSection.tsx` | Formulario de contacto (nombre, empresa, email, mensaje). | `portal` |

### `components/layout/`

Estructura visual del panel de administración.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `DashboardShell.tsx` | Contenedor principal del dashboard. Detecta si la ruta actual es un workspace (expediente/reunión) y cambia el layout a columnas colapsables. | `dashboard` |
| `Sidebar.tsx` | Barra lateral de navegación con todos los ítems del menú, badges de notificaciones y avatar del usuario. Incluye submenús colapsables. | `dashboard` |

### `components/ui/`

Primitivas de shadcn/ui. Sin lógica de negocio, puramente presentacionales.

| Archivo | Propósito |
|---------|-----------|
| `accordion.tsx` | Acordeón animado (usado en FAQ). |
| `badge.tsx` | Etiqueta de estado con variantes de color. |
| `button.tsx` | Botón base con variantes (primary, outline, ghost, destructive). |
| `tabs.tsx` | Pestañas (usado en detalle de expediente y ajustes). |
| `tooltip.tsx` | Tooltip flotante (usado en la sidebar y workspace). |

### `components/workspace/`

Panel avanzado para el trabajo diario en expedientes y reuniones. Solo se activa cuando `DashboardShell` detecta que la ruta es un workspace.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `WorkspaceLayout.tsx` | Layout de 3 columnas colapsables (documentos, editor, panel IA). Gestiona el estado de apertura/cierre de cada columna. | `workspace` |
| `CollapsibleColumn.tsx` | Columna con header clicable para expandir/colapsar. | `workspace` |
| `ai/AIPanelV2.tsx` | Panel derecho de IA: chat contextual, acciones rápidas, selector de herramientas. Punto de entrada del usuario a las capacidades IA. | `workspace` |
| `ai/AIConfigPanel.tsx` | Subpanel de configuración del proveedor IA activo en el workspace. | `workspace` |
| `ai/AgentActionFeed.tsx` | Feed en tiempo real de acciones que ejecuta el agente IA. | `workspace`, `agentes` |
| `ai/DeepSearchButton.tsx` | Botón que lanza una búsqueda profunda de subvenciones para el expediente actual. | `matching`, `workspace` |
| `ai/DeepSearchModal.tsx` | Modal con resultados de la búsqueda profunda, con opción de añadirlos al expediente. | `matching`, `workspace` |
| `ai/ContextIndicator.tsx` | Indicador visual del contexto IA activo (documentos incluidos, tokens estimados). | `workspace` |
| `ai/ContextToggle.tsx` | Toggle para incluir/excluir documentos del contexto IA. | `workspace` |
| `ai/useMentions.ts` | Hook para el sistema de `@menciones` en el editor (cita documentos o secciones). | `workspace` |
| `docs/DocumentList.tsx` | Lista de documentos adjuntos al expediente/reunión con upload y extracción de texto. | `workspace` |
| `docs/NotebookLeftPanel.tsx` | Panel izquierdo del notebook: árbol de documentos detectados y subvenciones asociadas. | `workspace` |
| `docs/SubvencionFolder.tsx` | Carpeta colapsable que agrupa documentos por subvención. | `workspace` |
| `editor/RichTextEditor.tsx` | Editor de texto enriquecido (markdown + formato) para notas del expediente. Soporta comandos IA inline. | `workspace` |

---

## `lib/`

Lógica de negocio pura. Sin dependencias de React ni de Next.js. Importado desde API Routes y scripts.

### `lib/supabase/`

Tres clientes Supabase para tres contextos distintos. **Nunca mezclar.**

| Archivo | Propósito | Cuándo usarlo |
|---------|-----------|---------------|
| `client.ts` | `createBrowserClient` — lee la sesión del usuario desde cookies del navegador. RLS aplicado. | Componentes cliente (`'use client'`) |
| `server.ts` | `createServerClient` — lee la sesión desde cookies SSR. RLS aplicado. | Server Components, API Routes que operan como el usuario |
| `service.ts` | Cliente con `SUPABASE_SERVICE_ROLE_KEY`. Bypassa RLS completamente. | API Routes de admin, scripts de servidor. **Nunca exponer al cliente.** |

### `lib/auth/`

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `helpers.ts` | Funciones de autorización para API Routes: `requireRole(rol)`, `requireAdminOrTramitador()`. Devuelven `NextResponse` 401/403 si no autorizado, o el objeto `user` si sí. | `auth` |

### `lib/matching/`

El motor de matching es determinista (sin IA). Produce scores reproducibles y explicables.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `engine.ts` | Algoritmo de scoring v2. Recibe `ClienteMatchProfile` + `SubvencionMatchProfile` y devuelve `{ score, motivos, detalle, hard_exclude, version }`. Dimensiones: CNAE(40) + TipoEmpresa(30) + Importe(20) + Gastos(10) + BonusGeo(15). Score normalizado sobre 115. | `matching` |
| `run-for-client.ts` | Orquestador para un NIF específico. Carga datos del cliente, todas las subvenciones activas con sus sectores/tipos/requisitos/gastos, construye los perfiles y llama a `engine.ts` en bucle. Persiste resultados en `cliente_subvencion_match`. Umbral mínimo: 0.28. | `matching`, `portal` |
| `deep-validator.ts` | Validador de elegibilidad en segunda fase. Cruza 4 fuentes: datos normalizados + grounding PDF + perfil cliente + respuestas cuestionario. Produce una lista de `bloqueantes`, `riesgos` y `documentos_pendientes`. | `matching` |

### `lib/subvenciones/`

Pipeline de procesado de subvenciones. Cada módulo es una fase independiente.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `pipeline.ts` | Orquestador de las 5 fases para una convocatoria: ingesta → descarga → extracción IA → normalización → validación. Gestiona estados en `subvenciones.pipeline_fase`. | `pipeline` |
| `pipeline-single.ts` | Variante que procesa una única subvención (por BDNS ID). Usado para reprocesado manual. | `pipeline` |
| `bdns-client.ts` | Cliente HTTP de la API pública de la BDNS. Descarga listados de convocatorias y metadatos. Gestiona paginación y reintentos. | `pipeline` |
| `pdf-service.ts` | Descarga PDFs desde las URLs de la BDNS y los sube a Supabase Storage. Extrae texto plano con `pdfjs-dist`. | `pipeline` |
| `pdf-gemini.ts` | Envía el PDF a Gemini 2.5 Flash en modo nativo (sin conversión de texto). Extrae 15 campos estructurados con trazabilidad. Más preciso que la extracción de texto. | `pipeline` |
| `ai-extractor.ts` | Extracción de campos (requisitos, sectores, tipos de empresa, gastos, documentación) a partir del texto del PDF usando el proveedor IA configurado. Incluye puntuación de confianza por campo. | `pipeline` |
| `normalizer.ts` | Escribe el resultado de la extracción en las tablas de la BD: `subvenciones`, `subvencion_requisitos`, `subvencion_gastos`, `subvencion_sectores`, `subvencion_tipos_empresa`. | `pipeline` |
| `document-manager.ts` | Gestiona múltiples documentos por convocatoria (convocatoria, bases reguladoras, resolución, correcciones). Registra en `grant_documents`. | `pipeline` |
| `estado-calculator.ts` | Calcula `estado_convocatoria` (abierta/próxima/cerrada/suspendida) a partir de las fechas y los eventos registrados. | `pipeline` |
| `grounding-writer.ts` | Guarda en `subvencion_campos_extraidos` la trazabilidad campo → fragmento del PDF de origen. Permite al matching verificar que un dato tiene soporte documental. | `matching`, `pipeline` |

### `lib/ai/providers/`

Abstracción multi-proveedor. El resto de la app solo usa la interfaz `BaseProvider`.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `base.ts` | Interfaz `AIProvider` con métodos `complete()` y `stream()`. Tipos comunes `Message`, `CompletionOptions`. | `agentes`, `workspace` |
| `factory.ts` | Lee `ia_tool_configs` de la BD y devuelve la instancia del proveedor correcto según workspace. Fallback a env vars si no hay config. | `agentes`, `workspace` |
| `anthropic.ts` | Implementación para Claude. Soporta streaming y modo `thinking` (adaptive). | `agentes`, `workspace` |
| `google.ts` | Implementación para Gemini. Soporta el modo nativo PDF (multimodal). | `pipeline`, `agentes` |
| `openai.ts` | Implementación para OpenAI y OpenRouter (compatible). | `agentes`, `workspace` |

### `lib/db/`

Capa de acceso a datos para configuración IA. Separan la lógica de BD de las API Routes.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `ia-providers.ts` | CRUD de `ia_providers`: leer, crear, actualizar, borrar configuraciones de proveedor. Enmascara API keys en GET. | `dashboard` |
| `ia-tools.ts` | CRUD de `ia_tool_configs`: configuración de qué herramienta IA usa qué modelo en qué workspace. | `dashboard` |
| `ia-analytics.ts` | Inserta registros en `ia_tool_executions` para métricas de uso (proveedor, modelo, tokens, latencia). | `agentes` |
| `ia-config.ts` | Helpers de lectura de configuración IA activa para un workspace concreto. | `workspace` |

### `lib/types/`

Tipos TypeScript compartidos entre API Routes, lib y scripts.

| Archivo | Propósito |
|---------|-----------|
| `subvenciones-pipeline.ts` | Tipos del pipeline: `BdnsConvocatoria`, `IaExtraccionResult`, `EstadoConvocatoria`, `PipelineFase`, `SubvencionNormalizada`. |
| `notebook.ts` | Tipos del workspace: `SubvencionDetectada`, `ClienteSnapshot`, `NotebookBlock`. |
| `ai-config.ts` | Tipos de configuración IA: `IAProvider`, `IAToolConfig`, `WorkspaceType`. |
| `agent-actions.ts` | Tipos de las acciones del agente IA: `AgentAction`, `AgentResponse`, `ActionType`. |

### `lib/` — archivos sueltos

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `einforma/client.ts` | Cliente de la API eInforma. Obtiene token OAuth, consulta datos de empresa por NIF (CNAE, empleados, ventas, localidad). Solo funciona desde IPs de Vercel (whitelist). | `portal` |
| `email.ts` | Helper para Resend API: resuelve la API key (desde env o DB), envía emails transaccionales. | `notificaciones` |
| `notifications.ts` | Sistema de notificaciones multicanal: email (Resend) y WhatsApp (Twilio). Lee config de `notif_channels`. Incluye helpers `sendWelcomeEmail` y `sendMatchNotificationEmail`. | `notificaciones` |
| `billing/generate-invoice.ts` | Genera el documento de factura cuando un expediente llega a la fase de cobro. | `dashboard` |
| `utils.ts` | Utilidades generales: `cn()` (merge de clases Tailwind), formateo de fechas y moneda. | — |
| `hooks/use-media-query.ts` | Hook React para detectar breakpoints (`isMobile`, `isTablet`). Usado en el portal y landing. | — |
| `stores/workspace-columns-store.ts` | Store Zustand con el estado de las columnas del workspace (abierta/cerrada/ancho). Persiste en localStorage. | `workspace` |

---

## `scripts/`

Utilidades Node.js para operaciones de datos y mantenimiento. Se ejecutan fuera del servidor Next.js, conectando directamente a la BD vía `DATABASE_URL`.

### `scripts/` — raíz

| Archivo | Propósito | Cuándo ejecutar |
|---------|-----------|-----------------|
| `pipeline-magistral.mjs` | Pipeline BDNS completo de 5 fases, crash-safe y resumible. Puede ejecutarse por fases individuales (`--fase`) o para un ID específico (`--id`). | Ingestión diaria de subvenciones |
| `pipeline-pdf-real.mjs` | Descarga PDFs desde BDNS y los procesa con Gemini para extraer 15 campos estructurados. Más lento pero más preciso que la extracción de texto. | Enriquecimiento de subvenciones importantes |
| `run-matching.mjs` | Ejecuta el motor de matching v2 para todos los clientes sin necesitar el servidor Next.js. Carga requisitos, gastos y beneficiarios. | Recalcular matches después de añadir clientes o subvenciones |
| `seed-subvenciones.mjs` | Inserta subvenciones PYME directamente desde la API BDNS filtrando por palabras clave. Bypassa el pipeline pesado. Útil para poblar la BD rápidamente. | Setup inicial o testing |
| `generate-titulos-comerciales.mjs` | Convierte títulos burocráticos del BOE en títulos atractivos para PYMEs usando Claude Haiku. Actualiza `subvenciones.titulo_comercial`. | Después de cada ingesta |
| `enrich-with-gemini.mjs` | Enriquece subvenciones descargando sus PDFs y analizándolos con Gemini (descripción, sectores, beneficiarios, importe). Versión legacy del pipeline PDF. | Enriquecimiento puntual |
| `deep-review.mjs` | Para cada cliente, descarga el PDF de sus top matches y lo analiza con Gemini: viabilidad, documentación necesaria, preguntas de venta. Guarda en `cliente_subvencion_match.deep_review`. | Preparación de reuniones con clientes |
| `prospectar.mjs` | Genera leads buscando subvenciones activas por sector CNAE + zona geográfica. Exporta CSV con datos de la oportunidad y pitch de venta. | Prospección comercial |
| `backup-db.mjs` | Exporta todas las tablas críticas como SQL INSERTs a `backups/YYYY-MM-DD_HH-mm.sql`. Conserva los 10 últimos backups. | Mantenimiento diario |
| `restore-db.mjs` | Restaura la BD desde un backup SQL. Interactivo: muestra lista de backups disponibles. **Destructivo — borra datos actuales.** | Recuperación de desastres |
| `run-migration.js` | Aplica un archivo de migración SQL a la BD de producción vía `DATABASE_URL`. | Despliegue de nuevas migraciones |
| `agent-loop.mjs` | Lee tareas de `agent_tasks` (estado `pending`), las ejecuta una a una usando el CLI de Claude Code, actualiza el estado a `done`/`failed` y guarda el output. Modo `--watch` para ejecución continua. | Automatización de tareas de desarrollo |

### `scripts/agents/`

Sistema multi-agente basado en LangGraph para tareas complejas de desarrollo y operaciones.

| Archivo | Propósito | Flujos |
|---------|-----------|--------|
| `orchestrator.ts` | Orquestador principal. Lee tareas de `agent_tasks`, crea worktrees git aislados y lanza agentes especializados en paralelo. | `agentes` |
| `add-task.ts` | CLI para añadir tareas a la cola: `--agent`, `--title`, `--desc`, `--priority`. Escribe en `agent_tasks`. | `agentes` |
| `langgraph/graph.ts` | Definición del grafo LangGraph: nodos (planner, executor, reviewer) y transiciones. | `agentes` |
| `langgraph/nodes.ts` | Implementación de cada nodo: qué prompt usa, qué herramientas tiene disponibles, cómo actualiza el estado. | `agentes` |
| `langgraph/prompts.ts` | Prompts del sistema para cada rol de agente (lead, programmer, database, security, qa, matching). | `agentes` |
| `langgraph/types.ts` | Tipos del estado del grafo (`AgentState`, `NodeType`, `CheckpointData`). | `agentes` |
| `langgraph/checkpointer.ts` | Persistencia de checkpoints del grafo en `langgraph_checkpoints` (Supabase). Permite reanudar grafos interrumpidos. | `agentes` |
| `langgraph/utils.ts` | Utilidades del grafo: parseo de respuestas, formateo de contexto, helpers de estado. | `agentes` |
| `langgraph/run.ts` | Entry point para ejecutar el grafo desde CLI. | `agentes` |

---

## `supabase/`

Todo lo relacionado con la BD: esquema, historial de cambios y scripts de corrección.

### `supabase/migrations/`

32 migraciones en orden cronológico. Cada una es idempotente (`IF NOT EXISTS`, `IF EXISTS`). Se aplican en orden numérico desde el SQL Editor de Supabase.

| Rango | Contenido |
|-------|-----------|
| `20260315*` | Schema inicial: expedientes, oportunidades, módulos operacionales, configuración IA |
| `20260316*` | Limpieza, workspace de documentos, chat sessions, configuración IA multi-modelo, notebook |
| `20260317*` | RLS de archivos y documentos |
| `20260318*` | Pipeline de subvenciones (tablas principales), perfiles de usuario + portal cliente, RLS |
| `20260324*` | Subvenciones v2 (grounding, sectores, tipos), matching + solicitudes |
| `20260325*` | Expediente-subvención, proveedores, fix RLS perfiles |
| `20260326*` | Cuestionario IA, sistema de agentes (`agent_tasks`), checkpoints LangGraph, rol tramitador, fee de éxito, título comercial, CRM de prospectos |
| `20260327*` | Chat cliente-gestor, pipeline v3 (grant_documents, grant_versions), onboarding/factura, deep review |
| `20260328*` | Fases de expediente con alertas |
| `20260329*` | Canales de notificación, columna `onboarding_data` en perfiles |
| `20260330*` | Tabla `expediente_fases`, pipeline PDF real |

### `supabase/fixes/`

SQLs de corrección puntual ejecutados manualmente fuera del flujo de migraciones. Ya aplicados en producción.

| Archivo | Propósito |
|---------|-----------|
| `fix-2026-03-16-documentos-archivos-ia.sql` | Añade columnas faltantes en `documentos` y `archivos`, crea tablas IA (`ia_providers`, `ia_tool_configs`), configura RLS permisivo y Storage bucket `archivos`. |

### `supabase/` — archivos raíz

| Archivo | Propósito |
|---------|-----------|
| `config.toml` | Configuración local de Supabase CLI. |
| `DATABASE.md` | Descripción de todas las tablas con sus columnas clave. |
| `MIGRATIONS.md` | Log de migraciones con descripción de qué cambió en cada una. |

---

## `docs/`

Documentación técnica del proyecto.

| Archivo/Directorio | Propósito |
|-------------------|-----------|
| `TECHNICAL.md` | Referencia técnica principal: stack, estructura, flujos, API, env vars, comandos, convenciones. |
| `CODEBASE.md` | Este documento. Mapa archivo a archivo del código fuente. |
| `architecture/ia-architecture.md` | Diseño del sistema IA multi-modelo (proveedores, herramientas, configuración). |
| `architecture/workspace-plan.md` | Plan de diseño del workspace unificado expediente/reunión. |
| `architecture/matching-engine.md` | Revisión técnica en profundidad del motor de matching (dimensiones, pesos, casos borde). |
| `reports/` | Auditorías de seguridad, ciclo completo, código y visuales. Referencia histórica. |

---

## `public/`

Assets estáticos servidos directamente por Next.js.

| Archivo | Propósito |
|---------|-----------|
| `logo-dark.png` | Logo para fondo oscuro (usado en la landing y sidebar). |
| `logo-light.png` | Logo para fondo claro. |
| `logo-bimi.svg` | Logo SVG para el estándar BIMI (verificación de email). |
| `favicon.ico` | Favicon del sitio (también hay uno en `app/favicon.ico` que tiene prioridad). |

---

## `prospection/`

Directorio de salida de `scripts/prospectar.mjs`. Los CSVs generados están en `.gitignore` (datos internos).

| Archivo | Propósito |
|---------|-----------|
| `.gitkeep` | Mantiene el directorio vacío en el repo. |

---

*Documento generado el 2026-03-28. Actualizar cuando se añadan ficheros con impacto en los flujos principales.*
