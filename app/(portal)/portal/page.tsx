'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import {
  Bell, LogOut, ChevronRight, ExternalLink, FileText,
  CheckCircle, AlertTriangle, Clock, Zap, Star,
  CreditCard, Landmark, ArrowRight, ArrowLeft,
  Shield, X, Check, Loader2, User, Building2, Save,
  MessageCircle, Send, Bot, Paperclip, Menu, Upload,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ClienteData {
  nif: string;
  nombre_empresa?: string;
  nombre_normalizado?: string;
  ciudad?: string;
  comunidad_autonoma?: string;
  cnae_codigo?: string;
  cnae_descripcion?: string;
  tamano_empresa?: string;
  num_empleados?: number;
  facturacion_anual?: number;
  provincia?: string;
  forma_juridica?: string;
  anos_antiguedad?: number;
  descripcion_actividad?: string;
}

interface MatchItem {
  id: string;
  score: number;
  motivos: string[];
  estado: string;
  es_hard_exclude: boolean;
  detalle_scoring?: Record<string, number>;
  subvencion: {
    id: string;
    bdns_id: string;
    titulo: string;
    organismo?: string;
    objeto?: string;
    resumen_ia?: string;
    para_quien?: string;
    importe_maximo?: number;
    presupuesto_total?: number;
    porcentaje_financiacion?: number;
    plazo_fin?: string;
    plazo_inicio?: string;
    estado_convocatoria: string;
    ambito_geografico?: string;
    url_oficial?: string;
  };
  solicitud?: {
    id: string;
    estado: string;
    contrato_firmado: boolean;
    metodo_pago_ok: boolean;
  };
}

interface Expediente {
  id: string;
  numero_bdns?: number;
  estado: string;
  fase?: string;
  titulo?: string;
  organismo?: string;
  plazo_solicitud?: string;
  created_at: string;
  contrato_firmado: boolean;
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
  return `${n} €`;
}
function diasRestantes(s?: string) {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000);
}
function scoreLabel(score: number) {
  if (score >= 0.65) return { text: 'Muy recomendable', color: C.fire, bg: '#fff7ed', border: '#fed7aa', icon: '🔥' };
  if (score >= 0.40) return { text: 'Buen encaje',       color: C.green, bg: '#ecfdf5', border: '#a7f3d0', icon: '✓' };
  return                 { text: 'Encaje posible',       color: C.muted,  bg: '#f8fafc', border: C.border,   icon: '~' };
}

// ─── Modal flujo solicitud ────────────────────────────────────────────────────

interface PreguntaIA {
  id: string;
  tipo: 'si_no' | 'texto_corto' | 'texto_largo' | 'numero';
  categoria: 'encaje' | 'proyecto' | 'empresa' | 'documentacion';
  pregunta: string;
  contexto: string | null;
  obligatoria: boolean;
}

type ModalPaso = 1 | 2 | 3;

