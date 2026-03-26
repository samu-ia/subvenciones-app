-- ============================================================================
-- EXPEDIENTE FEE — columnas de comisión por éxito e IBAN para SEPA
-- ============================================================================

ALTER TABLE public.expediente
  ADD COLUMN IF NOT EXISTS fee_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_estado   TEXT DEFAULT 'no_aplica'
    CHECK (fee_estado IN ('no_aplica', 'pendiente', 'facturado', 'cobrado')),
  ADD COLUMN IF NOT EXISTS iban_cliente TEXT;

CREATE INDEX IF NOT EXISTS idx_expediente_fee_estado ON public.expediente(fee_estado)
  WHERE fee_estado IN ('pendiente', 'facturado');
