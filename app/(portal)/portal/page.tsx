'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  FileText, TrendingUp, Euro, Clock, CheckCircle2,
  AlertCircle, ChevronRight, LogOut, Building2, Star,
  ExternalLink, Loader2,
} from 'lucide-react';

interface Perfil {
  rol: string;
  nif: string | null;
}

interface ClienteData {
  nif: string;
  nombre_normalizado: string | null;
  actividad: string | null;
  tamano_empresa: string | null;
  ciudad: string | null;
  email_normalizado: string | null;
}

interface Expediente {
  id: string;
  estado: string;
  created_at: string;
  numero_bdns: number | null;
  subvencion?: {
    titulo: string;
    organismo: string | null;
    importe_maximo: number | null;
    plazo_fin: string | null;
  } | null;
}

interface Match {
  id: string;
  score: number;
  motivos: string[] | null;
  estado: string;
  subvencion: {
    id: string;
    titulo: string;
    organismo: string | null;
    importe_maximo: number | null;
    plazo_fin: string | null;
    resumen_ia: string | null;
    ambito_geografico: string | null;
  };
}

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  lead_caliente: { label: 'Interesado',  color: '#d97706', bg: '#fffbeb' },
  en_proceso:    { label: 'En tramitación', color: '#1d4ed8', bg: '#eff4ff' },
  presentado:    { label: 'Presentado',  color: '#7c3aed', bg: '#f5f3ff' },
  resuelto:      { label: 'Resuelto',    color: '#059669', bg: '#ecfdf5' },
  descartado:    { label: 'Descartado',  color: '#94a3b8', bg: '#f1f5f9' },
};

