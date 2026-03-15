-- Tabla cliente
CREATE TABLE IF NOT EXISTS public.cliente (
    nif TEXT PRIMARY KEY,
    nombre_normalizado TEXT,
    email_normalizado TEXT,
    tamano_empresa TEXT,
    actividad TEXT,
    domicilio_fiscal TEXT,
    codigo_postal TEXT,
    ciudad TEXT,
    telefono TEXT,
    origen TEXT,
    acepta_terminos BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla einforma (datos empresariales enriquecidos)
CREATE TABLE IF NOT EXISTS public.einforma (
    nif TEXT PRIMARY KEY REFERENCES public.cliente(nif) ON DELETE CASCADE,
    denominacion TEXT,
    forma_juridica TEXT,
    cnae TEXT,
    situacion TEXT,
    capital_social NUMERIC,
    ventas NUMERIC,
    anio_ventas INTEGER,
    empleados INTEGER,
    fecha_constitucion DATE,
    fecha_ultimo_balance DATE,
    cargo_principal TEXT,
    cargo_principal_puesto TEXT,
    domicilio_social TEXT,
    localidad TEXT,
    telefono TEXT[],
    web TEXT[],
    email TEXT
);

-- Tabla ayudas
CREATE TABLE IF NOT EXISTS public.ayudas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_bdns INTEGER UNIQUE,
    titulo TEXT NOT NULL,
    organismo TEXT,
    descripcion TEXT,
    requisitos TEXT,
    importe_max NUMERIC,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado TEXT CHECK (estado IN ('abierta', 'cerrada', 'proxima', 'suspendida')),
    url_oficial TEXT,
    analisis_ia TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla expediente
CREATE TABLE IF NOT EXISTS public.expediente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nif TEXT NOT NULL REFERENCES public.cliente(nif) ON DELETE CASCADE,
    numero_bdns INTEGER,
    estado TEXT CHECK (estado IN ('lead_caliente', 'en_proceso', 'presentado', 'resuelto', 'descartado')),
    drive_folder_id TEXT,
    drive_folder_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla matches
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nif TEXT NOT NULL REFERENCES public.cliente(nif) ON DELETE CASCADE,
    ayuda_id UUID NOT NULL REFERENCES public.ayudas(id) ON DELETE CASCADE,
    estado TEXT CHECK (estado IN ('interesante', 'revisar', 'descartada', 'rentable')),
    puntuacion INTEGER CHECK (puntuacion >= 1 AND puntuacion <= 10),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla checklist_items
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES public.expediente(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    completado BOOLEAN DEFAULT false,
    obligatorio BOOLEAN DEFAULT false,
    notas TEXT,
    orden INTEGER
);

-- Tabla documentos
CREATE TABLE IF NOT EXISTS public.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT,
    storage_path TEXT,
    nif TEXT REFERENCES public.cliente(nif) ON DELETE CASCADE,
    expediente_id UUID REFERENCES public.expediente(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla notas
CREATE TABLE IF NOT EXISTS public.notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contenido TEXT NOT NULL,
    nif TEXT REFERENCES public.cliente(nif) ON DELETE CASCADE,
    expediente_id UUID REFERENCES public.expediente(id) ON DELETE CASCADE,
    ayuda_id UUID REFERENCES public.ayudas(id) ON DELETE CASCADE,
    autor_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_expediente_nif ON public.expediente(nif);
CREATE INDEX IF NOT EXISTS idx_matches_nif ON public.matches(nif);
CREATE INDEX IF NOT EXISTS idx_matches_ayuda_id ON public.matches(ayuda_id);
CREATE INDEX IF NOT EXISTS idx_checklist_expediente ON public.checklist_items(expediente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_nif ON public.documentos(nif);
CREATE INDEX IF NOT EXISTS idx_documentos_expediente ON public.documentos(expediente_id);
CREATE INDEX IF NOT EXISTS idx_notas_nif ON public.notas(nif);
CREATE INDEX IF NOT EXISTS idx_notas_expediente ON public.notas(expediente_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ayudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
