'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import {
  ArrowLeft, Check, CheckCircle, Clock, Upload, Loader2,
  FileText, Send, Bot, User, Paperclip, ExternalLink,
  AlertTriangle, CreditCard, X,
  Building2, Zap, Info,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ExpedienteData {
  id: string;
  nif: string;
  numero_bdns?: number;
  estado: string;
  fase?: string;
  fase_updated_at?: string;
  titulo?: string;
  organismo?: string;
  notas?: string;
  subvencion_id?: string;
  plazo_solicitud?: string;
  fecha_presentacion?: string;
  fecha_resolucion_provisional?: string;
  fecha_resolucion_definitiva?: string;
  plazo_aceptacion?: string;
  fecha_inicio_ejecucion?: string;
  fecha_fin_ejecucion?: string;
  plazo_justificacion?: string;
  fecha_cobro?: string;
  importe_solicitado?: number;
  importe_concedido?: number;
  fee_amount?: number;
  fee_estado?: string;
  contrato_firmado?: boolean;
  created_at: string;
  updated_at?: string;
}

interface SubvencionData {
  id: string;
  bdns_id?: string;
  titulo?: string;
  titulo_comercial?: string;
  organismo?: string;
  importe_maximo?: number;
  presupuesto_total?: number;
  porcentaje_financiacion?: number;
  plazo_fin?: string;
  objeto?: string;
  resumen_ia?: string;
  para_quien?: string;
  url_oficial?: string;
  estado_convocatoria?: string;
}

interface FaseData {
  id: string;
  fase: string;
  orden: number;
  fecha_inicio: string;
  fecha_completada: string | null;
}

interface ChecklistItem {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  obligatorio: boolean;
  completado: boolean;
  orden: number;
}

interface MensajeGestor {
  id: string;
  remitente: 'cliente' | 'gestor' | 'ia';
  contenido: string;
  leido: boolean;
  created_at: string;
}

// ─── Colores ──────────────────────────────────────────────────────────────────

