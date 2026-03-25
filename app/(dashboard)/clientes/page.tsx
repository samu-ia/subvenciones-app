'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Cliente {
  nif: string;
  nombre_empresa: string | null;
  nombre_normalizado: string | null;
  email_normalizado: string | null;
  actividad: string | null;
  tamano_empresa: string | null;
  ciudad: string | null;
  comunidad_autonoma: string | null;
  num_empleados: number | null;
  created_at: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => r.json())
      .then(data => {
        const lista = Array.isArray(data) ? data : [];
        setClientes(lista);
        setFilteredClientes(lista);
      })
      .catch(e => console.error('Error cargando clientes:', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredClientes(clientes);
    } else {
      const q = searchTerm.toLowerCase();
      const filtered = clientes.filter(cliente =>
        cliente.nombre_empresa?.toLowerCase().includes(q) ||
        cliente.nombre_normalizado?.toLowerCase().includes(q) ||
        cliente.nif?.toLowerCase().includes(q) ||
        cliente.actividad?.toLowerCase().includes(q) ||
        cliente.ciudad?.toLowerCase().includes(q) ||
        cliente.comunidad_autonoma?.toLowerCase().includes(q)
      );
      setFilteredClientes(filtered);
    }
  }, [searchTerm, clientes]);

  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            Clientes
          </h1>
          <p style={{ color: 'var(--ink2)', fontSize: '15px' }}>
            Gestiona la cartera de clientes
          </p>
        </div>
        
        <Link href="/clientes/nuevo">
          <button style={{
            backgroundColor: 'var(--teal)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: 'var(--s1)',
            transition: 'transform 0.2s'
          }}>
            + Nuevo cliente
          </button>
        </Link>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          position: 'relative',
          maxWidth: '500px'
        }}>
          <Search size={20} style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)'
          }} />
          <input
            type="text"
            placeholder="Buscar clientes por nombre, NIF, actividad o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              fontSize: '15px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--surface)',
              color: 'var(--ink)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          padding: '64px 32px',
          textAlign: 'center',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: 0.3
          }}>📋</div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: 'var(--ink)',
            marginBottom: '8px'
          }}>
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            {searchTerm ? 'Intenta con otro término de búsqueda' : 'Comienza agregando tu primer cliente'}
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: '12px',
          boxShadow: 'var(--s1)',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.5fr 1fr 1.5fr 1fr 1.5fr',
            gap: '16px',
            padding: '14px 24px',
            backgroundColor: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--ink2)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <div>Cliente</div>
            <div>NIF</div>
            <div>Actividad</div>
            <div>Tamaño</div>
            <div>Ubicación</div>
          </div>

          {/* Table Body */}
          {filteredClientes.map((cliente: Cliente) => (
            <Link
              key={cliente.nif}
              href={`/clientes/${cliente.nif}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="table-row" style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1fr 1.5fr 1fr 1.5fr',
                gap: '16px',
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--navy)' }}>
                    {cliente.nombre_empresa || cliente.nombre_normalizado || cliente.nif}
                  </div>
                  {cliente.email_normalizado && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      {cliente.email_normalizado}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)', fontFamily: 'monospace' }}>
                  {cliente.nif}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)' }}>
                  {cliente.actividad || '—'}
                </div>
                <div>
                  {cliente.tamano_empresa ? (
                    <span style={{
                      display: 'inline-block', padding: '3px 9px', borderRadius: '6px',
                      fontSize: '12px', fontWeight: '500',
                      backgroundColor: 'var(--blue-bg)', color: 'var(--blue)'
                    }}>
                      {cliente.tamano_empresa}
                    </span>
                  ) : <span style={{ color: 'var(--muted)', fontSize: '13px' }}>—</span>}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ink2)' }}>
                  {cliente.ciudad
                    ? `${cliente.ciudad}${cliente.comunidad_autonoma ? ` · ${cliente.comunidad_autonoma}` : ''}`
                    : cliente.comunidad_autonoma || '—'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
