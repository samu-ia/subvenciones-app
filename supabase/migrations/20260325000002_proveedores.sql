-- ============================================================================
-- PROVEEDORES Y CHECKLIST POR EXPEDIENTE
-- Fecha: 2026-03-25
-- · Tabla checklist_items: documentación requerida por expediente (generada por IA)
-- · Tabla proveedores: catálogo de empresas colaboradoras/patrocinadores
-- · Tabla expediente_proveedores: asignación IA de proveedores por expediente
-- ============================================================================

-- ─── 1. CHECKLIST_ITEMS (nueva tabla) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id  UUID NOT NULL REFERENCES public.expediente(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  descripcion    TEXT,
  tipo           TEXT DEFAULT 'documento'
                 CHECK (tipo IN ('documento','accion','verificacion')),
  categoria      TEXT,   -- 'identidad','fiscal','laboral','tecnico','juridico','financiero'
  obligatorio    BOOLEAN DEFAULT true,
  completado     BOOLEAN DEFAULT false,
  generado_ia    BOOLEAN DEFAULT false,
  notas          TEXT,
  orden          INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_admin_all" ON public.checklist_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "checklist_cliente_select" ON public.checklist_items
  FOR SELECT USING (
    expediente_id IN (
      SELECT e.id FROM public.expediente e
      JOIN public.perfiles p ON p.nif = e.nif
      WHERE p.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_checklist_expediente ON public.checklist_items(expediente_id);

-- ─── 2. TABLA PROVEEDORES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proveedores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  categoria        TEXT NOT NULL
                   CHECK (categoria IN (
                     'tecnologia','consultoria','formacion',
                     'equipamiento','marketing','juridico',
                     'financiero','construccion','otros'
                   )),
  descripcion      TEXT,
  servicios        TEXT[],
  logo_url         TEXT,
  web              TEXT,
  contacto_email   TEXT,
  contacto_nombre  TEXT,
  precio_referencia TEXT,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_admin_all" ON public.proveedores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "proveedores_select_activos" ON public.proveedores
  FOR SELECT USING (activo = true);

-- ─── 3. TABLA EXPEDIENTE_PROVEEDORES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.expediente_proveedores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id    UUID NOT NULL REFERENCES public.expediente(id) ON DELETE CASCADE,
  proveedor_id     UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  relevancia_score NUMERIC,
  motivo_match     TEXT,
  propuesta_texto  TEXT,
  estado           TEXT DEFAULT 'sugerido'
                   CHECK (estado IN ('sugerido','contactado','aceptado','descartado')),
  generado_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expediente_id, proveedor_id)
);

ALTER TABLE public.expediente_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exp_prov_admin_all" ON public.expediente_proveedores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "exp_prov_cliente_select" ON public.expediente_proveedores
  FOR SELECT USING (
    expediente_id IN (
      SELECT e.id FROM public.expediente e
      JOIN public.perfiles p ON p.nif = e.nif
      WHERE p.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_prov_categoria ON public.proveedores(categoria);
CREATE INDEX IF NOT EXISTS idx_exp_prov_exp   ON public.expediente_proveedores(expediente_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proveedores_updated_at') THEN
    CREATE TRIGGER trg_proveedores_updated_at
      BEFORE UPDATE ON public.proveedores
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;
