-- ============================================================================
-- ROL TRAMITADOR
-- Fecha: 2026-03-26
-- · Añade el rol 'tramitador' al sistema (gestor junior/técnico)
-- · Permisos: leer expedientes/clientes, cambiar fases, chat, checklist
-- · Restricciones: no puede aprobar/rechazar solicitudes, no facturación
-- ============================================================================

-- ─── 1. AMPLIAR CHECK CONSTRAINT EN perfiles.rol ─────────────────────────────
-- Droppear la restricción vieja e incluir 'tramitador'

ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('admin', 'cliente', 'tramitador'));

-- ─── 2. ACTUALIZAR get_my_rol() PARA DEVOLVER 'tramitador' ───────────────────
-- La función ya existe (20260325000003_fix_perfiles_rls.sql); como es un SELECT
-- genérico sobre perfiles.rol, no hay que cambiarla. Solo documentamos aquí que
-- a partir de esta migración puede devolver 'tramitador'.

-- ─── 3. RLS: expediente ──────────────────────────────────────────────────────

-- SELECT: tramitador ve todos los expedientes (igual que admin)
DROP POLICY IF EXISTS "expediente_tramitador_select" ON public.expediente;
CREATE POLICY "expediente_tramitador_select" ON public.expediente
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- UPDATE: tramitador puede actualizar expedientes.
-- NOTA: RLS no puede restringir columnas individuales; la política aplica a la
-- fila completa. La restricción de columnas (solo fase, notas, fechas —NO estado
-- final crítico como 'activo' o 'rechazado') DEBE aplicarse en la capa de API:
-- verificar que el body del PATCH no incluya 'estado' con valores finales, o
-- filtrar las columnas permitidas antes de ejecutar el UPDATE.
DROP POLICY IF EXISTS "expediente_tramitador_update" ON public.expediente;
CREATE POLICY "expediente_tramitador_update" ON public.expediente
  FOR UPDATE USING (
    public.get_my_rol() = 'tramitador'
  );

-- ─── 4. RLS: cliente ─────────────────────────────────────────────────────────

-- SELECT: tramitador ve todos los clientes (solo lectura; no INSERT/DELETE)
DROP POLICY IF EXISTS "cliente_tramitador_select" ON public.cliente;
CREATE POLICY "cliente_tramitador_select" ON public.cliente
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- ─── 5. RLS: checklist_items ─────────────────────────────────────────────────

-- SELECT: tramitador ve todos los checklist items
DROP POLICY IF EXISTS "checklist_tramitador_select" ON public.checklist_items;
CREATE POLICY "checklist_tramitador_select" ON public.checklist_items
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- UPDATE: tramitador puede marcar items como completados
DROP POLICY IF EXISTS "checklist_tramitador_update" ON public.checklist_items;
CREATE POLICY "checklist_tramitador_update" ON public.checklist_items
  FOR UPDATE USING (
    public.get_my_rol() = 'tramitador'
  );

-- ─── 6. RLS: mensajes_gestor ─────────────────────────────────────────────────

-- SELECT: tramitador lee todos los mensajes (chat con cualquier cliente)
DROP POLICY IF EXISTS "mensajes_tramitador_select" ON public.mensajes_gestor;
CREATE POLICY "mensajes_tramitador_select" ON public.mensajes_gestor
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- INSERT: tramitador puede enviar mensajes como 'gestor'
-- (el remitente 'gestor' ya está permitido en el CHECK constraint de la tabla)
DROP POLICY IF EXISTS "mensajes_tramitador_insert" ON public.mensajes_gestor;
CREATE POLICY "mensajes_tramitador_insert" ON public.mensajes_gestor
  FOR INSERT WITH CHECK (
    public.get_my_rol() = 'tramitador'
    AND remitente = 'gestor'
  );

-- ─── 7. RLS: alertas ─────────────────────────────────────────────────────────

-- SELECT: tramitador puede ver todas las alertas (no puede crearlas ni resolverlas)
DROP POLICY IF EXISTS "alertas_tramitador_select" ON public.alertas;
CREATE POLICY "alertas_tramitador_select" ON public.alertas
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- ─── 8. RLS: solicitudes ─────────────────────────────────────────────────────

-- SELECT: tramitador puede leer todas las solicitudes (solo lectura)
-- NO se concede UPDATE: el tramitador no puede aprobar/rechazar solicitudes
-- (cambiar estado a 'activo' o 'rechazado' requiere rol 'admin')
DROP POLICY IF EXISTS "solicitudes_tramitador_select" ON public.solicitudes;
CREATE POLICY "solicitudes_tramitador_select" ON public.solicitudes
  FOR SELECT USING (
    public.get_my_rol() = 'tramitador'
  );

-- ─── 9. NOTA PARA DESARROLLADORES: API routes ────────────────────────────────
-- Las rutas de API que usan requireRole('admin') deben actualizarse para aceptar
-- también el rol 'tramitador' donde corresponda. Ejemplo en TypeScript:
--
--   requireRole(['admin', 'tramitador'])   -- para GET /api/expedientes
--   requireRole(['admin'])                 -- para POST/PATCH con cambio de estado final
--
-- Rutas que deben aceptar tramitador:
--   GET  /api/expedientes       → requireRole(['admin','tramitador'])
--   GET  /api/clientes          → requireRole(['admin','tramitador'])
--   PATCH /api/expedientes/:id  → requireRole(['admin','tramitador']) + validar columnas
--   GET  /api/alertas           → requireRole(['admin','tramitador'])
--   GET  /api/solicitudes       → requireRole(['admin','tramitador'])
--
-- Rutas que deben seguir siendo solo 'admin':
--   POST/DELETE /api/clientes       → solo admin (crear/borrar clientes)
--   PATCH /api/solicitudes/:id      → solo admin (aprobar/rechazar)
--   GET/POST /api/facturacion       → solo admin
--   GET/POST /api/ajustes           → solo admin
