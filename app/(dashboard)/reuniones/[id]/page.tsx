'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import DocumentList from '@/components/workspace/DocumentList';
import RichTextEditor from '@/components/workspace/RichTextEditor';
import AIPanelV2 from '@/components/workspace/AIPanelV2';

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  cliente_nif: string | null;
  objetivo: string | null;
  cliente: {
    nombre_normalizado: string | null;
  }[];
}

interface Documento {
  id: string;
  nombre: string;
  contenido: string | null;
  tipo_documento: string | null;
  generado_por_ia: boolean;
  updated_at: string;
}

export default function ReunionWorkspacePage() {
  const params = useParams();
  const reunionId = params.id as string;

  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Array<{ id: string; nombre: string; mime_type?: string | null; tamano_bytes?: number; storage_path?: string }>>([]);

  const selectedDoc = documentos.find(d => d.id === selectedDocId);

  // Escuchar evento doc-created para actualizar lista sin prompt()
  useEffect(() => {
    const handler = (e: Event) => {
      const newDoc = (e as CustomEvent).detail;
      setDocumentos(prev => {
        if (prev.find(d => d.id === newDoc.id)) return prev;
        return [...prev, newDoc];
      });
      setSelectedDocId(newDoc.id);
      setDocContent('');
    };
    window.addEventListener('doc-created', handler);
    return () => window.removeEventListener('doc-created', handler);
  }, []);

  // Obtener userId
  useEffect(() => {
    const getUserId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUserId();
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [reunionId]);

  const loadData = async () => {
    const supabase = createClient();

    // Cargar reunión
    const { data: reunionData } = await supabase
      .from('reuniones')
      .select(`
        *,
        cliente:cliente_nif (
          nombre_normalizado
        )
      `)
      .eq('id', reunionId)
      .single();

    if (reunionData) {
      setReunion(reunionData);
    }

    // Cargar documentos
    const { data: docsData } = await supabase
      .from('documentos')
      .select('*')
      .eq('reunion_id', reunionId)
      .order('orden', { ascending: true });

    if (docsData && docsData.length > 0) {
      setDocumentos(docsData);
      setSelectedDocId(docsData[0].id);
      setDocContent(docsData[0].contenido || '');
    } else {
      // Crear documentos por defecto
      const defaultDocs = [
        { nombre: 'Notas de Reunión', tipo_documento: 'notas', contenido: '' },
        { nombre: 'Preparación', tipo_documento: 'preparacion', contenido: '' },
        { nombre: 'Conclusiones', tipo_documento: 'conclusiones', contenido: '' }
      ];

      const { data: newDocs } = await supabase
        .from('documentos')
        .insert(
          defaultDocs.map((doc, idx) => ({
            ...doc,
            reunion_id: reunionId,
            nif: reunionData?.cliente_nif,
            orden: idx
          }))
        )
        .select();

      if (newDocs) {
        setDocumentos(newDocs);
        setSelectedDocId(newDocs[0].id);
        setDocContent(newDocs[0].contenido || '');
      }
    }

    setLoading(false);
  };

  // Guardar documento actual
  const saveDocument = useCallback(async (content: string) => {
    if (!selectedDocId) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('documentos')
      .update({ contenido: content })
      .eq('id', selectedDocId);

    if (!error) {
      setLastSaved(new Date());
      // Actualizar en estado local
      setDocumentos(docs =>
        docs.map(d => d.id === selectedDocId ? { ...d, contenido: content } : d)
      );
    }
  }, [selectedDocId]);

  // Crear documento
  const handleCreateDoc = async () => {
    const nombre = prompt('Nombre del documento:');
    if (!nombre) return;

    const supabase = createClient();
    const { data: newDoc } = await supabase
      .from('documentos')
      .insert({
        nombre,
        reunion_id: reunionId,
        nif: reunion?.cliente_nif,
        contenido: '',
        orden: documentos.length
      })
      .select()
      .single();

    if (newDoc) {
      setDocumentos([...documentos, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent('');
    }
  };

  // Renombrar documento
  const handleRenameDoc = async (docId: string, newName: string) => {
    const supabase = createClient();
    await supabase
      .from('documentos')
      .update({ nombre: newName })
      .eq('id', docId);

    setDocumentos(docs =>
      docs.map(d => d.id === docId ? { ...d, nombre: newName } : d)
    );
  };

  // Eliminar documento
  const handleDeleteDoc = async (docId: string) => {
    const supabase = createClient();
    await supabase
      .from('documentos')
      .delete()
      .eq('id', docId);

    const newDocs = documentos.filter(d => d.id !== docId);
    setDocumentos(newDocs);

    if (selectedDocId === docId && newDocs.length > 0) {
      setSelectedDocId(newDocs[0].id);
      setDocContent(newDocs[0].contenido || '');
    }
  };

  // Seleccionar documento
  const handleSelectDoc = (docId: string) => {
    const doc = documentos.find(d => d.id === docId);
    if (doc) {
      setSelectedDocId(docId);
      setDocContent(doc.contenido || '');
    }
  };

  // Generar documento desde IA
  const handleGenerarDocumento = async (nombre: string, contenido: string, prompt: string) => {
    const supabase = createClient();

    // Modo insertar en documento existente
    if (nombre.startsWith('__insert__')) {
      const docId = nombre.replace('__insert__', '');
      await supabase
        .from('documentos')
        .update({ contenido, updated_at: new Date().toISOString() })
        .eq('id', docId);
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, contenido } : d));
      setSelectedDocId(docId);
      setDocContent(contenido);
      return;
    }

    const { data: newDoc } = await supabase
      .from('documentos')
      .insert({
        nombre,
        contenido,
        reunion_id: reunionId,
        nif: reunion?.cliente_nif,
        generado_por_ia: true,
        prompt_usado: prompt,
        orden: documentos.length
      })
      .select()
      .single();

    if (newDoc) {
      setDocumentos(prev => [...prev, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent(contenido);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando workspace...</div>;
  }

  if (!reunion) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Reunión no encontrada</div>;
  }

  return (
    <WorkspaceLayout
      header={
        <div>
          <Link
            href="/reuniones"
            style={{
              color: 'var(--primary)',
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
            Volver a reuniones
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>
                {reunion.titulo || 'Reunión sin título'}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '13px',
                color: 'var(--muted-foreground)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} />
                  <span>{reunion.cliente?.[0]?.nombre_normalizado || reunion.cliente_nif}</span>
                </div>
                <div>|</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  <span>{formatDate(reunion.fecha_programada)}</span>
                </div>
                <div>|</div>
                <span>{reunion.tipo}</span>
                <div>|</div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: reunion.estado === 'realizada' ? 'var(--success)' : 'var(--warning)',
                  color: 'white'
                }}>
                  {reunion.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
      documentList={
        <DocumentList
          documentos={documentos}
          archivos={archivos}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onCreateDoc={handleCreateDoc}
          onRenameDoc={handleRenameDoc}
          onDeleteDoc={handleDeleteDoc}
          onUploadFile={() => {}}
          contextoId={reunionId}
          contextoTipo="reunion"
          nif={reunion?.cliente_nif ?? undefined}
          onArchivoUploaded={(archivo) => setArchivos(prev => [...prev, archivo])}
        />
      }
      editor={
        selectedDoc ? (
          <RichTextEditor
            content={docContent}
            onChange={setDocContent}
            onSave={saveDocument}
            lastSaved={lastSaved}
            placeholder="Empieza a escribir..."
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-foreground)' }}>
            Selecciona o crea un documento para empezar
          </div>
        )
      }
      aiPanel={
        userId ? (
          <AIPanelV2
            userId={userId}
            contextoId={reunionId}
            contextoTipo="reunion"
            documentos={documentos}
            onGenerarDocumento={handleGenerarDocumento}
            selectedDocId={selectedDocId}
            onSelectDoc={handleSelectDoc}
          />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            Cargando asistente...
          </div>
        )
      }
    />
  );
}