function ModalSolicitud({
  match,
  cliente,
  onClose,
  onCompletado,
}: {
  match: MatchItem;
  cliente: ClienteData;
  onClose: () => void;
  onCompletado: () => void;
}) {
  const [paso, setPaso] = useState<ModalPaso>(1);
  const [preguntas, setPreguntas] = useState<PreguntaIA[]>([]);
  const [cargandoPreguntas, setCargandoPreguntas] = useState(true);
  const [respuestas, setRespuestas] = useState<Record<string, string | boolean | number>>({});
  const [firmante, setFirmante] = useState(cliente.nombre_empresa ?? '');
  const [dni, setDni] = useState(cliente.nif ?? '');
  const [aceptaContrato, setAceptaContrato] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'tarjeta' | 'transferencia' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const subv = match.subvencion;
  const scoreInfo = scoreLabel(match.score);
  const dias = diasRestantes(subv.plazo_fin);

  // Cargar preguntas dinámicas al abrir el modal
  useEffect(() => {
    setCargandoPreguntas(true);
    fetch('/api/portal/preguntas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subvencion_id: subv.id }),
    })
      .then(r => r.json())
      .then(data => {
        setPreguntas(data.preguntas ?? []);
        setRespuestas({});
      })
      .catch(() => setPreguntas([]))
      .finally(() => setCargandoPreguntas(false));
  }, [subv.id]);

  const obligatorias = preguntas.filter(p => p.obligatoria);
  const todasRespondidas = obligatorias.every(p => {
    const r = respuestas[p.id];
    if (r === undefined || r === null) return false;
    if (typeof r === 'string') return r.trim().length > 0;
    return true;
  });
  const encajePositivo = preguntas
    .filter(p => p.categoria === 'encaje' && respuestas[p.id] === true).length;

  function setResp(id: string, val: string | boolean | number) {
    setRespuestas(prev => ({ ...prev, [id]: val }));
  }

  async function avanzarPaso1() {
    if (!todasRespondidas) return;
    setPaso(2);
  }

  async function avanzarPaso2() {
    if (!aceptaContrato || !firmante.trim()) {
      setError('Debes leer y aceptar el contrato para continuar.');
      return;
    }
    setError('');
    setPaso(3);
  }

  async function finalizarSolicitud() {
    if (!metodoPago) { setError('Selecciona un método de pago.'); return; }
    setGuardando(true);
    setError('');
    try {
      const respuestasIA = preguntas.map(p => ({
        pregunta: p.pregunta,
        respuesta: respuestas[p.id] ?? null,
        tipo: p.tipo,
        categoria: p.categoria,
      }));
      const encajeScore = encajePositivo / Math.max(preguntas.filter(p => p.categoria === 'encaje').length, 1);

      const res = await fetch('/api/portal/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nif: cliente.nif,
          subvencion_id: subv.id,
          match_id: match.id,
          preguntas_ia: preguntas,
          respuestas_ia: respuestasIA,
          encaje_score: encajeScore,
          nombre_firmante: firmante,
          dni_firmante: dni,
          contrato_firmado: true,
          metodo_pago: metodoPago,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al guardar');
      }
      onCompletado();
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13,31,60,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          width: '100%', maxWidth: 540,
          boxShadow: '0 24px 80px rgba(13,31,60,0.25)',
          overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ background: scoreInfo.bg, color: scoreInfo.color, border: `1px solid ${scoreInfo.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {scoreInfo.icon} {scoreInfo.text} · {Math.round(match.score * 100)}%
                </span>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: C.navy, lineHeight: 1.4, margin: 0 }}>
                {subv.titulo}
              </h3>
              {subv.organismo && (
                <p style={{ fontSize: '0.76rem', color: C.muted, marginTop: 4 }}>{subv.organismo}</p>
              )}
            </div>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={14} color={C.ink2} />
            </button>
          </div>

          {/* Pasos */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
            {[{ n: 1, label: 'Verificar encaje' }, { n: 2, label: 'Contrato' }, { n: 3, label: 'Método de pago' }].map(p => (
              <div key={p.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: paso === p.n ? C.navy : paso > p.n ? C.teal : '#e2e8f0',
                  color: paso >= p.n ? '#fff' : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 800,
                }}>
                  {paso > p.n ? <Check size={11} /> : p.n}
                </div>
                <span style={{ fontSize: '0.72rem', color: paso === p.n ? C.navy : C.muted, fontWeight: paso === p.n ? 700 : 400 }}>
                  {p.label}
                </span>
                {p.n < 3 && <div style={{ flex: 1, height: 1, background: paso > p.n ? C.teal : '#e2e8f0' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>

          {/* PASO 1: Cuestionario IA */}
          {paso === 1 && (
            <div>
              {cargandoPreguntas ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
                  <Loader2 size={24} color={C.teal} style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '0.85rem', color: C.muted }}>Generando cuestionario personalizado...</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: C.ink2, marginBottom: 20, lineHeight: 1.6 }}>
                    Responde estas {preguntas.length} preguntas para verificar el encaje con esta convocatoria y preparar tu solicitud:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {preguntas.map((preg) => {
                      const categoriaColor: Record<string, string> = {
                        encaje: '#dbeafe', proyecto: '#d1fae5',
                        empresa: '#fef3c7', documentacion: '#fce7f3',
                      };
                      const resp = respuestas[preg.id];
                      return (
                        <div key={preg.id} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', border: '1px solid #e8ecf4' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ background: categoriaColor[preg.categoria] ?? '#f1f5f9', borderRadius: 20, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, color: C.ink2, textTransform: 'uppercase' }}>
                              {preg.categoria}
                            </span>
                            {preg.obligatoria && <span style={{ color: C.red, fontSize: '0.7rem' }}>*</span>}
                          </div>
                          <p style={{ fontSize: '0.83rem', color: C.ink, fontWeight: 600, marginBottom: 6 }}>{preg.pregunta}</p>
                          {preg.contexto && (
                            <p style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>{preg.contexto}</p>
                          )}

                          {preg.tipo === 'si_no' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setResp(preg.id, true)}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                  background: resp === true ? '#dcfce7' : '#fff',
                                  border: `1.5px solid ${resp === true ? '#22c55e' : '#e2e8f0'}`,
                                  color: resp === true ? '#166534' : C.ink2,
                                }}
                              >✓ Sí</button>
                              <button
                                onClick={() => setResp(preg.id, false)}
                                style={{
                                  flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                  background: resp === false ? '#fef2f2' : '#fff',
                                  border: `1.5px solid ${resp === false ? '#ef4444' : '#e2e8f0'}`,
                                  color: resp === false ? '#dc2626' : C.ink2,
                                }}
                              >✗ No</button>
                            </div>
                          )}

                          {preg.tipo === 'texto_corto' && (
                            <input
                              value={typeof resp === 'string' ? resp : ''}
                              onChange={e => setResp(preg.id, e.target.value)}
                              placeholder="Tu respuesta..."
                              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${resp ? '#0d9488' : '#e2e8f0'}`, borderRadius: 8, fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', color: C.ink }}
                            />
                          )}

                          {preg.tipo === 'texto_largo' && (
                            <textarea
                              value={typeof resp === 'string' ? resp : ''}
                              onChange={e => setResp(preg.id, e.target.value)}
                              placeholder="Describe con detalle..."
                              rows={4}
                              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${resp ? '#0d9488' : '#e2e8f0'}`, borderRadius: 8, fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', color: C.ink, resize: 'vertical', fontFamily: 'inherit' }}
                            />
                          )}

                          {preg.tipo === 'numero' && (
                            <input
                              type="number"
                              value={typeof resp === 'number' ? resp : ''}
                              onChange={e => setResp(preg.id, e.target.valueAsNumber)}
                              placeholder="0"
                              style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${resp !== undefined ? '#0d9488' : '#e2e8f0'}`, borderRadius: 8, fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box', color: C.ink }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {todasRespondidas && (() => {
                    const totalEncaje = preguntas.filter(p => p.categoria === 'encaje').length;
                    const bueno = encajePositivo >= Math.ceil(totalEncaje * 0.7);
                    return (
                      <div style={{
                        marginTop: 16,
                        background: bueno ? '#f0fdf4' : '#fef9c3',
                        border: `1px solid ${bueno ? '#bbf7d0' : '#fde68a'}`,
                        borderRadius: 10, padding: '12px 16px', fontSize: '0.82rem',
                        color: bueno ? '#166534' : '#92400e',
                      }}>
                        {bueno
                          ? `✓ Perfecto, cumples ${encajePositivo}/${totalEncaje} criterios de encaje — buena base para esta solicitud.`
                          : `⚠ Cumples ${encajePositivo}/${totalEncaje} criterios de encaje — puede haber dificultades. Podemos continuar y revisaremos el expediente.`}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* PASO 2: Contrato */}
          {paso === 2 && (
            <div>
              <div style={{
                background: '#f8fafc', borderRadius: 12, padding: '16px 18px',
                border: '1px solid #e2e8f0', marginBottom: 20, maxHeight: 300, overflow: 'auto',
                fontSize: '0.78rem', color: C.ink2, lineHeight: 1.8,
              }}>
                <p style={{ fontWeight: 800, color: C.navy, marginBottom: 10, fontSize: '0.85rem' }}>
                  CONTRATO DE GESTIÓN DE SUBVENCIONES — MODELO DE ÉXITO
                </p>
                <p><strong>PARTES:</strong> AyudaPyme (en adelante, el Gestor) y {cliente.nombre_empresa || 'el Cliente'} con NIF {cliente.nif} (en adelante, el Cliente).</p>
                <br />
                <p><strong>OBJETO:</strong> El Gestor se compromete a identificar, preparar y presentar en nombre del Cliente la solicitud de la siguiente subvención: <em>"{subv.titulo}"</em> (BDNS #{subv.bdns_id}), convocada por {subv.organismo ?? 'el organismo convocante'}.</p>
                <br />
                <p><strong>HONORARIOS:</strong> Este contrato se rige bajo el modelo de éxito. El Cliente <strong>no abonará cantidad alguna</strong> si no se obtiene la subvención. En caso de concesión, el Cliente pagará al Gestor el <strong>15% del importe concedido</strong> (IVA no incluido), en el plazo de 30 días desde el cobro.</p>
                <br />
                <p><strong>OBLIGACIONES DEL CLIENTE:</strong> El Cliente se compromete a (i) aportar la documentación requerida en los plazos indicados, (ii) no contratar a otro gestor para la misma subvención durante la vigencia de este contrato, (iii) informar al Gestor de cualquier cambio relevante en su situación empresarial.</p>
                <br />
                <p><strong>DURACIÓN:</strong> El presente contrato estará vigente hasta la resolución definitiva de la convocatoria o hasta su cancelación por mutuo acuerdo.</p>
                <br />
                <p><strong>PROTECCIÓN DE DATOS:</strong> Los datos del Cliente serán tratados conforme al RGPD y la LOPDGDD únicamente para la prestación del servicio contratado.</p>
                <br />
                <p style={{ color: C.muted, fontSize: '0.72rem' }}>Firmado electrónicamente — IP registrada — Fecha y hora de firma quedan registradas en el sistema.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.ink2, display: 'block', marginBottom: 4 }}>
                    NOMBRE O RAZÓN SOCIAL DEL FIRMANTE
                  </label>
                  <input
                    value={firmante}
                    onChange={e => setFirmante(e.target.value)}
                    placeholder="Nombre completo o razón social"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', color: C.ink }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: C.ink2, display: 'block', marginBottom: 4 }}>
                    NIF / DNI DEL REPRESENTANTE
                  </label>
                  <input
                    value={dni}
                    onChange={e => setDni(e.target.value)}
                    placeholder="NIF de empresa o DNI del representante"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', color: C.ink }}
                  />
                </div>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 14px', background: aceptaContrato ? '#f0fdf4' : '#f8fafc', borderRadius: 10, border: `1.5px solid ${aceptaContrato ? '#22c55e' : '#e2e8f0'}` }}>
                  <input type="checkbox" checked={aceptaContrato} onChange={e => setAceptaContrato(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, accentColor: C.teal, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: C.ink, lineHeight: 1.5 }}>
                    He leído y acepto el contrato de gestión anterior. Declaro ser el representante legal autorizado para firmar en nombre de {cliente.nombre_empresa || 'mi empresa'} y asumo el compromiso de pago del 15% del importe subvencionado <strong>únicamente si se consigue la subvención</strong>.
                  </span>
                </label>
              </div>
              {error && <p style={{ color: C.red, fontSize: '0.78rem', marginTop: 10 }}>{error}</p>}
            </div>
          )}

          {/* PASO 3: Método de pago */}
          {paso === 3 && (
            <div>
              <p style={{ fontSize: '0.85rem', color: C.ink2, marginBottom: 8, lineHeight: 1.6 }}>
                Recuerda: <strong>no cobraremos nada</strong> hasta que consigas la subvención. Necesitamos el método de pago para cuando llegue ese momento.
              </p>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={14} color={C.green} />
                <span style={{ fontSize: '0.78rem', color: '#166534' }}>
                  Solo se realizará el cargo cuando la subvención sea <strong>efectivamente concedida y cobrada</strong>.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  {
                    key: 'tarjeta' as const,
                    icon: <CreditCard size={20} color={C.navy} />,
                    titulo: 'Tarjeta de crédito / débito',
                    desc: 'Visa, Mastercard, American Express — cargo automático al cobrar',
                  },
                  {
                    key: 'transferencia' as const,
                    icon: <Landmark size={20} color={C.navy} />,
                    titulo: 'Transferencia bancaria',
                    desc: 'Te enviaremos la factura cuando corresponda — 30 días para pagar',
                  },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMetodoPago(opt.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                      background: metodoPago === opt.key ? '#eff6ff' : '#f8fafc',
                      border: `2px solid ${metodoPago === opt.key ? '#3b82f6' : '#e2e8f0'}`,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>{opt.titulo}</div>
                      <div style={{ fontSize: '0.75rem', color: C.ink2, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    {metodoPago === opt.key && <Check size={18} color="#3b82f6" style={{ flexShrink: 0 }} />}
                  </button>
                ))}
              </div>

              {metodoPago === 'tarjeta' && (
                <div style={{ marginTop: 14, background: '#eff6ff', borderRadius: 10, padding: '12px 14px', fontSize: '0.78rem', color: '#1e40af' }}>
                  Guardaremos el método de pago de forma segura. El cargo solo se ejecutará tras la concesión. Recibirás un correo de confirmación.
                </div>
              )}
              {error && <p style={{ color: C.red, fontSize: '0.78rem', marginTop: 10 }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {paso > 1 ? (
            <button
              onClick={() => { setPaso(paso === 3 ? 2 : 1); setError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: C.ink2 }}
            >
              <ArrowLeft size={14} /> Atrás
            </button>
          ) : <div />}

          {paso === 1 && (
            <button
              onClick={avanzarPaso1}
              disabled={cargandoPreguntas || !todasRespondidas}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: (!cargandoPreguntas && todasRespondidas) ? C.navy : '#e2e8f0',
                color: (!cargandoPreguntas && todasRespondidas) ? '#fff' : C.muted,
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: '0.88rem', fontWeight: 700, cursor: (!cargandoPreguntas && todasRespondidas) ? 'pointer' : 'not-allowed',
              }}
            >
              {cargandoPreguntas ? <><Loader2 size={14} /> Cargando...</> : <>Continuar <ArrowRight size={14} /></>}
            </button>
          )}
          {paso === 2 && (
            <button
              onClick={avanzarPaso2}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.navy, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Firmar y continuar <ArrowRight size={14} />
            </button>
          )}
          {paso === 3 && (
            <button
              onClick={finalizarSolicitud}
              disabled={guardando || !metodoPago}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: metodoPago ? C.teal : '#e2e8f0',
                color: metodoPago ? '#fff' : C.muted,
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: '0.88rem', fontWeight: 700,
                cursor: guardando || !metodoPago ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
              {guardando ? 'Guardando…' : 'Confirmar solicitud'}
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Card de match ────────────────────────────────────────────────────────────

function MatchCard({
  match,
  cliente,
  onSolicitar,
}: {
  match: MatchItem;
  cliente: ClienteData;
  onSolicitar: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const subv = match.subvencion;
  const info = scoreLabel(match.score);
  const dias = diasRestantes(subv.plazo_fin);
  const urgente = dias !== null && dias >= 0 && dias <= 15;
  const solicitud = match.solicitud;
  const yaActiva = solicitud && ['activo', 'contrato_firmado', 'pago_pendiente'].includes(solicitud.estado);

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: `1px solid ${yaActiva ? '#bbf7d0' : C.border}`,
      overflow: 'hidden', width: '100%',
      boxShadow: urgente ? '0 0 0 2px #fef2f2, 0 4px 16px rgba(239,68,68,0.08)' : '0 2px 8px rgba(13,31,60,0.06)',
    }}>
      {/* Strip de color por score */}
      <div style={{ height: 4, background: info.color === C.fire ? 'linear-gradient(90deg,#f97316,#fbbf24)' : info.color === C.green ? 'linear-gradient(90deg,#059669,#34d399)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)' }} />

      <div style={{ padding: isMobile ? '14px 14px' : '18px 20px' }}>
        {/* Header card */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: isMobile ? 'stretch' : 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 800 }}>
                {info.icon} {info.text}
              </span>
              {urgente && (
                <span style={{ background: '#fef2f2', color: C.red, borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 800 }}>
                  ⚡ {dias}d restantes
                </span>
              )}
              {subv.estado_convocatoria === 'abierta' && !urgente && (
                <span style={{ background: '#f0fdf4', color: C.green, borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                  Abierta
                </span>
              )}
              {yaActiva && (
                <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem', fontWeight: 800 }}>
                  ✓ Solicitud activa
                </span>
              )}
              {isMobile && (
                <span style={{ marginLeft: 'auto', fontSize: '1.1rem', fontWeight: 900, color: info.color, lineHeight: 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {Math.round(match.score * 100)}%
                  <span style={{ fontSize: '0.58rem', color: C.muted, fontWeight: 600, marginLeft: 3 }}>encaje</span>
                </span>
              )}
            </div>
            <h3 style={{ fontSize: isMobile ? '0.84rem' : '0.9rem', fontWeight: 700, color: C.navy, lineHeight: 1.4, margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {subv.titulo}
            </h3>
            {subv.organismo && <p style={{ fontSize: '0.75rem', color: C.muted, marginTop: 3, wordBreak: 'break-word' }}>{subv.organismo}</p>}
          </div>
          {!isMobile && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: info.color, lineHeight: 1 }}>
                {Math.round(match.score * 100)}%
              </div>
              <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 600 }}>encaje</div>
            </div>
          )}
        </div>

        {/* Por qué encaja */}
        {match.motivos.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', marginBottom: 5 }}>POR QUÉ ENCAJA</p>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {match.motivos.map((m, i) => (
                <li key={i} style={{ fontSize: '0.78rem', color: '#1e3a8a', display: 'flex', alignItems: 'flex-start', gap: 6, wordBreak: 'break-word' }}>
                  <Check size={11} color="#3b82f6" style={{ marginTop: 2, flexShrink: 0 }} />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Importe */}
        {(subv.importe_maximo || subv.presupuesto_total) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '0.72rem', color: C.muted }}>
              {subv.importe_maximo ? 'Hasta:' : 'Presupuesto del programa:'}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: C.teal }}>
              {fmtE(subv.importe_maximo ?? subv.presupuesto_total)}
            </span>
            {subv.porcentaje_financiacion && (
              <span style={{ fontSize: '0.72rem', color: C.muted }}>({subv.porcentaje_financiacion}% cofinanciación)</span>
            )}
          </div>
        )}

        {/* Resumen expandible */}
        {expanded && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subv.resumen_ia && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, marginBottom: 4 }}>RESUMEN</p>
                <p style={{ fontSize: '0.8rem', color: C.ink2, lineHeight: 1.6, margin: 0, wordBreak: 'break-word' }}>{subv.resumen_ia}</p>
              </div>
            )}
            {subv.plazo_fin && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Clock size={12} color={C.muted} />
                <span style={{ fontSize: '0.78rem', color: C.ink2 }}>Cierre: <strong>{fmt(subv.plazo_fin)}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Footer card */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', color: C.ink2 }}
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
          {subv.url_oficial && (
            <a href={subv.url_oficial} target="_blank" rel="noopener noreferrer"
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', color: C.ink2, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} /> Oficial
            </a>
          )}
          {!yaActiva ? (
            <button
              onClick={onSolicitar}
              style={{
                marginLeft: isMobile ? 0 : 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: info.color === C.fire ? 'linear-gradient(90deg,#f97316,#ea580c)' :
                             info.color === C.green ? 'linear-gradient(90deg,#059669,#047857)' :
                             'linear-gradient(90deg,#1a3561,#1e40af)',
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '9px 18px', fontSize: '0.85rem', fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                ...(isMobile ? { width: '100%', marginTop: 4 } : {}),
              }}
            >
              <Star size={13} />
              Quiero esta
            </button>
          ) : (
            <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontSize: '0.8rem', fontWeight: 700 }}>
              <CheckCircle size={14} />
              Solicitud enviada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vista perfil empresa ──────────────────────────────────────────────────────

const CCAA = [
  'Andalucía','Aragón','Asturias','Baleares','Canarias','Cantabria','Castilla-La Mancha',
  'Castilla y León','Cataluña','Ceuta','Extremadura','Galicia','La Rioja','Madrid',
  'Melilla','Murcia','Navarra','País Vasco','Valencia',
];

const FORMAS_JURIDICAS = [
  { value: 'SL', label: 'Sociedad Limitada (SL)' },
  { value: 'SA', label: 'Sociedad Anónima (SA)' },
  { value: 'autonomo', label: 'Autónomo / Freelance' },
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'asociacion', label: 'Asociación / Fundación' },
  { value: 'otro', label: 'Otro' },
];

