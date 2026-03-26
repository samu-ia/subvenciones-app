import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f6fb',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(13,31,60,0.08)',
          marginBottom: 32,
          fontSize: '2rem',
        }}
      >
        🔍
      </div>

      <h1
        style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 900,
          color: '#0d1f3c',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: '1.15rem',
          fontWeight: 600,
          color: '#0d1f3c',
          marginBottom: 8,
        }}
      >
        Página no encontrada
      </p>

      <p
        style={{
          fontSize: '0.95rem',
          color: '#64748b',
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        La página que buscas no existe o ha sido movida.
        Vuelve al inicio para seguir navegando.
      </p>

      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#0d1f3c',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '14px 28px',
          fontSize: '0.95rem',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(13,31,60,0.2)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
      >
        Volver al inicio
      </Link>

      <p
        style={{
          marginTop: 48,
          fontSize: '0.78rem',
          color: '#94a3b8',
        }}
      >
        AyudaPyme — Tu agencia de subvenciones
      </p>
    </div>
  );
}
