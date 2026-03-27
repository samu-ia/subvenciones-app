/**
 * lib/billing/generate-invoice.ts
 *
 * Genera factura PDF para success-fee de AyudaPyme.
 * - Número secuencial formato AYP-YYYY-XXXX
 * - PDF profesional vía Puppeteer (HTML → PDF)
 * - Sube a Supabase Storage bucket 'archivos'
 * - Retorna { factura_numero, factura_url, pdf_buffer }
 */

import { createServiceClient } from '@/lib/supabase/service';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

export interface InvoiceData {
  expedienteId: string;
  /** NIF del cliente */
  nif: string;
  /** Nombre de la empresa cliente */
  nombreEmpresa: string;
  /** Dirección fiscal */
  direccion?: string;
  /** Ciudad */
  ciudad?: string;
  /** Código postal */
  codigoPostal?: string;
  /** Título de la subvención */
  tituloSubvencion: string;
  /** Importe concedido al cliente */
  importeConcedido: number;
  /** Fee calculado (15% del importe, mín 300€) */
  feeAmount: number;
}

export interface InvoiceResult {
  factura_numero: string;
  factura_url: string;
  pdf_buffer: Buffer;
}

// ──────────────────────────────────────────────────────────────────────────────
// Número secuencial
// ──────────────────────────────────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const sb = createServiceClient();
  const year = new Date().getFullYear();
  const prefix = `AYP-${year}-`;

  // Buscar el último número de factura del año actual
  const { data } = await sb
    .from('expediente')
    .select('factura_numero')
    .like('factura_numero', `${prefix}%`)
    .order('factura_numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1;
  if (data?.factura_numero) {
    const lastSeq = parseInt(data.factura_numero.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Formateo
// ──────────────────────────────────────────────────────────────────────────────

function fmtEUR(n: number): string {
  return n.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML de factura
// ──────────────────────────────────────────────────────────────────────────────

function buildInvoiceHTML(data: InvoiceData, facturaNumero: string): string {
  const fecha = fmtDate(new Date());
  const baseImponible = data.feeAmount;
  const iva = baseImponible * 0.21;
  const total = baseImponible + iva;

  const clienteDir = [
    data.direccion,
    [data.codigoPostal, data.ciudad].filter(Boolean).join(' '),
  ].filter(Boolean).join('<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, sans-serif;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.5;
    padding: 48px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 3px solid #0d1f3c;
  }
  .brand { font-size: 28px; font-weight: 900; color: #0d1f3c; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 22px; color: #0d9488; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-num { font-size: 14px; color: #475569; margin-top: 4px; font-weight: 600; }
  .invoice-date { font-size: 12px; color: #94a3b8; margin-top: 2px; }

  .parties {
    display: flex;
    justify-content: space-between;
    margin-bottom: 36px;
    gap: 40px;
  }
  .party { flex: 1; }
  .party-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
  .party-name { font-weight: 700; font-size: 15px; color: #0d1f3c; }
  .party-detail { font-size: 12px; color: #475569; margin-top: 4px; }

  .concept-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }
  .concept-label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
  .concept-text { font-size: 13px; color: #334155; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th {
    background: #0d1f3c;
    color: #fff;
    padding: 10px 16px;
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }
  thead th:last-child { text-align: right; }
  tbody td {
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 13px;
  }
  tbody td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

  .totals {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 40px;
  }
  .totals-table { width: 280px; }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
    color: #475569;
  }
  .totals-row.total {
    border-top: 2px solid #0d1f3c;
    margin-top: 8px;
    padding-top: 12px;
    font-size: 18px;
    font-weight: 900;
    color: #0d1f3c;
  }

  .payment {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 32px;
  }
  .payment-title { font-size: 11px; text-transform: uppercase; color: #059669; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; }
  .payment-detail { font-size: 12px; color: #334155; }

  .footer {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #94a3b8;
    text-align: center;
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand">AyudaPyme</div>
    <div class="brand-sub">Gestión de subvenciones para PYMEs</div>
    <div class="party-detail" style="margin-top:8px">
      AyudaPyme S.L.<br>
      CIF: B12345678<br>
      Madrid, España
    </div>
  </div>
  <div class="invoice-title">
    <h1>Factura</h1>
    <div class="invoice-num">${facturaNumero}</div>
    <div class="invoice-date">${fecha}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-label">Facturar a</div>
    <div class="party-name">${escapeHtml(data.nombreEmpresa)}</div>
    <div class="party-detail">
      NIF: ${escapeHtml(data.nif)}<br>
      ${clienteDir || 'España'}
    </div>
  </div>
</div>

<div class="concept-box">
  <div class="concept-label">Concepto</div>
  <div class="concept-text">
    Comisión de éxito (success fee) por gestión de subvención:<br>
    <strong>${escapeHtml(data.tituloSubvencion)}</strong>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Descripción</th>
      <th>Importe</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        Comisión del 15% sobre importe concedido de ${fmtEUR(data.importeConcedido)}<br>
        <span style="font-size:11px;color:#94a3b8">(Mínimo 300 €. Según acuerdo de servicio.)</span>
      </td>
      <td>${fmtEUR(baseImponible)}</td>
    </tr>
  </tbody>
</table>

<div class="totals">
  <div class="totals-table">
    <div class="totals-row">
      <span>Base imponible</span>
      <span>${fmtEUR(baseImponible)}</span>
    </div>
    <div class="totals-row">
      <span>IVA (21%)</span>
      <span>${fmtEUR(iva)}</span>
    </div>
    <div class="totals-row total">
      <span>Total</span>
      <span>${fmtEUR(total)}</span>
    </div>
  </div>
</div>

<div class="payment">
  <div class="payment-title">Forma de pago</div>
  <div class="payment-detail">
    Transferencia bancaria en un plazo de 30 días desde la fecha de emisión.<br>
    Los datos bancarios se proporcionarán por email.
  </div>
</div>

<div class="footer">
  AyudaPyme S.L. · CIF B12345678 · Inscrita en el Registro Mercantil de Madrid<br>
  Este documento es una factura válida a efectos fiscales.
</div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────────────────────
// Generación de PDF con Puppeteer
// ──────────────────────────────────────────────────────────────────────────────

async function htmlToPdf(html: string): Promise<Buffer> {
  // Dynamic import para no cargar puppeteer si no se necesita
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Subida a Storage
// ──────────────────────────────────────────────────────────────────────────────

async function uploadInvoice(
  facturaNumero: string,
  expedienteId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const sb = createServiceClient();
  const storagePath = `facturas/${expedienteId}/${facturaNumero}.pdf`;

  const { error: uploadErr } = await sb.storage
    .from('archivos')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Error subiendo factura a Storage: ${uploadErr.message}`);
  }

  // Generar URL pública firmada (válida 10 años = ~315360000 seg)
  const { data: signedData, error: signErr } = await sb.storage
    .from('archivos')
    .createSignedUrl(storagePath, 315360000);

  if (signErr || !signedData?.signedUrl) {
    // Fallback: devolver la ruta interna
    return `storage://archivos/${storagePath}`;
  }

  return signedData.signedUrl;
}

// ──────────────────────────────────────────────────────────────────────────────
// Función principal exportada
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera factura PDF, la sube a Storage y devuelve los datos.
 * NO actualiza la tabla expediente (eso lo hace el caller).
 */
export async function generateInvoice(data: InvoiceData): Promise<InvoiceResult> {
  // 1. Obtener número de factura secuencial
  const facturaNumero = await nextInvoiceNumber();

  // 2. Generar HTML
  const html = buildInvoiceHTML(data, facturaNumero);

  // 3. Convertir a PDF
  const pdfBuffer = await htmlToPdf(html);

  // 4. Subir a Supabase Storage
  const facturaUrl = await uploadInvoice(facturaNumero, data.expedienteId, pdfBuffer);

  console.log(`[billing] Factura ${facturaNumero} generada para expediente ${data.expedienteId} (${pdfBuffer.length} bytes)`);

  return {
    factura_numero: facturaNumero,
    factura_url: facturaUrl,
    pdf_buffer: pdfBuffer,
  };
}
