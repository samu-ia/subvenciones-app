-- Canal de notificaciones (email, whatsapp)
-- Una fila por canal. config guarda las credenciales del proveedor.

CREATE TABLE IF NOT EXISTS public.notif_channels (
  canal        text PRIMARY KEY,          -- 'email' | 'whatsapp'
  provider     text,                       -- 'resend' | 'twilio'
  enabled      boolean NOT NULL DEFAULT false,
  from_name    text,                       -- "AyudaPyme"
  from_address text,                       -- email o número WhatsApp con prefijo país
  config       jsonb   NOT NULL DEFAULT '{}',  -- { api_key } o { account_sid, auth_token }
  updated_at   timestamptz DEFAULT now()
);

-- Seed con filas vacías para que los ajustes siempre tengan algo que mostrar
INSERT INTO public.notif_channels (canal, provider, enabled, from_name, from_address, config)
VALUES
  ('email',    'resend',  false, 'AyudaPyme', '', '{}'),
  ('whatsapp', 'twilio',  false, 'AyudaPyme', '', '{}')
ON CONFLICT (canal) DO NOTHING;

-- Solo admins pueden leer/escribir
ALTER TABLE public.notif_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_channels_admin" ON public.notif_channels
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'admin'));