function VistaPerfilEmpresa({
  cliente,
  onGuardado,
}: {
  cliente: ClienteData | null;
  onGuardado: (actualizado: Partial<ClienteData>) => void;
}) {
  const [form, setForm] = useState({
    nombre_empresa: cliente?.nombre_empresa ?? '',
    cnae_codigo: cliente?.cnae_codigo ?? '',
    cnae_descripcion: cliente?.cnae_descripcion ?? '',
    comunidad_autonoma: cliente?.comunidad_autonoma ?? '',
    provincia: cliente?.provincia ?? '',
    ciudad: cliente?.ciudad ?? '',
    num_empleados: String(cliente?.num_empleados ?? ''),
    facturacion_anual: String(cliente?.facturacion_anual ?? ''),
    forma_juridica: cliente?.forma_juridica ?? '',
    anos_antiguedad: String(cliente?.anos_antiguedad ?? ''),
    descripcion_actividad: cliente?.descripcion_actividad ?? '',
    tamano_empresa: cliente?.tamano_empresa ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function set(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(''); setError('');

    const body: Record<string, unknown> = { ...form };
    if (body.num_empleados) body.num_empleados = parseInt(body.num_empleados as string, 10) || null;
    else body.num_empleados = null;
    if (body.facturacion_anual) body.facturacion_anual = parseFloat(body.facturacion_anual as string) || null;
    else body.facturacion_anual = null;
    if (body.anos_antiguedad) body.anos_antiguedad = parseInt(body.anos_antiguedad as string, 10) || null;
    else body.anos_antiguedad = null;

    const res = await fetch('/api/cliente/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); }
    else {
      setMsg('Guardado');
      onGuardado({
        nombre_empresa: form.nombre_empresa,
        cnae_descripcion: form.cnae_descripcion,
        comunidad_autonoma: form.comunidad_autonoma,
        ciudad: form.ciudad,
        num_empleados: form.num_empleados ? parseInt(form.num_empleados) : undefined,
      });
    }
    setLoading(false);
  }

  const completitud = [
    form.nombre_empresa, form.cnae_codigo, form.comunidad_autonoma,
    form.num_empleados, form.facturacion_anual, form.forma_juridica,
  ].filter(Boolean).length;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.navy, margin: 0 }}>Mi empresa</h1>
        <p style={{ color: C.ink2, fontSize: '0.85rem', marginTop: 4 }}>
          Cuantos más datos completes, más precisos serán tus matches de subvenciones.
        </p>
        {/* Barra de completitud */}
        <div style={{ marginTop: 12, background: '#f1f5f9', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 8,
            width: `${Math.round((completitud / 6) * 100)}%`,
            background: completitud === 6 ? '#059669' : completitud >= 4 ? '#0d9488' : '#3b82f6',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 4 }}>
          {completitud}/6 campos clave completados
        </div>
      </div>

      <form onSubmit={guardar}>
        {/* Datos básicos */}
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Datos básicos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Nombre de la empresa</label>
              <input
                value={form.nombre_empresa}
                onChange={e => set('nombre_empresa', e.target.value)}
                placeholder="Ej: TechNova SL"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Forma jurídica</label>
              <select
                value={form.forma_juridica}
                onChange={e => set('forma_juridica', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff', fontFamily: 'inherit' }}
              >
                <option value="">Seleccionar…</option>
                {FORMAS_JURIDICAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Años de antigüedad</label>
              <input
                type="number" min="0" max="100"
                value={form.anos_antiguedad}
                onChange={e => set('anos_antiguedad', e.target.value)}
                placeholder="Ej: 5"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* Actividad */}
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Actividad y sector
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>
                Código CNAE
                <span style={{ fontWeight: 400, color: C.muted }}> (4 dígitos)</span>
              </label>
              <input
                value={form.cnae_codigo}
                onChange={e => set('cnae_codigo', e.target.value.slice(0, 4))}
                placeholder="6201"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Descripción actividad (CNAE)</label>
              <input
                value={form.cnae_descripcion}
                onChange={e => set('cnae_descripcion', e.target.value)}
                placeholder="Ej: Programación informática"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Descripción libre de la actividad</label>
            <textarea
              value={form.descripcion_actividad}
              onChange={e => set('descripcion_actividad', e.target.value)}
              rows={3}
              placeholder="Describe brevemente a qué se dedica tu empresa..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Localización */}
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Localización
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Comunidad autónoma</label>
              <select
                value={form.comunidad_autonoma}
                onChange={e => set('comunidad_autonoma', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.82rem', background: '#fff', fontFamily: 'inherit' }}
              >
                <option value="">Seleccionar…</option>
                {CCAA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Provincia</label>
              <input
                value={form.provincia}
                onChange={e => set('provincia', e.target.value)}
                placeholder="Ej: Madrid"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Ciudad</label>
              <input
                value={form.ciudad}
                onChange={e => set('ciudad', e.target.value)}
                placeholder="Ej: Madrid"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* Tamaño */}
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Tamaño y finanzas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Número de empleados</label>
              <input
                type="number" min="0"
                value={form.num_empleados}
                onChange={e => set('num_empleados', e.target.value)}
                placeholder="Ej: 15"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>Tamaño empresa</label>
              <select
                value={form.tamano_empresa}
                onChange={e => set('tamano_empresa', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff', fontFamily: 'inherit' }}
              >
                <option value="">Seleccionar…</option>
                <option value="micro">Micro (1–9 empleados)</option>
                <option value="pequeña">Pequeña (10–49 empleados)</option>
                <option value="mediana">Mediana (50–249 empleados)</option>
                <option value="grande">Grande (250+ empleados)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: C.ink2, display: 'block', marginBottom: 5 }}>
                Facturación anual (€)
                <span style={{ fontWeight: 400, color: C.muted }}> aprox.</span>
              </label>
              <input
                type="number" min="0"
                value={form.facturacion_anual}
                onChange={e => set('facturacion_anual', e.target.value)}
                placeholder="Ej: 1500000"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: C.muted, marginTop: 10, marginBottom: 0 }}>
            Estos datos son confidenciales y solo se usan para calcular elegibilidad en subvenciones.
          </p>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 10, cursor: 'pointer',
              background: 'linear-gradient(90deg,#0d1f3c,#1d4ed8)',
              color: '#fff', border: 'none', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
            Guardar cambios
          </button>
          {msg && <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.85rem' }}>✓ {msg}</span>}
          {error && <span style={{ color: '#dc2626', fontSize: '0.82rem' }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}

// ─── Setup empresa (onboarding primer acceso) ─────────────────────────────────

const CCAA_SETUP = [
  'Andalucía','Aragón','Asturias','Baleares','Canarias','Cantabria',
  'Castilla-La Mancha','Castilla y León','Cataluña','Extremadura',
  'Galicia','La Rioja','Madrid','Murcia','Navarra','País Vasco','Valencia','Ceuta','Melilla',
];

function SetupEmpresa({ onComplete }: { onComplete: (nif: string) => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nif: '', nombre_empresa: '', telefono: '',
    actividad: '', tamano_empresa: '', comunidad_autonoma: '',
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const inputS: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: '0.9rem',
    color: C.ink, background: '#fff', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelS: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    color: C.ink2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nif.trim()) { setError('El NIF es obligatorio'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/portal/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); setLoading(false); return; }
    onComplete(data.nif);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: C.navy, borderRadius: 14, padding: '10px 18px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem', color: C.navy }}>AP</div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>AyudaPyme</span>
      </div>

      <div style={{ background: '#fff', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 520, boxShadow: '0 4px 32px rgba(13,31,60,0.1)' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.navy, margin: '0 0 8px' }}>
            {step === 1 ? '¡Bienvenido a AyudaPyme!' : 'Cuéntanos sobre tu empresa'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: C.ink2, margin: 0 }}>
            {step === 1
              ? 'Introduce el NIF de tu empresa para empezar a encontrar subvenciones.'
              : 'Con estos datos buscamos las subvenciones más adecuadas para ti.'}
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: s <= step ? C.teal : C.border }} />
          ))}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: '0.83rem', color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={step === 1 ? (e => { e.preventDefault(); if (!form.nif.trim()) { setError('El NIF es obligatorio'); return; } setError(''); setStep(2); }) : submit}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelS}>NIF / CIF de tu empresa *</label>
                <input type="text" value={form.nif} onChange={e => set('nif', e.target.value.toUpperCase())}
                  placeholder="B12345678" required style={{ ...inputS, textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={labelS}>Nombre de la empresa</label>
                <input type="text" value={form.nombre_empresa} onChange={e => set('nombre_empresa', e.target.value)}
                  placeholder="Razón social o nombre comercial" style={inputS} />
              </div>
              <div>
                <label style={labelS}>Teléfono de contacto</label>
                <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="600 123 456" style={inputS} />
              </div>
              <button type="submit" style={{ marginTop: 8, padding: '13px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Continuar →
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelS}>¿A qué se dedica tu empresa?</label>
                <input type="text" value={form.actividad} onChange={e => set('actividad', e.target.value)}
                  placeholder="Ej: Tecnología, construcción, hostelería..." style={inputS} />
              </div>
              <div>
                <label style={labelS}>Tamaño</label>
                <select value={form.tamano_empresa} onChange={e => set('tamano_empresa', e.target.value)} style={inputS}>
                  <option value="">Seleccionar...</option>
                  <option value="Autónomo">Autónomo</option>
                  <option value="Microempresa">Microempresa (&lt;10 empleados)</option>
                  <option value="Pequeña">Pequeña (10–49)</option>
                  <option value="Mediana">Mediana (50–249)</option>
                  <option value="Grande">Grande (250+)</option>
                </select>
              </div>
              <div>
                <label style={labelS}>Comunidad Autónoma</label>
                <select value={form.comunidad_autonoma} onChange={e => set('comunidad_autonoma', e.target.value)} style={inputS}>
                  <option value="">Seleccionar...</option>
                  {CCAA_SETUP.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink2, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Atrás
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: loading ? C.muted : C.teal, color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Guardando...' : 'Acceder al portal →'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Mi Gestor (chat) ─────────────────────────────────────────────────────────

interface MensajeGestor {
  id: string;
  remitente: 'cliente' | 'gestor' | 'ia';
  contenido: string;
  leido: boolean;
  created_at: string;
}

function BurbujaMensaje({ msg }: { msg: MensajeGestor }) {
  const esCliente = msg.remitente === 'cliente';
  const esIA = msg.remitente === 'ia';
  const hora = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const fecha = new Date(msg.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

  return (
    <div style={{ display: 'flex', flexDirection: esCliente ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
      {/* Avatar */}
      {!esCliente && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: esIA ? '#ede9fe' : '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {esIA ? <Bot size={14} color="#7c3aed" /> : <User size={14} color="#fff" />}
        </div>
      )}

      <div style={{ maxWidth: '72%' }}>
        {!esCliente && (
          <p style={{ fontSize: '0.68rem', color: C.muted, marginBottom: 3, fontWeight: 600, paddingLeft: 4 }}>
            {esIA ? 'Gestor IA · AyudaPyme' : 'Gestor · AyudaPyme'}
          </p>
        )}
        <div style={{
          background: esCliente ? 'linear-gradient(135deg,#0d1f3c,#1a3561)' : '#fff',
          color: esCliente ? '#fff' : C.ink,
          borderRadius: esCliente ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '10px 14px',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          border: esCliente ? 'none' : `1px solid ${C.border}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.contenido}
        </div>
        <p style={{ fontSize: '0.65rem', color: C.muted, marginTop: 3, textAlign: esCliente ? 'right' : 'left', paddingInline: 4 }}>
          {fecha === hoy ? hora : `${fecha} ${hora}`}
        </p>
      </div>
    </div>
  );
}

function VistaMiGestor({ nif }: { nif: string }) {
  const [mensajes, setMensajes] = useState<MensajeGestor[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    try {
      const res = await fetch('/api/portal/gestor');
      if (res.ok) {
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 20_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nif]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if ((!texto.trim() && !archivo) || enviando) return;
    const contenido = texto.trim();
    setTexto('');
    setArchivo(null);
    setEnviando(true);

    // Optimistic update
    const tempMsg: MensajeGestor = {
      id: 'temp',
      remitente: 'cliente',
      contenido: contenido || (archivo ? `[Archivo: ${archivo?.name}]` : ''),
      leido: true,
      created_at: new Date().toISOString(),
    };
    setMensajes(prev => [...prev, tempMsg]);

    try {
      let fetchOpts: RequestInit;
      if (archivo) {
        const fd = new FormData();
        if (contenido) fd.append('contenido', contenido);
        fd.append('adjunto', archivo);
        fetchOpts = { method: 'POST', body: fd };
      } else {
        fetchOpts = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido }),
        };
      }
      const res = await fetch('/api/portal/gestor', fetchOpts);
      if (res.ok) {
        const data = await res.json();
        setMensajes(data.mensajes ?? []);
      }
    } catch {
      setMensajes(prev => prev.filter(m => m.id !== 'temp'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

      {/* Header del chat */}
      <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '3px solid rgba(255,255,255,0.2)' }}>
          <User size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>Tu Gestor · AyudaPyme</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', margin: 0 }}>Normalmente responde en menos de 24h</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#dcfce7', borderRadius: 20, padding: '4px 10px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }} />
          <span style={{ fontSize: '0.7rem', color: '#065f46', fontWeight: 700 }}>Activo</span>
        </div>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, background: '#f8fafc' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={20} color={C.teal} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : mensajes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16, padding: '40px 20px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={28} color={C.teal} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: C.navy, marginBottom: 6 }}>Habla con tu gestor</p>
              <p style={{ fontSize: '0.85rem', color: C.ink2, lineHeight: 1.6, maxWidth: 340 }}>
                Pregunta lo que necesites sobre tus subvenciones, el estado de tus solicitudes, o cualquier duda sobre el proceso.
              </p>
            </div>
            {[
              '¿Cuáles son mis mejores opciones ahora mismo?',
              '¿Cómo funciona el proceso de solicitud?',
              '¿Cuándo me pagaréis si me conceden la subvención?',
            ].map(sugerencia => (
              <button key={sugerencia} onClick={() => setTexto(sugerencia)}
                style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20, padding: '8px 16px', fontSize: '0.8rem', color: C.ink2, cursor: 'pointer', fontFamily: 'inherit' }}>
                {sugerencia}
              </button>
            ))}
          </div>
        ) : (
          mensajes.map(m => <BurbujaMensaje key={m.id} msg={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', background: '#fff', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        {archivo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '5px 10px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <Paperclip size={12} color="#3b82f6" />
            <span style={{ fontSize: '0.78rem', color: '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.name}</span>
            <button onClick={() => setArchivo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 2 }}>
              <X size={12} />
            </button>
          </div>
        )}
        <form onSubmit={enviar} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => setArchivo(e.target.files?.[0] ?? null)} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar archivo"
            style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${C.border}`, background: archivo ? '#eff6ff' : '#fff', color: archivo ? '#3b82f6' : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Paperclip size={16} />
          </button>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar(e as unknown as React.FormEvent))}
            placeholder="Escribe tu mensaje..."
            disabled={enviando}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 24, border: `1.5px solid ${C.border}`, fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', background: enviando ? '#f8fafc' : '#fff', color: C.ink }}
          />
          <button
            type="submit"
            disabled={(!texto.trim() && !archivo) || enviando}
            style={{ width: 42, height: 42, borderRadius: '50%', background: ((!texto.trim() && !archivo) || enviando) ? C.border : C.teal, border: 'none', cursor: ((!texto.trim() && !archivo) || enviando) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {enviando ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color="#fff" />}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Vista = 'dashboard' | 'ayudas' | 'expedientes' | 'perfil' | 'gestor';

export default function PortalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [setupPendiente, setSetupPendiente] = useState(false);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [expedienteActivo, setExpedienteActivo] = useState<Expediente | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [cargandoChecklist, setCargandoChecklist] = useState(false);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [matchSolicitando, setMatchSolicitando] = useState<MatchItem | null>(null);
  const [toast, setToast] = useState('');
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }

      const { data: perfil } = await supabase
        .from('perfiles').select('rol, nif').eq('id', user.id).maybeSingle();

      if (perfil?.rol === 'admin') { router.replace('/clientes'); return; }

      if (perfil?.nif) {
        // Cargar datos del cliente
        const { data: cli } = await supabase.from('cliente')
          .select('nif,nombre_empresa,nombre_normalizado,ciudad,comunidad_autonoma,cnae_codigo,cnae_descripcion,tamano_empresa,num_empleados,facturacion_anual,provincia,forma_juridica,anos_antiguedad,descripcion_actividad')
          .eq('nif', perfil.nif).maybeSingle();
        setCliente(cli);

        // Cargar matches con subvenciones
        const { data: matchData } = await supabase
          .from('cliente_subvencion_match')
          .select(`
            id, score, motivos, estado, es_hard_exclude, detalle_scoring,
            subvenciones!inner(
              id, bdns_id, titulo, organismo, objeto, resumen_ia, para_quien,
              importe_maximo, presupuesto_total, porcentaje_financiacion, plazo_fin, plazo_inicio,
              estado_convocatoria, ambito_geografico, url_oficial
            )
          `)
          .eq('nif', perfil.nif)
          .eq('es_hard_exclude', false)
          .gte('score', 0.1)
          .order('score', { ascending: false })
          .limit(30);

        // Cargar solicitudes existentes
        const { data: solis } = await supabase
          .from('solicitudes')
          .select('id, estado, contrato_firmado, metodo_pago_ok, subvencion_id')
          .eq('nif', perfil.nif);

        const soliMap = Object.fromEntries((solis ?? []).map(s => [s.subvencion_id, s]));

        const matchItems: MatchItem[] = (matchData ?? []).map((m: Record<string, unknown>) => {
          const subv = (m.subvenciones as Record<string, unknown>);
          return {
            id: m.id as string,
            score: m.score as number,
            motivos: (m.motivos as string[]) ?? [],
            estado: m.estado as string,
            es_hard_exclude: m.es_hard_exclude as boolean,
            detalle_scoring: m.detalle_scoring as Record<string, number>,
            subvencion: {
              id: subv.id as string,
              bdns_id: subv.bdns_id as string,
              titulo: subv.titulo as string,
              organismo: subv.organismo as string,
              objeto: subv.objeto as string,
              resumen_ia: subv.resumen_ia as string,
              para_quien: subv.para_quien as string,
              importe_maximo: subv.importe_maximo as number,
              presupuesto_total: subv.presupuesto_total as number,
              porcentaje_financiacion: subv.porcentaje_financiacion as number,
              plazo_fin: subv.plazo_fin as string,
              plazo_inicio: subv.plazo_inicio as string,
              estado_convocatoria: subv.estado_convocatoria as string,
              ambito_geografico: subv.ambito_geografico as string,
              url_oficial: subv.url_oficial as string,
            },
            solicitud: soliMap[subv.id as string],
          };
        });
        setMatches(matchItems);

        // Cargar expedientes
        const { data: expData } = await supabase
          .from('expediente')
          .select('id, numero_bdns, estado, fase, titulo, organismo, plazo_solicitud, created_at, contrato_firmado')
          .eq('nif', perfil.nif)
          .order('created_at', { ascending: false });
        setExpedientes(expData ?? []);

        // Contar mensajes no leídos del gestor/IA (tabla puede no existir aún)
        try {
          const { count } = await supabase
            .from('mensajes_gestor')
            .select('id', { count: 'exact', head: true })
            .eq('nif', perfil.nif)
            .in('remitente', ['gestor', 'ia'])
            .eq('leido', false);
          setMensajesNoLeidos(count ?? 0);
        } catch { /* tabla mensajes_gestor pendiente de migración */ }
      } else {
        // Usuario nuevo sin empresa vinculada → mostrar onboarding
        setSetupPendiente(true);
      }

      setChecking(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSolicitudCompletada() {
    setMatchSolicitando(null);
    setToast('✓ Solicitud registrada. Nuestro equipo se pondrá en contacto pronto.');
    setTimeout(() => setToast(''), 5000);
    setMatches(prev => prev.map(m =>
      m.id === matchSolicitando?.id
        ? { ...m, solicitud: { id: 'new', estado: 'activo', contrato_firmado: true, metodo_pago_ok: true } }
        : m
    ));
    // Ir a expedientes tras confirmar
    setTimeout(() => { setVista('expedientes'); }, 1500);
  }

  async function abrirExpediente(exp: Expediente) {
    setExpedienteActivo(exp);
    setCargandoChecklist(true);
    setChecklist([]);
    const supabase = createClient();
    const { data } = await supabase
      .from('checklist_items')
      .select('id, nombre, descripcion, categoria, obligatorio, completado, orden')
      .eq('expediente_id', exp.id)
      .order('orden');
    setChecklist(data ?? []);
    setCargandoChecklist(false);
  }

  async function subirDocumento(item: ChecklistItem, file: File) {
    if (!cliente?.nif || !expedienteActivo) return;
    setSubiendoDoc(item.id);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `${cliente.nif}/${expedienteActivo.id}/${item.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('archivos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      // Marcar como completado
      await supabase.from('checklist_items').update({ completado: true }).eq('id', item.id);
      setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, completado: true } : i));
      setToast('✓ Documento subido correctamente');
      setTimeout(() => setToast(''), 4000);
    } catch (e) {
      setToast('Error al subir el documento. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSubiendoDoc(null);
    }
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f6fb' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#1a3561' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (setupPendiente) {
    return <SetupEmpresa onComplete={async (nif) => {
      // Recargar datos tras setup
      const { data: cli } = await supabase.from('cliente')
        .select('nif,nombre_empresa,nombre_normalizado,ciudad,comunidad_autonoma,cnae_codigo,cnae_descripcion,tamano_empresa,num_empleados,facturacion_anual,provincia,forma_juridica,anos_antiguedad,descripcion_actividad')
        .eq('nif', nif).maybeSingle();
      setCliente(cli);
      setSetupPendiente(false);
    }} />;
  }

  const nombre = cliente?.nombre_empresa ?? cliente?.nombre_normalizado ?? 'tu empresa';
  const matchesActivos = matches.filter(m => m.subvencion.estado_convocatoria === 'abierta');
  const matchesFuego = matches.filter(m => m.score >= 0.65);
  const totalPotencial = matches.reduce((s, m) => s + (m.subvencion.importe_maximo ?? m.subvencion.presupuesto_total ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{ background: C.navy, padding: isMobile ? '0 12px' : '0 24px', display: 'flex', alignItems: 'center', height: 56, gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 100 }}>
        {isMobile && (
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sidebarOpen ? <X size={18} color="#fff" /> : <Menu size={18} color="#fff" />}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', color: C.navy }}>AP</div>
          {!isMobile && <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>AyudaPyme</span>}
        </div>
        <div style={{ flex: 1 }} />
        {matchesFuego.length > 0 && (
          <div style={{ background: '#f97316', borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={11} /> {matchesFuego.length} {!isMobile && <>muy recomendable{matchesFuego.length > 1 ? 's' : ''}</>}
          </div>
        )}
        <button onClick={() => setVista('gestor')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Bell size={16} color="#fff" />
          {mensajesNoLeidos > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: '#f97316', borderRadius: '50%', fontSize: '0.6rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
            </span>
          )}
        </button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={16} color="#fff" />
        </div>
        {!isMobile && (
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <LogOut size={13} /> Salir
          </button>
        )}
      </nav>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>

        {/* SIDEBAR OVERLAY (mobile) */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, top: 56, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
          />
        )}

        {/* SIDEBAR */}
        <aside style={{
          width: 220, background: '#fff', borderRight: `1px solid ${C.border}`, padding: '20px 0',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          ...(isMobile ? {
            position: 'fixed', top: 56, left: 0, bottom: 0, zIndex: 95,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            boxShadow: sidebarOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
          } : {}),
        }}>
          {[
            { key: 'dashboard', label: 'Inicio', icon: <Star size={15} /> },
            { key: 'ayudas', label: 'Mis subvenciones', icon: <FileText size={15} />, badge: matchesActivos.length || undefined },
            { key: 'expedientes', label: 'Expedientes', icon: <CheckCircle size={15} />, badge: expedientes.length || undefined },
            { key: 'gestor', label: 'Mi Gestor', icon: <MessageCircle size={15} />, badge: mensajesNoLeidos || undefined },
            { key: 'perfil', label: 'Mi empresa', icon: <Building2 size={15} />, badge: !cliente?.cnae_descripcion ? '!' : undefined },
          ].map(item => (
            <button key={item.key} onClick={() => { setVista(item.key as Vista); if (isMobile) setSidebarOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px', background: vista === item.key ? '#eff6ff' : 'none',
                border: 'none', borderLeft: `3px solid ${vista === item.key ? '#3b82f6' : 'transparent'}`,
                cursor: 'pointer', color: vista === item.key ? '#1e40af' : C.ink2,
                fontWeight: vista === item.key ? 700 : 500, fontSize: '0.85rem',
                textAlign: 'left', width: '100%',
              }}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ background: vista === item.key ? '#3b82f6' : '#f1f5f9', color: vista === item.key ? '#fff' : C.ink2, borderRadius: 10, padding: '1px 7px', fontSize: '0.65rem', fontWeight: 800 }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Perfil incompleto */}
          {!cliente?.cnae_descripcion && (
            <button
              onClick={() => { setVista('perfil'); if (isMobile) setSidebarOpen(false); }}
              style={{ margin: '0 12px 12px', background: '#fffbeb', borderRadius: 12, padding: '12px 14px', border: '1px solid #fde68a', textAlign: 'left', cursor: 'pointer', width: 'calc(100% - 24px)', fontFamily: 'inherit' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Completa tu perfil</p>
              <p style={{ fontSize: '0.7rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                Añade tu CNAE y comunidad autónoma para mejores matches.
              </p>
            </button>
          )}

          {/* Salir (mobile) */}
          {isMobile && (
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              style={{ margin: '0 12px 12px', background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', color: C.ink2, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, width: 'calc(100% - 24px)', fontFamily: 'inherit' }}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          )}

          <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, marginBottom: 2 }}>
              {nombre.length > 22 ? nombre.slice(0, 22) + '…' : nombre}
            </p>
            {cliente?.ciudad && <p style={{ fontSize: '0.68rem', color: C.muted }}>{cliente.ciudad}</p>}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: isMobile ? '20px 14px' : '28px 32px', overflowX: 'hidden', overflowY: 'auto', minWidth: 0 }}>

          {/* ── DASHBOARD ── */}
          {vista === 'dashboard' && (
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.navy, marginBottom: 4 }}>
                Hola, {nombre.split(' ')[0]} 👋
              </h1>
              <p style={{ color: C.ink2, marginBottom: 24, fontSize: '0.9rem' }}>
                Hemos encontrado <strong>{matches.length} subvenciones</strong> que podrían encajar con tu empresa.
              </p>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
                {[
                  { label: 'Subvenciones abiertas', value: String(matchesActivos.length), sub: 'En plazo ahora mismo', color: C.green, bg: '#f0fdf4' },
                  { label: 'Muy recomendables', value: String(matchesFuego.length), sub: 'Encaje alto con tu empresa', color: C.fire, bg: '#fff7ed' },
                  { label: 'Importe potencial', value: totalPotencial > 0 ? fmtE(totalPotencial) ?? 'A calcular' : 'A calcular', sub: totalPotencial > 0 ? 'Suma de presupuestos disponibles' : 'Pendiente de datos', color: C.teal, bg: '#f0fdfa' },
                ].map(card => (
                  <div key={card.label} style={{ background: card.bg, borderRadius: 14, padding: '16px 18px', border: `1px solid ${card.bg}` }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.navy, marginTop: 2 }}>{card.label}</div>
                    <div style={{ fontSize: '0.7rem', color: C.muted }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Banner si hay matches urgentes */}
              {matchesFuego.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg,#0d1f3c,#1a3561)',
                  borderRadius: 16, padding: isMobile ? '16px 16px' : '20px 24px', marginBottom: 24,
                  display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                  flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 12 : 16,
                  color: '#fff',
                }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={22} color="#fbbf24" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>
                      {matchesFuego.length} subvención{matchesFuego.length > 1 ? 'es' : ''} con muy alto encaje
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', margin: '3px 0 0' }}>
                      Estas son las más relevantes para tu empresa. Actúa antes de que cierren los plazos.
                    </p>
                  </div>
                  <button onClick={() => setVista('ayudas')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f97316', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                    Ver todas <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Indicador foco Galicia — solo para clientes de Galicia */}
              {cliente?.comunidad_autonoma === 'Galicia' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 20,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  marginBottom: 16, width: 'fit-content',
                }}>
                  <span style={{ fontSize: '0.8rem' }}>🌍</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#065f46' }}>
                    Galicia · Cobertura nacional próximamente
                  </span>
                </div>
              )}

              {/* Top 3 matches */}
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: C.navy, marginBottom: 14 }}>
                Top subvenciones para ti
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {matches.slice(0, 3).map(m => (
                  <MatchCard key={m.id} match={m} cliente={cliente!} onSolicitar={() => setMatchSolicitando(m)} />
                ))}
                {matches.length > 3 && (
                  <button onClick={() => setVista('ayudas')}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: 12, padding: '14px', cursor: 'pointer', color: C.ink2, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Ver las {matches.length - 3} subvenciones restantes <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── AYUDAS ── */}
          {vista === 'ayudas' && (
            <div style={{ maxWidth: 820, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.navy, margin: 0 }}>Mis subvenciones</h1>
                <span style={{ background: '#f1f5f9', color: C.muted, borderRadius: 20, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {matches.length} encontradas
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {matches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
                    <FileText size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p style={{ fontSize: '0.9rem' }}>No hay subvenciones en este momento. Vuelve pronto.</p>
                  </div>
                ) : (
                  matches.map(m => (
                    <MatchCard key={m.id} match={m} cliente={cliente!} onSolicitar={() => setMatchSolicitando(m)} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── EXPEDIENTES ── */}
          {vista === 'expedientes' && (() => {
            const estadoMap: Record<string, { bg: string; color: string; label: string; desc: string }> = {
              en_tramitacion: { bg: '#eff6ff', color: C.blue,  label: 'En tramitación',  desc: 'Estamos preparando la documentación para la presentación.' },
              pendiente_docs: { bg: '#fefce8', color: C.amber, label: 'Pendiente de docs', desc: 'Necesitamos documentos de tu empresa para continuar.' },
              presentado:     { bg: '#f0fdf4', color: C.green, label: 'Presentado',        desc: 'La solicitud ha sido presentada. Esperando resolución.' },
              subsanacion:    { bg: '#fff7ed', color: C.fire,  label: 'Subsanación',       desc: 'La administración solicita correcciones. Estamos en ello.' },
              concedido:      { bg: '#dcfce7', color: C.green, label: 'Concedido ✓',       desc: '¡Enhorabuena! La subvención ha sido aprobada.' },
              denegado:       { bg: '#fef2f2', color: C.red,   label: 'Denegado',          desc: 'La solicitud no fue aprobada en esta convocatoria.' },
              cerrado:        { bg: '#f1f5f9', color: C.muted, label: 'Cerrado',           desc: 'Expediente cerrado.' },
            };

            if (expedienteActivo) {
              const est = estadoMap[expedienteActivo.estado] ?? { bg: '#f1f5f9', color: C.muted, label: expedienteActivo.estado, desc: '' };
              const completados = checklist.filter(i => i.completado).length;
              const total = checklist.length;
              const pct = total > 0 ? Math.round((completados / total) * 100) : 0;
              const porCategoria = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
                const cat = item.categoria ?? 'Documentación';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
              }, {});

              return (
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                  {/* Breadcrumb */}
                  <button onClick={() => setExpedienteActivo(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                    <ArrowLeft size={14} /> Todos los expedientes
                  </button>

                  {/* Cabecera expediente */}
                  <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '24px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.navy, marginBottom: 4 }}>
                          {expedienteActivo.titulo ?? (expedienteActivo.numero_bdns ? `Subvención BDNS #${expedienteActivo.numero_bdns}` : 'Expediente en gestión')}
                        </div>
                        {expedienteActivo.organismo && (
                          <div style={{ fontSize: '0.8rem', color: C.muted, marginBottom: 8 }}>{expedienteActivo.organismo}</div>
                        )}
                        <span style={{ background: est.bg, color: est.color, borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                          {est.label}
                        </span>
                      </div>
                      {expedienteActivo.plazo_solicitud && (
                        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plazo</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: C.navy }}>{fmt(expedienteActivo.plazo_solicitud)}</div>
                          {(() => { const d = diasRestantes(expedienteActivo.plazo_solicitud); return d !== null && d > 0 ? <div style={{ fontSize: '0.72rem', color: d <= 14 ? C.red : C.muted }}>{d} días</div> : null; })()}
                        </div>
                      )}
                    </div>
                    {est.desc && (
                      <div style={{ background: est.bg, border: `1px solid ${est.color}22`, borderRadius: 10, padding: '10px 14px', marginTop: 16, fontSize: '0.83rem', color: est.color, fontWeight: 600 }}>
                        {est.desc}
                      </div>
                    )}
                  </div>

                  {/* Progreso documentación */}
                  {total > 0 && (
                    <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy }}>Documentación</div>
                        <div style={{ fontSize: '0.8rem', color: pct === 100 ? C.green : C.muted, fontWeight: 700 }}>
                          {completados}/{total} documentos {pct === 100 ? '✓ Completo' : ''}
                        </div>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: 999, height: 8, overflow: 'hidden', marginBottom: 20 }}>
                        <div style={{ background: pct === 100 ? C.green : C.teal, height: '100%', width: `${pct}%`, borderRadius: 999, transition: 'width 0.4s ease' }} />
                      </div>

                      {cargandoChecklist ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando checklist…
                        </div>
                      ) : (
                        Object.entries(porCategoria).map(([cat, items]) => (
                          <div key={cat} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{cat}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {items.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: item.completado ? '#f0fdf4' : '#fafafa', borderRadius: 10, border: `1px solid ${item.completado ? '#bbf7d0' : C.border}`, padding: '12px 14px' }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 6, background: item.completado ? C.green : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                    {item.completado ? <Check size={13} color="#fff" /> : <span style={{ fontSize: '0.65rem', color: C.muted, fontWeight: 700 }}>{item.orden}</span>}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: item.completado ? C.green : C.navy }}>
                                      {item.nombre}
                                      {item.obligatorio && !item.completado && <span style={{ color: C.red, marginLeft: 4 }}>*</span>}
                                    </div>
                                    {item.descripcion && (
                                      <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 2 }}>{item.descripcion}</div>
                                    )}
                                  </div>
                                  {!item.completado && (
                                    <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                                      <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(item, f); }} />
                                      <div style={{ background: subiendoDoc === item.id ? '#e2e8f0' : C.teal, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.2s' }}>
                                        {subiendoDoc === item.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
                                        {subiendoDoc === item.id ? 'Subiendo…' : 'Subir'}
                                      </div>
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}

                      {checklist.length === 0 && !cargandoChecklist && (
                        <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '0.82rem' }}>
                          Tu gestor preparará la lista de documentos necesarios pronto.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline de fases */}
                  <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, marginBottom: 16 }}>Proceso de tramitación</div>
                    {(() => {
                      const FASE_A_PASO: Record<string, number> = {
                        'preparacion': 0,
                        'presentada': 1,
                        'instruccion': 2,
                        'resolucion_provisional': 2,
                        'alegaciones': 2,
                        'resolucion_definitiva': 3,
                        'aceptacion': 3,
                        'ejecucion': 3,
                        'justificacion': 3,
                        'cobro': 4,
                        'denegada': -1,
                        'desistida': -1,
                      };
                      const faseActualIdx = FASE_A_PASO[expedienteActivo.fase ?? ''] ?? 0;
                      return [
                        { key: 'solicitud',     label: 'Solicitud recibida',   desc: 'Has solicitado esta subvención' },
                        { key: 'documentacion', label: 'Documentación',        desc: 'Recopilación de documentos necesarios' },
                        { key: 'presentacion',  label: 'Presentación',         desc: 'Envío oficial a la administración' },
                        { key: 'resolucion',    label: 'Resolución',           desc: 'Respuesta de la administración' },
                        { key: 'cobro',         label: 'Cobro',                desc: 'Recepción del importe concedido' },
                      ].map((fase, idx) => {
                      const done    = idx < faseActualIdx;
                      const current = idx === faseActualIdx;
                      return (
                        <div key={fase.key} style={{ display: 'flex', gap: 14, paddingBottom: idx < 4 ? 20 : 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? C.green : current ? C.teal : '#e2e8f0', border: `2px solid ${done ? C.green : current ? C.teal : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {done ? <Check size={14} color="#fff" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: current ? '#fff' : 'transparent', display: 'block' }} />}
                            </div>
                            {idx < 4 && <div style={{ width: 2, flex: 1, background: done ? C.green : '#e2e8f0', marginTop: 4 }} />}
                          </div>
                          <div style={{ paddingBottom: 4 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: current ? 800 : 600, color: current ? C.navy : done ? C.green : C.muted }}>{fase.label}</div>
                            <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: 1 }}>{fase.desc}</div>
                          </div>
                        </div>
                      );
                    });
                    })()}
                  </div>
                </div>
              );
            }

            return (
              <div style={{ maxWidth: 700, margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: C.navy, marginBottom: 20 }}>Mis expedientes</h1>
                {expedientes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
                    <CheckCircle size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                    <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Aún no tienes expedientes activos</p>
                    <p style={{ fontSize: '0.82rem', marginTop: 6 }}>Cuando solicites una subvención y la aprobemos, aparecerá aquí.</p>
                    <button onClick={() => setVista('ayudas')}
                      style={{ marginTop: 16, background: C.navy, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Ver subvenciones disponibles <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {expedientes.map(exp => {
                      const est = estadoMap[exp.estado] ?? { bg: '#f1f5f9', color: C.muted, label: exp.estado, desc: '' };
                      return (
                        <button key={exp.id} onClick={() => abrirExpediente(exp)}
                          style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'box-shadow 0.15s' }}>
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: exp.contrato_firmado ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={18} color={exp.contrato_firmado ? C.green : C.muted} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>
                              {exp.titulo ?? (exp.numero_bdns ? `Subvención BDNS #${exp.numero_bdns}` : 'Expediente en gestión')}
                            </div>
                            {exp.organismo && <div style={{ fontSize: '0.74rem', color: C.muted, marginTop: 1 }}>{exp.organismo}</div>}
                            <div style={{ fontSize: '0.74rem', color: C.muted, marginTop: 2 }}>
                              Abierto el {fmt(exp.created_at)}
                              {exp.plazo_solicitud && (() => { const d = diasRestantes(exp.plazo_solicitud); return d !== null && d > 0 ? <span style={{ color: d <= 7 ? C.red : C.amber, marginLeft: 8, fontWeight: 700 }}> · {d}d para plazo</span> : null; })()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: est.bg, color: est.color, borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                              {est.label}
                            </span>
                            <ChevronRight size={16} color={C.muted} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* ── MI GESTOR ── */}
          {vista === 'gestor' && cliente?.nif && (
            <VistaMiGestor nif={cliente.nif} />
          )}

          {/* ── PERFIL ── */}
          {vista === 'perfil' && (
            <VistaPerfilEmpresa
              cliente={cliente}
              onGuardado={(actualizado) => {
                setCliente(prev => prev ? { ...prev, ...actualizado } : null);
                setToast('✓ Perfil actualizado. Recalculando matches…');
                setTimeout(() => setToast(''), 5000);
              }}
            />
          )}

        </main>
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

      {/* Modal solicitud */}
      {matchSolicitando && cliente && (
        <ModalSolicitud
          match={matchSolicitando}
          cliente={cliente}
          onClose={() => setMatchSolicitando(null)}
          onCompletado={onSolicitudCompletada}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
