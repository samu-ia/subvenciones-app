'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { X, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';

interface AuthModalProps {
  onClose: () => void;
  initialMode?: Mode;
}

export default function AuthModal({ onClose, initialMode = 'login' }: AuthModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      setError('Email o contraseña incorrectos');
      setLoading(false); return;
    }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', authData.user.id).maybeSingle();
    const rol = perfil?.rol ?? authData.user.user_metadata?.rol ?? 'cliente';
    router.push(rol === 'admin' ? '/dashboard' : '/portal');
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { data: regData, error: regError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { rol: 'cliente' },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal`,
      },
    });
    if (regError) {
      // Mensaje más claro para errores comunes
      if (regError.message.includes('already registered') || regError.message.includes('already been registered')) {
        setError('Este email ya está registrado. Prueba a iniciar sesión.');
      } else if (regError.message.includes('Password should be')) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(regError.message);
      }
      setLoading(false); return;
    }
    // Si Supabase devuelve sesión directamente (confirmación de email desactivada)
    if (regData?.session) {
      router.push('/portal');
      router.refresh();
      return;
    }
    // Si requiere confirmación de email
    setSuccess('¡Cuenta creada! Revisa tu bandeja de entrada para confirmar tu email. Una vez confirmado podrás acceder a tu portal de subvenciones.');
    setLoading(false);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (forgotError) { setError(forgotError.message); setLoading(false); return; }
    setSuccess('Te hemos enviado un email para restablecer tu contraseña.');
    setLoading(false);
  }

  const titles: Record<Mode, string> = {
    login: 'Acceder a tu cuenta',
    register: 'Crear cuenta nueva',
    forgot: 'Recuperar contraseña',
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(13,31,60,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '40px 36px',
          width: '100%', maxWidth: 420,
          boxShadow: '0 24px 80px rgba(13,31,60,0.25)',
          position: 'relative', animation: 'modalIn 0.2s ease',
        }}
      >
        {/* Cerrar */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'var(--bg)', border: 'none', borderRadius: 8,
          width: 32, height: 32, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink2)',
        }}>
          <X size={16} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 38, height: 38, background: 'var(--navy)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '0.85rem',
          }}>AP</div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy)' }}>AyudaPyme</span>
        </div>

        {/* Back en forgot */}
        {mode !== 'login' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink2)',
            display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem',
            marginBottom: 16, padding: 0, fontFamily: 'inherit',
          }}>
            <ArrowLeft size={14} /> Volver
          </button>
        )}

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
          {titles[mode]}
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--ink2)', marginBottom: mode === 'register' ? 12 : 28 }}>
          {mode === 'login' && 'Accede a tu panel de subvenciones.'}
          {mode === 'register' && 'Gratuito · Sin compromiso · Solo pagas si conseguimos la subvención.'}
          {mode === 'forgot' && 'Te enviaremos un enlace para restablecer tu contraseña.'}
        </p>
        {mode === 'register' && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#065f46', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem' }}>✓</span>
            <span>Después de crear tu cuenta configurarás los datos de tu empresa y verás las subvenciones disponibles.</span>
          </div>
        )}

        {success ? (
          <div style={{
            background: 'var(--green-bg)', border: '1px solid #86efac',
            borderRadius: 12, padding: '16px 18px',
            fontSize: '0.85rem', color: '#15803d', lineHeight: 1.5,
          }}>
            {success}
          </div>
        ) : (
          <form onSubmit={mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleForgot}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="tu@email.com" style={inputStyle} />
            </Field>

            {mode !== 'forgot' && (
              <Field label="Contraseña">
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    required placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink2)',
                    display: 'flex', padding: 0,
                  }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
            )}

            {error && (
              <div style={{
                background: 'var(--red-bg)', border: '1px solid #fecaca',
                borderRadius: 8, padding: '10px 14px',
                fontSize: '0.8rem', color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '13px',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1, marginTop: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'login' && 'Entrar'}
              {mode === 'register' && 'Crear cuenta'}
              {mode === 'forgot' && 'Enviar enlace'}
            </button>
          </form>
        )}

        {/* Links de modo */}
        {!success && (
          <div style={{ marginTop: 22, textAlign: 'center', fontSize: '0.8rem', color: 'var(--ink2)' }}>
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('forgot'); setError(''); }} style={linkBtnStyle}>
                  ¿Olvidaste tu contraseña?
                </button>
                <div style={{ marginTop: 10 }}>
                  ¿No tienes cuenta?{' '}
                  <button onClick={() => { setMode('register'); setError(''); }} style={{ ...linkBtnStyle, fontWeight: 700, color: 'var(--teal)' }}>
                    Regístrate
                  </button>
                </div>
              </>
            )}
            {mode === 'register' && (
              <span>
                ¿Ya tienes cuenta?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} style={{ ...linkBtnStyle, fontWeight: 700, color: 'var(--teal)' }}>
                  Iniciar sesión
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px',
  border: '1.5px solid var(--border)', borderRadius: 9,
  fontSize: '0.87rem', color: 'var(--ink)',
  outline: 'none', fontFamily: 'inherit',
  background: '#fff', boxSizing: 'border-box',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--ink2)', fontFamily: 'inherit', fontSize: '0.8rem',
  textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink2)',
        display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
