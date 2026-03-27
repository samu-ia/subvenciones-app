import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Importación dinámica para evitar problemas de bundling
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    pages.push(pageText);
  }
  return pages.join('\n');
}

/**
 * POST /api/archivos/extract-text
 * Descarga el archivo de Supabase Storage, extrae el texto y lo guarda en texto_extraido
 */
export async function POST(request: NextRequest) {
  try {
    const { archivoId } = await request.json();
    if (!archivoId) return NextResponse.json({ error: 'Falta archivoId' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Obtener metadata del archivo
    const { data: archivo, error: fetchErr } = await supabase
      .from('archivos')
      .select('id, nombre, storage_path, mime_type, texto_extraido')
      .eq('id', archivoId)
      .single();

    if (fetchErr || !archivo) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });

    // Si ya tiene texto, devolver directamente
    if (archivo.texto_extraido) {
      return NextResponse.json({ texto: archivo.texto_extraido, cached: true });
    }

    // Solo procesar PDFs y texto plano
    const mime = archivo.mime_type ?? '';
    if (!mime.includes('pdf') && !mime.includes('text')) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado para extracción', mime }, { status: 422 });
    }

    // Descargar el archivo de Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('archivos')
      .download(archivo.storage_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: 'Error descargando archivo: ' + dlErr?.message }, { status: 500 });
    }

    let textoExtraido = '';

    if (mime.includes('pdf')) {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      textoExtraido = await extractPdfText(buffer);
    } else if (mime.includes('text')) {
      textoExtraido = await fileData.text();
    }

    // Verificar si se extrajo algo de texto (PDFs escaneados pueden dar resultado vacío)
    const textoLimpio = textoExtraido.trim();
    if (!textoLimpio) {
      return NextResponse.json({
        error: 'No se pudo extraer texto del archivo. Es posible que sea un PDF escaneado sin capa de texto (imagen). Prueba a subir el documento en formato Word o texto plano.',
        vacio: true,
      }, { status: 422 });
    }

    // Truncar a 50.000 chars para no saturar el contexto
    if (textoLimpio.length > 50000) {
      textoExtraido = textoLimpio.substring(0, 50000) + '\n[... texto truncado ...]';
    } else {
      textoExtraido = textoLimpio;
    }

    // Guardar en la BD
    await supabase
      .from('archivos')
      .update({ texto_extraido: textoExtraido })
      .eq('id', archivoId);

    return NextResponse.json({ texto: textoExtraido, cached: false });

  } catch (err) {
    console.error('[extract-text] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
