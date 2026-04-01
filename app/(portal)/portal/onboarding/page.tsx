'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import {
  Building2, Briefcase, Target, PartyPopper,
  ChevronRight, ChevronLeft, Loader2, Check,
  Factory, Users, Globe, Store,
  Leaf, Monitor, UserPlus, Plane, Lightbulb,
  Edit3,
} from 'lucide-react';

// ─── Colores (mismos que portal) ──────────────────────────────────────────────
const C = {
  navy: '#1a3561', teal: '#0d9488', bg: '#f4f6fb',
  surface: '#fff', border: '#e8ecf4', ink: '#0d1f3c',
  ink2: '#475569', muted: '#94a3b8', green: '#059669',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface EmpresaData {
  nombre_empresa: string;
  nif: string;
  sector: string;
  num_empleados: number | '';
  descripcion_actividad: string;
}

interface ActividadData {
  invierte_maquinaria: boolean;
  contrata_personal: boolean;
  exporta: boolean;
  tiene_local: boolean;
}

interface PrioridadesData {
  ahorro_energetico: boolean;
  digitalizacion: boolean;
  contratacion: boolean;
  internacionalizacion: boolean;
  investigacion_desarrollo: boolean;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  // Paso 1: Datos empresa
  const [empresa, setEmpresa] = useState<EmpresaData>({
    nombre_empresa: '', nif: '', sector: '', num_empleados: '', descripcion_actividad: '',
  });
  const [editingEmpresa, setEditingEmpresa] = useState(false);

  // Paso 2: Actividad
  const [actividad, setActividad] = useState<ActividadData>({
    invierte_maquinaria: false, contrata_personal: false,
    exporta: false, tiene_local: false,
  });

  // Paso 3: Prioridades
  const [prioridades, setPrioridades] = useState<PrioridadesData>({
    ahorro_energetico: false, digitalizacion: false,
    contratacion: false, internacionalizacion: false,
    investigacion_desarrollo: false,
  });

  // Cargar datos del cliente
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }

      const { data: perfil } = await supabase
        .from('perfiles').select('nif, onboarding_data').eq('id', user.id).maybeSingle();

      if (!perfil?.nif) { router.replace('/portal'); return; }

      // Si ya completó onboarding, ir al portal
      if (perfil.onboarding_data) { router.replace('/portal'); return; }

      // Cargar datos de la empresa
      const { data: cli } = await supabase.from('cliente')
        .select('nif, nombre_empresa, cnae_descripcion, num_empleados, descripcion_actividad')
        .eq('nif', perfil.nif).maybeSingle();

      if (cli) {
        setEmpresa({
          nombre_empresa: cli.nombre_empresa ?? '',
          nif: cli.nif,
          sector: cli.cnae_descripcion ?? '',
          num_empleados: cli.num_empleados ?? '',
          descripcion_actividad: cli.descripcion_actividad ?? '',
        });
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar y redirigir
  async function guardarYContinuar() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/portal/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: editingEmpresa ? empresa : undefined,
          actividad,
          prioridades,
          completado_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');

      // Mostrar confetti
      setShowConfetti(true);
      setPaso(4);
    } catch {
      setSaveError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function irAlPortal() {
    router.replace('/portal');
  }

  // ─── Estilos reutilizables ──────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: C.surface, borderRadius: 20, width: '100%', maxWidth: 640,
    boxShadow: '0 4px 32px rgba(13,31,60,0.08)', overflow: 'hidden',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '13px 28px', borderRadius: 12, border: 'none',
    background: C.teal, color: '#fff', fontWeight: 700, fontSize: '0.95rem',
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
    alignItems: 'center', gap: 8, transition: 'opacity 0.2s',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '13px 28px', borderRadius: 12,
    border: `1.5px solid ${C.border}`, background: '#fff',
    color: C.ink2, fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
    alignItems: 'center', gap: 8,
  };

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

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: C.navy }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ─── Pasos config ───────────────────────────────────────────────────────────
  const pasos = [
    { num: 1, label: 'Tu empresa', icon: Building2 },
    { num: 2, label: 'Tu actividad', icon: Briefcase },
    { num: 3, label: 'Qué buscas', icon: Target },
    { num: 4, label: '¡Listo!', icon: PartyPopper },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '24px 16px' : '40px 24px' }}>

      {/* Logo */}
      <div style={{ background: C.navy, borderRadius: 14, padding: '10px 18px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, background: '#fff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.7rem', color: C.navy }}>AP</div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>AyudaPyme</span>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, marginBottom: 32, width: '100%', maxWidth: 640 }}>
        {pasos.map((p, i) => {
          const Icon = p.icon;
          const isActive = paso === p.num;
          const isDone = paso > p.num;
          return (
            <div key={p.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isActive ? C.teal : isDone ? C.green : C.surface,
                color: isActive || isDone ? '#fff' : C.muted,
                borderRadius: 10, padding: isMobile ? '6px 8px' : '8px 14px',
                fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 700,
                border: `1.5px solid ${isActive ? C.teal : isDone ? C.green : C.border}`,
                transition: 'all 0.3s ease',
                flex: 1, justifyContent: 'center',
              }}>
                {isDone ? <Check size={14} /> : <Icon size={14} />}
                {!isMobile && <span>{p.label}</span>}
              </div>
              {i < pasos.length - 1 && (
                <div style={{ width: isMobile ? 8 : 16, height: 2, background: isDone ? C.green : C.border, margin: '0 2px' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Card principal */}
      <div style={cardStyle}>

        {/* ─── PASO 1: Tu empresa ──────────────────────────────────────── */}
        {paso === 1 && (
          <div style={{ padding: isMobile ? '28px 20px' : '40px 40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.navy, margin: '0 0 8px' }}>
              Tu empresa
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.ink2, margin: '0 0 28px', lineHeight: 1.5 }}>
              Hemos importado estos datos de tu empresa. Revísalos y corrige lo que no sea correcto.
            </p>

            {/* Datos importados (modo vista) */}
            {!editingEmpresa ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow label="Nombre" value={empresa.nombre_empresa || '—'} />
                <InfoRow label="NIF" value={empresa.nif || '—'} />
                <InfoRow label="Sector / Actividad" value={empresa.sector || '—'} />
                <InfoRow label="Nº empleados" value={empresa.num_empleados ? String(empresa.num_empleados) : '—'} />
                <InfoRow label="Descripción" value={empresa.descripcion_actividad || '—'} />

                <button
                  onClick={() => setEditingEmpresa(true)}
                  style={{
                    ...btnSecondary, marginTop: 8, justifyContent: 'center',
                    color: C.teal, borderColor: C.teal,
                  }}
                >
                  <Edit3 size={16} /> Corregir datos
                </button>
              </div>
            ) : (
              /* Modo edición */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelS}>Nombre de la empresa</label>
                  <input type="text" value={empresa.nombre_empresa}
                    onChange={e => setEmpresa(p => ({ ...p, nombre_empresa: e.target.value }))}
                    style={inputS} placeholder="Razón social" />
                </div>
                <div>
                  <label style={labelS}>Sector / Actividad (CNAE)</label>
                  <input type="text" value={empresa.sector}
                    onChange={e => setEmpresa(p => ({ ...p, sector: e.target.value }))}
                    style={inputS} placeholder="Ej: Hostelería, Tecnología..." />
                </div>
                <div>
                  <label style={labelS}>Nº de empleados</label>
                  <input type="number" value={empresa.num_empleados}
                    onChange={e => setEmpresa(p => ({ ...p, num_empleados: e.target.value ? Number(e.target.value) : '' }))}
                    style={inputS} placeholder="0" min={0} />
                </div>
                <div>
                  <label style={labelS}>Descripción de la actividad</label>
                  <textarea value={empresa.descripcion_actividad}
                    onChange={e => setEmpresa(p => ({ ...p, descripcion_actividad: e.target.value }))}
                    style={{ ...inputS, minHeight: 80, resize: 'vertical' }}
                    placeholder="¿Qué hace tu empresa?" />
                </div>
                <button
                  onClick={() => setEditingEmpresa(false)}
                  style={{ ...btnSecondary, justifyContent: 'center', color: C.green, borderColor: C.green }}
                >
                  <Check size={16} /> Datos correctos
                </button>
              </div>
            )}

            {/* Navegación */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
              <button onClick={() => setPaso(2)} style={btnPrimary}>
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ─── PASO 2: Tu actividad ───────────────────────────────────── */}
        {paso === 2 && (
          <div style={{ padding: isMobile ? '28px 20px' : '40px 40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.navy, margin: '0 0 8px' }}>
              Tu actividad
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.ink2, margin: '0 0 28px', lineHeight: 1.5 }}>
              Responde a estas preguntas para encontrar las subvenciones que mejor encajan contigo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CheckboxCard
                checked={actividad.invierte_maquinaria}
                onChange={v => setActividad(p => ({ ...p, invierte_maquinaria: v }))}
                icon={<Factory size={20} color={actividad.invierte_maquinaria ? C.teal : C.muted} />}
                title="¿Inviertes en maquinaria o equipos?"
                subtitle="Compra, leasing o renovación de equipamiento"
              />
              <CheckboxCard
                checked={actividad.contrata_personal}
                onChange={v => setActividad(p => ({ ...p, contrata_personal: v }))}
                icon={<Users size={20} color={actividad.contrata_personal ? C.teal : C.muted} />}
                title="¿Contratas o vas a contratar personal?"
                subtitle="Nuevas incorporaciones, ampliación de plantilla"
              />
              <CheckboxCard
                checked={actividad.exporta}
                onChange={v => setActividad(p => ({ ...p, exporta: v }))}
                icon={<Globe size={20} color={actividad.exporta ? C.teal : C.muted} />}
                title="¿Exportas o quieres exportar?"
                subtitle="Ventas a mercados internacionales"
              />
              <CheckboxCard
                checked={actividad.tiene_local}
                onChange={v => setActividad(p => ({ ...p, tiene_local: v }))}
                icon={<Store size={20} color={actividad.tiene_local ? C.teal : C.muted} />}
                title="¿Tienes local comercial o naves?"
                subtitle="Espacios físicos propios o alquilados"
              />
            </div>

            {/* Navegación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <button onClick={() => setPaso(1)} style={btnSecondary}>
                <ChevronLeft size={18} /> Atrás
              </button>
              <button onClick={() => setPaso(3)} style={btnPrimary}>
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ─── PASO 3: Qué buscas ─────────────────────────────────────── */}
        {paso === 3 && (
          <div style={{ padding: isMobile ? '28px 20px' : '40px 40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: C.navy, margin: '0 0 8px' }}>
              ¿Qué buscas?
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.ink2, margin: '0 0 28px', lineHeight: 1.5 }}>
              Selecciona tus prioridades. Así priorizaremos las subvenciones que más te interesan.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PriorityCard
                selected={prioridades.ahorro_energetico}
                onChange={v => setPrioridades(p => ({ ...p, ahorro_energetico: v }))}
                icon={<Leaf size={22} />}
                title="Ahorro energético"
                subtitle="Eficiencia energética, renovables, sostenibilidad"
                color="#059669"
                bgColor="#ecfdf5"
              />
              <PriorityCard
                selected={prioridades.digitalizacion}
                onChange={v => setPrioridades(p => ({ ...p, digitalizacion: v }))}
                icon={<Monitor size={22} />}
                title="Digitalización"
                subtitle="Software, web, e-commerce, automatización"
                color="#1d4ed8"
                bgColor="#eff6ff"
              />
              <PriorityCard
                selected={prioridades.contratacion}
                onChange={v => setPrioridades(p => ({ ...p, contratacion: v }))}
                icon={<UserPlus size={22} />}
                title="Contratación"
                subtitle="Bonificaciones por contratar, formación"
                color="#d97706"
                bgColor="#fffbeb"
              />
              <PriorityCard
                selected={prioridades.internacionalizacion}
                onChange={v => setPrioridades(p => ({ ...p, internacionalizacion: v }))}
                icon={<Plane size={22} />}
                title="Internacionalización"
                subtitle="Exportar, ferias internacionales, mercados"
                color="#7c3aed"
                bgColor="#f5f3ff"
              />
              <PriorityCard
                selected={prioridades.investigacion_desarrollo}
                onChange={v => setPrioridades(p => ({ ...p, investigacion_desarrollo: v }))}
                icon={<Lightbulb size={22} />}
                title="I+D+i"
                subtitle="Investigación, desarrollo, innovación"
                color="#dc2626"
                bgColor="#fef2f2"
              />
            </div>

            {/* Navegación */}
            {saveError && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: 12, textAlign: 'center' }}>{saveError}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(2)} style={btnSecondary}>
                <ChevronLeft size={18} /> Atrás
              </button>
              <button
                onClick={guardarYContinuar}
                disabled={saving}
                style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                ) : (
                  <>Finalizar <Check size={18} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── PASO 4: ¡Listo! ────────────────────────────────────────── */}
        {paso === 4 && (
          <div style={{
            padding: isMobile ? '48px 20px' : '64px 40px',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {/* Animación de confetti/celebración */}
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.teal}, #06b6d4)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 28,
              animation: showConfetti ? 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            }}>
              <PartyPopper size={44} color="#fff" />
            </div>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: C.navy, margin: '0 0 12px' }}>
              ¡Todo listo!
            </h2>
            <p style={{ fontSize: '1rem', color: C.ink2, margin: '0 0 8px', lineHeight: 1.6, maxWidth: 420 }}>
              Ya tenemos toda la información que necesitamos.
            </p>
            <p style={{ fontSize: '0.9rem', color: C.muted, margin: '0 0 36px', lineHeight: 1.5, maxWidth: 420 }}>
              Nuestro motor de matching ha analizado <strong style={{ color: C.navy }}>más de 5.000 convocatorias</strong> para
              encontrar las que encajan con tu empresa.
            </p>

            <button
              onClick={irAlPortal}
              style={{
                ...btnPrimary,
                padding: '16px 40px', fontSize: '1.05rem', borderRadius: 14,
                background: `linear-gradient(135deg, ${C.navy}, #1e40af)`,
                boxShadow: `0 8px 24px rgba(13,31,60,0.25)`,
              }}
            >
              Ver mis ayudas <ChevronRight size={20} />
            </button>

            {/* Sparkles animados */}
            {showConfetti && <ConfettiDots />}

            <style>{`
              @keyframes bounceIn {
                0% { transform: scale(0); opacity: 0; }
                60% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes floatUp {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
              }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', borderRadius: 12,
      background: '#f8fafc', border: '1px solid #e8ecf4',
    }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0d1f3c' }}>
        {value}
      </span>
    </div>
  );
}

function CheckboxCard({ checked, onChange, icon, title, subtitle }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderRadius: 14,
        border: `2px solid ${checked ? '#0d9488' : '#e8ecf4'}`,
        background: checked ? '#f0fdfa' : '#fff',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: checked ? '#ccfbf1' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.2s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{subtitle}</div>
      </div>
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        border: `2px solid ${checked ? '#0d9488' : '#d1d5db'}`,
        background: checked ? '#0d9488' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease', flexShrink: 0,
      }}>
        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  );
}

function PriorityCard({ selected, onChange, icon, title, subtitle, color, bgColor }: {
  selected: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
}) {
  return (
    <button
      onClick={() => onChange(!selected)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px', borderRadius: 14,
        border: `2px solid ${selected ? color : '#e8ecf4'}`,
        background: selected ? bgColor : '#fff',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 13,
        background: selected ? `${color}18` : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: selected ? color : '#94a3b8',
        flexShrink: 0, transition: 'all 0.2s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0d1f3c', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{subtitle}</div>
      </div>
      <div style={{
        width: 26, height: 26, borderRadius: 8,
        border: `2px solid ${selected ? color : '#d1d5db'}`,
        background: selected ? color : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease', flexShrink: 0,
      }}>
        {selected && <Check size={14} color="#fff" strokeWidth={3} />}
      </div>
    </button>
  );
}

function ConfettiDots() {
  const colors = ['#0d9488', '#f97316', '#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626'];
  // Pre-compute random values to avoid impure function calls during render
  const dots = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    width: 8 + Math.random() * 8,
    height: 8 + Math.random() * 8,
    borderRadius: Math.random() > 0.5 ? '50%' : 3,
    color: colors[i % colors.length],
    left: `${10 + Math.random() * 80}%`,
    top: -60 - Math.random() * 100,
    duration: 1.5 + Math.random() * 1.5,
    delay: Math.random() * 0.5,
  })), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', height: 0, overflow: 'visible' }}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: d.width, height: d.height,
            borderRadius: d.borderRadius,
            background: d.color,
            left: d.left, top: d.top,
            animation: `floatUp ${d.duration}s ease-out ${d.delay}s forwards`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
