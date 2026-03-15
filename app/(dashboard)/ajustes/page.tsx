'use client';

import { useState, useEffect } from 'react';
import { Settings, Brain, Shield, Zap } from 'lucide-react';

export default function AjustesPage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--s2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s1)', marginBottom: '8px' }}>
          <Settings size={28} style={{ color: 'var(--teal)' }} />
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Ajustes</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '15px' }}>
          Configura la aplicación según tus necesidades
        </p>
      </div>

      {/* Grid de secciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--s2)' }}>
        {/* Tarjeta: General */}
        <a
          href="/ajustes/general"
          className="table-row"
          style={{
            display: 'block',
            padding: 'var(--s2)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s1)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: 'var(--blue-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Settings size={24} style={{ color: 'var(--teal)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>General</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5 }}>
                Configuración básica de la aplicación, empresa y preferencias
              </p>
            </div>
          </div>
        </a>

        {/* Tarjeta: Usuarios */}
        <a
          href="/ajustes/usuarios"
          className="table-row"
          style={{
            display: 'block',
            padding: 'var(--s2)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s1)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: 'var(--green-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Shield size={24} style={{ color: 'var(--teal)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>Usuarios</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5 }}>
                Gestión de usuarios, roles y permisos de acceso
              </p>
            </div>
          </div>
        </a>

        {/* Tarjeta: Integraciones */}
        <a
          href="/ajustes/integraciones"
          className="table-row"
          style={{
            display: 'block',
            padding: 'var(--s2)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s1)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: 'var(--amber-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Zap size={24} style={{ color: 'var(--teal)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>Integraciones</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5 }}>
                Conecta con servicios externos y automatizaciones
              </p>
            </div>
          </div>
        </a>

        {/* Tarjeta: IA */}
        <a
          href="/ajustes/ia"
          className="table-row"
          style={{
            display: 'block',
            padding: 'var(--s2)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--s1)' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Brain size={24} style={{ color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>Configuración IA</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', lineHeight: 1.5 }}>
                Gestiona modelos, claves API, recuperación documental y comportamiento de la inteligencia artificial
              </p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
