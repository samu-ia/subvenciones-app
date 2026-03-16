'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Briefcase, User } from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import DocumentList from '@/components/workspace/DocumentList';
import RichTextEditor from '@/components/workspace/RichTextEditor';
import AIPanelV2 from '@/components/workspace/AIPanelV2';

interface Expediente {
  id: string;
  nif: string;
  numero_bdns: number | null;
  estado: string;
  created_at: string;
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

export default function ExpedienteWorkspacePage() {
  const params = useParams();
  const expedienteId = params.id as string;

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const selectedDoc = documentos.find(d => d.id === selectedDocId);

  // Obtener userId
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [expedienteId]);

  const loadData = async () => {
    const supabase = createClient();

    const { data: expData } = await supabase
      .from('expediente')
      .select(`*, cliente:nif (nombre_normalizado)`)
      .eq('id', expedienteId)
      .single();

    if (expData) setExpediente(expData);

    const { data: docsData } = await supabase
      .from('documentos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('orden', { ascending: true });

    if (docsData && docsData.length > 0) {
      setDocumentos(docsData);
      setSelectedDocId(docsData[0].id);
      setDocContent(docsData[0].contenido || '');
    } else {
      const defaultDocs = [
        { nombre: 'Memoria', tipo_documento: 'memoria', contenido: '' },
        { nombre: 'Checklist', tipo_documento: 'checklist', contenido: '' },
        { nombre: 'Notas', tipo_documento: 'notas', contenido: '' },
      ];
      const { data: newDocs } = await supabase
        .from('documentos')
        .insert(defaultDocs.map((doc, idx) => ({
          ...doc,
          expediente_id: expedienteId,
          nif: expData?.nif,
          orden: idx,
          generado_por_ia: false,
        })))
        .select();
      if (newDocs) {
        setDocumentos(newDocs);
        setSelectedDocId(newDocs[0].id);
        setDocContent('');
      }
    }
    setLoading(false);
  };

  const saveDocument = useCallback(async (content: string) => {
    if (!selectedDocId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('documentos')
      .update({ contenido: content, updated_at: new Date().toISOString() })
      .eq('id', selectedDocId);
    if (!error) {
      setLastSaved(new Date());
      setDocumentos(docs =>
        docs.map(d => d.id === selectedDocId ? { ...d, contenido: content } : d)
      );
    }
  }, [selectedDocId]);

  const handleCreateDoc = async () => {
    const nombre = prompt('Nombre del documento:');
    if (!nombre) return;
    const supabase = createClient();
    const { data: newDoc } = await supabase
      .from('documentos')
      .insert({
        nombre,
        expediente_id: expedienteId,
        nif: expediente?.nif,
        contenido: '',
        orden: documentos.length,
        generado_por_ia: false,
      })
      .select()
      .single();
    if (newDoc) {
      setDocumentos([...documentos, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent('');
    }
  };

  const handleRenameDoc = async (docId: string, newName: string) => {
    const supabase = createClient();
    await supabase.from('documentos').update({ nombre: newName }).eq('id', docId);
    setDocumentos(docs => docs.map(d => d.id === docId ? { ...d, nombre: newName } : d));
  };

  const handleDeleteDoc = async (docId: string) => {
    const supabase = createClient();
    await supabase.from('documentos').delete().eq('id', docId);
    const newDocs = documentos.filter(d => d.id !== docId);
    setDocumentos(newDocs);
    if (selectedDocId === docId && newDocs.length > 0) {
      setSelectedDocId(newDocs[0].id);
      setDocContent(newDocs[0].contenido || '');
    }
  };

  const handleSelectDoc = (docId: string) => {
    const doc = documentos.find(d => d.id === docId);
    if (doc) {
      setSelectedDocId(docId);
      setDocContent(doc.contenido || '');
    }
  };

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
        expediente_id: expedienteId,
        nif: expediente?.nif,
        generado_por_ia: true,
        prompt_usado: prompt,
        orden: documentos.length,
      })
      .select()
      .single();
    if (newDoc) {
      setDocumentos(prev => [...prev, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent(contenido);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando workspace...</div>;
  }

  if (!expediente) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Expediente no encontrado</div>;
  }

  const titulo = expediente.numero_bdns
    ? `BDNS ${expediente.numero_bdns}`
    : `Expediente ${expediente.id.slice(0, 8)}`;

  return (
    <WorkspaceLayout
      header={
        <div>
          <Link
            href="/expedientes"
            style={{
              color: 'var(--primary)',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '12px',
            }}
          >
            <ArrowLeft size={14} />
            Volver a expedientes
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>
                {titulo}
              </h1>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                fontSize: '13px', color: 'var(--muted-foreground)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} />
                  <span>{expediente.cliente?.[0]?.nombre_normalizado || expediente.nif}</span>
                </div>
                <span>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} />
                  <span>{expediente.nif}</span>
                </div>
                <span>|</span>
                <span style={{
                  padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                  backgroundColor:
                    expediente.estado === 'aprobado' ? 'var(--success)' :
                    expediente.estado === 'rechazado' ? 'var(--destructive)' : 'var(--warning)',
                  color: 'white',
                }}>
                  {expediente.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
      documentList={
        <DocumentList
          documentos={documentos}
          archivos={[]}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onCreateDoc={handleCreateDoc}
          onRenameDoc={handleRenameDoc}
          onDeleteDoc={handleDeleteDoc}
          onUploadFile={() => alert('Upload de archivos próximamente')}
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
            contextoId={expedienteId}
            contextoTipo="expediente"
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
