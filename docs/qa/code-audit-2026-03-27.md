# Code Audit Report — 2026-03-27

Auditoría de los últimos 10 commits (`afb32a6..17916de`).

## Resumen

| Severidad | Bugs | IDs |
|-----------|------|-----|
| CRITICAL | 1 | #1 |
| HIGH | 1 | #2 |
| MEDIUM | 3 | #3, #4, #5 |
| LOW | 3 | #6, #7, #8 |

---

## Bug #1 — CRITICAL: Número de tarjeta de crédito almacenado en texto plano

- **Archivo:** `app/(portal)/portal/page.tsx`, línea 559
- **Tipo:** Seguridad / PCI-DSS
- **Descripción:** El input de tarjeta de crédito captura el número completo y lo guarda en estado como `card:XXXXXXXXXXXXXXXX`, que luego se envía al backend vía `/api/portal/solicitudes` como `metodo_pago`. Almacenar números de tarjeta en texto plano viola PCI-DSS.
- **Fix:** Reemplazar con Stripe Elements o tokenización. Nunca enviar ni almacenar números de tarjeta en el servidor.

## Bug #2 — HIGH: CHECK constraint de `estado` demasiado restrictivo en `cliente_subvencion_match`

- **Archivo:** `supabase/migrations/20260318000002_perfiles_roles_portal.sql`, línea 79
- **Tipo:** DB constraint mismatch
- **Descripción:** El CHECK constraint solo permite `('nuevo','visto','interesado','descartado')`, pero CLAUDE.md documenta estados adicionales como `'pendiente'`, `'solicitando'`, `'concedida'`. Cualquier operación que intente usar esos estados fallará silenciosamente.
- **Fix:** Migración ALTER para expandir el CHECK constraint.

## Bug #3 — MEDIUM: PATCH de expedientes requiere `admin`, pero GET permite `tramitador`

- **Archivo:** `app/api/expedientes/[id]/route.ts`, línea 117
- **Tipo:** Autorización inconsistente
- **Descripción:** GET usa `requireAdminOrTramitador()` (línea 91), pero PATCH usa `requireRole('admin')` (línea 117). Tramitadores pueden ver expedientes pero no actualizarlos, contradiciendo la lógica de negocio donde tramitadores gestionan fases.
- **Fix:** Cambiar línea 117 a `requireAdminOrTramitador()`.

## Bug #4 — MEDIUM: RLS impide que clientes actualicen `checklist_items`

- **Archivo:** `supabase/migrations/20260325000002_proveedores.sql`, líneas 34-41
- **Tipo:** RLS / permisos
- **Descripción:** Solo existe política `checklist_cliente_select` (SELECT). En `app/(portal)/portal/expediente/[id]/page.tsx` línea 216, el cliente intenta `supabase.from('checklist_items').update(...)` desde el browser (anon client). El update falla silenciosamente por RLS, pero el UI muestra éxito porque el estado local se actualiza.
- **Fix:** Crear API route server-side para el update, o añadir política RLS UPDATE para clientes sobre sus propios expedientes.

## Bug #5 — MEDIUM: Mensajes del chat no filtran por `expediente_id`

- **Archivo:** `app/api/portal/expediente/[id]/route.ts`, líneas 85-89
- **Tipo:** Lógica de consulta
- **Descripción:** La query de `mensajes_gestor` filtra solo por `.eq('nif', perfil.nif)`, devolviendo todos los mensajes del cliente sin importar el expediente. Si el cliente tiene múltiples expedientes, los chats se mezclan.
- **Fix:** Añadir `.eq('expediente_id', id)` a la query si la tabla tiene esa columna.

## Bug #6 — LOW: Variables de entorno no documentadas en CLAUDE.md

- **Archivo:** `CLAUDE.md`
- **Tipo:** Documentación
- **Descripción:** Las siguientes env vars se usan en código pero no aparecen en la sección "Variables de entorno necesarias" de CLAUDE.md:
  - `GALICIA_FOCUS` — usado en `api/matching/run/route.ts` y `lib/matching/run-for-client.ts`
  - `INGEST_SECRET` — usado en múltiples API routes para autenticación de cron jobs
  - `NEXT_PUBLIC_SITE_URL` — usado en notificaciones y emails
- **Fix:** Documentar las 3 variables en CLAUDE.md.

## Bug #7 — LOW: `ConfettiDots` usa `Math.random()` durante SSR

- **Archivo:** `app/(portal)/portal/onboarding/page.tsx`, líneas 611-632
- **Tipo:** Hydration mismatch
- **Descripción:** El componente genera valores aleatorios en el render, causando diferencias entre server y client hydration.
- **Fix:** Mover generación de valores a `useEffect`/`useState` para ejecutar solo en cliente.

## Bug #8 — LOW: Fetch de preguntas falla silenciosamente

- **Archivo:** `app/(portal)/portal/page.tsx`, líneas 170-182
- **Tipo:** UX / error handling
- **Descripción:** Si `/api/portal/preguntas` falla, se hace `.catch(() => setPreguntas([]))`. Con array vacío, `todasRespondidas` retorna `true` y el usuario avanza sin responder nada.
- **Fix:** Mostrar estado de error y deshabilitar avance si las preguntas no cargan.

---

## Falsos positivos descartados

- **`MatchScore.version` faltante en v1/v2**: FALSO. Ambas paths incluyen `version` correctamente (v1 línea 896, v2 línea 570, hardExclude línea 196).
- **`MatchScoreDetalle` incompleto en v1**: FALSO. V1 incluye los 7 campos (líneas 869-878).
- **`checklist_items` sin columnas `descripcion`/`categoria`**: FALSO. La migración `20260316000000_cleanup_database.sql` hace DROP de la tabla, y `20260325000002_proveedores.sql` la recrea con esquema completo.
