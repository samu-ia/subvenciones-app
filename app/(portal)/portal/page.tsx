'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ─── TIPOS ─────────────────────────────────────────────────────────────────── */
interface ClienteData {
  id?: string;
  nombre?: string;
  nif?: string;
  sector?: string;
  tamano_empresa?: string;
  ciudad?: string;
  cnae?: string;
}

interface MatchSubvencion {
  id: string;
  titulo: string;
  organismo?: string;
  importe_max?: number;
  fecha_fin?: string;
  objeto?: string;
  bdns_id?: string;
}

interface Match {
  id: string;
  score: number;
  razon_encaje?: string;
  requisitos_ok?: string[];
  requisitos_riesgo?: string[];
  subvencion: MatchSubvencion;
}

interface Expediente {
  id: string;
  titulo?: string;
  estado: string;
  created_at: string;
  numero_bdns?: number;
}

/* ─── COLORES ────────────────────────────────────────────────────────────────── */
const C = {
  navy: '#0d1f3c',
  navy2: '#162d52',
  teal: '#0d7377',
  bg: '#f4f6fb',
  surface: '#fff',
  border: '#e8ecf4',
  ink: '#0d1f3c',
  ink2: '#4a5568',
  muted: '#94a3b8',
  green: '#059669',
  greenBg: '#ecfdf5',
  greenBorder: '#a7f3d0',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBorder: '#fcd34d',
  red: '#dc2626',
  redBg: '#fef2f2',
  blue: '#1d4ed8',
  blueBg: '#eff4ff',
  blueBorder: '#bfdbfe',
  fire: '#f97316',
};

/* ─── UTILIDADES ────────────────────────────────────────────────────────────── */
function getScoreStyle(score: number) {
  if (score >= 0.7) return { text: '🔥 Muy recomendable', bg: '#fff7ed', color: C.fire, border: '#fed7aa' };
  if (score >= 0.4) return { text: '👍 Posible encaje',   bg: C.greenBg, color: C.green, border: C.greenBorder };
  return                 { text: '⚠️ Encaje bajo',        bg: '#f8fafc',  color: C.muted, border: C.border };
}

function getStrip(score: number) {
  if (score >= 0.7) return 'linear-gradient(90deg,#f97316,#fbbf24)';
  if (score >= 0.4) return `linear-gradient(90deg,${C.green},#34d399)`;
  return 'linear-gradient(90deg,#94a3b8,#cbd5e1)';
}

function getDias(fechaFin?: string): number | null {
  if (!fechaFin) return null;
  return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86400000);
}

