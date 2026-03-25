/**
 * GET /api/clientes/lookup?nif=B12345678
 *
 * Busca datos de una empresa por su NIF/CIF.
 * Estrategia:
 *   1. Busca en nuestra propia base de datos (si ya es cliente)
 *   2. Consulta la API VIES de la UE (gratuita, oficial) → nombre + dirección
 *
 * Devuelve los datos que encuentre para prerellenar el formulario.
 * Si no encuentra nada, devuelve { found: false }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

interface LookupResult {
  found: boolean;
  fuente?: 'bd' | 'vies';
  nombre_empresa?: string;
  ciudad?: string;
  codigo_postal?: string;
  comunidad_autonoma?: string;
  cnae_codigo?: string;
  cnae_descripcion?: string;
  tamano_empresa?: string;
  num_empleados?: number;
  facturacion_anual?: number;
  actividad?: string;
}

/** Mapeo de prefijos de código postal a Comunidad Autónoma */
const CP_A_CCAA: Record<string, string> = {
  '01': 'País Vasco', '02': 'Castilla-La Mancha', '03': 'Valencia',
  '04': 'Andalucía', '05': 'Castilla y León', '06': 'Extremadura',
  '07': 'Baleares', '08': 'Cataluña', '09': 'Castilla y León',
  '10': 'Extremadura', '11': 'Andalucía', '12': 'Valencia',
  '13': 'Castilla-La Mancha', '14': 'Andalucía', '15': 'Galicia',
  '16': 'Castilla-La Mancha', '17': 'Cataluña', '18': 'Andalucía',
  '19': 'Castilla-La Mancha', '20': 'País Vasco', '21': 'Andalucía',
  '22': 'Aragón', '23': 'Andalucía', '24': 'Castilla y León',
  '25': 'Cataluña', '26': 'La Rioja', '27': 'Galicia',
  '28': 'Madrid', '29': 'Andalucía', '30': 'Murcia',
  '31': 'Navarra', '32': 'Galicia', '33': 'Asturias',
  '34': 'Castilla y León', '35': 'Canarias', '36': 'Galicia',
  '37': 'Castilla y León', '38': 'Canarias', '39': 'Cantabria',
  '40': 'Castilla y León', '41': 'Andalucía', '42': 'Castilla y León',
  '43': 'Cataluña', '44': 'Aragón', '45': 'Castilla-La Mancha',
  '46': 'Valencia', '47': 'Castilla y León', '48': 'País Vasco',
  '49': 'Castilla y León', '50': 'Aragón', '51': 'Ceuta',
  '52': 'Melilla',
};

/** Parsea la dirección que devuelve VIES para extraer CP y ciudad */
function parsearDireccionVies(address: string): { ciudad?: string; codigo_postal?: string; comunidad_autonoma?: string } {
  if (!address) return {};
  // VIES devuelve líneas separadas por \n
  // Típicamente: "CALLE X 1\n28001 MADRID\nESPANA" o "CALLE X 1 28001 MADRID ESPANA"
  const lineas = address.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);

  let codigo_postal: string | undefined;
  let ciudad: string | undefined;

  for (const linea of lineas) {
    // Buscar patrón: 5 dígitos + espacio + nombre ciudad
    const m = linea.match(/^(\d{5})\s+(.+)/);
    if (m) {
      codigo_postal = m[1];
      // Quitar "ESPANA" o "SPAIN" del final si aparece
      ciudad = m[2].replace(/\s*(ESPANA|ESPAÑA|SPAIN)$/i, '').trim();
      break;
    }
  }

  // Si no encontramos el patrón en línea separada, buscar en todo el texto
  if (!codigo_postal) {
    const m = address.match(/(\d{5})\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s+ESPA[ÑN]A|\s+SPAIN|$)/i);
    if (m) {
      codigo_postal = m[1];
      ciudad = m[2].trim();
    }
  }

  const comunidad_autonoma = codigo_postal ? CP_A_CCAA[codigo_postal.slice(0, 2)] : undefined;

  return { ciudad, codigo_postal, comunidad_autonoma };
}

/** Consulta la API VIES de la UE para obtener datos de la empresa */
async function buscarEnVies(nif: string): Promise<Partial<LookupResult> | null> {
  try {
    // VIES acepta CIFs españoles (empresas) y NIFs (autónomos con IVA)
    const nifLimpio = nif.toUpperCase().replace(/\s/g, '');
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/ES/vat/${nifLimpio}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      isValid?: boolean;
      name?: string;
      address?: string;
    };

    if (!data.isValid || !data.name) return null;

    // Limpiar nombre (VIES devuelve en mayúsculas)
    const nombre_empresa = data.name
      .replace(/^---$/, '')
      .trim();

    if (!nombre_empresa || nombre_empresa === '---') return null;

    const { ciudad, codigo_postal, comunidad_autonoma } = parsearDireccionVies(data.address ?? '');

    return { nombre_empresa, ciudad, codigo_postal, comunidad_autonoma, fuente: 'vies' };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const nif = request.nextUrl.searchParams.get('nif')?.toUpperCase().trim();
  if (!nif) return NextResponse.json({ error: 'nif requerido' }, { status: 400 });

  // Si hay sesión activa, también buscamos en nuestra BD
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const sb = createServiceClient();
      const { data: clienteExistente } = await sb
        .from('cliente')
        .select('nombre_empresa, ciudad, codigo_postal, comunidad_autonoma, cnae_codigo, cnae_descripcion, tamano_empresa, num_empleados, facturacion_anual, actividad')
        .eq('nif', nif)
        .maybeSingle();

      if (clienteExistente?.nombre_empresa) {
        return NextResponse.json({ found: true, fuente: 'bd', ...clienteExistente } satisfies LookupResult);
      }
    }
  } catch { /* sin sesión — continuar con VIES */ }

  // Consultar VIES (solo para CIF de empresa: empieza por letra)
  if (/^[A-HJUVNPQRSWKL]/i.test(nif)) {
    const viesData = await buscarEnVies(nif);
    if (viesData?.nombre_empresa) {
      return NextResponse.json({ found: true, ...viesData } satisfies LookupResult);
    }
  }

  return NextResponse.json({ found: false } satisfies LookupResult);
}
