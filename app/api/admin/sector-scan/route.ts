/**
 * GET /api/admin/sector-scan?cnae=5610&ca=Galicia&tamano=pyme
 *
 * Detecta subvenciones activas para un CNAE + comunidad autónoma.
 * No necesita NIF — sirve para prospección antes de hablar con el cliente.
 *
 * Parámetros:
 *   cnae    — código CNAE 2-4 dígitos (ej: 56, 5610)
 *   ca      — comunidad autónoma del cliente (opcional, ej: Galicia)
 *   tamano  — micropyme | pyme | grande | autonomo (opcional, default: pyme)
 *   limit   — número máximo de resultados (default: 20)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdminOrTramitador } from '@/lib/auth/helpers';

// Normalizar nombre de CA para comparación
function normCA(s: string | null | undefined): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim();
  const aliases: Record<string, string[]> = {
    'Galicia':         ['galicia'],
    'Madrid':          ['madrid', 'comunidad de madrid'],
    'Cataluña':        ['cataluña', 'cataluna', 'catalunya'],
    'Andalucía':       ['andalucía', 'andalucia'],
    'Valencia':        ['valencia', 'comunitat valenciana', 'comunidad valenciana'],
    'Castilla y León': ['castilla y leon', 'castilla y león'],
    'País Vasco':      ['país vasco', 'pais vasco', 'euskadi'],
    'Canarias':        ['canarias'],
    'Aragón':          ['aragón', 'aragon'],
    'Murcia':          ['murcia', 'región de murcia'],
    'Extremadura':     ['extremadura'],
    'Asturias':        ['asturias'],
    'Baleares':        ['baleares', 'illes balears'],
    'Navarra':         ['navarra'],
    'Cantabria':       ['cantabria'],
    'La Rioja':        ['la rioja'],
    'Castilla-La Mancha': ['castilla-la mancha', 'castilla la mancha'],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    if (vals.some(a => lower.includes(a))) return key;
  }
  return s;
}

// Inferir tipos de empresa desde tamaño
function tiposFromTamano(tamano: string): string[] {
  switch (tamano.toLowerCase()) {
    case 'micropyme': case 'microempresa': return ['micropyme', 'pyme'];
    case 'pequeña': case 'mediana': return ['pyme'];
    case 'grande': return ['grande'];
    case 'autonomo': case 'autónomo': return ['autonomo'];
    default: return ['pyme', 'micropyme'];
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrTramitador();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const cnaeRaw = searchParams.get('cnae')?.trim() ?? '';
  const caRaw = searchParams.get('ca')?.trim() ?? '';
  const tamano = searchParams.get('tamano')?.trim() ?? 'pyme';
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  if (!cnaeRaw) return NextResponse.json({ error: 'cnae requerido (ej: 5610 o 56)' }, { status: 400 });

  const cnae4 = cnaeRaw.slice(0, 4).padStart(2, '0');
  const cnae2 = cnaeRaw.slice(0, 2);
  const clienteCA = normCA(caRaw);
  const tiposCliente = tiposFromTamano(tamano);

  const sb = createServiceClient();
  const ahora = new Date();

  // Cargar subvenciones activas con sus sectores, tipos y campos_extraidos
  const { data: subvenciones, error } = await sb
    .from('subvenciones')
    .select(`
      id, titulo, titulo_comercial, organismo, ambito_geografico, comunidad_autonoma,
      estado_convocatoria, importe_maximo, presupuesto_total, porcentaje_financiacion,
      plazo_fin, para_quien, objeto, campos_extraidos
    `)
    .not('estado_convocatoria', 'in', '("cerrada","suspendida","resuelta")')
    .order('importe_maximo', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subvIds = (subvenciones ?? []).map(s => s.id);
  if (!subvIds.length) return NextResponse.json({ resultados: [], total: 0 });

  // Cargar sectores y tipos de empresa
  const [{ data: sectores }, { data: tipos }] = await Promise.all([
    sb.from('subvencion_sectores').select('subvencion_id,cnae_codigo,nombre_sector,excluido').in('subvencion_id', subvIds),
    sb.from('subvencion_tipos_empresa').select('subvencion_id,tipo,excluido').in('subvencion_id', subvIds),
  ]);

  const sectoresMap: Record<string, typeof sectores> = {};
  const tiposMap: Record<string, typeof tipos> = {};
  for (const s of sectores ?? []) {
    if (!sectoresMap[s.subvencion_id]) sectoresMap[s.subvencion_id] = [];
    sectoresMap[s.subvencion_id]!.push(s);
  }
  for (const t of tipos ?? []) {
    if (!tiposMap[t.subvencion_id]) tiposMap[t.subvencion_id] = [];
    tiposMap[t.subvencion_id]!.push(t);
  }

  const resultados: Array<{
    id: string;
    titulo: string;
    organismo: string | null;
    ambito: string | null;
    importe_maximo: number | null;
    porcentaje_financiacion: number | null;
    plazo_fin: string | null;
    estado_convocatoria: string | null;
    encaje: 'directo' | 'probable' | 'posible';
    encaje_razon: string;
    dias_plazo: number | null;
    objeto: string | null;
  }> = [];

  for (const s of subvenciones ?? []) {
    const ce = s.campos_extraidos as Record<string, unknown> | null;
    const subvSectores = sectoresMap[s.id] ?? [];
    const subvTipos = tiposMap[s.id] ?? [];

    // Geografía: hard exclude si autonomico y CA no coincide
    const ca = normCA(s.comunidad_autonoma);
    const ambito = s.ambito_geografico ?? 'desconocido';

    // Verificar también localizacion de campos_extraidos
    const locCE = Array.isArray(ce?.localizacion) ? (ce.localizacion as string[]) : [];
    const esNacionalCE = locCE.some(l => /nacional|estatal/i.test(l));
    const esNacionalAmbito = ['nacional', 'estatal', 'europeo', 'desconocido'].includes(ambito);

    if (!esNacionalAmbito && !esNacionalCE && clienteCA) {
      if (ambito === 'autonomico' && ca && ca !== clienteCA) continue;
      if (locCE.length > 0 && !esNacionalCE) {
        const locNorm = locCE.map(l => normCA(l));
        if (locNorm.some(l => l) && !locNorm.some(l => l === clienteCA)) continue;
      }
    }

    // Verificar plazo no vencido
    let diasPlazo: number | null = null;
    if (s.plazo_fin) {
      diasPlazo = Math.ceil((new Date(s.plazo_fin).getTime() - ahora.getTime()) / 86_400_000);
      if (diasPlazo < 0) continue;
    }

    // CNAE matching — determinar nivel de encaje
    const permitidos = subvSectores.filter(sec => !sec.excluido);
    const excluidos = subvSectores.filter(sec => sec.excluido);

    // Hard exclude: CNAE del cliente en excluidos
    const cnaeExcluido = excluidos.some(sec => sec.cnae_codigo?.slice(0, 4) === cnae4 || sec.cnae_codigo?.slice(0, 2) === cnae2);
    if (cnaeExcluido) continue;

    // Verificar campos_extraidos.cnae_excluidos
    const cnaesExclCE = Array.isArray(ce?.cnae_excluidos) ? (ce.cnae_excluidos as string[]) : [];
    if (cnaesExclCE.some(c => String(c).slice(0, 4) === cnae4 || String(c).slice(0, 2) === cnae2)) continue;

    // Nivel de encaje en CNAE
    let cnaeEncaje: 'directo' | 'probable' | 'posible' = 'posible';
    let encajeRazon = '';

    const cnaesInclCE = ce?.cnae_incluidos === 'todos' ? 'todos' :
      Array.isArray(ce?.cnae_incluidos) ? (ce.cnae_incluidos as string[]) : null;

    if (cnaesInclCE === 'todos' || (!cnaesInclCE && !permitidos.length)) {
      cnaeEncaje = 'probable';
      encajeRazon = 'Abierta a todos los sectores';
    } else if (Array.isArray(cnaesInclCE)) {
      const match4 = (cnaesInclCE as string[]).some(c => String(c).slice(0, 4) === cnae4);
      const match2 = (cnaesInclCE as string[]).some(c => String(c).slice(0, 2) === cnae2);
      if (match4) { cnaeEncaje = 'directo'; encajeRazon = `CNAE ${cnae4} incluido directamente`; }
      else if (match2) { cnaeEncaje = 'probable'; encajeRazon = `División CNAE ${cnae2} incluida`; }
      else { cnaeEncaje = 'posible'; encajeRazon = 'Sector no especificado en el PDF'; }
    } else if (permitidos.length) {
      const match4 = permitidos.some(sec => sec.cnae_codigo?.slice(0, 4) === cnae4);
      const match2 = permitidos.some(sec => sec.cnae_codigo?.slice(0, 2) === cnae2);
      if (match4) { cnaeEncaje = 'directo'; encajeRazon = `CNAE ${cnae4} encaja directamente`; }
      else if (match2) { cnaeEncaje = 'probable'; encajeRazon = `División CNAE ${cnae2} dentro del ámbito`; }
      else { encajeRazon = 'Otros sectores'; } // posible
    }

    // Tipo empresa matching
    const tiposPermitidos = subvTipos.filter(t => !t.excluido);
    const tiposExcluidos = subvTipos.filter(t => t.excluido);

    const tipoExcluido = tiposExcluidos.some(t => tiposCliente.includes(t.tipo));
    if (tipoExcluido) continue;

    // Verificar beneficiarios_tipo de campos_extraidos
    const benTipoCE = ce?.beneficiarios_tipo as string | null;
    if (benTipoCE && benTipoCE !== 'pyme') {
      const TIPO_MAP: Record<string, string> = {
        'autónomos': 'autonomo', 'autonomos': 'autonomo', 'micropyme': 'micropyme',
        'gran_empresa': 'grande', 'grande': 'grande',
      };
      const tipoCE = TIPO_MAP[benTipoCE] ?? 'pyme';
      if (!tiposCliente.includes(tipoCE) && tipoCE !== 'pyme') {
        encajeRazon += encajeRazon ? ` · orientada a ${benTipoCE}` : `Orientada a ${benTipoCE}`;
        if (cnaeEncaje === 'directo') cnaeEncaje = 'probable';
      }
    } else if (tiposPermitidos.length > 0) {
      const tipoMatch = tiposPermitidos.some(t => tiposCliente.includes(t.tipo));
      if (!tipoMatch && tiposPermitidos.length > 0) {
        encajeRazon += encajeRazon ? ` · tipo empresa no exacto` : 'Tipo empresa no exacto';
        if (cnaeEncaje === 'directo') cnaeEncaje = 'probable';
      }
    }

    resultados.push({
      id: s.id,
      titulo: s.titulo_comercial || s.titulo || '',
      organismo: s.organismo,
      ambito: s.ambito_geografico,
      importe_maximo: s.importe_maximo,
      porcentaje_financiacion: s.porcentaje_financiacion,
      plazo_fin: s.plazo_fin,
      estado_convocatoria: s.estado_convocatoria,
      encaje: cnaeEncaje,
      encaje_razon: encajeRazon || 'Pendiente de verificar bases',
      dias_plazo: diasPlazo,
      objeto: s.objeto ? String(s.objeto).slice(0, 200) : null,
    });
  }

  // Ordenar: directas primero, luego por importe
  resultados.sort((a, b) => {
    const orden = { directo: 0, probable: 1, posible: 2 };
    const diff = orden[a.encaje] - orden[b.encaje];
    if (diff !== 0) return diff;
    return (b.importe_maximo ?? 0) - (a.importe_maximo ?? 0);
  });

  const top = resultados.slice(0, limit);

  // Resumen estadístico
  const importeTotal = top.filter(r => r.encaje !== 'posible').reduce((s, r) => s + (r.importe_maximo ?? 0), 0);
  const directas = top.filter(r => r.encaje === 'directo').length;
  const probables = top.filter(r => r.encaje === 'probable').length;

  return NextResponse.json({
    query: { cnae: cnaeRaw, ca: caRaw || 'España', tamano },
    resumen: {
      total_encontradas: resultados.length,
      directas,
      probables,
      importe_maximo_total: importeTotal,
      mensaje_ventas: resultados.length > 0
        ? `Para CNAE ${cnaeRaw}${caRaw ? ` en ${caRaw}` : ''} hay ${resultados.length} subvenciones activas: ${directas} directas y ${probables} probables, con un importe máximo combinado de ${importeTotal.toLocaleString('es-ES')} €.`
        : `No se detectan subvenciones activas para CNAE ${cnaeRaw}${caRaw ? ` en ${caRaw}` : ''} en este momento.`,
    },
    resultados: top,
  });
}
