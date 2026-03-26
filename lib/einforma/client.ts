/**
 * lib/einforma/client.ts
 *
 * Cliente para la API eInforma (base de datos de empresas españolas).
 * Documentación: https://api.einforma.com/docs
 *
 * Flujo:
 *   1. POST /oauth2/token  → access_token
 *   2. GET  /empresas/{nif} → datos de la empresa
 */

const EINFORMA_BASE = 'https://api.einforma.com';
const TIMEOUT_MS = 15_000;

// ─── Token (no se cachea entre requests; en Vercel las funciones son stateless) ──

async function getToken(): Promise<string> {
  const clientId     = process.env.EINFORMA_CLIENT_ID!;
  const clientSecret = process.env.EINFORMA_CLIENT_SECRET!;

  const res = await fetch(`${EINFORMA_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`eInforma auth error ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('eInforma: no access_token en respuesta');
  return data.access_token as string;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EInformaEmpresa {
  denominacion:         string | null;
  forma_juridica:       string | null;
  cnae:                 string | null;         // código CNAE 4 dígitos
  cnae_descripcion:     string | null;
  situacion:            string | null;         // activa, inactiva, concursada…
  capital_social:       number | null;         // en euros
  ventas:               number | null;         // última cifra de negocio en euros
  anio_ventas:          number | null;
  empleados:            number | null;
  fecha_constitucion:   string | null;         // YYYY-MM-DD
  fecha_ultimo_balance: string | null;
  cargo_principal:      string | null;         // nombre del administrador/CEO
  cargo_principal_puesto: string | null;
  domicilio_social:     string | null;
  localidad:            string | null;
  comunidad_autonoma:   string | null;
  provincia:            string | null;
  codigo_postal:        string | null;
  telefono:             string[];
  web:                  string[];
  email:                string | null;
}

// ─── Normalización de la respuesta ────────────────────────────────────────────
// eInforma puede devolver distintas estructuras según la versión de API.
// Esta función mapea los campos más comunes a nuestro schema.

function normalizar(raw: Record<string, unknown>): EInformaEmpresa {
  const str  = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const num  = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
  const arr  = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];

  // Fecha constitucion puede venir como "YYYY-MM-DD", "DD/MM/YYYY" o timestamp
  const fecha = (v: unknown): string | null => {
    if (!v) return null;
    const s = String(v).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  // Ventas puede venir como número, string, o dentro de un objeto financiero
  const finanzas = (raw.finanzas as Record<string, unknown>) ?? raw;
  const ventas = num(raw.cifraNegocios) ?? num(raw.ventas) ?? num((finanzas as Record<string, unknown>)?.cifraNegocios);
  const anioVentas = num(raw.anioVentas) ?? num((finanzas as Record<string, unknown>)?.anio);

  // CNAE puede venir como "6201", { codigo: "6201", descripcion: "..." } o similar
  let cnae: string | null = null;
  let cnaeDesc: string | null = null;
  if (typeof raw.cnae === 'string') {
    cnae = raw.cnae;
  } else if (raw.cnae && typeof raw.cnae === 'object') {
    const c = raw.cnae as Record<string, unknown>;
    cnae = str(c.codigo ?? c.code ?? c.cnae);
    cnaeDesc = str(c.descripcion ?? c.description);
  }
  cnaeDesc = cnaeDesc ?? str(raw.cnaeDescripcion ?? raw.actividadDescripcion);

  // Domicilio puede estar en objeto o campos planos
  const dom = (raw.domicilio as Record<string, unknown>) ?? {};
  const localidad = str(dom.localidad ?? dom.ciudad ?? raw.localidad ?? raw.ciudad);
  const provincia = str(dom.provincia ?? raw.provincia);
  const comunidadAutonoma = str(dom.comunidadAutonoma ?? dom.ccaa ?? raw.comunidadAutonoma ?? raw.ccaa);
  const cp = str(dom.codigoPostal ?? raw.codigoPostal ?? raw.cp);

  // Cargo principal
  const cargos = Array.isArray(raw.cargos) ? (raw.cargos as Record<string, unknown>[]) : [];
  const principal = cargos[0] ?? {};

  return {
    denominacion:         str(raw.denominacion ?? raw.razonSocial ?? raw.nombre),
    forma_juridica:       str(raw.formaJuridica ?? raw.tipoSociedad),
    cnae:                 cnae ? cnae.replace(/\./g, '').slice(0, 4) : null,
    cnae_descripcion:     cnaeDesc,
    situacion:            str(raw.situacion ?? raw.estado),
    capital_social:       num(raw.capitalSocial),
    ventas,
    anio_ventas:          anioVentas,
    empleados:            num(raw.empleados ?? raw.numeroEmpleados),
    fecha_constitucion:   fecha(raw.fechaConstitucion),
    fecha_ultimo_balance: fecha(raw.fechaUltimoBalance),
    cargo_principal:      str(principal.nombre ?? principal.name),
    cargo_principal_puesto: str(principal.cargo ?? principal.puesto),
    domicilio_social:     str(dom.direccion ?? raw.domicilioSocial),
    localidad,
    comunidad_autonoma:   comunidadAutonoma,
    provincia,
    codigo_postal:        cp,
    telefono:             arr(raw.telefono ?? raw.telefonos),
    web:                  arr(raw.web ?? raw.webs ?? raw.urls),
    email:                str(raw.email),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Consulta los datos de una empresa por NIF/CIF.
 * Devuelve null si el NIF no existe o la API no está disponible.
 * Nunca lanza — los errores se devuelven como null para no bloquear el registro.
 */
export async function consultarEmpresa(nif: string): Promise<EInformaEmpresa | null> {
  try {
    const token = await getToken();

    const res = await fetch(`${EINFORMA_BASE}/api/v1/empresas/${encodeURIComponent(nif)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`eInforma empresas ${res.status}`);

    const raw = await res.json() as Record<string, unknown>;
    return normalizar(raw);
  } catch (err) {
    // Log en producción sin bloquear al usuario
    console.warn('[eInforma] Error consultando empresa:', nif, (err as Error).message);
    return null;
  }
}
