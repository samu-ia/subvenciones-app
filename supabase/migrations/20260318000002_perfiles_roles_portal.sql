-- ============================================================================
-- PERFILES DE USUARIO Y PORTAL CLIENTE
-- Fecha: 2026-03-18
-- Vincula auth.users con clientes y define roles (admin / cliente)
-- ============================================================================

-- ─── 1. TABLA PERFILES ───────────────────────────────────────────────────────
-- Extiende auth.users con rol y NIF vinculado (para clientes)

CREATE TABLE IF NOT EXISTS public.perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol         TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente')),
  nif         TEXT REFERENCES public.cliente(nif) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver/editar su propio perfil
CREATE POLICY "perfil_select_own" ON public.perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "perfil_update_own" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins pueden ver todos los perfiles
CREATE POLICY "perfil_admin_all" ON public.perfiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_perfiles_nif ON public.perfiles(nif);
CREATE INDEX IF NOT EXISTS idx_perfiles_rol ON public.perfiles(rol);

-- ─── 2. RLS PORTAL: cliente solo ve SUS datos ─────────────────────────────────

-- expediente: cliente ve solo los suyos (via nif del perfil)
CREATE POLICY "expediente_cliente_select" ON public.expediente
  FOR SELECT USING (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'cliente' AND nif IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- cliente: cliente ve solo su propia ficha
CREATE POLICY "cliente_self_select" ON public.cliente
  FOR SELECT USING (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND rol = 'cliente' AND nif IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- subvenciones: cualquier usuario autenticado puede ver (son datos públicos enriquecidos)
CREATE POLICY "subvenciones_auth_select" ON public.subvenciones
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─── 3. TABLA MATCHES CLIENTE-SUBVENCION ─────────────────────────────────────
-- Resultado del matching automático: qué subvenciones encajan con qué cliente

CREATE TABLE IF NOT EXISTS public.cliente_subvencion_match (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nif               TEXT NOT NULL REFERENCES public.cliente(nif) ON DELETE CASCADE,
  subvencion_id     UUID NOT NULL REFERENCES public.subvenciones(id) ON DELETE CASCADE,
  score             NUMERIC(4,2),          -- 0.00 a 1.00
  motivos           TEXT[],                -- razones del match (bullets)
  estado            TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (estado IN ('nuevo','visto','interesado','descartado')),
  calculado_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nif, subvencion_id)
);

ALTER TABLE public.cliente_subvencion_match ENABLE ROW LEVEL SECURITY;

-- Cliente ve solo sus matches
CREATE POLICY "match_cliente_select" ON public.cliente_subvencion_match
  FOR SELECT USING (
    nif IN (
      SELECT nif FROM public.perfiles
      WHERE id = auth.uid() AND nif IS NOT NULL
    )
    OR
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Admin puede insertar/actualizar matches
CREATE POLICY "match_admin_write" ON public.cliente_subvencion_match
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_match_nif          ON public.cliente_subvencion_match(nif);
CREATE INDEX IF NOT EXISTS idx_match_subvencion   ON public.cliente_subvencion_match(subvencion_id);
CREATE INDEX IF NOT EXISTS idx_match_score        ON public.cliente_subvencion_match(score DESC);
CREATE INDEX IF NOT EXISTS idx_match_estado       ON public.cliente_subvencion_match(estado);

-- ─── 4. FUNCIÓN: crear perfil automáticamente al registrar usuario ────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
