'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Calendar, Clock, User, ArrowLeft } from 'lucide-react';

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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      {/* Header */}
      <Link
        href="/reuniones"
        style={{
          color: 'var(--teal)',
          fontSize: '14px',
          fontWeight: '600',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={16} />
        Volver a reuniones
      </Link>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--ink)',
          marginBottom: '16px'
        }}>
          {reunion.titulo || 'Sin título'}
        </h1>

        {/* Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          backgroundColor: 'var(--surface)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} style={{ color: 'var(--muted)' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>Cliente</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                {reunion.cliente?.[0]?.nombre_normalizado || reunion.cliente_nif || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} style={{ color: 'var(--muted)' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>Fecha</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                {formatDate(reunion.fecha_programada)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '18px' }}>📋</div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>Tipo</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
                {reunion.tipo || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '18px' }}>🚦</div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>Estado</div>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: reunion.estado === 'realizada' ? 'var(--green-bg)' : 'var(--amber-bg)',
                color: reunion.estado === 'realizada' ? 'var(--green)' : 'var(--amber)'
              }}>
                {reunion.estado || 'pendiente'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Objetivo */}
      {reunion.objetivo && (
        <div style={{
          backgroundColor: 'var(--surface)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          marginBottom: '24px'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '700',
            color: 'var(--ink)',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Objetivo
          </h3>
          <p style={{ fontSize: '15px', color: 'var(--ink2)', lineHeight: '1.6', margin: 0 }}>
            {reunion.objetivo}
          </p>
        </div>
      )}

      {/* Cuaderno de Notas */}
      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg)'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--ink)',
            margin: 0
          }}>
            Cuaderno de la reunión
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {saving ? (
              <span style={{ color: 'var(--amber)' }}>Guardando...</span>
            ) : lastSaved ? (
              <span>Guardado {lastSaved.toLocaleTimeString('es-ES')}</span>
            ) : (
              <span>Guardado automático activado</span>
            )}
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Escribe aquí la preparación de la reunión, notas durante la reunión, conclusiones y próximos pasos...

Puedes estructurarlo como prefieras:

📋 Preparación:
- Puntos a tratar
- Documentos necesarios

📝 Notas:
- Comentarios del cliente
- Decisiones tomadas

✅ Conclusiones:
- Resumen de acuerdos

🎯 Próximos pasos:
- Acciones a realizar
- Fechas de seguimiento"
            style={{
              width: '100%',
              minHeight: '500px',
              padding: '16px',
              fontSize: '15px',
              lineHeight: '1.7',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}
