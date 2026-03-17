'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Briefcase, User } from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import NotebookLeftPanel from '@/components/workspace/docs/NotebookLeftPanel';
import RichTextEditor from '@/components/workspace/editor/RichTextEditor';
import AIPanelV2 from '@/components/workspace/ai/AIPanelV2';
import type { ContextMode } from '@/components/workspace/ai/ContextToggle';

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
  const [selectedArchivoId, setSelectedArchivoId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Array<{ id: string; nombre: string; mime_type?: string | null; tamano_bytes?: number; storage_path?: string }>>([]);
  const [contextSelections, setContextSelections] = useState<Record<string, ContextMode>>({});
  const [archivoSignedUrl, setArchivoSignedUrl] = useState<string | null>(null);

  const selectedDoc = documentos.find(d => d.id === selectedDocId);

  // Generar signed URL cuando se selecciona un archivo
  useEffect(() => {
    if (!selectedArchivoId) { setArchivoSignedUrl(null); return; }
    const archivo = archivos.find(a => a.id === selectedArchivoId);
    if (!archivo?.storage_path) { setArchivoSignedUrl(null); return; }
    const supabase = createClient();
    supabase.storage.from('archivos').createSignedUrl(archivo.storage_path, 3600)
      .then(({ data }) => setArchivoSignedUrl(data?.signedUrl ?? null))
      .catch(() => setArchivoSignedUrl(null));
  }, [selectedArchivoId, archivos]);

  // Escuchar evento doc-created para actualizar lista sin prompt()
  useEffect(() => {
    const handler = (e: Event) => {
      const newDoc = (e as CustomEvent).detail;
      setDocumentos(prev => {
        if (prev.find(d => d.id === newDoc.id)) return prev;
        return [...prev, newDoc];
      });
      setSelectedDocId(newDoc.id);
      setDocContent(newDoc.contenido || '');
    };
    window.addEventListener('doc-created', handler);
    return () => window.removeEventListener('doc-created', handler);
  }, []);

  // Escuchar acciones del agente (crear/editar documentos)
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        type: string;
        documentId: string;
        documentName?: string;
        contenido?: string;
      };
      if (detail.type === 'create_document') {
        // Recargar el documento recién creado desde Supabase
        const supabase = createClient();
        const { data: newDoc } = await supabase
          .from('documentos')
          .select('*')
          .eq('id', detail.documentId)
          .single();
        if (newDoc) {
          setDocumentos(prev => {
            if (prev.find(d => d.id === newDoc.id)) return prev;
            return [...prev, newDoc];
          });
          // Seleccionar el último doc creado
          setSelectedDocId(newDoc.id);
          setDocContent(newDoc.contenido || '');
        }
      } else if (detail.type === 'edit_document') {
        // Actualizar el contenido del doc editado en el estado local
        setDocumentos(prev => prev.map(d =>
          d.id === detail.documentId ? { ...d, contenido: detail.contenido ?? d.contenido } : d
        ));
        // Si está abierto, actualizar el editor
        setSelectedDocId(id => {
          if (id === detail.documentId) setDocContent(detail.contenido ?? '');
          return id;
        });
      }
    };
    window.addEventListener('agent-doc-action', handler);
    return () => window.removeEventListener('agent-doc-action', handler);
  }, []);

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
      setSelectedArchivoId(null);
      setDocContent(doc.contenido || '');
    }
  };

  const handleSelectArchivo = (archivoId: string) => {
    setSelectedArchivoId(archivoId);
    setSelectedDocId(null);
  };

  const handleChangeTipoDoc = async (docId: string, tipo: string) => {
    const supabase = createClient();
    await supabase.from('documentos').update({ tipo_documento: tipo }).eq('id', docId);
    setDocumentos(docs => docs.map(d => d.id === docId ? { ...d, tipo_documento: tipo } : d));
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
        <NotebookLeftPanel
          documentos={documentos}
          archivos={archivos}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onCreateDoc={handleCreateDoc}
          onRenameDoc={handleRenameDoc}
          onDeleteDoc={handleDeleteDoc}
          contextoId={expedienteId}
          contextoTipo="expediente"
          nif={expediente?.nif}
          onArchivoUploaded={archivo => setArchivos(prev => [...prev, archivo])}
          onSelectArchivo={handleSelectArchivo}
          selectedArchivoId={selectedArchivoId}
          contextSelections={contextSelections}
          onContextModeChange={(docId, mode) => setContextSelections(prev => ({ ...prev, [docId]: mode }))}
        />
      }
      editor={
        (() => {
          const selectedArchivo = archivos.find(a => a.id === selectedArchivoId);
          if (selectedArchivo) {
            const fileUrl = archivoSignedUrl;
            const isPdf = selectedArchivo.mime_type === 'application/pdf';
            const isImage = selectedArchivo.mime_type?.startsWith('image/');
            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                  padding: '10px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--background)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>
                      📎 {selectedArchivo.nombre}
                    </span>
                    {selectedArchivo.tamano_bytes && (
                      <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                        {Math.round(selectedArchivo.tamano_bytes / 1024)} KB
                      </span>
                    )}
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        fontSize: '12px', fontWeight: '600', color: 'var(--primary)',
                        textDecoration: 'none', padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid var(--primary)',
                      }}>
                      ↓ Descargar
                    </a>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {fileUrl && isPdf ? (
                    <iframe src={fileUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                  ) : fileUrl && isImage ? (
                    <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', overflowY: 'auto', height: '100%' }}>
                      <img src={fileUrl} alt={selectedArchivo.nombre}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                    </div>
                  ) : fileUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--muted-foreground)' }}>
                      <div style={{ fontSize: '48px' }}>📄</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{selectedArchivo.nombre}</div>
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--primary)', color: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                        Abrir archivo
                      </a>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted-foreground)' }}>
                      Archivo no disponible
                    </div>
                  )}
                </div>
              </div>
            );
          }
          if (selectedDoc) {
            const TIPOS_DOC = [
              { value: 'nota', label: 'Nota' },
              { value: 'notas', label: 'Notas' },
              { value: 'preparacion', label: 'Preparación' },
              { value: 'guion', label: 'Guión' },
              { value: 'resumen', label: 'Resumen' },
              { value: 'email', label: 'Email' },
              { value: 'checklist', label: 'Checklist' },
              { value: 'memoria', label: 'Memoria' },
              { value: 'informe', label: 'Informe' },
              { value: 'propuesta', label: 'Propuesta' },
              { value: 'otro', label: 'Otro' },
            ];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'var(--background)',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)', flex: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedDoc.nombre}
                  </span>
                  <select
                    value={selectedDoc.tipo_documento ?? 'nota'}
                    onChange={e => handleChangeTipoDoc(selectedDoc.id, e.target.value)}
                    style={{
                      fontSize: '11px', padding: '3px 6px', borderRadius: '6px',
                      border: '1px solid var(--border)', background: 'var(--background)',
                      color: 'var(--muted-foreground)', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {TIPOS_DOC.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {lastSaved && (
                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      Guardado {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <RichTextEditor
                    key={selectedDocId ?? 'empty'}
                    content={docContent}
                    onChange={setDocContent}
                    onSave={saveDocument}
                    lastSaved={lastSaved}
                    placeholder="Empieza a escribir..."
                  />
                </div>
              </div>
            );
          }
          return (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--muted-foreground)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>Selecciona un documento para empezar</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>O crea uno nuevo desde el panel izquierdo</div>
            </div>
          );
        })()
      }
      aiPanel={
        userId ? (
          <AIPanelV2
            userId={userId}
            contextoId={expedienteId}
            contextoTipo="expediente"
            documentos={documentos}
            contextSelections={contextSelections}
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
