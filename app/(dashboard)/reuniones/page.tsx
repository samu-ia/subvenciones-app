'use client';

import { Calendar, Plus } from 'lucide-react';
import Link from 'next/link';

export default function ReunionesPage() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--s2)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', marginBottom: '8px' }}>
            <Calendar size={32} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 600 }}>Reuniones</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Gestiona reuniones con clientes, prepara contexto y genera documentación
          </p>
        </div>

        <Link
          href="/reuniones/nueva"
          style={{
            padding: '12px 24px',
            background: 'var(--teal)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          <Plus size={20} />
          Nueva reunión
        </Link>
      </div>

      <div style={{
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Módulo en desarrollo. Incluirá: lista de reuniones, preparación con IA, búsqueda profunda, generación de guiones y documentos.
        </p>
      </div>
    </div>
  );
}
