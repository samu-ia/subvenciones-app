'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Briefcase, User, Bot, CheckSquare, Store, Check, Square, ExternalLink, Mail, RefreshCw, FileText } from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import NotebookLeftPanel from '@/components/workspace/docs/NotebookLeftPanel';
import RichTextEditor from '@/components/workspace/editor/RichTextEditor';
import AIPanelV2 from '@/components/workspace/ai/AIPanelV2';
import type { ContextMode } from '@/components/workspace/ai/ContextToggle';

// ─── Tipos extra ──────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string; nombre: string; descripcion?: string;
  tipo: string; categoria?: string; obligatorio: boolean;
  completado: boolean; generado_ia: boolean; orden: number;
}
interface ProveedorAsignado {
  id: string; relevancia_score: number;
  motivo_match?: string; propuesta_texto?: string; estado: string;
  proveedor: { nombre: string; categoria: string; descripcion?: string; servicios?: string[]; web?: string; contacto_email?: string; contacto_nombre?: string; precio_referencia?: string };
}

// ─── Panel checklist ──────────────────────────────────────────────────────────

function PanelChecklist({ expedienteId }: { expedienteId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('checklist_items').select('*').eq('expediente_id', expedienteId).order('orden')
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [expedienteId]);

  async function toggle(item: ChecklistItem) {
    const supabase = createClient();
    await supabase.from('checklist_items').update({ completado: !item.completado }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completado: !i.completado } : i));
  }

  const completados = items.filter(i => i.completado).length;
  const categorias = [...new Set(items.map(i => i.categoria).filter(Boolean))];

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.83rem' }}>Cargando checklist...</div>;
  if (items.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>
      <CheckSquare size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
      <p style={{ fontSize: '0.82rem' }}>Sin checklist. Se genera automáticamente al activar el expediente.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Progress */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          <span>Documentación requerida</span>
          <span style={{ color: completados === items.length ? '#059669' : '#475569' }}>{completados}/{items.length}</span>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${(completados / items.length) * 100}%`, background: completados === items.length ? '#059669' : '#3b82f6', transition: 'width 0.3s' }} />
        </div>
      </div>
      {/* Items by category */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {(categorias.length > 0 ? categorias : [undefined]).map(cat => {
          const catItems = cat ? items.filter(i => i.categoria === cat) : items.filter(i => !i.categoria);
          if (catItems.length === 0) return null;
          return (
            <div key={cat ?? 'sin-cat'} style={{ marginBottom: 12 }}>
              {cat && <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 4, paddingLeft: 2 }}>{cat}</div>}
              {catItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggle(item)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: item.completado ? '#f0fdf4' : 'transparent', transition: 'background 0.12s' }}
                >
                  <span style={{ color: item.completado ? '#059669' : '#cbd5e1', marginTop: 1, flexShrink: 0 }}>
                    {item.completado ? <Check size={14} /> : <Square size={14} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: item.obligatorio ? 600 : 500, color: item.completado ? '#6b7280' : '#0d1f3c', textDecoration: item.completado ? 'line-through' : 'none' }}>
                      {item.nombre}
                      {item.obligatorio && !item.completado && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
                    </div>
                    {item.descripcion && !item.completado && (
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 1 }}>{item.descripcion}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel proveedores ────────────────────────────────────────────────────────

function PanelProveedores({ expedienteId }: { expedienteId: string }) {
  const [provs, setProvs] = useState<ProveedorAsignado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('expediente_proveedores')
      .select('id, relevancia_score, motivo_match, propuesta_texto, estado, proveedor:proveedores(nombre,categoria,descripcion,servicios,web,contacto_email,contacto_nombre,precio_referencia)')
      .eq('expediente_id', expedienteId)
      .order('relevancia_score', { ascending: false })
      .then(({ data }) => {
        setProvs((data ?? []).map((d: any) => ({ ...d, proveedor: Array.isArray(d.proveedor) ? d.proveedor[0] : d.proveedor })));
        setLoading(false);
      });
  }, [expedienteId]);

  async function cambiarEstado(id: string, estado: string) {
    const supabase = createClient();
    await supabase.from('expediente_proveedores').update({ estado }).eq('id', id);
    setProvs(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
  }

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', fontSize: '0.83rem' }}>Cargando proveedores...</div>;
  if (provs.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>
      <Store size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
      <p style={{ fontSize: '0.82rem' }}>Sin proveedores asignados. Se generan al activar el expediente.</p>
    </div>
  );

  const ESTADO_COLORS: Record<string, string> = { sugerido: '#3b82f6', contactado: '#d97706', aceptado: '#059669', descartado: '#94a3b8' };

  return (
    <div style={{ overflowY: 'auto', padding: '12px 12px 20px' }}>
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Proveedores sugeridos por IA
      </div>
      {provs.map(p => (
        <div key={p.id} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0d1f3c' }}>{p.proveedor?.nombre}</div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: ESTADO_COLORS[p.estado] ?? '#94a3b8', background: (ESTADO_COLORS[p.estado] ?? '#94a3b8') + '20', padding: '2px 7px', borderRadius: 10 }}>
              {p.estado}
            </span>
          </div>
          {p.motivo_match && (
            <div style={{ fontSize: '0.73rem', color: '#475569', marginBottom: 6, fontStyle: 'italic' }}>
              {p.motivo_match}
            </div>
          )}
          {p.propuesta_texto && (
            <div style={{ fontSize: '0.73rem', color: '#334155', background: '#f8fafc', borderRadius: 6, padding: '6px 8px', marginBottom: 8, lineHeight: 1.5 }}>
              {p.propuesta_texto}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {p.proveedor?.contacto_email && (
              <a href={`mailto:${p.proveedor.contacto_email}`} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#3b82f6', textDecoration: 'none', background: '#eff6ff', padding: '3px 7px', borderRadius: 6 }}>
                <Mail size={10} /> Contactar
              </a>
            )}
            {p.proveedor?.web && (
              <a href={p.proveedor.web} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#475569', textDecoration: 'none', background: '#f8fafc', padding: '3px 7px', borderRadius: 6 }}>
                <ExternalLink size={10} /> Web
              </a>
            )}
            <select
              value={p.estado}
              onChange={e => cambiarEstado(p.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="sugerido">Sugerido</option>
              <option value="contactado">Contactado</option>
              <option value="aceptado">Aceptado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

interface Expediente {
  id: string;
  nif: string;
  numero_bdns: number | null;
  estado: string;
  created_at: string;
  titulo?: string | null;
  organismo?: string | null;
  subvencion_id?: string | null;
  cliente: { nombre_normalizado: string | null }[];
}

interface Documento {
  id: string;
  nombre: string;
  contenido: string | null;
  tipo_documento: string | null;
  generado_por_ia: boolean;
  updated_at: string;
}

interface ClienteCompleto {
  nombre_empresa?: string | null;
  cnae_descripcion?: string | null;
  comunidad_autonoma?: string | null;
  ciudad?: string | null;
  num_empleados?: number | null;
  facturacion_anual?: number | null;
  forma_juridica?: string | null;
  anos_antiguedad?: number | null;
  descripcion_actividad?: string | null;
  tamano_empresa?: string | null;
}

interface SubvencionData {
  titulo?: string | null;
  organismo?: string | null;
  objeto?: string | null;
  para_quien?: string | null;
  importe_maximo?: number | null;
  plazo_fin?: string | null;
  url_oficial?: string | null;
  estado_convocatoria?: string | null;
}

interface SolicitudData {
  respuestas_ia?: Array<{ pregunta: string; respuesta: unknown; tipo: string; categoria: string }> | null;
  encaje_score?: number | null;
  informe_viabilidad?: string | null;
}

// ─── Panel Ficha del Expediente ────────────────────────────────────────────────

function PanelFicha({
  expediente,
  cliente,
  subvencion,
  solicitud,
  onQuickAction,
}: {
  expediente: Expediente;
  cliente: ClienteCompleto | null;
  subvencion: SubvencionData | null;
  solicitud: SolicitudData | null;
  onQuickAction: (msg: string) => void;
}) {
  const fmtE = (n?: number | null) => {
    if (!n) return 'N/D';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K €`;
    return `${n.toLocaleString('es-ES')} €`;
  };
  const fmtFecha = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/D';
  const diasRestantes = subvencion?.plazo_fin ? Math.ceil((new Date(subvencion.plazo_fin).getTime() - Date.now()) / 86_400_000) : null;

  const respuestas = solicitud?.respuestas_ia ?? [];
  const proyecto = respuestas.filter(r => r.categoria === 'proyecto');
  const encaje = respuestas.filter(r => r.categoria === 'encaje');

  let informeData: Record<string, unknown> | null = null;
  try { if (solicitud?.informe_viabilidad) informeData = JSON.parse(solicitud.informe_viabilidad as string); } catch { /* no JSON */ }

  const QUICK_ACTIONS = [
    { emoji: '📋', label: 'Memoria completa', msg: 'Genera la memoria de solicitud completa y detallada usando todos los datos del cliente y la subvención. Crea un documento tipo "memoria" con todas las secciones rellenas con datos reales.' },
    { emoji: '💰', label: 'Presupuesto detallado', msg: 'Genera una memoria económica y presupuesto detallado de la inversión basándote en lo que el cliente dijo que haría con la ayuda. Crea una tabla con conceptos, importes y justificación. Tipo "memoria_economica".' },
    { emoji: '📅', label: 'Cronograma', msg: 'Genera un cronograma de ejecución del proyecto en formato tabla Markdown con fases, actividades, fechas estimadas y responsables. Tipo "cronograma".' },
    { emoji: '✉️', label: 'Email — pedir documentos', msg: 'Redacta un email profesional para enviar al cliente solicitándole la documentación necesaria para tramitar esta subvención. Incluye la lista de documentos del checklist. Tipo "email".' },
    { emoji: '📝', label: 'Proyecto técnico', msg: 'Genera el proyecto técnico completo que justifique la necesidad de la subvención, con descripción técnica detallada del proyecto, tecnología o inversión a realizar. Tipo "proyecto_tecnico".' },
    { emoji: '🔎', label: 'Resumen ejecutivo', msg: 'Genera un resumen ejecutivo de 1 página con los puntos clave del expediente: empresa, subvención, encaje, proyecto y próximos pasos. Tipo "informe".' },
  ];

  const C = { border: '#e8ecf4', bg: '#f8fafc', navy: '#0d1f3c', muted: '#94a3b8', green: '#059669', amber: '#d97706', red: '#dc2626' };
  const row = (label: string, value: string | null | undefined) => (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: '0.8rem' }}>
      <span style={{ color: C.muted, flexShrink: 0, width: 130 }}>{label}</span>
      <span style={{ color: C.navy, fontWeight: 500, flex: 1 }}>{value || 'N/D'}</span>
    </div>
  );

  return (
    <div style={{ overflowY: 'auto', padding: '14px 14px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Acciones rápidas */}
      <div>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 8 }}>Generar con IA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => onQuickAction(a.msg)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: C.navy, textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = C.border; }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{a.emoji}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subvención */}
      {subvencion && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>Subvención</div>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
            {row('Título', subvencion.titulo)}
            {row('Organismo', subvencion.organismo)}
            {row('Importe máx.', fmtE(subvencion.importe_maximo))}
            <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: '0.8rem' }}>
              <span style={{ color: C.muted, flexShrink: 0, width: 130 }}>Plazo fin</span>
              <span style={{ color: diasRestantes != null && diasRestantes < 30 ? C.red : C.navy, fontWeight: 600 }}>
                {fmtFecha(subvencion.plazo_fin)}{diasRestantes != null ? ` (${diasRestantes > 0 ? diasRestantes + 'd' : 'VENCIDO'})` : ''}
              </span>
            </div>
            {subvencion.objeto && row('Objeto', subvencion.objeto)}
            {subvencion.url_oficial && (
              <div style={{ padding: '6px 0', fontSize: '0.8rem' }}>
                <a href={subvencion.url_oficial} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={11} /> Ver convocatoria oficial
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cliente */}
      <div>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>Empresa</div>
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
          {row('NIF', expediente.nif)}
          {row('Sector', cliente?.cnae_descripcion)}
          {row('Tamaño', cliente?.tamano_empresa)}
          {row('Empleados', cliente?.num_empleados?.toString())}
          {row('Facturación', fmtE(cliente?.facturacion_anual))}
          {row('Forma jurídica', cliente?.forma_juridica)}
          {row('Antigüedad', cliente?.anos_antiguedad != null ? `${cliente.anos_antiguedad} años` : null)}
          {row('Localización', [cliente?.ciudad, cliente?.comunidad_autonoma].filter(Boolean).join(', '))}
          {cliente?.descripcion_actividad && row('Actividad', cliente.descripcion_actividad)}
        </div>
      </div>

      {/* Informe de viabilidad */}
      {informeData && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>Informe de Viabilidad</div>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
            {informeData.puntuacion_encaje != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: Number(informeData.puntuacion_encaje) >= 70 ? '#ecfdf5' : '#fff7ed', border: `2px solid ${Number(informeData.puntuacion_encaje) >= 70 ? C.green : C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: Number(informeData.puntuacion_encaje) >= 70 ? C.green : C.amber, flexShrink: 0 }}>
                  {informeData.puntuacion_encaje as number}%
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.navy }}>{String(informeData.recomendacion ?? '').toUpperCase()}</div>
                  <div style={{ fontSize: '0.72rem', color: C.muted }}>{String(informeData.recomendacion_motivo ?? '')}</div>
                </div>
              </div>
            )}
            {informeData.resumen_ejecutivo != null && <p style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.6, margin: '0 0 8px' }}>{String(informeData.resumen_ejecutivo)}</p>}
          </div>
        </div>
      )}

      {/* Respuestas del cuestionario */}
      {proyecto.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>Lo que el cliente quiere hacer</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proyecto.map((r, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, marginBottom: 4 }}>{r.pregunta}</div>
                <div style={{ fontSize: '0.8rem', color: C.navy, lineHeight: 1.5 }}>{String(r.respuesta ?? '—')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encaje */}
      {encaje.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, marginBottom: 6 }}>
            Criterios de encaje
            {solicitud?.encaje_score != null && (
              <span style={{ marginLeft: 6, color: C.navy }}>{Math.round((solicitud.encaje_score as number) * 100)}%</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {encaje.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 8px', background: '#fff', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: '0.78rem' }}>
                <span style={{ color: r.respuesta ? C.green : C.red, fontWeight: 700, flexShrink: 0 }}>{r.respuesta ? '✓' : '✗'}</span>
                <span style={{ color: C.navy }}>{r.pregunta}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpedienteWorkspacePage() {
  const params = useParams();
  const expedienteId = params.id as string;

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedArchivoId, setSelectedArchivoId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Array<{ id: string; nombre: string; mime_type?: string | null; tamano_bytes?: number; storage_path?: string }>>([]);
  const [contextSelections, setContextSelections] = useState<Record<string, ContextMode>>({});
  const [archivoSignedUrl, setArchivoSignedUrl] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<'ia' | 'checklist' | 'proveedores' | 'ficha'>('ficha');
  const [setupLoading, setSetupLoading] = useState(false);
  const [clienteData, setClienteData] = useState<ClienteCompleto | null>(null);
  const [subvencionData, setSubvencionData] = useState<SubvencionData | null>(null);
  const [solicitudData, setSolicitudData] = useState<SolicitudData | null>(null);
  const [quickAction, setQuickAction] = useState<{ text: string; key: number } | null>(null);

  const selectedDoc = documentos.find(d => d.id === selectedDocId);

  function dispararQuickAction(msg: string) {
    setPanelTab('ia');
    setQuickAction(prev => ({ text: msg, key: (prev?.key ?? 0) + 1 }));
  }

  // Generar signed URL cuando se selecciona un archivo
  useEffect(() => {
    if (!selectedArchivoId) { setArchivoSignedUrl(null); return; }
    const archivo = archivos.find(a => a.id === selectedArchivoId);
    if (!archivo?.storage_path) { setArchivoSignedUrl(null); return; }
    const supabase = createClient();
    supabase.storage.from('archivos').createSignedUrl(archivo.storage_path, 3600)
      .then(({ data }) => setArchivoSignedUrl(data?.signedUrl ?? null))
      .catch(() => setArchivoSignedUrl(null));
  }, [selectedArchivoId, archivos]);

  // Escuchar evento doc-created para actualizar lista sin prompt()
  useEffect(() => {
    const handler = (e: Event) => {
      const newDoc = (e as CustomEvent).detail;
      setDocumentos(prev => {
        if (prev.find(d => d.id === newDoc.id)) return prev;
        return [...prev, newDoc];
      });
      setSelectedDocId(newDoc.id);
      setDocContent(newDoc.contenido || '');
    };
    window.addEventListener('doc-created', handler);
    return () => window.removeEventListener('doc-created', handler);
  }, []);

  // Escuchar acciones del agente (crear/editar documentos)
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        type: string;
        documentId: string;
        documentName?: string;
        contenido?: string;
      };
      if (detail.type === 'create_document') {
        // Recargar el documento recién creado desde Supabase
        const supabase = createClient();
        const { data: newDoc } = await supabase
          .from('documentos')
          .select('*')
          .eq('id', detail.documentId)
          .single();
        if (newDoc) {
          setDocumentos(prev => {
            if (prev.find(d => d.id === newDoc.id)) return prev;
            return [...prev, newDoc];
          });
          // Seleccionar el último doc creado
          setSelectedDocId(newDoc.id);
          setDocContent(newDoc.contenido || '');
        }
      } else if (detail.type === 'edit_document' || detail.type === 'edit_section') {
        // Actualizar el contenido del doc editado en el estado local
        setDocumentos(prev => prev.map(d =>
          d.id === detail.documentId ? { ...d, contenido: detail.contenido ?? d.contenido } : d
        ));
        // Si está abierto, actualizar el editor
        setSelectedDocId(id => {
          if (id === detail.documentId) setDocContent(detail.contenido ?? '');
          return id;
        });
      } else if (detail.type === 'delete_document') {
        // Borrar doc de la lista
        setDocumentos(prev => {
          const newDocs = prev.filter(d => d.id !== detail.documentId);
          // Si estaba seleccionado, pasar al primero disponible
          setSelectedDocId(id => {
            if (id === detail.documentId) {
              const next = newDocs[0];
              if (next) setDocContent(next.contenido || '');
              return next?.id ?? null;
            }
            return id;
          });
          return newDocs;
        });
      }
    };
    window.addEventListener('agent-doc-action', handler);
    return () => window.removeEventListener('agent-doc-action', handler);
  }, []);

  // Obtener userId
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [expedienteId]);

  const loadData = async () => {
    const supabase = createClient();

    const { data: expData } = await supabase
      .from('expediente')
      .select(`*, cliente:nif (nombre_normalizado)`)
      .eq('id', expedienteId)
      .single();

    if (expData) {
      setExpediente(expData);

      // Cargar datos enriquecidos en paralelo
      const [{ data: cliData }, { data: solData }, subvResult] = await Promise.all([
        supabase.from('cliente').select('nombre_empresa,cnae_descripcion,comunidad_autonoma,ciudad,num_empleados,facturacion_anual,forma_juridica,anos_antiguedad,descripcion_actividad,tamano_empresa').eq('nif', expData.nif).maybeSingle(),
        supabase.from('solicitudes').select('respuestas_ia,encaje_score,informe_viabilidad').eq('expediente_id', expedienteId).maybeSingle(),
        expData.subvencion_id
          ? supabase.from('subvenciones').select('titulo,organismo,objeto,para_quien,importe_maximo,plazo_fin,url_oficial,estado_convocatoria').eq('id', expData.subvencion_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setClienteData(cliData);
      setSolicitudData(solData);
      setSubvencionData(subvResult.data);
    }

    const { data: docsData } = await supabase
      .from('documentos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('orden', { ascending: true });

    if (docsData && docsData.length > 0) {
      setDocumentos(docsData);
      setSelectedDocId(docsData[0].id);
      setDocContent(docsData[0].contenido || '');
    } else {
      const defaultDocs = [
        { nombre: 'Memoria', tipo_documento: 'memoria', contenido: '' },
        { nombre: 'Checklist', tipo_documento: 'checklist', contenido: '' },
        { nombre: 'Notas', tipo_documento: 'notas', contenido: '' },
      ];
      const { data: newDocs } = await supabase
        .from('documentos')
        .insert(defaultDocs.map((doc, idx) => ({
          ...doc,
          expediente_id: expedienteId,
          nif: expData?.nif,
          orden: idx,
          generado_por_ia: false,
        })))
        .select();
      if (newDocs) {
        setDocumentos(newDocs);
        setSelectedDocId(newDocs[0].id);
        setDocContent('');
      }
    }
    setLoading(false);
  };

  const saveDocument = useCallback(async (content: string) => {
    if (!selectedDocId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('documentos')
      .update({ contenido: content, updated_at: new Date().toISOString() })
      .eq('id', selectedDocId);
    if (!error) {
      setLastSaved(new Date());
      setDocumentos(docs =>
        docs.map(d => d.id === selectedDocId ? { ...d, contenido: content } : d)
      );
    }
  }, [selectedDocId]);

  const handleCreateDoc = async () => {
    const nombre = prompt('Nombre del documento:');
    if (!nombre) return;
    const supabase = createClient();
    const { data: newDoc } = await supabase
      .from('documentos')
      .insert({
        nombre,
        expediente_id: expedienteId,
        nif: expediente?.nif,
        contenido: '',
        orden: documentos.length,
        generado_por_ia: false,
      })
      .select()
      .single();
    if (newDoc) {
      setDocumentos([...documentos, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent('');
    }
  };

  const handleRenameDoc = async (docId: string, newName: string) => {
    const supabase = createClient();
    await supabase.from('documentos').update({ nombre: newName }).eq('id', docId);
    setDocumentos(docs => docs.map(d => d.id === docId ? { ...d, nombre: newName } : d));
  };

  const handleDeleteDoc = async (docId: string) => {
    const supabase = createClient();
    await supabase.from('documentos').delete().eq('id', docId);
    const newDocs = documentos.filter(d => d.id !== docId);
    setDocumentos(newDocs);
    if (selectedDocId === docId && newDocs.length > 0) {
      setSelectedDocId(newDocs[0].id);
      setDocContent(newDocs[0].contenido || '');
    }
  };

  const handleSelectDoc = (docId: string) => {
    const doc = documentos.find(d => d.id === docId);
    if (doc) {
      setSelectedDocId(docId);
      setSelectedArchivoId(null);
      setDocContent(doc.contenido || '');
    }
  };

  const handleSelectArchivo = (archivoId: string) => {
    setSelectedArchivoId(archivoId);
    setSelectedDocId(null);
  };

  const handleChangeTipoDoc = async (docId: string, tipo: string) => {
    const supabase = createClient();
    await supabase.from('documentos').update({ tipo_documento: tipo }).eq('id', docId);
    setDocumentos(docs => docs.map(d => d.id === docId ? { ...d, tipo_documento: tipo } : d));
  };

  const handleGenerarDocumento = async (nombre: string, contenido: string, prompt: string) => {
    const supabase = createClient();

    // Modo insertar en documento existente
    if (nombre.startsWith('__insert__')) {
      const docId = nombre.replace('__insert__', '');
      await supabase
        .from('documentos')
        .update({ contenido, updated_at: new Date().toISOString() })
        .eq('id', docId);
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, contenido } : d));
      setSelectedDocId(docId);
      setDocContent(contenido);
      return;
    }

    const { data: newDoc } = await supabase
      .from('documentos')
      .insert({
        nombre,
        contenido,
        expediente_id: expedienteId,
        nif: expediente?.nif,
        generado_por_ia: true,
        prompt_usado: prompt,
        orden: documentos.length,
      })
      .select()
      .single();
    if (newDoc) {
      setDocumentos(prev => [...prev, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent(contenido);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando workspace...</div>;
  }

  if (!expediente) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Expediente no encontrado</div>;
  }

  const titulo = expediente.numero_bdns
    ? `BDNS ${expediente.numero_bdns}`
    : `Expediente ${expediente.id.slice(0, 8)}`;

  return (
    <WorkspaceLayout
      header={
        <div>
          <Link
            href="/expedientes"
            style={{
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '12px',
            }}
          >
            <ArrowLeft size={14} />
            Volver a expedientes
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>
                {titulo}
              </h1>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                fontSize: '13px', color: 'var(--muted-foreground)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} />
                  <span>{expediente.cliente?.[0]?.nombre_normalizado || expediente.nif}</span>
                </div>
                <span>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} />
                  <span>{expediente.nif}</span>
                </div>
                <span>|</span>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                  backgroundColor:
                    expediente.estado === 'aprobado' ? 'var(--success)' :
                    expediente.estado === 'rechazado' ? 'var(--destructive)' : 'var(--warning)',
                  color: 'white',
                }}>
                  {expediente.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
      documentList={
        <NotebookLeftPanel
          documentos={documentos}
          archivos={archivos}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onCreateDoc={handleCreateDoc}
          onRenameDoc={handleRenameDoc}
          onDeleteDoc={handleDeleteDoc}
          contextoId={expedienteId}
          contextoTipo="expediente"
          nif={expediente?.nif}
          onArchivoUploaded={archivo => setArchivos(prev => [...prev, archivo])}
          onSelectArchivo={handleSelectArchivo}
          selectedArchivoId={selectedArchivoId}
          contextSelections={contextSelections}
          onContextModeChange={(docId, mode) => setContextSelections(prev => ({ ...prev, [docId]: mode }))}
        />
      }
      editor={
        (() => {
          const selectedArchivo = archivos.find(a => a.id === selectedArchivoId);
          if (selectedArchivo) {
            const fileUrl = archivoSignedUrl;
            const isPdf = selectedArchivo.mime_type === 'application/pdf';
            const isImage = selectedArchivo.mime_type?.startsWith('image/');
            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                  padding: '10px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--background)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                      📎 {selectedArchivo.nombre}
                    </span>
                    {selectedArchivo.tamano_bytes && (
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        {Math.round(selectedArchivo.tamano_bytes / 1024)} KB
                      </span>
                    )}
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: '12px', fontWeight: '600', color: 'var(--primary)',
                        textDecoration: 'none', padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid var(--primary)',
                      }}>
                      ↓ Descargar
                    </a>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {fileUrl && isPdf ? (
                    <iframe src={fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                  ) : fileUrl && isImage ? (
                    <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', overflowY: 'auto', height: '100%' }}>
                      <img src={fileUrl} alt={selectedArchivo.nombre}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                    </div>
                  ) : fileUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--muted-foreground)' }}>
                      <div style={{ fontSize: '48px' }}>📄</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{selectedArchivo.nombre}</div>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--primary)', color: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                        Abrir archivo
                      </a>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted-foreground)' }}>
                      Archivo no disponible
                    </div>
                  )}
                </div>
              </div>
            );
          }
          if (selectedDoc) {
            const TIPOS_DOC = [
              { value: 'nota', label: 'Nota' },
              { value: 'notas', label: 'Notas' },
              { value: 'preparacion', label: 'Preparación' },
              { value: 'guion', label: 'Guión' },
              { value: 'resumen', label: 'Resumen' },
              { value: 'email', label: 'Email' },
              { value: 'checklist', label: 'Checklist' },
              { value: 'memoria', label: 'Memoria' },
              { value: 'informe', label: 'Informe' },
              { value: 'propuesta', label: 'Propuesta' },
              { value: 'otro', label: 'Otro' },
            ];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--background)',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)', flex: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedDoc.nombre}
                  </span>
                  <select
                    value={selectedDoc.tipo_documento ?? 'nota'}
                    onChange={e => handleChangeTipoDoc(selectedDoc.id, e.target.value)}
                    style={{
                      fontSize: '11px', padding: '3px 6px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--background)',
                      color: 'var(--muted-foreground)', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {TIPOS_DOC.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {lastSaved && (
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      Guardado {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <RichTextEditor
                    key={selectedDocId ?? 'empty'}
                    content={docContent}
                    onChange={setDocContent}
                    onSave={saveDocument}
                    lastSaved={lastSaved}
                    placeholder="Empieza a escribir..."
                  />
                </div>
              </div>
            );
          }
          return (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--muted-foreground)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Selecciona un documento para empezar</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>O crea uno nuevo desde el panel izquierdo</div>
            </div>
          );
        })()
      }
      aiPanel={
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--background)', flexShrink: 0 }}>
            {([
              { key: 'ficha', label: 'Ficha', icon: <FileText size={12} /> },
              { key: 'ia', label: 'Asistente', icon: <Bot size={12} /> },
              { key: 'checklist', label: 'Checklist', icon: <CheckSquare size={12} /> },
              { key: 'proveedores', label: 'Proveedores', icon: <Store size={12} /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setPanelTab(tab.key)}
                style={{
                  flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: panelTab === tab.key ? 'var(--background)' : '#f8fafc',
                  color: panelTab === tab.key ? '#0d1f3c' : '#94a3b8',
                  fontWeight: panelTab === tab.key ? 700 : 500,
                  fontSize: '0.72rem',
                  borderBottom: panelTab === tab.key ? '2px solid #1d4ed8' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
          {/* Panel content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {panelTab === 'ficha' && expediente && (
              <PanelFicha
                expediente={expediente}
                cliente={clienteData}
                subvencion={subvencionData}
                solicitud={solicitudData}
                onQuickAction={dispararQuickAction}
              />
            )}
            {panelTab === 'ia' && (
              userId ? (
                <AIPanelV2
                  userId={userId}
                  contextoId={expedienteId}
                  contextoTipo="expediente"
                  documentos={documentos}
                  contextSelections={contextSelections}
                  onGenerarDocumento={handleGenerarDocumento}
                  selectedDocId={selectedDocId}
                  onSelectDoc={handleSelectDoc}
                  quickAction={quickAction}
                />
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  Cargando asistente...
                </div>
              )
            )}
            {panelTab === 'checklist' && <PanelChecklist expedienteId={expedienteId} />}
            {panelTab === 'proveedores' && <PanelProveedores expedienteId={expedienteId} />}
          </div>
        </div>
      }
    />
  );
}
