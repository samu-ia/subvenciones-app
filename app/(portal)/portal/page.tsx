'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/* ─────────────── TIPOS ─────────────── */
interface Cliente { id: string; nombre: string; nif: string; sector?: string; }
interface Expediente { id: string; titulo: string; estado: string; fecha_solicitud?: string; importe?: number; }
interface Match { id: string; score: number; subvencion: { id: string; titulo: string; organismo?: string; importe_max?: number; fecha_fin?: string; descripcion?: string; }; }

/* ─────────────── SUB-COMPONENTES ─────────────── */
function SidebarItem({ icon, label, active, badge, onClick }: { icon: string; label: string; active?: boolean; badge?: number; onClick: () => void; }) {
  return (
    <div onClick={onClick} className={`p-sb-item${active ? ' p-sb-active' : ''}`} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
      background: active ? '#1a3561' : 'transparent', color: active ? '#fff' : '#c8d6ef',
      fontWeight: active ? 600 : 400, fontSize: 14, marginBottom: 2, userSelect: 'none', transition: 'background .15s',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? <span style={{ background: '#e53e3e', color: '#fff', borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>{badge}</span> : null}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string; }) {
  return (
    <div className="p-card-anim" style={{
      background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(13,31,60,.07)',
      borderTop: `4px solid ${color}`, flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#0d1f3c', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7a99', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SubvCard({ match, onEncaje }: { match: Match; onEncaje: (m: Match) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const s = match.subvencion;
  const score = match.score;
  const isHot = score >= 0.7;
  const stripColor = isHot
    ? 'linear-gradient(90deg,#f97316,#facc15)'
    : score >= 0.4
      ? 'linear-gradient(90deg,#22c55e,#84cc16)'
      : 'linear-gradient(90deg,#94a3b8,#cbd5e1)';

  const badgeColor = isHot ? '#f97316' : score >= 0.4 ? '#22c55e' : '#94a3b8';
  const scoreLabel = isHot ? '🔥 Alta' : score >= 0.4 ? '✅ Media' : '⚠️ Baja';

  const fechaFin = s.fecha_fin ? new Date(s.fecha_fin) : null;
  const diasRestantes = fechaFin ? Math.ceil((fechaFin.getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="p-subv-card" style={{
      background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(13,31,60,.07)',
      overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{ height: 5, background: stripColor }} />
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0d1f3c', lineHeight: 1.3, marginBottom: 4 }}>{s.titulo}</div>
            {s.organismo && <div style={{ fontSize: 12, color: '#6b7a99' }}>{s.organismo}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <span style={{ background: badgeColor, color: '#fff', borderRadius: 99, fontSize: 12, padding: '3px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {scoreLabel} {Math.round(score * 100)}%
            </span>
            {diasRestantes !== null && (
              <span style={{ fontSize: 11, color: diasRestantes < 15 ? '#e53e3e' : '#6b7a99', fontWeight: diasRestantes < 15 ? 700 : 400 }}>
                {diasRestantes > 0 ? `⏳ ${diasRestantes}d restantes` : '⚠️ Plazo vencido'}
              </span>
            )}
          </div>
        </div>

        {s.importe_max && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#1a3561', fontWeight: 600 }}>
            💰 Hasta {s.importe_max.toLocaleString('es-ES')}€
          </div>
        )}

        {s.descripcion && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
            <strong style={{ color: '#1a3561' }}>Por qué encaja:</strong>{' '}
            {expanded ? s.descripcion : s.descripcion.slice(0, 120) + (s.descripcion.length > 120 ? '…' : '')}
            {s.descripcion.length > 120 && (
              <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, marginLeft: 4 }}>
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="p-btn-enc" onClick={() => onEncaje(match)} style={{
            background: '#0d1f3c', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
          }}>
            🎯 Ver encaje
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyBox({ icon, text }: { icon: string; text: string; }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

/* ─────────────── MODAL ENCAJE ─────────────── */
const PREGUNTAS = [
  '¿Tu empresa lleva más de 1 año operativa?',
  '¿Tienes menos de 250 empleados?',
  '¿El proyecto supone innovación o digitalización?',
  '¿Puedes aportar al menos un 25% de cofinanciación?',
  '¿Estás al corriente con Hacienda y Seguridad Social?',
];

function ModalEncaje({ match, answers, onChange, onClose, onConfirm }: {
  match: Match; answers: Record<number, boolean | null>; onChange: (i: number, v: boolean) => void;
  onClose: () => void; onConfirm: () => void;
}) {
  const respondidas = Object.values(answers).filter(v => v !== null).length;
  const positivas = Object.values(answers).filter(v => v === true).length;
  const pct = respondidas > 0 ? Math.round((positivas / PREGUNTAS.length) * 100) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,60,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(13,31,60,.25)' }}>
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Análisis de encaje</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#0d1f3c', lineHeight: 1.3 }}>{match.subvencion.titulo}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, paddingLeft: 8 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {PREGUNTAS.map((q, i) => (
            <div key={i} style={{ marginBottom: 16, padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1.5px solid', borderColor: answers[i] === true ? '#22c55e' : answers[i] === false ? '#f87171' : '#e2e8f0' }}>
              <div style={{ fontSize: 14, color: '#1e293b', marginBottom: 10, fontWeight: 500 }}>{q}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[true, false].map(val => (
                  <button key={String(val)} className="p-qa-btn" onClick={() => onChange(i, val)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 7, border: '1.5px solid',
                    borderColor: answers[i] === val ? (val ? '#22c55e' : '#f87171') : '#e2e8f0',
                    background: answers[i] === val ? (val ? '#f0fdf4' : '#fef2f2') : '#fff',
                    color: answers[i] === val ? (val ? '#16a34a' : '#dc2626') : '#64748b',
                    fontWeight: answers[i] === val ? 700 : 400, fontSize: 13, cursor: 'pointer',
                  }}>
                    {val ? '✅ Sí' : '❌ No'}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {pct !== null && (
            <div style={{ background: pct >= 60 ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${pct >= 60 ? '#86efac' : '#fcd34d'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: pct >= 60 ? '#16a34a' : '#d97706' }}>{pct}%</div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                {pct >= 60 ? '✅ Buen nivel de encaje — recomendamos tramitarla' : '⚠️ Encaje parcial — revisa los requisitos antes de tramitar'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
              Cancelar
            </button>
            <button onClick={onConfirm} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#0d1f3c', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
              ✅ Quiero que lo tramitéis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── PÁGINA PRINCIPAL ─────────────── */
export default function PortalPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'expedientes' | 'ayudas'>('dashboard');
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [qaAnswers, setQaAnswers] = useState<Record<number, boolean | null>>({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      // Datos del cliente
      const { data: perfil } = await supabase.from('clientes').select('*').eq('user_id', user.id).single();
      if (perfil) setCliente(perfil);

      // Expedientes
      if (perfil) {
        const { data: exps } = await supabase.from('expedientes').select('*').eq('cliente_id', perfil.id).order('fecha_solicitud', { ascending: false });
        setExpedientes(exps || []);

        // Matches
        const { data: mts } = await supabase
          .from('cliente_subvencion_match')
          .select('id, score, subvencion:subvenciones(id,titulo,organismo,importe_max,fecha_fin,descripcion)')
          .eq('cliente_id', perfil.id)
          .order('score', { ascending: false });
        setMatches((mts || []) as Match[]);
      }

      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const openEncaje = (m: Match) => {
    setModalMatch(m);
    setQaAnswers({});
  };

  const confirmTramitar = () => {
    setModalMatch(null);
    setToast('✅ Solicitud enviada — nos pondremos en contacto contigo pronto.');
    setTimeout(() => setToast(''), 4000);
  };

  const matchesAltos = matches.filter(m => m.score >= 0.7);
  const matchesMedios = matches.filter(m => m.score >= 0.4 && m.score < 0.7);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f4fa' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#1a3561', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const nombre = cliente?.nombre || 'Cliente';
  const hora = new Date().getHours();
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <style>{`
        @keyframes portalUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .p-card-anim{animation:portalUp .4s ease both;}
        .p-sb-item:hover:not(.p-sb-active){background:#1e3d6e!important;}
        .p-subv-card{transition:box-shadow .25s,transform .25s;}
        .p-subv-card:hover{box-shadow:0 4px 16px rgba(13,31,60,.13)!important;transform:translateY(-2px);}
        .p-btn-enc:hover{background:#162d52!important;}
        .p-qa-btn{transition:all .15s;}
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f0f4fa' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width: 240, background: '#0d1f3c', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
          <div style={{ padding: '24px 20px 12px' }}>
            <img src="/logo-light.png" alt="AyudaPyme" style={{ height: 32, marginBottom: 24 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6fa5', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, paddingLeft: 4 }}>Portal</div>
            <SidebarItem icon="🏠" label="Dashboard" active={tab === 'dashboard'} onClick={() => setTab('dashboard')} />
            <SidebarItem icon="📁" label="Mis expedientes" active={tab === 'expedientes'} badge={expedientes.filter(e => e.estado === 'pendiente').length || undefined} onClick={() => setTab('expedientes')} />
            <SidebarItem icon="🎯" label="Ayudas disponibles" active={tab === 'ayudas'} badge={matchesAltos.length || undefined} onClick={() => setTab('ayudas')} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 20px', borderTop: '1px solid #1a3561' }}>
            <button onClick={handleLogout} style={{ width: '100%', background: 'transparent', border: '1px solid #1a3561', color: '#94a3b8', borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}>
              🚪 Cerrar sesión
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

          {/* Topbar */}
          <header style={{ background: '#fff', borderBottom: '1px solid #e8edf5', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
            <div style={{ fontSize: 14, color: '#6b7a99' }}>
              {tab === 'dashboard' && '🏠 Dashboard'}
              {tab === 'expedientes' && '📁 Mis expedientes'}
              {tab === 'ayudas' && '🎯 Ayudas disponibles'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{nombre}</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1a3561', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                {nombre[0]?.toUpperCase()}
              </div>
            </div>
          </header>

          {/* Contenido */}
          <div style={{ padding: '32px', flex: 1 }}>

            {/* ── DASHBOARD ── */}
            {tab === 'dashboard' && (
              <div className="p-card-anim">
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0d1f3c', marginBottom: 4 }}>{saludo}, {nombre} 👋</h1>
                <p style={{ color: '#6b7a99', fontSize: 14, marginBottom: 28 }}>Aquí tienes un resumen de tu actividad y las mejores oportunidades de financiación.</p>

                {/* Summary cards */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
                  <SummaryCard label="Expedientes activos" value={expedientes.length} color="#3b82f6" icon="📁" />
                  <SummaryCard label="Ayudas recomendadas" value={matchesAltos.length} color="#f97316" icon="🔥" />
                  <SummaryCard label="Posibles ayudas" value={matchesMedios.length} color="#22c55e" icon="✅" />
                </div>

                {/* Muy recomendables */}
                {matchesAltos.length > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1f3c', margin: 0 }}>🔥 Muy recomendables</h2>
                      <span style={{ background: '#fff3e0', color: '#f97316', borderRadius: 99, fontSize: 12, padding: '2px 10px', fontWeight: 700 }}>{matchesAltos.length}</span>
                    </div>
                    {matchesAltos.slice(0, 3).map(m => <SubvCard key={m.id} match={m} onEncaje={openEncaje} />)}
                  </>
                )}

                {/* Posibles */}
                {matchesMedios.length > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: matchesAltos.length > 0 ? 24 : 0 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0d1f3c', margin: 0 }}>👍 Posibles ayudas</h2>
                      <span style={{ background: '#f0fdf4', color: '#22c55e', borderRadius: 99, fontSize: 12, padding: '2px 10px', fontWeight: 700 }}>{matchesMedios.length}</span>
                    </div>
                    {matchesMedios.slice(0, 3).map(m => <SubvCard key={m.id} match={m} onEncaje={openEncaje} />)}
                  </>
                )}

                {matches.length === 0 && <EmptyBox icon="🔍" text="Aún no hemos encontrado subvenciones para tu perfil. Pronto tendrás resultados." />}
              </div>
            )}

            {/* ── EXPEDIENTES ── */}
            {tab === 'expedientes' && (
              <div className="p-card-anim">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d1f3c', marginBottom: 24 }}>📁 Mis expedientes</h1>
                {expedientes.length === 0 ? (
                  <EmptyBox icon="📂" text="Todavía no tienes expedientes abiertos." />
                ) : (
                  <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(13,31,60,.07)', overflow: 'hidden' }}>
                    {expedientes.map((exp, i) => {
                      const estadoColor: Record<string, string> = { activo: '#22c55e', pendiente: '#f97316', cerrado: '#94a3b8', denegado: '#ef4444' };
                      const color = estadoColor[exp.estado] || '#94a3b8';
                      return (
                        <div key={exp.id} style={{ padding: '16px 20px', borderBottom: i < expedientes.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#0d1f3c' }}>{exp.titulo}</div>
                            {exp.fecha_solicitud && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Solicitado: {new Date(exp.fecha_solicitud).toLocaleDateString('es-ES')}</div>}
                          </div>
                          {exp.importe && <div style={{ fontSize: 14, fontWeight: 700, color: '#1a3561' }}>{exp.importe.toLocaleString('es-ES')}€</div>}
                          <span style={{ background: `${color}18`, color, borderRadius: 99, fontSize: 12, padding: '3px 12px', fontWeight: 700, textTransform: 'capitalize' }}>{exp.estado}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── AYUDAS ── */}
            {tab === 'ayudas' && (
              <div className="p-card-anim">
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0d1f3c', marginBottom: 24 }}>🎯 Todas las ayudas disponibles</h1>
                {matches.length === 0 ? (
                  <EmptyBox icon="🔍" text="No hay ayudas disponibles por ahora. Vuelve pronto." />
                ) : (
                  matches.map(m => <SubvCard key={m.id} match={m} onEncaje={openEncaje} />)
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── MODAL ── */}
      {modalMatch && (
        <ModalEncaje
          match={modalMatch}
          answers={qaAnswers}
          onChange={(i, v) => setQaAnswers(prev => ({ ...prev, [i]: v }))}
          onClose={() => setModalMatch(null)}
          onConfirm={confirmTramitar}
        />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#0d1f3c', color: '#fff', borderRadius: 10, padding: '12px 24px',
          fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(13,31,60,.3)', zIndex: 2000,
          animation: 'portalUp .3s ease both',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
