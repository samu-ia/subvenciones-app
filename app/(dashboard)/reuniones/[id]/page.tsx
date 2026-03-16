'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Calendar, Clock, User, ArrowLeft, Settings } from 'lucide-react';
import ConfigModal from '@/components/workspace/ConfigModal';

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  duracion_minutos: number | null;
  cliente_nif: string | null;
  notas: string | null;
  objetivo: string | null;
  conclusiones: string | null;
  proximos_pasos: string[] | null;
  cliente: {
    nombre_normalizado: string | null;
  }[];
}

export default function ReunionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reunionId = params.id as string;
  
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    async function fetchReunion() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('reuniones')
          .select(`
            *,
            cliente:cliente_nif (
              nombre_normalizado
            )
          `)
          .eq('id', reunionId)
          .single();

        if (error) {
          console.error('Error cargando reunión:', error);
          setLoading(false);
          return;
        }

        if (data) {
          setReunion(data);
          setNotas(data.notas || '');
        }
        setLoading(false);
      } catch (err) {
        console.error('Error en fetchReunion:', err);
        setLoading(false);
      }
    }

    if (reunionId) {
      fetchReunion();
    }
  }, [reunionId]);

  const saveNotas = useCallback(async (content: string) => {
    setSaving(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('reuniones')
      .update({ notas: content })
      .eq('id', reunionId);

    if (error) {
      console.error('Error guardando notas:', error);
    } else {
      setLastSaved(new Date());
    }
    setSaving(false);
  }, [reunionId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notas !== (reunion?.notas || '')) {
        saveNotas(notas);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notas, reunion?.notas, saveNotas]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (!reunion) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Reunión no encontrada</div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px' }}>
      {/* Header Compacto */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/reuniones"
          style={{
            color: 'var(--teal)',
            fontSize: '13px',
            fontWeight: '600',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '12px'
          }}
        >
          <ArrowLeft size={14} />
          Volver
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '12px'
          }}>
            {reunion.titulo || 'Sin título'}
          </h1>

          <button
            onClick={() => setShowConfig(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--ink2)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = 'var(--ink2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <Settings size={16} />
            Ajustes IA
          </button>
        </div>

        {/* Info Compacta en Una Línea */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          fontSize: '14px',
          color: 'var(--ink2)',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} style={{ color: 'var(--muted)' }} />
            <span style={{ fontWeight: '500' }}>
              {reunion.cliente?.[0]?.nombre_normalizado || reunion.cliente_nif || '—'}
            </span>
          </div>
          <div style={{ color: 'var(--border)' }}>|</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} style={{ color: 'var(--muted)' }} />
            <span>{formatDate(reunion.fecha_programada)}</span>
          </div>
          <div style={{ color: 'var(--border)' }}>|</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📋</span>
            <span>{reunion.tipo || '—'}</span>
          </div>
          <div style={{ color: 'var(--border)' }}>|</div>
          <span style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            backgroundColor: reunion.estado === 'realizada' ? 'var(--green-bg)' : 'var(--amber-bg)',
            color: reunion.estado === 'realizada' ? 'var(--green)' : 'var(--amber)'
          }}>
            {reunion.estado || 'pendiente'}
          </span>
        </div>

        {/* Objetivo compacto si existe */}
        {reunion.objetivo && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '14px',
            color: 'var(--ink2)',
            lineHeight: '1.5'
          }}>
            <strong style={{ color: 'var(--ink)' }}>Objetivo:</strong> {reunion.objetivo}
          </div>
        )}
      </div>

      {/* EDITOR PRINCIPAL - Ocupa casi toda la pantalla */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Barra superior limpia */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)'
        }}>
          <h2 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--ink)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            Cuaderno
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>
            {saving ? (
              <span style={{ color: 'var(--amber)' }}>●  Guardando...</span>
            ) : lastSaved ? (
              <span style={{ color: 'var(--green)' }}>✓  Guardado {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Guardado automático</span>
            )}
          </div>
        </div>

        {/* Área de escritura grande */}
        <div style={{ padding: '0' }}>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Escribe aquí tus notas...

📋 Preparación
- Puntos a tratar
- Documentos necesarios

📝 Durante la reunión
- Comentarios del cliente
- Decisiones tomadas

✅ Conclusiones
- Resumen de acuerdos

🎯 Próximos pasos
- Acciones a realizar"
            style={{
              width: '100%',
              minHeight: '65vh',
              padding: '32px',
              fontSize: '15px',
              lineHeight: '1.8',
              border: 'none',
              backgroundColor: 'white',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
    </div>
  );
}
