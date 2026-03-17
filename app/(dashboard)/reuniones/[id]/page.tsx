'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import NotebookLeftPanel from '@/components/workspace/docs/NotebookLeftPanel';
import DeepSearchButton from '@/components/workspace/ai/DeepSearchButton';
import RichTextEditor from '@/components/workspace/editor/RichTextEditor';
import AIPanelV2 from '@/components/workspace/ai/AIPanelV2';
import type {
  SubvencionDetectada, EstadoInvestigacion, EstadoExpediente,
  ClienteSnapshot,
} from '@/lib/types/notebook';
import type { ContextMode } from '@/components/workspace/ai/ContextToggle';

interface Reunion {
  id: string;
  titulo: string | null;
  tipo: string | null;
  estado: string | null;
  fecha_programada: string | null;
  cliente_nif: string | null;
  objetivo: string | null;
  investigacion_estado?: string | null;
  num_subvenciones?: number | null;
  cliente: { nombre_normalizado: string | null }[];
}

interface Documento {
  id: string;
  nombre: string;
  contenido: string | null;
  tipo_documento: string | null;
  generado_por_ia: boolean;
  updated_at: string;
}

interface Archivo {
  id: string;
  nombre: string;
  mime_type?: string | null;
  tamano_bytes?: number;
  storage_path?: string;
}

