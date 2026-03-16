'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, Paperclip, Trash2, Settings } from 'lucide-react';
import ConfigModal from '@/components/workspace/ConfigModal';

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [showConfig, setShowConfig] = useState(false);

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

      // Fetch documents (using documentos table if it exists, otherwise create mock)
      // For now, we'll use localStorage as a simple storage
      const storedDocs = localStorage.getItem(`expediente_${expedienteId}_docs`);
      if (storedDocs) {
        const docs = JSON.parse(storedDocs);
        setDocumentos(docs);
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
          setDocContent(docs[0].contenido || '');
        }
      } else {
        // Create default documents
        const defaultDocs: Documento[] = [
          { id: '1', nombre: 'Memoria', contenido: '', created_at: new Date().toISOString() },
          { id: '2', nombre: 'Notas', contenido: '', created_at: new Date().toISOString() },
          { id: '3', nombre: 'Checklist', contenido: '', created_at: new Date().toISOString() },
        ];
        setDocumentos(defaultDocs);
        setSelectedDoc(defaultDocs[0]);
        setDocContent('');
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
      created_at: new Date().toISOString()
    };
    
    const updatedDocs = [...documentos, newDoc];
    setDocumentos(updatedDocs);
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

      {/* Two-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Documents List */}
        <div style={{
          width: '320px',
          borderRight: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Documents Section */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h3 style={{
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: 0
              }}>
                Documentos
              </h3>
              <button
                onClick={createNewDoc}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--teal)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                <Plus size={16} />
                Nuevo
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {documentos.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: selectedDoc?.id === doc.id ? 'var(--surface)' : 'transparent',
                    border: selectedDoc?.id === doc.id ? '1px solid var(--border)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    position: 'relative'
                  }}
                  onClick={() => selectDoc(doc)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <FileText size={16} style={{ color: 'var(--teal)' }} />
                    {editingDocId === doc.id ? (
                      <input
                        type="text"
                        value={editingDocName}
                        onChange={(e) => setEditingDocName(e.target.value)}
                        onBlur={() => {
                          const updatedDocs = documentos.map(d =>
                            d.id === doc.id ? { ...d, nombre: editingDocName } : d
                          );
                          setDocumentos(updatedDocs);
                          if (selectedDoc?.id === doc.id) {
                            setSelectedDoc({ ...doc, nombre: editingDocName });
                          }
                          localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
                          setEditingDocId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        autoFocus
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: 'var(--ink)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          outline: 'none',
                          flex: 1
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: selectedDoc?.id === doc.id ? '600' : '500',
                        color: 'var(--ink)'
                      }}>
                        {doc.nombre}
                      </span>
                    )}
                  </div>
                  
                  {/* Menu de 3 puntos */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--muted)'
                    }}
                  >
                    <Plus size={16} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  
                  {openMenuId === doc.id && (
                    <>
                      <div 
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 999
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        backgroundColor: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '140px',
                        overflow: 'hidden',
                        marginTop: '4px'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDocId(doc.id);
                            setEditingDocName(doc.nombre);
                            setOpenMenuId(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: 'none',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            color: 'var(--ink)',
                            textAlign: 'left'
                          }}
                        >
                          <FileText size={14} />
                          Renombrar
                        </button>
                        {documentos.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDoc(doc.id);
                              setOpenMenuId(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: 'none',
                              background: 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '13px',
                              color: 'var(--red)',
                              textAlign: 'left',
                              borderTop: '1px solid var(--border)'
                            }}
                          >
                            <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Archivos Section (Placeholder) */}
          <div style={{ padding: '20px' }}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px'
            }}>
              Archivos
            </h3>
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '13px'
            }}>
              <Paperclip size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>Sin archivos adjuntos</p>
            </div>
          </div>
        </div>

        {/* Right Panel - Document Editor */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white'
        }}>
          {selectedDoc ? (
            <>
              <div style={{
                padding: '20px 32px',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'var(--surface)'
              }}>
                <input
                  type="text"
                  value={selectedDoc.nombre}
                  onChange={(e) => {
                    const updatedDocs = documentos.map(doc => 
                      doc.id === selectedDoc.id 
                        ? { ...doc, nombre: e.target.value }
                        : doc
                    );
                    setDocumentos(updatedDocs);
                    setSelectedDoc({ ...selectedDoc, nombre: e.target.value });
                    localStorage.setItem(`expediente_${expedienteId}_docs`, JSON.stringify(updatedDocs));
                  }}
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: 'var(--ink)',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    width: '100%',
                    padding: '4px 0'
                  }}
                />
              </div>
              
              <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Escribe aquí el contenido del documento...

Puedes usar este espacio para:
• Redactar la memoria del proyecto
• Tomar notas sobre el expediente
• Crear checklists de documentos necesarios
• Escribir resúmenes y conclusiones
• Cualquier contenido relacionado con este expediente"
                  style={{
                    width: '100%',
                    minHeight: '100%',
                    padding: '0',
                    fontSize: '15px',
                    lineHeight: '1.8',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--ink)',
                    fontFamily: 'inherit',
                    resize: 'none'
                  }}
                />
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--muted)'
            }}>
              <p>Selecciona un documento para editarlo</p>
            </div>
          )}
        </div>
      </div>
      
      <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
    </div>
  );
}
