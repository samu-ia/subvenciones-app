-- ============================================================================
-- CRM Prospectos — tabla para gestionar el pipeline de ventas
-- 2026-03-26
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prospectos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa  TEXT NOT NULL,
  nif             TEXT,
  sector          TEXT,
  ciudad          TEXT,
  provincia       TEXT,
  telefono        TEXT,
  email           TEXT,
  web             TEXT,
  contacto_nombre TEXT,
  estado          TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (estado IN ('nuevo', 'contactado', 'interesado', 'reunion', 'cliente', 'descartado')),
  notas           TEXT,
  fecha_contacto  TIMESTAMPTZ,
  proxima_accion  TEXT,
  fecha_proxima   DATE,
  potencial_eur   NUMERIC,
  origen          TEXT DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON public.prospectos(estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_sector ON public.prospectos(sector);

ALTER TABLE public.prospectos ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.prospectos TO service_role;

CREATE POLICY "prospectos_admin_all" ON public.prospectos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tramitador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tramitador')));

COMMENT ON TABLE public.prospectos IS 'CRM: pipeline de ventas — empresas en proceso de convertirse en clientes';
