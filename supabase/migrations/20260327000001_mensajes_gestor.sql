-- Tabla de mensajes entre cliente y gestor/IA
CREATE TABLE IF NOT EXISTS mensajes_gestor (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nif         TEXT        NOT NULL REFERENCES cliente(nif) ON DELETE CASCADE,
  remitente   TEXT        NOT NULL CHECK (remitente IN ('cliente', 'gestor', 'ia')),
  contenido   TEXT        NOT NULL,
  leido       BOOLEAN     NOT NULL DEFAULT false,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mensajes_gestor_nif_idx ON mensajes_gestor(nif, created_at DESC);

-- RLS
ALTER TABLE mensajes_gestor ENABLE ROW LEVEL SECURITY;

-- Los clientes solo ven sus propios mensajes (por nif, unido a su perfil)
CREATE POLICY "cliente_lee_sus_mensajes" ON mensajes_gestor
  FOR SELECT USING (
    nif = (SELECT nif FROM perfiles WHERE id = auth.uid())
  );

CREATE POLICY "cliente_envia_mensajes" ON mensajes_gestor
  FOR INSERT WITH CHECK (
    remitente = 'cliente' AND
    nif = (SELECT nif FROM perfiles WHERE id = auth.uid())
  );
