# Auditoría del Ciclo Completo: Cliente -> Cobro

**Fecha:** 2026-03-27
**Método:** Análisis exhaustivo de código (auth, portal, dashboard, API, DB, storage)

---

## Resumen Ejecutivo

Se simuló el ciclo completo de un cliente real de AyudaPyme analizando todo el código involucrado:

1. **Landing -> Registro -> Onboarding -> Ver matches** - Funcional con 3 bugs
2. **Cliente marca interés -> Se crea solicitud** - Funcional con 2 bugs
3. **Gestor ve expediente, lo mueve de fase** - Funcional con 1 bug
4. **Cliente sube documentos** - Funcional con 3 bugs de seguridad/validación
5. **Expediente llega a cobro -> Se genera factura** - **ROTO** - factura nunca se genera

---

## Bugs Encontrados (12 total)

### CRÍTICOS (bloquean el negocio)

| # | Bug | Impacto | Task ID |
|---|-----|---------|---------|
| 1 | **No se genera factura al llegar a cobro** | fee_amount se calcula pero factura_url y factura_numero nunca se rellenan. El modelo de negocio (success fee) no puede ejecutarse. | `d59d1834` |
| 2 | **fee_estado atascado en 'pendiente'** | No hay API para que el gestor marque la factura como emitida o cobrada. Sin tracking de ingresos. | `6586b5b9` |
| 3 | **RLS de archivos permite a cualquier usuario ver todos los archivos** | Cualquier usuario autenticado puede leer/modificar/borrar documentos de cualquier otro cliente. Violación de privacidad. | `5d5c07fa` |
| 4 | **Formulario de tarjeta almacena datos en plaintext** | Sin Stripe, los datos de tarjeta van al state del componente. Riesgo PCI-DSS. | `3b63656d` |

### ALTOS (causan errores o confusión)

| # | Bug | Impacto | Task ID |
|---|-----|---------|---------|
| 5 | **No se valida importe_concedido antes de cobro** | Gestor puede mover a cobro sin importe, generando fee de 300€ fijo sin base real. | `a59e9b97` |
| 6 | **SetupEmpresa redirige antes de confirmar API OK** | Si /api/portal/setup falla, el usuario entra en bucle infinito setup->onboarding->setup. | `c5d214b3` |
| 7 | **Error de auth callback no se muestra** | Si el link de verificación expira, el usuario vuelve a landing sin saber por qué. Crea duplicados. | `e58ac8f8` |
| 8 | **Modal de solicitud sin paso de confirmación** | Cliente envía solicitud y el modal se cierra. No sabe qué pasa después. | `70fa96c1` |
| 9 | **Se permite saltar fases del expediente** | Gestor puede ir de 'preparacion' a 'cobro' directamente, saltando todo el proceso. | `64328491` |

### MEDIOS (degradan la experiencia)

| # | Bug | Impacto | Task ID |
|---|-----|---------|---------|
| 10 | **Extracción de texto falla silenciosamente** | .catch(() => {}) traga todos los errores. Archivos sin texto extraído, sin aviso. | `af94fc9b` |
| 11 | **No se envía email tras marcar interés** | Cliente no recibe confirmación por email de su solicitud. | `0627075b` |
| 12 | **Validación de archivos solo en frontend** | Solo HTML5 accept attribute. Sin validación de MIME type en backend. Inconsistencia entre componentes. | `6086416a` |

---

## Mejoras UX Propuestas (3)

| # | Mejora | Impacto Esperado | Task ID |
|---|--------|------------------|---------|
| 1 | **Panel de estado en tiempo real** | Suscripción Realtime a cambios de expediente. El cliente ve actualizaciones sin recargar. | `e2643f99` |
| 2 | **Paginación y filtros en matches** | Con 50+ matches, la página es inusable en móvil. Filtros por score, plazo, importe + paginación. | `f6d32ed8` |
| 3 | **Onboarding guiado con progreso visual** | Barra de progreso, validación en tiempo real, explicaciones de cada prioridad, celebración al final. | `db40b9c8` |

---

## Flujo Analizado Paso a Paso

### Paso 1: Landing -> Registro
- **Ruta:** Landing (/) -> AuthModal (register) -> Supabase signUp -> Email verificación
- **Archivos:** `components/landing/AuthModal.tsx`, `components/landing/LandingClient.tsx`
- **Bug encontrado:** Error callback no mostrado (#7)

### Paso 2: Callback -> Setup -> Onboarding
- **Ruta:** /auth/callback -> /portal -> SetupEmpresa (NIF) -> /portal/onboarding (3 pasos)
- **Archivos:** `app/auth/callback/route.ts`, `app/(portal)/portal/page.tsx`, `app/api/portal/setup/route.ts`, `app/(portal)/portal/onboarding/page.tsx`
- **Bug encontrado:** SetupEmpresa redirect race condition (#6)
- **Nota:** Posible race condition en NIF linking (entre check y upsert)

### Paso 3: Ver Matches -> Marcar Interés
- **Ruta:** /portal -> MatchCards -> ModalSolicitud (3 pasos) -> POST /api/portal/solicitudes
- **Archivos:** `app/(portal)/portal/page.tsx`, `app/api/portal/solicitudes/route.ts`, `app/api/portal/preguntas/route.ts`
- **Bugs encontrados:** Sin confirmación (#8), sin email (#11), tarjeta plaintext (#4)
- **Nota:** Expediente NO se crea automáticamente. Requiere acción del admin.

### Paso 4: Admin Activa Expediente -> Gestor Trabaja
- **Ruta:** POST /api/solicitudes/[id]/accion -> crea expediente -> POST /api/expedientes/[id]/setup
- **Archivos:** `app/api/solicitudes/[id]/accion/route.ts`, `app/api/expedientes/[id]/setup/route.ts`
- **Genera:** Checklist, memoria, informe viabilidad, match proveedores

### Paso 5: Gestor Mueve Fases
- **Ruta:** PATCH /api/expedientes/[id] con {fase: 'nueva_fase'}
- **Archivos:** `app/api/expedientes/[id]/route.ts`, `app/(dashboard)/expedientes/[id]/page.tsx`
- **Bug encontrado:** Sin validación de orden (#9)

### Paso 6: Cliente Sube Documentos
- **Ruta:** Expediente detail -> DocumentList -> Supabase Storage -> /api/archivos/extract-text
- **Archivos:** `components/workspace/docs/DocumentList.tsx`, `app/api/archivos/extract-text/route.ts`
- **Bugs encontrados:** RLS permisiva (#3), validación solo frontend (#12), extracción silenciosa (#10)

### Paso 7: Cobro -> Factura (ROTO)
- **Ruta:** PATCH fase='cobro' -> calcula fee -> crea alerta -> envía emails
- **Lo que falta:** Generar PDF factura, rellenar factura_url/factura_numero, API para fee_estado
- **Bugs encontrados:** Sin factura (#1), fee_estado atascado (#2), sin validación importe (#5)

---

## Priorización Recomendada

1. **Semana 1:** Bugs #1 (factura), #2 (fee_estado), #3 (RLS), #4 (tarjeta) — bloquean negocio/seguridad
2. **Semana 2:** Bugs #5 (validación cobro), #6 (setup loop), #7 (auth error), #8 (confirmación)
3. **Semana 3:** Bugs #9 (fases), #10 (extracción), #11 (email), #12 (validación archivos)
4. **Semana 4:** UX #1 (realtime), #2 (paginación), #3 (onboarding)