export default function ReunionNotebookPage() {
  const params = useParams();
  const reunionId = params.id as string;

  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [clienteSnapshot, setClienteSnapshot] = useState<ClienteSnapshot>({});
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedArchivoId, setSelectedArchivoId] = useState<string | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [subvenciones, setSubvenciones] = useState<SubvencionDetectada[]>([]);
  const [subvencionActivaId, setSubvencionActivaId] = useState<string | null>(null);
  const [investigacionEstado, setInvestigacionEstado] = useState<EstadoInvestigacion>('pendiente');
  const [investigacionError, setInvestigacionError] = useState<string | null>(null);
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
          setSelectedDocId(newDoc.id);
          setDocContent(newDoc.contenido || '');
        }
      } else if (detail.type === 'edit_document') {
        setDocumentos(prev => prev.map(d =>
          d.id === detail.documentId ? { ...d, contenido: detail.contenido ?? d.contenido } : d
        ));
        setSelectedDocId(id => {
          if (id === detail.documentId) setDocContent(detail.contenido ?? '');
          return id;
        });
      }
    };
    window.addEventListener('agent-doc-action', handler);
    return () => window.removeEventListener('agent-doc-action', handler);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  useEffect(() => { loadData(); }, [reunionId]);

  const loadData = async () => {
    const supabase = createClient();

    const { data: reunionData } = await supabase
      .from('reuniones')
      .select('*, cliente:cliente_nif(nombre_normalizado, tamano_empresa, actividad, ciudad)')
      .eq('id', reunionId)
      .single();

    if (reunionData) {
      setReunion(reunionData);
      setInvestigacionEstado((reunionData.investigacion_estado as EstadoInvestigacion) || 'pendiente');
    }

    if (reunionData?.cliente_nif) {
      const { data: einforma } = await supabase
        .from('einforma')
        .select('cnae, empleados, ventas, forma_juridica, fecha_constitucion, localidad')
        .eq('nif', reunionData.cliente_nif)
        .maybeSingle();

      const clienteArr = reunionData.cliente as Array<{
        nombre_normalizado: string | null;
        tamano_empresa: string | null;
        actividad: string | null;
        ciudad: string | null;
      }>;
      const cliente = clienteArr?.[0];

      setClienteSnapshot({
        nif: reunionData.cliente_nif,
        nombre: cliente?.nombre_normalizado ?? undefined,
        cnae: einforma?.cnae ?? undefined,
        actividad: cliente?.actividad ?? undefined,
        ciudad: cliente?.ciudad ?? einforma?.localidad ?? undefined,
        tamano_empresa: cliente?.tamano_empresa ?? undefined,
        empleados: einforma?.empleados ?? undefined,
        ventas: einforma?.ventas ?? undefined,
        forma_juridica: einforma?.forma_juridica ?? undefined,
        fecha_constitucion: einforma?.fecha_constitucion ?? undefined,
      });
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
      const defaultDocs = [
        { nombre: 'Notas de Reunion', tipo_documento: 'notas', contenido: '' },
        { nombre: 'Preparacion', tipo_documento: 'preparacion', contenido: '' },
      ];

      const { data: newDocs } = await supabase
        .from('documentos')
        .insert(
          defaultDocs.map((doc, idx) => ({
            ...doc,
            reunion_id: reunionId,
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

    // Archivos
    const { data: archivosData } = await supabase
      .from('archivos').select('*').eq('reunion_id', reunionId);
    if (archivosData) setArchivos(archivosData);

    // Subvenciones detectadas
    const { data: subvData } = await supabase
      .from('subvenciones_detectadas')
      .select('*, checklist:subvenciones_checklist(*)')
      .eq('reunion_id', reunionId)
      .order('puntuacion', { ascending: false });
    if (subvData && subvData.length > 0) {
      setSubvenciones(subvData as SubvencionDetectada[]);
    }

    setLoading(false);
  };

  const saveDocument = useCallback(async (content: string) => {
    if (!selectedDocId) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('documentos')
      .update({ contenido: content })
      .eq('id', selectedDocId);

    if (!error) {
      setLastSaved(new Date());
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

  // Cambiar tipo de documento
  const handleChangeTipoDoc = async (docId: string, tipo: string) => {
    const supabase = createClient();
    await supabase.from('documentos').update({ tipo_documento: tipo }).eq('id', docId);
    setDocumentos(docs => docs.map(d => d.id === docId ? { ...d, tipo_documento: tipo } : d));
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

  const handleSelectDoc = (docId: string) => {
    const doc = documentos.find(d => d.id === docId);
    if (doc) { setSelectedDocId(docId); setSelectedArchivoId(null); setDocContent(doc.contenido || ''); }
  };

  const handleSelectArchivo = (archivoId: string) => {
    setSelectedArchivoId(archivoId);
    setSelectedDocId(null);
  };

  const handleGenerarDocumento = async (nombre: string, contenido: string, promptUsado: string) => {
    const supabase = createClient();
    if (nombre.startsWith('__insert__')) {
      const docId = nombre.replace('__insert__', '');
      await supabase.from('documentos').update({ contenido, updated_at: new Date().toISOString() }).eq('id', docId);
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, contenido } : d));
      setSelectedDocId(docId);
      setDocContent(contenido);
      return;
    }
    const { data: newDoc } = await supabase.from('documentos').insert({
      nombre, contenido, reunion_id: reunionId,
      generado_por_ia: true, prompt_usado: promptUsado, orden: documentos.length,
    }).select().single();
    if (newDoc) {
      setDocumentos(prev => [...prev, newDoc]);
      setSelectedDocId(newDoc.id);
      setDocContent(contenido);
    }
  };

  const handleDeepSearch = async () => {
    setInvestigacionEstado('ejecutando');
    setInvestigacionError(null);
    try {
      const res = await fetch('/api/ia/deep-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reunionId,
          contextoTipo: 'reunion',
          clienteSnapshot,
          contextoAdicional: documentos
            .filter(d => d.contenido)
            .map(d => d.contenido)
            .join('\n\n---\n\n')
            .substring(0, 2000),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error en la investigacion');
      }
      const data = await res.json();
      if (data.documento) {
        setDocumentos(prev => {
          if (prev.find(d => d.id === data.documento.id)) return prev;
          return [...prev, data.documento];
        });
        setSelectedDocId(data.documento.id);
        setDocContent(data.documento.contenido || '');
      }
      setSubvenciones(data.subvenciones || []);
      setInvestigacionEstado('completada');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setInvestigacionError(msg);
      setInvestigacionEstado('error');
    }
  };

  const handleChecklistItem = async (checklistId: string, done: boolean) => {
    await fetch('/api/subvenciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checklist', id: checklistId, updates: { completado: done } }),
    });
    setSubvenciones(prev => prev.map(sv => ({
      ...sv,
      checklist: sv.checklist?.map(c => c.id === checklistId ? { ...c, completado: done } : c),
    })));
  };

  const handleChangeEstadoSubvencion = async (id: string, estado: EstadoExpediente) => {
    await fetch('/api/subvenciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'subvencion', id, updates: { estado_expediente: estado } }),
    });
    setSubvenciones(prev => prev.map(sv => sv.id === id ? { ...sv, estado_expediente: estado } : sv));
  };

  const handleDeleteSubvencion = async (id: string) => {
    await fetch('/api/subvenciones?id=' + id, { method: 'DELETE' });
    setSubvenciones(prev => prev.filter(sv => sv.id !== id));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando notebook...</div>;
  if (!reunion) return <div style={{ padding: '40px', textAlign: 'center' }}>Reunion no encontrada</div>;

  return (
    <WorkspaceLayout
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/reuniones" style={{
              color: 'var(--primary)', fontSize: '12px', fontWeight: '600',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '4px',
            }}>
              <ArrowLeft size={12} /> Reuniones
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                {reunion.titulo || 'Reunion sin titulo'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} /> {reunion.cliente?.[0]?.nombre_normalizado || reunion.cliente_nif}
                </span>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={11} /> {formatDate(reunion.fecha_programada)}
                </span>
                {reunion.tipo && <><span>·</span><span>{reunion.tipo}</span></>}
                <span style={{
                  padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
                  background: reunion.estado === 'realizada' ? '#dcfce7' : '#fef9c3',
                  color: reunion.estado === 'realizada' ? '#16a34a' : '#a16207',
                }}>
                  {reunion.estado}
                </span>
              </div>
            </div>
          </div>
        </div>
      }
      documentList={
        <NotebookLeftPanel
          clienteSnapshot={clienteSnapshot}
          documentos={documentos}
          archivos={archivos}
          selectedDocId={selectedDocId}
          onSelectDoc={handleSelectDoc}
          onCreateDoc={handleCreateDoc}
          onRenameDoc={handleRenameDoc}
          onDeleteDoc={handleDeleteDoc}
          contextoId={reunionId}
          contextoTipo="reunion"
          nif={reunion.cliente_nif ?? undefined}
          onArchivoUploaded={archivo => setArchivos(prev => [...prev, archivo])}
          onSelectArchivo={handleSelectArchivo}
          selectedArchivoId={selectedArchivoId}
          contextSelections={contextSelections}
          onContextModeChange={(docId, mode) => setContextSelections(prev => ({ ...prev, [docId]: mode }))}
          investigacionEstado={investigacionEstado}
          subvenciones={subvenciones}
          subvencionActivaId={subvencionActivaId}
          onSelectSubvencion={setSubvencionActivaId}
          onChecklistItem={handleChecklistItem}
          onChangeEstadoSubvencion={handleChangeEstadoSubvencion}
          onDeleteSubvencion={handleDeleteSubvencion}
        />
      }
      leftFooter={
        <DeepSearchButton
          estado={investigacionEstado}
          numSubvenciones={subvenciones.length}
          onLanzar={handleDeepSearch}
          errorMsg={investigacionError}
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
                {/* Header archivo */}
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
                {/* Visor */}
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
                        style={{
                          padding: '8px 20px', borderRadius: '8px',
                          background: 'var(--primary)', color: 'white',
                          textDecoration: 'none', fontSize: '13px', fontWeight: '600',
                        }}>
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
              { value: 'informe', label: 'Informe' },
              { value: 'propuesta', label: 'Propuesta' },
              { value: 'otro', label: 'Otro' },
            ];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header doc con selector de tipo */}
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
            contextoId={reunionId}
            contextoTipo="reunion"
            documentos={documentos}
            contextSelections={contextSelections}
            clienteNombre={clienteSnapshot.nombre}
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