const C = {
  navy: '#0d1f3c', teal: '#0d9488', bg: '#f4f6fb',
  surface: '#fff', border: '#e8ecf4', ink: '#0d1f3c',
  ink2: '#475569', muted: '#94a3b8', green: '#059669',
  amber: '#d97706', red: '#dc2626', blue: '#1d4ed8',
  fire: '#f97316',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtE(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
  return `${n.toLocaleString('es-ES')} €`;
}
function diasRestantes(s?: string) {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
}

// ─── Constantes de fases ──────────────────────────────────────────────────────

const TODAS_FASES = [
  { key: 'preparacion',             label: 'Documentación',      desc: 'Preparación de la memoria y documentos' },
  { key: 'presentada',              label: 'Presentación',       desc: 'Envío oficial a la administración' },
  { key: 'instruccion',             label: 'Instrucción',        desc: 'Revisión por la administración' },
  { key: 'resolucion_provisional',  label: 'Res. provisional',   desc: 'Resolución provisional emitida' },
  { key: 'alegaciones',             label: 'Alegaciones',        desc: 'Plazo de alegaciones' },
  { key: 'resolucion_definitiva',   label: 'Res. definitiva',    desc: 'Resolución definitiva emitida' },
  { key: 'aceptacion',              label: 'Aceptación',         desc: 'Aceptación formal de la subvención' },
  { key: 'ejecucion',               label: 'Ejecución',          desc: 'Ejecución del proyecto subvencionado' },
  { key: 'justificacion',           label: 'Justificación',      desc: 'Presentación de justificación de gastos' },
  { key: 'cobro',                   label: 'Cobro',              desc: 'Recepción del importe concedido' },
];

const FASES_KEYS = TODAS_FASES.map(f => f.key);

// ─── Datos bancarios AyudaPyme ───────────────────────────────────────────────

const AYUDAPYME_IBAN = 'ES12 3456 7890 1234 5678 9012';
const AYUDAPYME_TITULAR = 'AyudaPyme Gestión S.L.';
const AYUDAPYME_CONCEPTO_PREFIX = 'Fee expediente';

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expediente, setExpediente] = useState<ExpedienteData | null>(null);
  const [subvencion, setSubvencion] = useState<SubvencionData | null>(null);
  const [fases, setFases] = useState<FaseData[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [mensajes, setMensajes] = useState<MensajeGestor[]>([]);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // Chat state
  const [textoChat, setTextoChat] = useState('');
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [archivoChat, setArchivoChat] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ─── Cargar datos ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    loadExpediente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadExpediente() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/expediente/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 || res.status === 403) {
          setError('No tienes acceso a este expediente o no existe.');
        } else {
          setError(data.error ?? 'Error al cargar el expediente');
        }
        return;
      }
      const data = await res.json();
      setExpediente(data.expediente);
      setSubvencion(data.subvencion);
      setFases(data.fases);
      setChecklist(data.checklist);
      setMensajes(data.mensajes);
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-scroll chat
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ─── Subir documento ──────────────────────────────────────────────────────

  async function subirDocumento(item: ChecklistItem, file: File) {
    if (!expediente) return;

    // Validación backend: tipo y tamaño
    const MAX_SIZE_MB = 20;
    const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`El archivo supera el máximo permitido (${MAX_SIZE_MB} MB)`);
      return;
    }
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      showToast('Tipo de archivo no permitido. Sube PDF, imagen, Word o Excel.');
      return;
    }

    setSubiendoDoc(item.id);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${expediente.nif}/${expediente.id}/${item.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      // Marcar como completado via API (service role, evita RLS)
      const res = await fetch(`/api/portal/expediente/${expediente.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, completado: true, storage_path: path }),
      });
      if (!res.ok) throw new Error('Error al marcar documento como completado');

      setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, completado: true } : i));
      showToast('Documento subido correctamente');
    } catch {
      showToast('Error al subir el documento. Inténtalo de nuevo.');
    } finally {
      setSubiendoDoc(null);
    }
  }

  // ─── Enviar mensaje ───────────────────────────────────────────────────────

  async function enviarMensaje() {
    if ((!textoChat.trim() && !archivoChat) || enviandoChat) return;
    setEnviandoChat(true);
    try {
      let res: Response;
      if (archivoChat) {
        const fd = new FormData();
        fd.append('contenido', textoChat.trim() || `[Archivo adjunto: ${archivoChat.name}]`);
        fd.append('adjunto', archivoChat);
        res = await fetch('/api/portal/gestor', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/portal/gestor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: textoChat.trim() }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
      }
      setTextoChat('');
      setArchivoChat(null);
    } catch {
      showToast('Error al enviar mensaje');
    } finally {
      setEnviandoChat(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} color={C.teal} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, color: C.muted, fontSize: '0.9rem' }}>Cargando expediente…</p>
        </div>
      </div>
    );
  }

  if (error || !expediente) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 20 }}>
          <AlertTriangle size={40} color={C.amber} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: '1rem', fontWeight: 700, color: C.navy, marginBottom: 8 }}>{error || 'Expediente no encontrado'}</p>
          <button
            onClick={() => router.push('/portal')}
            style={{ background: C.navy, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}
          >
            <ArrowLeft size={14} /> Volver al portal
          </button>
        </div>
      </div>
    );
  }

  // ─── Datos derivados ──────────────────────────────────────────────────────

  const titulo = subvencion?.titulo_comercial ?? expediente.titulo ?? (expediente.numero_bdns ? `Subvención BDNS #${expediente.numero_bdns}` : 'Expediente en gestión');
  const organismoDisplay = subvencion?.organismo ?? expediente.organismo;
  const importeMax = subvencion?.importe_maximo;
  const faseActual = expediente.fase ?? 'preparacion';
  const fasesMap = new Map(fases.map(f => [f.fase, f]));
  const idxActual = FASES_KEYS.indexOf(faseActual);

  const completados = checklist.filter(i => i.completado).length;
  const totalChecklist = checklist.length;
  const pctChecklist = totalChecklist > 0 ? Math.round((completados / totalChecklist) * 100) : 0;

  const isDone = (key: string, idx: number) => {
    const faseDb = fasesMap.get(key);
    if (faseDb) return faseDb.fecha_completada != null;
    return idx < idxActual;
  };
  const isCurrent = (key: string, idx: number) => {
    if (key === faseActual) return true;
    if (fasesMap.size === 0) return idx === idxActual;
    return false;
  };

  // Próximos pasos del cliente
  const proximosPasos = calcularProximosPasos(expediente, checklist, faseActual);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/portal')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', fontWeight: 600, padding: '4px 8px', borderRadius: 8 }}
          >
            <ArrowLeft size={16} /> Portal
          </button>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <span style={{ fontSize: '0.82rem', color: C.ink2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titulo}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 20px' }}>

        {/* ── 1. HEADER ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? '20px 16px' : '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 800, color: C.navy, margin: 0, lineHeight: 1.3 }}>
                {titulo}
              </h1>
              {organismoDisplay && (
                <div style={{ fontSize: '0.82rem', color: C.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Building2 size={13} /> {organismoDisplay}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {importeMax && (
                  <span style={{ background: '#ecfdf5', color: C.green, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={12} /> Hasta {fmtE(importeMax)}
                  </span>
                )}
                {subvencion?.porcentaje_financiacion && (
                  <span style={{ background: '#eff6ff', color: C.blue, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                    {subvencion.porcentaje_financiacion}% financiación
                  </span>
                )}
                {subvencion?.url_oficial && (
                  <a href={subvencion.url_oficial} target="_blank" rel="noopener noreferrer"
                    style={{ background: '#f8fafc', color: C.ink2, borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${C.border}` }}>
                    <ExternalLink size={11} /> Ver convocatoria
                  </a>
                )}
              </div>
            </div>

            {/* Fechas clave */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {expediente.plazo_solicitud && (() => {
                const d = diasRestantes(expediente.plazo_solicitud);
                return (
                  <div style={{ background: d !== null && d <= 7 ? '#fef2f2' : '#fefce8', border: `1px solid ${d !== null && d <= 7 ? '#fecaca' : '#fde68a'}`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: '0.68rem', color: d !== null && d <= 7 ? C.red : C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plazo</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: C.navy }}>{fmt(expediente.plazo_solicitud)}</div>
                    {d !== null && d > 0 && <div style={{ fontSize: '0.72rem', color: d <= 14 ? C.red : C.muted, fontWeight: 700 }}>{d} días</div>}
                  </div>
                );
              })()}
              {expediente.importe_concedido && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '0.68rem', color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concedido</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: C.green }}>{fmtE(expediente.importe_concedido)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. TIMELINE DE FASES ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color={C.teal} /> Proceso de tramitación
          </div>

          {/* Fases terminales */}
          {(faseActual === 'denegada' || faseActual === 'desistida') ? (
            <div style={{
              background: faseActual === 'denegada' ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${faseActual === 'denegada' ? '#fecaca' : C.border}`,
              borderRadius: 12, padding: '16px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: faseActual === 'denegada' ? C.red : C.muted }}>
                {faseActual === 'denegada' ? 'Solicitud denegada' : 'Expediente desistido'}
              </div>
              <div style={{ fontSize: '0.82rem', color: C.ink2, marginTop: 6 }}>
                {faseActual === 'denegada'
                  ? 'La solicitud no fue aprobada en esta convocatoria. Contacta con tu gestor para explorar alternativas.'
                  : 'Se ha desistido de este expediente.'}
              </div>
            </div>
          ) : !isMobile ? (
            /* Desktop: timeline horizontal */
            <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
              {TODAS_FASES.map((fase, idx) => {
                const faseDb = fasesMap.get(fase.key);
                const done = isDone(fase.key, idx);
                const current = isCurrent(fase.key, idx);
                const isLast = idx === TODAS_FASES.length - 1;
                const nextDone = !isLast && isDone(TODAS_FASES[idx + 1].key, idx + 1);
                const nextCurrent = !isLast && isCurrent(TODAS_FASES[idx + 1].key, idx + 1);

                return (
                  <div key={fase.key} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? '0 0 auto' : '1 1 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 68 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: done ? '#059669' : current ? '#f59e0b' : '#e2e8f0',
                        border: `2.5px solid ${done ? '#059669' : current ? '#f59e0b' : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.3s',
                        boxShadow: current ? '0 0 0 4px rgba(245,158,11,0.2)' : 'none',
                      }}>
                        {done
                          ? <Check size={15} color="#fff" strokeWidth={3} />
                          : <span style={{ width: current ? 10 : 6, height: current ? 10 : 6, borderRadius: '50%', background: current ? '#fff' : '#cbd5e1', display: 'block' }} />
                        }
                      </div>
                      <div style={{
                        fontSize: '0.65rem', fontWeight: current ? 800 : 600,
                        color: done ? '#059669' : current ? '#1a3561' : '#94a3b8',
                        textAlign: 'center', marginTop: 6, lineHeight: 1.2, maxWidth: 78,
                      }}>
                        {fase.label}
                      </div>
                      {done && faseDb?.fecha_completada && (
                        <div style={{ fontSize: '0.58rem', color: '#059669', marginTop: 2, fontWeight: 600 }}>
                          {new Date(faseDb.fecha_completada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                      {current && (
                        <div style={{ fontSize: '0.58rem', color: '#f59e0b', marginTop: 2, fontWeight: 700 }}>En curso</div>
                      )}
                    </div>
                    {!isLast && (
                      <div style={{
                        height: 3, flex: 1, marginTop: 14.5,
                        background: done && (nextDone || nextCurrent) ? '#059669' : '#e2e8f0',
                        borderRadius: 2, minWidth: 8, transition: 'background 0.3s',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mobile: timeline vertical */
            <div>
              {TODAS_FASES.map((fase, idx) => {
                const faseDb = fasesMap.get(fase.key);
                const done = isDone(fase.key, idx);
                const current = isCurrent(fase.key, idx);
                const isLast = idx === TODAS_FASES.length - 1;

                return (
                  <div key={fase.key} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: done ? '#059669' : current ? '#f59e0b' : '#e2e8f0',
                        border: `2.5px solid ${done ? '#059669' : current ? '#f59e0b' : '#cbd5e1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: current ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none',
                      }}>
                        {done
                          ? <Check size={13} color="#fff" strokeWidth={3} />
                          : <span style={{ width: current ? 8 : 5, height: current ? 8 : 5, borderRadius: '50%', background: current ? '#fff' : '#cbd5e1', display: 'block' }} />
                        }
                      </div>
                      {!isLast && (
                        <div style={{ width: 2, flex: 1, background: done ? '#059669' : '#e2e8f0', marginTop: 4, borderRadius: 1 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 2, flex: 1 }}>
                      <div style={{
                        fontSize: '0.83rem', fontWeight: current ? 800 : 600,
                        color: done ? '#059669' : current ? '#1a3561' : '#94a3b8',
                      }}>
                        {fase.label}
                        {current && <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700, marginLeft: 8 }}>En curso</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>{fase.desc}</div>
                      {done && faseDb?.fecha_completada && (
                        <div style={{ fontSize: '0.68rem', color: '#059669', marginTop: 2, fontWeight: 600 }}>
                          Completada el {new Date(faseDb.fecha_completada).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Grid 2 columnas en desktop */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* ── 3. DOCUMENTOS REQUERIDOS ── */}
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? '16px' : '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color={C.teal} /> Documentación
              </div>
              {totalChecklist > 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pctChecklist === 100 ? C.green : C.muted }}>
                  {completados}/{totalChecklist} {pctChecklist === 100 ? '✓' : ''}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {totalChecklist > 0 && (
              <div style={{ background: '#f1f5f9', borderRadius: 6, height: 6, marginBottom: 14, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6, transition: 'width 0.5s',
                  width: `${pctChecklist}%`,
                  background: pctChecklist === 100 ? C.green : `linear-gradient(90deg, ${C.teal}, #2dd4bf)`,
                }} />
              </div>
            )}

            {totalChecklist === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: C.muted }}>
                <FileText size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Tu gestor preparará la lista de documentos necesarios pronto.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {checklist.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    background: item.completado ? '#f0fdf4' : '#fafafa',
                    borderRadius: 10, border: `1px solid ${item.completado ? '#bbf7d0' : C.border}`,
                    padding: '10px 12px',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: item.completado ? C.green : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                    }}>
                      {item.completado
                        ? <Check size={12} color="#fff" />
                        : <span style={{ fontSize: '0.6rem', color: C.muted, fontWeight: 700 }}>{item.orden}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: item.completado ? C.green : C.navy }}>
                        {item.nombre}
                        {item.obligatorio && !item.completado && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
                      </div>
                      {item.descripcion && (
                        <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 2 }}>{item.descripcion}</div>
                      )}
                      {item.completado && (
                        <div style={{ fontSize: '0.68rem', color: C.green, marginTop: 2, fontWeight: 600 }}>Subido</div>
                      )}
                    </div>
                    {!item.completado && (
                      <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                        <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(item, f); }} />
                        <div style={{
                          background: subiendoDoc === item.id ? '#e2e8f0' : C.teal, color: '#fff',
                          borderRadius: 8, padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {subiendoDoc === item.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={11} />}
                          {subiendoDoc === item.id ? 'Subiendo…' : 'Subir'}
                        </div>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. PRÓXIMOS PASOS ── */}
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? '16px' : '20px 24px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color={C.fire} /> Próximos pasos
            </div>

            {proximosPasos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: C.muted }}>
                <CheckCircle size={28} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>No hay acciones pendientes por tu parte ahora mismo.</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Estamos trabajando en tu expediente. Te avisaremos cuando necesitemos algo.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {proximosPasos.map((paso, idx) => (
                  <div key={idx} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: paso.urgente ? '#fff7ed' : '#f8fafc',
                    borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${paso.urgente ? '#fed7aa' : C.border}`,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: paso.urgente ? '#f97316' : C.teal, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      fontSize: '0.75rem', fontWeight: 800,
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>{paso.titulo}</div>
                      <div style={{ fontSize: '0.75rem', color: C.ink2, marginTop: 2 }}>{paso.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 6. FACTURACIÓN (si fee_estado = 'facturado') ── */}
        {expediente.fee_estado === 'facturado' && expediente.fee_amount && (
          <div style={{
            background: 'linear-gradient(135deg, #0d1f3c 0%, #1e3a5f 100%)',
            borderRadius: 16, padding: isMobile ? '20px 16px' : '24px 28px', marginBottom: 16,
            color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={18} color="#fbbf24" />
              <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>Facturación — Success Fee</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 18px', flex: '1 1 140px' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Importe concedido</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4 }}>{fmtE(expediente.importe_concedido) ?? '—'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 18px', flex: '1 1 140px' }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fee AyudaPyme (15%)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4, color: '#fbbf24' }}>{fmtE(expediente.fee_amount)}</div>
              </div>
              {expediente.importe_concedido && (
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 18px', flex: '1 1 140px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neto para ti</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4, color: '#4ade80' }}>{fmtE(expediente.importe_concedido - expediente.fee_amount)}</div>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 10 }}>Datos para transferencia bancaria</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: '6px 16px', fontSize: '0.82rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Titular:</span>
                <span style={{ fontWeight: 700 }}>{AYUDAPYME_TITULAR}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>IBAN:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{AYUDAPYME_IBAN}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Concepto:</span>
                <span style={{ fontWeight: 700 }}>{AYUDAPYME_CONCEPTO_PREFIX} {expediente.id.substring(0, 8)}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Importe:</span>
                <span style={{ fontWeight: 700, color: '#fbbf24' }}>{fmtE(expediente.fee_amount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. MENSAJES / CHAT CON GESTOR ── */}
        <div style={{
          background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`,
          overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} color={C.teal} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy }}>Chat con tu gestor</span>
            <span style={{ fontSize: '0.72rem', color: C.muted, marginLeft: 'auto' }}>
              {mensajes.length > 0 ? `${mensajes.length} mensajes` : 'Sin mensajes aún'}
            </span>
          </div>

          {/* Mensajes */}
          <div
            ref={chatContainerRef}
            style={{
              height: 320, overflowY: 'auto', padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 14,
              background: '#fafbfc',
            }}
          >
            {mensajes.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: C.muted }}>
                <div>
                  <Bot size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Escribe tu primera consulta</p>
                  <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Tu gestor virtual te responderá al instante</p>
                </div>
              </div>
            ) : (
              mensajes.map(msg => {
                const esCliente = msg.remitente === 'cliente';
                const esIA = msg.remitente === 'ia';
                const hora = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const fecha = new Date(msg.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: esCliente ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
                    {!esCliente && (
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: esIA ? '#ede9fe' : '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {esIA ? <Bot size={13} color="#7c3aed" /> : <User size={13} color="#fff" />}
                      </div>
                    )}
                    <div style={{ maxWidth: '72%' }}>
                      {!esCliente && (
                        <p style={{ fontSize: '0.65rem', color: C.muted, marginBottom: 3, fontWeight: 600, paddingLeft: 4 }}>
                          {esIA ? 'Gestor IA · AyudaPyme' : 'Gestor · AyudaPyme'}
                        </p>
                      )}
                      <div style={{
                        background: esCliente ? 'linear-gradient(135deg,#0d1f3c,#1a3561)' : '#fff',
                        color: esCliente ? '#fff' : C.ink,
                        borderRadius: esCliente ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '10px 14px', fontSize: '0.85rem', lineHeight: 1.6,
                        border: esCliente ? 'none' : `1px solid ${C.border}`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap',
                      }}>
                        {msg.contenido}
                      </div>
                      <p style={{ fontSize: '0.62rem', color: C.muted, marginTop: 3, textAlign: esCliente ? 'right' : 'left', paddingInline: 4 }}>
                        {fecha === hoy ? hora : `${fecha} ${hora}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          {/* Input chat */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: C.muted, flexShrink: 0 }}
              title="Adjuntar archivo"
            >
              <Paperclip size={18} />
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={e => { const f = e.target.files?.[0]; if (f) setArchivoChat(f); }} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {archivoChat && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#eff6ff', borderRadius: 6, padding: '4px 10px', fontSize: '0.72rem',
                  color: C.blue, fontWeight: 600, width: 'fit-content',
                }}>
                  <Paperclip size={11} /> {archivoChat.name}
                  <button onClick={() => setArchivoChat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted }}>
                    <X size={11} />
                  </button>
                </div>
              )}
              <textarea
                value={textoChat}
                onChange={e => setTextoChat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); } }}
                placeholder="Escribe tu consulta…"
                rows={1}
                style={{
                  width: '100%', resize: 'none', border: `1.5px solid ${C.border}`,
                  borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  color: C.ink, lineHeight: 1.4,
                }}
              />
            </div>

            <button
              onClick={enviarMensaje}
              disabled={enviandoChat || (!textoChat.trim() && !archivoChat)}
              style={{
                background: (textoChat.trim() || archivoChat) ? C.teal : '#e2e8f0',
                color: '#fff', border: 'none', borderRadius: 10, width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (textoChat.trim() || archivoChat) ? 'pointer' : 'default',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              {enviandoChat ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
            </button>
          </div>
        </div>

        {/* ── Info subvención (resumen IA) ── */}
        {subvencion?.resumen_ia && (
          <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: isMobile ? '16px' : '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} color={C.blue} /> Sobre esta subvención
            </div>
            <div style={{ fontSize: '0.84rem', color: C.ink2, lineHeight: 1.7 }}>
              {subvencion.resumen_ia}
            </div>
            {subvencion.para_quien && (
              <div style={{ marginTop: 12, background: '#f0f9ff', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#0369a1' }}>
                <strong>Dirigido a:</strong> {subvencion.para_quien}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
          background: '#0f172a', color: '#fff', borderRadius: 12,
          padding: '14px 20px', fontSize: '0.85rem', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'slideUp 0.3s ease',
        }}>
          <CheckCircle size={16} color="#4ade80" />
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Calcular próximos pasos ─────────────────────────────────────────────────

function calcularProximosPasos(
  expediente: ExpedienteData,
  checklist: ChecklistItem[],
  faseActual: string
): Array<{ titulo: string; desc: string; urgente: boolean }> {
  const pasos: Array<{ titulo: string; desc: string; urgente: boolean }> = [];

  // Documentos pendientes
  const pendientes = checklist.filter(i => !i.completado);
  const obligatoriosPendientes = pendientes.filter(i => i.obligatorio);

  if (obligatoriosPendientes.length > 0) {
    pasos.push({
      titulo: `Sube ${obligatoriosPendientes.length} documento${obligatoriosPendientes.length > 1 ? 's' : ''} obligatorio${obligatoriosPendientes.length > 1 ? 's' : ''}`,
      desc: obligatoriosPendientes.slice(0, 3).map(i => i.nombre).join(', ') + (obligatoriosPendientes.length > 3 ? '…' : ''),
      urgente: true,
    });
  } else if (pendientes.length > 0) {
    pasos.push({
      titulo: `${pendientes.length} documento${pendientes.length > 1 ? 's' : ''} opcional${pendientes.length > 1 ? 'es' : ''} pendiente${pendientes.length > 1 ? 's' : ''}`,
      desc: 'Pueden mejorar tu solicitud, pero no son estrictamente necesarios.',
      urgente: false,
    });
  }

  // Plazo próximo
  if (expediente.plazo_solicitud) {
    const d = diasRestantes(expediente.plazo_solicitud);
    if (d !== null && d > 0 && d <= 14) {
      pasos.push({
        titulo: `Plazo de solicitud en ${d} día${d > 1 ? 's' : ''}`,
        desc: `Fecha límite: ${fmt(expediente.plazo_solicitud)}. Asegúrate de tener todo listo.`,
        urgente: d <= 7,
      });
    }
  }

  // Según la fase actual
  switch (faseActual) {
    case 'preparacion':
      if (obligatoriosPendientes.length === 0 && checklist.length > 0) {
        pasos.push({
          titulo: 'Documentación lista — en revisión',
          desc: 'Nuestros gestores están revisando tu documentación antes de presentar la solicitud.',
          urgente: false,
        });
      }
      break;
    case 'presentada':
      pasos.push({
        titulo: 'Solicitud presentada — espera respuesta',
        desc: 'La administración está revisando la solicitud. Te notificaremos cualquier novedad.',
        urgente: false,
      });
      break;
    case 'instruccion':
      pasos.push({
        titulo: 'Fase de instrucción',
        desc: 'El organismo está evaluando la solicitud. Puede requerir documentación adicional.',
        urgente: false,
      });
      break;
    case 'alegaciones':
      pasos.push({
        titulo: 'Plazo de alegaciones abierto',
        desc: 'Si no estás de acuerdo con la resolución provisional, contacta con tu gestor para presentar alegaciones.',
        urgente: true,
      });
      break;
    case 'aceptacion':
      pasos.push({
        titulo: 'Aceptar la subvención',
        desc: 'Debes confirmar formalmente la aceptación de la subvención concedida.',
        urgente: true,
      });
      break;
    case 'ejecucion':
      pasos.push({
        titulo: 'Ejecuta el proyecto',
        desc: 'Realiza las inversiones/actividades aprobadas y guarda todas las facturas y justificantes.',
        urgente: false,
      });
      break;
    case 'justificacion':
      pasos.push({
        titulo: 'Prepara la justificación',
        desc: 'Reúne facturas, contratos y evidencias de la ejecución del proyecto.',
        urgente: true,
      });
      break;
    case 'cobro':
      pasos.push({
        titulo: '¡Subvención cobrada!',
        desc: 'El importe ha sido (o será) transferido a tu cuenta.',
        urgente: false,
      });
      break;
  }

  // Fee pendiente de pago
  if (expediente.fee_estado === 'facturado' && expediente.fee_amount) {
    pasos.push({
      titulo: `Pagar fee de ${fmtE(expediente.fee_amount)}`,
      desc: 'Realiza la transferencia bancaria con los datos indicados abajo.',
      urgente: true,
    });
  }

  return pasos;
}