export default function PortalClientePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<'inicio' | 'expedientes' | 'subvenciones'>('inicio');

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Perfil
      const { data: p } = await supabase
        .from('perfiles')
        .select('rol, nif')
        .eq('id', user.id)
        .maybeSingle();

      if (!p) { router.push('/login'); return; }
      if (p.rol === 'admin') { router.push('/clientes'); return; }
      setPerfil(p);

      if (!p.nif) { setLoading(false); return; }

      // Datos del cliente
      const { data: c } = await supabase
        .from('cliente')
        .select('nif, nombre_normalizado, actividad, tamano_empresa, ciudad, email_normalizado')
        .eq('nif', p.nif)
        .maybeSingle();
      setCliente(c);

      // Expedientes con datos de subvención
      const { data: exps } = await supabase
        .from('expediente')
        .select(`
          id, estado, created_at, numero_bdns
        `)
        .eq('nif', p.nif)
        .order('created_at', { ascending: false });
      setExpedientes(exps ?? []);

      // Matches ordenados por score
      const { data: ms } = await supabase
        .from('cliente_subvencion_match')
        .select(`
          id, score, motivos, estado,
          subvencion:subvencion_id (
            id, titulo, organismo, importe_maximo, plazo_fin, resumen_ia, ambito_geografico
          )
        `)
        .eq('nif', p.nif)
        .neq('estado', 'descartado')
        .order('score', { ascending: false })
        .limit(20);
      setMatches((ms as unknown as Match[]) ?? []);

      setLoading(false);
    }
    cargar();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--teal)' }} />
      </div>
    );
  }

  const expedientesActivos = expedientes.filter(e => !['resuelto', 'descartado'].includes(e.estado));
  const matchesDestacados = matches.filter(m => m.score >= 0.7);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Header */}
      <header style={{
        background: 'var(--navy)', color: '#fff',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--teal)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.8rem',
          }}>AP</div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>AyudaPyme</span>
          <span style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: 6,
            padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600, marginLeft: 4,
          }}>Mi portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
            {cliente?.nombre_normalizado ?? 'Mi empresa'}
          </span>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 7, padding: '6px 12px', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 600,
          }}>
            <LogOut size={13} /> Salir
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Bienvenida */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
            Hola, {cliente?.nombre_normalizado?.split(' ')[0] ?? 'bienvenido'} 👋
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '0.9rem' }}>
            Este es tu espacio personal. Aquí puedes ver tus expedientes y las subvenciones que hemos encontrado para ti.
          </p>
        </div>

        {/* Tarjetas resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          <StatCard
            icon={<FileText size={20} color="var(--blue)" />}
            bg="var(--blue-bg)"
            label="Expedientes activos"
            value={expedientesActivos.length}
          />
          <StatCard
            icon={<Star size={20} color="#d97706" />}
            bg="#fffbeb"
            label="Subvenciones compatibles"
            value={matchesDestacados.length}
          />
          <StatCard
            icon={<TrendingUp size={20} color="var(--green)" />}
            bg="var(--green-bg)"
            label="Expedientes totales"
            value={expedientes.length}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {([
            { key: 'inicio', label: 'Inicio' },
            { key: 'expedientes', label: `Mis expedientes (${expedientes.length})` },
            { key: 'subvenciones', label: `Subvenciones para mí (${matches.length})` },
          ] as { key: typeof tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 18px', border: 'none', background: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              fontSize: '0.85rem',
              color: tab === t.key ? 'var(--teal)' : 'var(--ink2)',
              borderBottom: tab === t.key ? '2px solid var(--teal)' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: INICIO ── */}
        {tab === 'inicio' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Ficha empresa */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Building2 size={18} color="var(--teal)" />
                <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Datos de tu empresa</h2>
              </div>
              {cliente ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FichaRow label="NIF / CIF" value={cliente.nif} />
                  <FichaRow label="Nombre" value={cliente.nombre_normalizado} />
                  <FichaRow label="Actividad" value={cliente.actividad} />
                  <FichaRow label="Tamaño" value={cliente.tamano_empresa} />
                  <FichaRow label="Ciudad" value={cliente.ciudad} />
                  <FichaRow label="Email" value={cliente.email_normalizado} />
                </div>
              ) : (
                <p style={{ color: 'var(--ink2)', fontSize: '0.85rem' }}>
                  No hay datos vinculados a tu cuenta aún. Contacta con nosotros.
                </p>
              )}
            </div>

            {/* Últimas subvenciones destacadas */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Star size={18} color="#d97706" />
                  <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Top subvenciones</h2>
                </div>
                <button onClick={() => setTab('subvenciones')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  Ver todas <ChevronRight size={13} />
                </button>
              </div>
              {matchesDestacados.length === 0 ? (
                <EmptyState text="Aún no hemos analizado subvenciones para tu empresa. Pronto aparecerán aquí." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {matchesDestacados.slice(0, 4).map(m => (
                    <MatchMini key={m.id} match={m} />
                  ))}
                </div>
              )}
            </div>

            {/* Expedientes recientes */}
            <div style={{ gridColumn: '1 / -1', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="var(--blue)" />
                  <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Mis expedientes recientes</h2>
                </div>
                <button onClick={() => setTab('expedientes')} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  Ver todos <ChevronRight size={13} />
                </button>
              </div>
              {expedientes.length === 0 ? (
                <EmptyState text="Todavía no tienes expedientes. Cuando iniciemos una tramitación para ti, aparecerá aquí." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {expedientes.slice(0, 5).map(exp => (
                    <ExpedienteRow key={exp.id} exp={exp} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: EXPEDIENTES ── */}
        {tab === 'expedientes' && (
          <div>
            {expedientes.length === 0 ? (
              <EmptyState text="No tienes expedientes todavía. Cuando empecemos a tramitar una subvención contigo, aparecerá aquí." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expedientes.map(exp => (
                  <ExpedienteRow key={exp.id} exp={exp} full />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: SUBVENCIONES PARA MÍ ── */}
        {tab === 'subvenciones' && (
          <div>
            {matches.length === 0 ? (
              <EmptyState text="Todavía estamos analizando qué subvenciones encajan con tu empresa. Vuelve pronto." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {matches.map(m => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 42, height: 42, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ink2)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function FichaRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.83rem', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--ink2)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 600, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );
}

function ExpedienteRow({ exp, full }: { exp: Expediente; full?: boolean }) {
  const est = ESTADO_LABELS[exp.estado] ?? { label: exp.estado, color: '#64748b', bg: '#f1f5f9' };
  return (
    <div style={{
      background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <FileText size={16} color="var(--blue)" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--navy)', marginBottom: 2 }}>
            {exp.numero_bdns ? `Subvención BDNS #${exp.numero_bdns}` : 'Expediente en estudio'}
          </div>
          {full && (
            <div style={{ fontSize: '0.75rem', color: 'var(--ink2)' }}>
              Abierto el {new Date(exp.created_at).toLocaleDateString('es-ES')}
            </div>
          )}
        </div>
      </div>
      <span style={{
        background: est.bg, color: est.color,
        borderRadius: 6, padding: '3px 10px',
        fontSize: '0.73rem', fontWeight: 700, flexShrink: 0,
      }}>
        {est.label}
      </span>
    </div>
  );
}

function MatchMini({ match: m }: { match: Match }) {
  const pct = Math.round((m.score ?? 0) * 100);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', background: 'var(--muted)', borderRadius: 9,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: pct >= 80 ? 'var(--green-bg)' : 'var(--blue-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 800,
        color: pct >= 80 ? 'var(--green)' : 'var(--blue)',
      }}>
        {pct}%
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.subvencion.titulo}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--ink2)' }}>{m.subvencion.organismo ?? '—'}</div>
      </div>
    </div>
  );
}

function MatchCard({ match: m }: { match: Match }) {
  const pct = Math.round((m.score ?? 0) * 100);
  const isHigh = pct >= 80;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${isHigh ? '#86efac' : 'var(--border)'}`,
      borderRadius: 14, padding: 22,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)', marginBottom: 4 }}>
            {m.subvencion.titulo}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}>{m.subvencion.organismo ?? '—'}</div>
        </div>
        <div style={{
          flexShrink: 0,
          background: isHigh ? 'var(--green-bg)' : 'var(--blue-bg)',
          color: isHigh ? 'var(--green)' : 'var(--blue)',
          borderRadius: 10, padding: '6px 14px',
          fontWeight: 800, fontSize: '1rem',
        }}>
          {pct}% match
        </div>
      </div>

      {m.subvencion.resumen_ia && (
        <p style={{ fontSize: '0.83rem', color: 'var(--ink2)', marginBottom: 12, lineHeight: 1.55 }}>
          {m.subvencion.resumen_ia}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {m.subvencion.importe_maximo && (
          <Chip icon={<Euro size={11} />} text={`Hasta ${m.subvencion.importe_maximo.toLocaleString('es-ES')} €`} color="var(--green)" bg="var(--green-bg)" />
        )}
        {m.subvencion.plazo_fin && (
          <Chip icon={<Clock size={11} />} text={`Plazo: ${fmt(m.subvencion.plazo_fin)}`} color="var(--amber)" bg="var(--amber-bg)" />
        )}
        {m.subvencion.ambito_geografico && (
          <Chip icon={<CheckCircle2 size={11} />} text={m.subvencion.ambito_geografico} color="var(--ink2)" bg="var(--muted)" />
        )}
      </div>

      {m.motivos && m.motivos.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Por qué encaja contigo
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {m.motivos.slice(0, 3).map((mot, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: '0.8rem', color: 'var(--ink)' }}>
                <CheckCircle2 size={13} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                {mot}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, text, color, bg }: { icon: React.ReactNode; text: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, borderRadius: 6,
      padding: '3px 9px', fontSize: '0.75rem', fontWeight: 600,
    }}>
      {icon} {text}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px dashed var(--border)',
      borderRadius: 14, padding: '40px 24px', textAlign: 'center',
    }}>
      <AlertCircle size={28} color="var(--border)" style={{ marginBottom: 12 }} />
      <p style={{ color: 'var(--ink2)', fontSize: '0.85rem', maxWidth: 360, margin: '0 auto' }}>{text}</p>
    </div>
  );
}