function fmtImporte(n?: number): string {
  if (!n) return '';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')} M€`;
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('es-ES')}k €`;
  return `${n.toLocaleString('es-ES')} €`;
}

function initials(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'U';
}

/* ─── COMPONENTE: MATCH CARD ────────────────────────────────────────────────── */
function MatchCard({ match, onEncaje }: { match: Match; onEncaje: (m: Match) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const s = match.subvencion;
  const sl = getScoreStyle(match.score);
  const dias = getDias(s.fecha_fin);
  const reqOk = match.requisitos_ok ?? [];
  const reqRiesgo = match.requisitos_riesgo ?? [];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.surface, border: `1px solid ${hovered ? '#d0d5e8' : C.border}`,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: hovered ? '0 4px 16px rgba(13,31,60,.1)' : '0 1px 3px rgba(13,31,60,.06)',
        marginBottom: 12, transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Strip */}
      <div style={{ height: 3, background: getStrip(match.score) }} />

      {/* Main */}
      <div style={{ padding: '16px 20px' }}>
        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
            fontWeight: 700, padding: '3px 10px', borderRadius: 100,
            background: sl.bg, color: sl.color, border: `1px solid ${sl.border}`,
          }}>
            {sl.text}
          </span>
          {s.fecha_fin && new Date(s.fecha_fin) > new Date() && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
              fontWeight: 600, padding: '3px 9px', borderRadius: 100,
              background: C.greenBg, color: C.green,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              Abierta
            </span>
          )}
          {dias !== null && dias >= 0 && dias <= 30 && (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
              background: C.redBg, color: C.red,
            }}>
              ⏰ {dias} días
            </span>
          )}
        </div>

        {/* Título */}
        <div style={{ fontWeight: 700, fontSize: 15, color: C.ink, lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.01em' }}>
          {s.titulo}
        </div>

        {/* Why box */}
        {match.razon_encaje && (
          <div style={{ background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 9, padding: '10px 13px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3b82f6', marginBottom: 3 }}>
              Por qué encaja con tu empresa
            </div>
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55 }}>{match.razon_encaje}</div>
          </div>
        )}

        {/* Importe */}
        {s.importe_max ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.teal, letterSpacing: '-0.02em' }}>
              Hasta {fmtImporte(s.importe_max)}
            </span>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>importe máximo</span>
          </div>
        ) : null}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: '10px 20px', background: 'none', border: 'none',
          borderTop: `1px solid ${C.border}`, fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 12, fontWeight: 600, color: expanded ? C.ink2 : C.muted,
          cursor: 'pointer', textAlign: 'left', transition: 'color .15s',
        }}
      >
        <span style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          background: expanded ? C.navy : C.bg, border: `1px solid ${expanded ? C.navy : C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: expanded ? '#fff' : C.muted,
          transform: expanded ? 'rotate(180deg)' : 'none', transition: 'all .25s',
        }}>↓</span>
        {expanded ? 'Ocultar detalles' : 'Ver detalles y análisis de riesgos'}
      </button>

      {/* Detalles expandibles */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {s.objeto && (
            <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.65 }}>{s.objeto}</div>
          )}

          {(reqOk.length > 0 || reqRiesgo.length > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 6 }}>
                Checklist de elegibilidad
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {reqOk.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink2 }}>
                    <span>✅</span> {r}
                  </div>
                ))}
                {reqRiesgo.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink2 }}>
                    <span>⚠️</span> {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {s.importe_max && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 2 }}>Importe máx.</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{fmtImporte(s.importe_max)}</div>
              </div>
            )}
            {s.fecha_fin && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 2 }}>Fin de plazo</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                  {new Date(s.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
            {s.organismo && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 12px', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 2 }}>Organismo</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{s.organismo}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 20px 14px', borderTop: `1px solid ${C.border}`, background: '#fafbfd', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>
          {s.bdns_id ? `BDNS #${s.bdns_id}` : ''}
        </span>
        <button
          onClick={() => onEncaje(match)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 18px',
            background: C.navy, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'background .2s', boxShadow: '0 2px 8px rgba(13,31,60,.15)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = C.navy2)}
          onMouseLeave={e => (e.currentTarget.style.background = C.navy)}
        >
          Ver encaje completo
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── COMPONENTE: MODAL ENCAJE ───────────────────────────────────────────────── */
const PREGUNTAS = [
  '¿Tu empresa lleva más de 1 año operativa?',
  '¿Tienes menos de 250 empleados?',
  '¿El proyecto supone innovación o digitalización?',
  '¿Puedes aportar al menos un 25% de cofinanciación?',
  '¿Estás al corriente con Hacienda y Seguridad Social?',
];

function ModalEncaje({ match, onClose, onTramitar }: {
  match: Match;
  onClose: () => void;
  onTramitar: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({});
  const respondidas = Object.values(answers).filter(v => v !== null).length;
  const positivas = Object.values(answers).filter(v => v === true).length;
  const pct = respondidas > 0 ? Math.round((positivas / PREGUNTAS.length) * 100) : null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,60,.5)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
          padding: '28px 32px', maxWidth: 500, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(13,31,60,.2)',
          animation: 'modalIn .28s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, background: C.blueBg, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎯</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 2 }}>Análisis de encaje</h2>
            <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{match.subvencion.titulo}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
        </div>

        {/* Preguntas */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 18, background: C.navy, borderRadius: '50%', color: '#fff', fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</span>
            Verificación rápida
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PREGUNTAS.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 13px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.ink2 }}>{q}</span>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {([true, false] as const).map(val => (
                    <button
                      key={String(val)}
                      onClick={() => setAnswers(a => ({ ...a, [i]: val }))}
                      style={{
                        padding: '4px 13px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all .15s',
                        border: `1px solid ${answers[i] === val ? (val ? C.greenBorder : '#fecaca') : C.border}`,
                        background: answers[i] === val ? (val ? C.greenBg : C.redBg) : C.surface,
                        color: answers[i] === val ? (val ? C.green : C.red) : C.ink2,
                      }}
                    >
                      {val ? 'Sí' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resultado */}
        {pct !== null && (
          <div style={{
            background: pct >= 60 ? C.greenBg : C.amberBg,
            border: `1px solid ${pct >= 60 ? C.greenBorder : C.amberBorder}`,
            borderRadius: 11, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{pct >= 60 ? '✅' : '⚠️'}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: pct >= 60 ? C.green : C.amber, letterSpacing: '-0.03em', lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 12, color: C.ink2, fontWeight: 500, marginTop: 2 }}>
                {pct >= 60 ? 'Buen nivel de encaje — recomendamos tramitarla' : 'Encaje parcial — revisa los requisitos antes de tramitar'}
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 1, background: C.border, margin: '16px 0' }} />

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 9 }}>
          <button
            onClick={onTramitar}
            style={{
              flex: 1, padding: 12, background: C.navy, color: '#fff',
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14,
              border: 'none', borderRadius: 9, cursor: 'pointer', transition: 'background .2s',
              boxShadow: '0 2px 10px rgba(13,31,60,.2)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.navy2)}
            onMouseLeave={e => (e.currentTarget.style.background = C.navy)}
          >
            ✅ Quiero tramitarla
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '12px 20px', background: 'transparent', color: C.muted,
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 500,
              border: `1px solid ${C.border}`, borderRadius: 9, cursor: 'pointer', transition: 'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ink2; e.currentTarget.style.color = C.ink; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── COMPONENTE: SIDEBAR ITEM ───────────────────────────────────────────────── */
function SidebarItem({ icon, label, active, badge, onClick }: {
  icon: string; label: string; active?: boolean; badge?: number; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
        borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? C.blue : C.ink2,
        background: active ? C.blueBg : hovered ? C.bg : 'transparent',
        cursor: 'pointer', marginBottom: 2, transition: 'all .15s', userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{ background: C.red, color: '#fff', borderRadius: 99, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}

/* ─── COMPONENTE: SUMMARY CARD ───────────────────────────────────────────────── */
function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 18px', boxShadow: '0 1px 3px rgba(13,31,60,.06)', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontWeight: 400 }}>{sub}</div>
    </div>
  );
}

/* ─── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────── */
export default function PortalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [userName, setUserName] = useState('Cliente');
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'ayudas' | 'expedientes'>('dashboard');
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const meta = user.user_metadata;
      setUserName(meta?.nombre_completo ?? meta?.full_name ?? user.email?.split('@')[0] ?? 'Cliente');

      // Datos del cliente vinculado a este usuario
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clienteData) {
        setCliente(clienteData);

        // Expedientes
        const { data: exps } = await supabase
          .from('expedientes')
          .select('id, titulo, estado, created_at, numero_bdns')
          .eq('cliente_id', clienteData.id)
          .order('created_at', { ascending: false });
        setExpedientes(exps ?? []);

        // Matches
        const { data: mts } = await supabase
          .from('cliente_subvencion_match')
          .select(`
            id, score, razon_encaje, requisitos_ok, requisitos_riesgo,
            subvencion:subvenciones(id, titulo, organismo, importe_max, fecha_fin, objeto, bdns_id)
          `)
          .eq('cliente_id', clienteData.id)
          .order('score', { ascending: false })
          .limit(30);
        setMatches((mts ?? []) as unknown as Match[]);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const confirmTramitar = () => {
    setModalMatch(null);
    setToast('Solicitud enviada — nos pondremos en contacto contigo pronto.');
    setTimeout(() => setToast(''), 4000);
  };

  const matchesAltos  = matches.filter(m => m.score >= 0.7);
  const matchesMedios = matches.filter(m => m.score >= 0.4 && m.score < 0.7);
  const importePotencial = matches.reduce((s, m) => s + (m.subvencion.importe_max ?? 0), 0);

  const proximoCierre = matches
    .filter(m => m.subvencion.fecha_fin && new Date(m.subvencion.fecha_fin) > new Date())
    .sort((a, b) => new Date(a.subvencion.fecha_fin!).getTime() - new Date(b.subvencion.fecha_fin!).getTime())[0];
  const diasProximo = proximoCierre ? getDias(proximoCierre.subvencion.fecha_fin) : null;

  const nombre = cliente?.nombre || userName;
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  /* ── Spinner de carga ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <div style={{ width: 40, height: 40, border: `4px solid ${C.border}`, borderTopColor: C.navy, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── Render principal ── */
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: C.bg, minHeight: '100vh' }}>
      <style>{`
        @keyframes up { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .p-anim { animation: up .4s ease both; }
      `}</style>

      {/* ══ TOP NAV ══ */}
      <nav style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        height: 60, display: 'flex', alignItems: 'center', padding: '0 40px',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 3px rgba(13,31,60,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, background: C.navy, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>AP</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>AyudaPyme</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, position: 'relative' }}>
            🔔
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ width: 26, height: 26, background: C.navy, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>
              {initials(nombre)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>{nombre}</span>
          </div>
        </div>
      </nav>

      {/* ══ LAYOUT ══ */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 220, flexShrink: 0, background: C.surface,
          borderRight: `1px solid ${C.border}`, padding: '24px 0',
          position: 'sticky', top: 60, height: 'calc(100vh - 60px)', overflowY: 'auto',
        }}>
          {/* Sección principal */}
          <div style={{ padding: '0 16px', marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, padding: '0 8px', marginBottom: 6 }}>Principal</div>
            <SidebarItem icon="🏠" label="Dashboard"        active={tab === 'dashboard'}    onClick={() => setTab('dashboard')} />
            <SidebarItem icon="📋" label="Mis expedientes"  active={tab === 'expedientes'}  badge={expedientes.filter(e => e.estado === 'pendiente').length || undefined} onClick={() => setTab('expedientes')} />
            <SidebarItem icon="🔍" label="Todas las ayudas" active={tab === 'ayudas'}       onClick={() => setTab('ayudas')} />
          </div>

          <div style={{ height: 1, background: C.border, margin: '12px 16px' }} />

          {/* Sección cuenta */}
          <div style={{ padding: '0 16px', marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, padding: '0 8px', marginBottom: 6 }}>Cuenta</div>
            <SidebarItem icon="⚙️" label="Perfil empresa"  onClick={() => {}} />
            <SidebarItem icon="💳" label="Facturación"     onClick={() => {}} />
          </div>

          <div style={{ height: 1, background: C.border, margin: '12px 16px' }} />

          <div style={{ padding: '0 16px' }}>
            <SidebarItem icon="🚪" label="Cerrar sesión" onClick={handleLogout} />
          </div>

          {/* Bloque perfil incompleto */}
          {!cliente?.cnae && (
            <div style={{ margin: '16px', padding: '14px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 8 }}>
                ⏳ Perfil incompleto
              </div>
              <div style={{ height: 5, background: '#fde68a', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', background: C.amber, borderRadius: 100, width: '60%' }} />
              </div>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 500, lineHeight: 1.5 }}>
                60% completado — añade tu CNAE para mejorar el encaje con las subvenciones
              </div>
            </div>
          )}
        </aside>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <main style={{ flex: 1, padding: '32px 36px 60px', overflowY: 'auto', maxWidth: 960 }}>

          {/* ═══ VISTA: DASHBOARD ═══ */}
          {tab === 'dashboard' && (
            <div className="p-anim">
              {/* Saludo */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 6 }}>
                  Dashboard personalizado
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, color: C.ink, marginBottom: 8 }}>
                  {saludo}, <span style={{ color: C.teal }}>{nombre.split(' ')[0]}</span> 👋
                </h1>
                {matches.length > 0 ? (
                  <p style={{ fontSize: 14, color: C.ink2 }}>
                    Hemos analizado tu perfil y encontrado{' '}
                    <strong style={{ color: C.ink }}>{matches.length} subvenciones que encajan contigo</strong>
                    {importePotencial > 0 && (
                      <> — importe potencial estimado:{' '}
                        <strong style={{ color: C.teal }}>~{fmtImporte(importePotencial)}</strong>
                      </>
                    )}
                  </p>
                ) : (
                  <p style={{ fontSize: 14, color: C.ink2 }}>
                    Estamos analizando las subvenciones disponibles para tu perfil de empresa.
                  </p>
                )}
              </div>

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
                <SummaryCard
                  label="Subvenciones recomendadas"
                  value={matches.length || '—'}
                  sub="Analizadas para tu perfil"
                  color={C.navy}
                />
                <SummaryCard
                  label="Importe potencial"
                  value={importePotencial > 0 ? `~${fmtImporte(importePotencial)}` : '—'}
                  sub="Estimación con tu perfil actual"
                  color={C.green}
                />
                <SummaryCard
                  label="Próximo cierre"
                  value={diasProximo !== null ? `${diasProximo}d` : '—'}
                  sub={proximoCierre?.subvencion.organismo?.slice(0, 28) ?? 'Sin plazos próximos'}
                  color={C.amber}
                />
              </div>

              {/* Banner acción recomendada */}
              {!cliente?.cnae && (
                <div style={{
                  background: `linear-gradient(135deg,${C.navy},#0d4a6e)`,
                  borderRadius: 14, padding: '20px 24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 16, marginBottom: 32, boxShadow: '0 4px 16px rgba(13,31,60,.15)', flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>⚡</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', marginBottom: 2 }}>
                        Acción recomendada: completa tu perfil ahora
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                        Añade tu CNAE y facturación aproximada para mejorar el encaje con más convocatorias
                      </div>
                    </div>
                  </div>
                  <button style={{
                    padding: '9px 20px', background: '#fff', color: C.navy,
                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 13,
                    border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    Completar perfil →
                  </button>
                </div>
              )}

              {/* Subvenciones muy recomendables */}
              {matchesAltos.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>
                      🔥 Muy recomendables para ti
                    </h2>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: '#fff7ed', color: C.fire, border: '1px solid #fed7aa' }}>
                      Alta probabilidad
                    </span>
                  </div>
                  {matchesAltos.slice(0, 3).map(m => (
                    <MatchCard key={m.id} match={m} onEncaje={setModalMatch} />
                  ))}
                </>
              )}

              {/* Subvenciones posibles */}
              {matchesMedios.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: matchesAltos.length > 0 ? 12 : 0 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>
                      👍 Posibles para tu perfil
                    </h2>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}` }}>
                      Encaje parcial
                    </span>
                  </div>
                  {matchesMedios.slice(0, 2).map(m => (
                    <MatchCard key={m.id} match={m} onEncaje={setModalMatch} />
                  ))}
                </>
              )}

              {/* Estado vacío */}
              {matches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Analizando subvenciones para tu perfil</div>
                  <div style={{ fontSize: 14, color: C.muted, maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                    En cuanto completemos el análisis de tu empresa, encontrarás aquí las mejores oportunidades de financiación.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ VISTA: TODAS LAS AYUDAS ═══ */}
          {tab === 'ayudas' && (
            <div className="p-anim">
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 6 }}>Todas las ayudas</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: C.ink }}>
                  {matches.length > 0 ? `${matches.length} subvenciones analizadas para tu empresa` : 'Subvenciones disponibles'}
                </h1>
              </div>

              {matches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                  <div style={{ fontSize: 14, color: C.muted }}>No hay subvenciones analizadas todavía.</div>
                </div>
              ) : (
                matches.map(m => <MatchCard key={m.id} match={m} onEncaje={setModalMatch} />)
              )}
            </div>
          )}

          {/* ═══ VISTA: EXPEDIENTES ═══ */}
          {tab === 'expedientes' && (
            <div className="p-anim">
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, marginBottom: 6 }}>Gestión</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: C.ink }}>Mis expedientes</h1>
              </div>

              {expedientes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Sin expedientes activos</div>
                  <div style={{ fontSize: 14, color: C.muted, maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
                    Cuando empecemos a tramitar una subvención para ti, el estado aparecerá aquí.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {expedientes.map(exp => {
                    const estadoMap: Record<string, { bg: string; color: string }> = {
                      pendiente:   { bg: C.amberBg, color: C.amber },
                      en_proceso:  { bg: C.blueBg,  color: C.blue  },
                      presentado:  { bg: C.blueBg,  color: C.blue  },
                      resuelto:    { bg: C.greenBg, color: C.green },
                      descartado:  { bg: '#f1f5f9', color: C.muted },
                    };
                    const est = estadoMap[exp.estado] ?? { bg: '#f1f5f9', color: C.muted };

                    return (
                      <div key={exp.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(13,31,60,.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 4 }}>
                              {exp.titulo ?? `Expediente #${exp.id.slice(0, 8)}`}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted }}>
                              {new Date(exp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 100, background: est.bg, color: est.color, whiteSpace: 'nowrap' }}>
                            {exp.estado.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL ── */}
      {modalMatch && (
        <ModalEncaje
          match={modalMatch}
          onClose={() => setModalMatch(null)}
          onTramitar={confirmTramitar}
        />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: C.navy, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600, padding: '11px 22px', borderRadius: 100, fontSize: 13,
          zIndex: 300, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 28px rgba(13,31,60,.25)', whiteSpace: 'nowrap',
          animation: 'up .35s ease',
        }}>
          <span style={{ width: 18, height: 18, background: C.green, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
