-- Migración para sistema de sesiones de chat múltiples
-- Permite tener múltiples conversaciones separadas por expediente/reunión

-- Tabla para sesiones de chat
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reunion_id UUID REFERENCES reuniones(id) ON DELETE CASCADE,
    expediente_id UUID REFERENCES expediente(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL DEFAULT 'Nueva conversación',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: debe tener reunion_id O expediente_id, pero no ambos
    CONSTRAINT fk_contexto_session CHECK (
        (reunion_id IS NOT NULL AND expediente_id IS NULL) OR
        (reunion_id IS NULL AND expediente_id IS NOT NULL)
    )
);

-- Agregar session_id a ia_interacciones
ALTER TABLE ia_interacciones
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_reunion ON chat_sessions(reunion_id) WHERE reunion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_expediente ON chat_sessions(expediente_id) WHERE expediente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_interacciones_session ON ia_interacciones(session_id) WHERE session_id IS NOT NULL;

-- Comentarios
COMMENT ON TABLE chat_sessions IS 'Sesiones de chat múltiples para expedientes y reuniones';
COMMENT ON COLUMN chat_sessions.titulo IS 'Título descriptivo de la sesión de chat';
COMMENT ON COLUMN ia_interacciones.session_id IS 'Sesión de chat a la que pertenece esta interacción';
