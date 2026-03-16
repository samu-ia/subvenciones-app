'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import ConfigModal from '@/components/workspace/ConfigModal';
import DocumentList from '@/components/workspace/DocumentList';
import RichTextEditor from '@/components/workspace/RichTextEditor';
import AIPanel from '@/components/workspace/AIPanel';
import { CollapsibleColumn, createCollapseButton } from '@/components/workspace/CollapsibleColumn';
import { useWorkspaceColumnsStore } from '@/lib/stores/workspace-columns-store';
import { useIsDesktop } from '@/lib/hooks/use-media-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ContextMode = 'off' | 'insights' | 'full';

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
  created_at: string;
  generado_por_ia?: boolean;
}

interface Archivo {
  id: string;
  nombre: string;
  mime_type?: string | null;
  tamano_bytes?: number;
}

export default function ExpedienteDetailPage() {
  const params = useParams();
  const expedienteId = params.id as string;
  
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [contextSelections, setContextSelections] = useState<Record<string, ContextMode>>({});
  const [archivos] = useState<Archivo[]>([]);
  
  // Mobile tabs
  const [mobileTab, setMobileTab] = useState<'docs' | 'editor' | 'ai'>('docs');
  const isDesktop = useIsDesktop();

  // Zustand store
  const { documentosCollapsed, aiCollapsed, toggleDocumentos, toggleAi } = useWorkspaceColumnsStore();

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Fetch expediente
      const { data: expData, error: expError } = await supabase
        .from('expediente')
        .select(`
          *,
          cliente:nif (
            nombre_normalizado
          )
        `)
        .eq('id', expedienteId)
        .single();

      if (expError) {
        console.error('Error cargando expediente:', expError);
      } else {
        setExpediente(expData);
      }

      // Fetch documents
      const storedDocs = localStorage.getItem(`expediente_${expedienteId}_docs`);
      if (storedDocs) {
        const docs = JSON.parse(storedDocs);
        setDocumentos(docs);
        
        // Initialize context selections: default to 'insights' for AI docs, 'off' for others
        const initialSelections: Record<string, ContextMode> = {};
        docs.forEach((doc: Documento) => {
          initialSelections[doc.id] = doc.generado_por_ia ? 'insights' : 'off';
        });
        setContextSelections(initialSelections);
        
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
          setDocContent(docs[0].contenido || '');
        }
      } else {
        // Create default documents
        const defaultDocs: Documento[] = [
          { id: '1', nombre: 'Memoria', contenido: '', created_at: new Date().toISOString(), generado_por_ia: false },
          { id: '2', nombre: 'Notas', contenido: '', created_at: new Date().toISOString(), generado_por_ia: false },
          { id: '3', nombre: 'Checklist', contenido: '', created_at: new Date().toISOString(), generado_por_ia: false },
        ];
        setDocumentos(defaultDocs);
        setSelectedDoc(defaultDocs[0]);
        setDocContent('');
        
        // Initialize context selections
        const initialSelections: Record<string, ContextMode> = {};
        defaultDocs.forEach((doc: Documento) => {
          initialSelections[doc.id] = 'off';
        });
        setContextSelections(initialSelections);
        
        localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(defaultDocs));
      }
      
      setLoading(false);
    }

    fetchData();
  }, [expedienteId]);

  const saveDocument = useCallback(async (content: string) => {
    if (!selectedDoc) return;
    
    setSaving(true);
    
    // Update document in state and localStorage
    const updatedDocs = documentos.map(doc => 
      doc.id === selectedDoc.id 
        ? { ...doc, contenido: content }
        : doc
    );
    
    setDocumentos(updatedDocs);
    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
    setLastSaved(new Date());
    setSaving(false);
  }, [selectedDoc, documentos, expedienteId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (selectedDoc && docContent !== (selectedDoc.contenido || '')) {
        saveDocument(docContent);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [docContent, selectedDoc, saveDocument]);

  const createNewDoc = () => {
    const newDoc: Documento = {
      id: Date.now().toString(),
      nombre: `Documento ${documentos.length + 1}`,
      contenido: '',
      created_at: new Date().toISOString(),
      generado_por_ia: false
    };
    
    const updatedDocs = [...documentos, newDoc];
    setDocumentos(updatedDocs);
    setContextSelections(prev => ({ ...prev, [newDoc.id]: 'off' }));
    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
    setSelectedDoc(newDoc);
    setDocContent('');
  };

  const deleteDoc = (docId: string) => {
    if (documentos.length <= 1) {
      alert('Debe haber al menos un documento');
      return;
    }
    
    const updatedDocs = documentos.filter(doc => doc.id !== docId);
    setDocumentos(updatedDocs);
    
    // Remove from context selections
    const { [docId]: _, ...remainingSelections } = contextSelections;
    setContextSelections(remainingSelections);
    
    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
    
    if (selectedDoc?.id === docId) {
      setSelectedDoc(updatedDocs[0]);
      setDocContent(updatedDocs[0].contenido || '');
    }
  };

  const selectDoc = (doc: Documento) => {
    setSelectedDoc(doc);
    setDocContent(doc.contenido || '');
  };

  const renameDoc = (docId: string, newName: string) => {
    const updatedDocs = documentos.map(doc =>
      doc.id === docId ? { ...doc, nombre: newName } : doc
    );
    setDocumentos(updatedDocs);
    if (selectedDoc?.id === docId) {
      setSelectedDoc({ ...selectedDoc, nombre: newName });
    }
    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
  };

  const handleContextModeChange = (docId: string, mode: ContextMode) => {
    setContextSelections(prev => ({ ...prev, [docId]: mode }));
  };

  const handleGenerarDocumento = (nombre: string, contenido: string) => {
    const newDoc: Documento = {
      id: Date.now().toString(),
      nombre,
      contenido,
      created_at: new Date().toISOString(),
      generado_por_ia: true
    };
    
    const updatedDocs = [...documentos, newDoc];
    setDocumentos(updatedDocs);
    setContextSelections(prev => ({ ...prev, [newDoc.id]: 'insights' }));
    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
    
    // Auto-select new doc
    setSelectedDoc(newDoc);
    setDocContent(newDoc.contenido || '');
  };

  const collapseButtonDocs = useMemo(
    () => createCollapseButton(toggleDocumentos, 'Documentos'),
    [toggleDocumentos]
  );

  const collapseButtonAi = useMemo(
    () => createCollapseButton(toggleAi, 'Asistente IA'),
    [toggleAi]
  );

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (!expediente) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Expediente no encontrado</div>;
  }

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '24px 40px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--surface)'
      }}>
        <Link
          href="/expedientes"
          style={{
            color: 'var(--teal)',
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '12px'
          }}
        >
          <ArrowLeft size={16} />
          Volver a expedientes
        </Link>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--ink)',
              marginBottom: '4px'
            }}>
              {expediente.numero_bdns ? `BDNS ${expediente.numero_bdns}` : `Expediente ${expediente.id.slice(0, 8)}`}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--ink2)' }}>
              {expediente.cliente?.[0]?.nombre_normalizado || expediente.nif}
            </p>
          </div>
          
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

      {/* Workspace Layout */}
      {isDesktop ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: Documents */}
          <CollapsibleColumn
            isCollapsed={documentosCollapsed}
            onToggle={toggleDocumentos}
            collapsedIcon={require('lucide-react').FileText}
            collapsedLabel="Documentos"
          >
            <div style={{
              width: documentosCollapsed ? '48px' : '320px',
              borderRight: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 150ms'
            }}>
              <DocumentList
                documentos={documentos}
                archivos={archivos}
                selectedDocId={selectedDoc?.id || null}
                onSelectDoc={(docId) => {
                  const doc = documentos.find(d => d.id === docId);
                  if (doc) selectDoc(doc);
                }}
                onCreateDoc={createNewDoc}
                onDeleteDoc={deleteDoc}
                onRenameDoc={renameDoc}
                onUploadFile={() => {}}
                contextSelections={contextSelections}
                onContextModeChange={handleContextModeChange}
                collapseButton={collapseButtonDocs}
              />
            </div>
          </CollapsibleColumn>

          {/* Center: Editor */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'white',
            overflow: 'auto'
          }}>
            {selectedDoc && (
              <RichTextEditor
                content={docContent}
                onChange={setDocContent}
                onSave={saveDocument}
                lastSaved={lastSaved}
              />
            )}
          </div>

          {/* Right: AI Panel */}
          <CollapsibleColumn
            isCollapsed={aiCollapsed}
            onToggle={toggleAi}
            collapsedIcon={require('lucide-react').Sparkles}
            collapsedLabel="Asistente IA"
          >
            <div style={{
              width: aiCollapsed ? '48px' : '320px',
              borderLeft: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'width 150ms'
            }}>
              <AIPanel
                contextoId={expedienteId}
                contextoTipo="expediente"
                documentos={documentos}
                contextSelections={contextSelections}
                onGenerarDocumento={handleGenerarDocumento}
                collapseButton={collapseButtonAi}
              />
            </div>
          </CollapsibleColumn>
        </div>
      ) : (
        /* Mobile: Tabs */
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="docs" className="flex-1">Documentos</TabsTrigger>
            <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">IA</TabsTrigger>
          </TabsList>
          
          <TabsContent value="docs" className="flex-1 overflow-auto m-0">
            <DocumentList
              documentos={documentos}
              archivos={archivos}
              selectedDocId={selectedDoc?.id || null}
              onSelectDoc={(docId) => {
                const doc = documentos.find(d => d.id === docId);
                if (doc) {
                  selectDoc(doc);
                  setMobileTab('editor');
                }
              }}
              onCreateDoc={createNewDoc}
              onDeleteDoc={deleteDoc}
              onRenameDoc={renameDoc}
              onUploadFile={() => {}}
              contextSelections={contextSelections}
              onContextModeChange={handleContextModeChange}
            />
          </TabsContent>
          
          <TabsContent value="editor" className="flex-1 overflow-auto m-0">
            {selectedDoc && (
              <RichTextEditor
                content={docContent}
                onChange={setDocContent}
                onSave={saveDocument}
                lastSaved={lastSaved}
              />
            )}
          </TabsContent>
          
          <TabsContent value="ai" className="flex-1 overflow-auto m-0">
            <AIPanel
              contextoId={expedienteId}
              contextoTipo="expediente"
              documentos={documentos}
              contextSelections={contextSelections}
              onGenerarDocumento={handleGenerarDocumento}
            />
          </TabsContent>
        </Tabs>
      )}
      
      <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
    </div>
  );
}
