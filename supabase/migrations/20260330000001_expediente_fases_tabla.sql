-- ============================================================================
-- TABLA expediente_fases — historial de fases por expediente
-- Fecha: 2026-03-30
-- · Registra cada fase con fecha inicio, fecha completada, y orden
-- · Se usa para el timeline visual en el portal del cliente
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expediente_fases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID NOT NULL REFERENCES public.expediente(id) ON DELETE CASCADE,
  fase            TEXT NOT NULL,
  orden           INTEGER NOT NULL,
  fecha_inicio    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_completada TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: solo un registro por (expediente, fase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_expediente_fases_uniq
  ON public.expediente_fases(expediente_id, fase);

CREATE INDEX IF NOT EXISTS idx_expediente_fases_exp
  ON public.expediente_fases(expediente_id);

-- RLS: admins ven todo, clientes ven las fases de sus expedientes
ALTER TABLE public.expediente_fases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fases_admin_all" ON public.expediente_fases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tramitador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol IN ('admin', 'tramitador')));

CREATE POLICY "fases_cliente_read" ON public.expediente_fases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expediente e
      JOIN public.perfiles p ON p.nif = e.nif AND p.id = auth.uid()
      WHERE e.id = expediente_fases.expediente_id
    )
  );
