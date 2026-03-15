'use client';

import { FileText, Upload } from 'lucide-react';

export default function DocumentosPage() {
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
            <FileText size={32} style={{ color: 'var(--teal)' }} />
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 600 }}>Documentos</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
            Gestiona documentos de clientes, expedientes y documentación generada con IA
          </p>
        </div>

        <button
          style={{
            padding: '12px 24px',
            background: 'var(--teal)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          <Upload size={20} />
          Subir documento
        </button>
      </div>

      <div style={{
        padding: 'var(--s2)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Módulo en desarrollo. Incluirá: subida de documentos, generación con IA, versionado y búsqueda semántica.
        </p>
      </div>
    </div>
  );
}
