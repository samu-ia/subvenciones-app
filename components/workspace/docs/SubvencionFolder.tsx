'use client';

import { useState } from 'react';
import {
  ChevronRight, ChevronDown, ExternalLink, CheckSquare, Square,
  FileText, Globe, Euro, Calendar, Building2, Target, Loader2,
  AlertCircle, Trash2
} from 'lucide-react';
import type {
  SubvencionDetectada, SubvencionChecklistItem,
  EstadoExpediente
} from '@/lib/types/notebook';
import {
  ESTADO_EXPEDIENTE_LABELS, ESTADO_EXPEDIENTE_COLOR,
  ESTADO_CONV_LABELS
} from '@/lib/types/notebook';

interface SubvencionFolderProps {
  subvencion: SubvencionDetectada;
  isActive: boolean;
  onSelect: (id: string) => void;
  onCheckItem: (checklistId: string, done: boolean) => void;
  onChangeEstado: (id: string, estado: EstadoExpediente) => void;
  onDelete: (id: string) => void;
  /** Seleccionar un documento asociado en el editor */
  onOpenDocumento?: (docId: string) => void;
}

export default function SubvencionFolder({
  subvencion: sv,
  isActive,
  onSelect,
  onCheckItem,
  onChangeEstado,
  onDelete,
  onOpenDocumento,
}: SubvencionFolderProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<'resumen' | 'datos' | 'checklist' | 'docs'>('resumen');
  const [savingCheck, setSavingCheck] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = () => {
    setExpanded(v => !v);
    onSelect(sv.id);
  };

  const checklist = sv.checklist || [];
  const totalItems = checklist.length;
  const doneItems = checklist.filter(c => c.completado).length;
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const handleCheck = async (item: SubvencionChecklistItem) => {
    setSavingCheck(item.id);
    await onCheckItem(item.id, !item.completado);
    setSavingCheck(null);
  };

  const estadoColor = ESTADO_EXPEDIENTE_COLOR[sv.estado_expediente] || '#6b7280';

  return (
    <div style={{
      borderRadius: '8px',
      border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
      overflow: 'hidden',
      background: 'var(--background)',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Cabecera de la carpeta ── */}
      <button
        onClick={toggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 12px',
          background: isActive ? 'color-mix(in srgb, var(--primary) 6%, var(--background))' : 'var(--background)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expanded
          ? <ChevronDown size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        }
        <span style={{ fontSize: '14px', marginRight: '2px', flexShrink: 0 }}>📁</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: '600', color: 'var(--foreground)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {sv.titulo}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{
              fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '4px',
              background: estadoColor + '18', color: estadoColor,
            }}>
              {ESTADO_EXPEDIENTE_LABELS[sv.estado_expediente]}
            </span>
            {sv.puntuacion && (
              <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>
                {sv.puntuacion}/10
              </span>
            )}
          </div>
        </div>
      </button>

      {/* ── Contenido expandido ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Sub-tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            padding: '0 8px', background: 'var(--muted)',
          }}>
            {(['resumen', 'datos', 'checklist', 'docs'] as const).map(tab => (
              <button key={tab}
                onClick={() => setActiveSection(tab)}
                style={{
                  padding: '6px 10px', fontSize: '10px', fontWeight: '600',
                  border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: activeSection === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeSection === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>
                {tab === 'checklist' ? `✅ ${doneItems}/${totalItems}` : tab === 'docs' ? '📄 Docs' : tab === 'datos' ? '📊 Datos' : '✨ Resumen'}
              </button>
            ))}
          </div>

          <div style={{ padding: '12px' }}>
            {/* RESUMEN */}
            {activeSection === 'resumen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sv.resumen_ia && (
                  <p style={{ fontSize: '12px', color: 'var(--foreground)', lineHeight: '1.6', margin: 0 }}>
                    {sv.resumen_ia}
                  </p>
                )}
                {sv.motivo_match && (
                  <div style={{ padding: '8px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', marginBottom: '3px' }}>POR QUÉ ENCAJA</div>
                    <p style={{ fontSize: '11px', color: '#15803d', margin: 0, lineHeight: '1.5' }}>{sv.motivo_match}</p>
                  </div>
                )}
                {!sv.encaja && sv.motivo_rechazo && (
                  <div style={{ padding: '8px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626', marginBottom: '3px' }}>POR QUÉ NO ENCAJA</div>
                    <p style={{ fontSize: '11px', color: '#b91c1c', margin: 0 }}>{sv.motivo_rechazo}</p>
                  </div>
                )}
                {sv.docs_faltantes && sv.docs_faltantes.length > 0 && (
                  <div style={{ padding: '8px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                      <AlertCircle size={11} style={{ color: '#d97706' }} />
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#d97706' }}>DOCS POSIBLEMENTE NECESARIOS</span>
                    </div>
                    {sv.docs_faltantes.map((d, i) => (
                      <div key={i} style={{ fontSize: '11px', color: '#92400e', padding: '1px 0' }}>· {d}</div>
                    ))}
                  </div>
                )}

                {/* Estado del expediente */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-foreground)', marginBottom: '5px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>Estado expediente</div>
                  <select
                    value={sv.estado_expediente}
                    onChange={e => onChangeEstado(sv.id, e.target.value as EstadoExpediente)}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: '6px',
                      border: '1px solid var(--border)', fontSize: '12px',
                      background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer',
                    }}
                  >
                    {(Object.entries(ESTADO_EXPEDIENTE_LABELS) as [EstadoExpediente, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* DATOS OFICIALES */}
            {activeSection === 'datos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {sv.organismo && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Building2 size={12} style={{ color: 'var(--muted-foreground)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600' }}>ORGANISMO</div>
                      <div style={{ fontSize: '12px', color: 'var(--foreground)' }}>{sv.organismo}</div>
                    </div>
                  </div>
                )}
                {sv.importe_max && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Euro size={12} style={{ color: 'var(--muted-foreground)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600' }}>IMPORTE MÁX.</div>
                      <div style={{ fontSize: '12px', color: 'var(--foreground)', fontWeight: '600' }}>
                        {sv.importe_max.toLocaleString('es-ES')} €
                      </div>
                    </div>
                  </div>
                )}
                {sv.plazo_fin && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Calendar size={12} style={{ color: 'var(--muted-foreground)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600' }}>PLAZO FIN</div>
                      <div style={{ fontSize: '12px', color: 'var(--foreground)' }}>
                        {new Date(sv.plazo_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Target size={12} style={{ color: 'var(--muted-foreground)', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600' }}>ESTADO CONVOCATORIA</div>
                    <div style={{ fontSize: '12px', color: 'var(--foreground)' }}>
                      {ESTADO_CONV_LABELS[sv.estado_conv]}
                    </div>
                  </div>
                </div>
                {sv.numero_bdns && (
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    BDNS: {sv.numero_bdns}
                  </div>
                )}
                {sv.url_oficial && (
                  <a href={sv.url_oficial} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', color: 'var(--primary)', textDecoration: 'none',
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                      marginTop: '4px',
                    }}>
                    <Globe size={12} />
                    Ver convocatoria oficial
                    <ExternalLink size={10} />
                  </a>
                )}
                {sv.descripcion && (
                  <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.5', margin: '4px 0 0 0' }}>
                    {sv.descripcion}
                  </p>
                )}
              </div>
            )}

            {/* CHECKLIST */}
            {activeSection === 'checklist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Progress bar */}
                {totalItems > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                      <span>{doneItems} de {totalItems} completados</span>
                      <span>{progress}%</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22c55e' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}
                {checklist.length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0' }}>
                    Sin checklist generado
                  </p>
                )}
                {checklist.map(item => (
                  <button key={item.id}
                    onClick={() => handleCheck(item)}
                    disabled={savingCheck === item.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 8px',
                      borderRadius: '6px', border: 'none', background: 'none',
                      cursor: savingCheck === item.id ? 'wait' : 'pointer',
                      textAlign: 'left', width: '100%',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {savingCheck === item.id
                      ? <Loader2 size={14} style={{ flexShrink: 0, marginTop: '1px', animation: 'spin 1s linear infinite', color: 'var(--muted-foreground)' }} />
                      : item.completado
                        ? <CheckSquare size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#22c55e' }} />
                        : <Square size={14} style={{ flexShrink: 0, marginTop: '1px', color: item.obligatorio ? 'var(--foreground)' : 'var(--muted-foreground)' }} />
                    }
                    <span style={{
                      fontSize: '12px', lineHeight: '1.5',
                      color: item.completado ? 'var(--muted-foreground)' : 'var(--foreground)',
                      textDecoration: item.completado ? 'line-through' : 'none',
                    }}>
                      {item.texto}
                      {!item.obligatorio && <span style={{ color: 'var(--muted-foreground)', fontSize: '10px', marginLeft: '4px' }}>(opcional)</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* DOCS */}
            {activeSection === 'docs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(!sv.documentos || sv.documentos.length === 0) && (
                  <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0' }}>
                    Sin documentos asociados
                  </p>
                )}
                {sv.documentos?.map(doc => (
                  <button key={doc.id}
                    onClick={() => doc.documento_id && onOpenDocumento?.(doc.documento_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 8px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--background)',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <FileText size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>
                      {doc.tipo.replace(/_/g, ' ')}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Zona de borrado */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 6px', borderRadius: '5px' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}>
                  <Trash2 size={11} /> Eliminar
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#dc2626' }}>¿Seguro?</span>
                  <button onClick={() => onDelete(sv.id)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}>
                    Sí, eliminar
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Needed for spinner
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _style = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
