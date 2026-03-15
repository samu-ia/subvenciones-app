'use client';

import { Shield } from 'lucide-react';

export default function AjustesSeguridadPage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--s2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', marginBottom: '8px' }}>
          <Shield size={28} style={{ color: 'var(--teal)' }} />
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Seguridad</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Gestión de permisos, auditoría y políticas de seguridad
        </p>
      </div>

      <div style={{
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Próximamente</p>
      </div>
    </div>
  );
}
