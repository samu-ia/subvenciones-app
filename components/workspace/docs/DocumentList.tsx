'use client';

import { useState, useRef } from 'react';
import { FileText, Plus, Upload, MoreVertical, Pencil, Trash2, Bot, Loader2 } from 'lucide-react';
import { ContextToggle, type ContextMode } from '../ai/ContextToggle';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface Documento {
  id: string;
  nombre: string;
  tipo_documento?: string | null;
  generado_por_ia?: boolean;
  updated_at?: string;
}

interface Archivo {
  id: string;
  nombre: string;
  mime_type?: string | null;
  tamano_bytes?: number;
  storage_path?: string;
}

interface DocumentListProps {
  documentos: Documento[];
  archivos: Archivo[];
  selectedDocId: string | null;
  contextSelections?: Record<string, ContextMode>;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: () => void;
  onRenameDoc: (docId: string, newName: string) => void;
  onDeleteDoc: (docId: string) => void;
  onUploadFile: () => void;
  onContextModeChange?: (docId: string, mode: ContextMode) => void;
  collapseButton?: React.ReactNode;
  // Necesarios para la subida real de archivos
  contextoId?: string;
  contextoTipo?: 'reunion' | 'expediente';
  userId?: string;
  nif?: string;
  onArchivoUploaded?: (archivo: Archivo) => void;
}

export default function DocumentList({
  documentos,
  archivos,
  selectedDocId,
  contextSelections,
  onSelectDoc,
  onCreateDoc,
  onRenameDoc,
  onDeleteDoc,
  onUploadFile,
  onContextModeChange,
  collapseButton,
  contextoId,
  contextoTipo,
  userId,
  nif,
  onArchivoUploaded,
}: DocumentListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Inline new doc
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRename = (docId: string) => {
    if (editingName.trim()) {
      onRenameDoc(docId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCreateInline = () => {
    const name = newDocName.trim();
    setCreatingDoc(false);
    setNewDocName('');
    if (!name) return;
    // Delegamos en el padre (ya tiene la lógica Supabase)
    // Sobreescribimos temporalmente onCreateDoc con el nombre capturado
    // usando un evento personalizado más limpio: guardamos el nombre en un data-attr
    // y llamamos onCreateDoc que en las páginas usa prompt(). 
    // Para evitar prompt() definitivamente, pasamos el nombre vía el event system:
    onCreateDocWithName(name);
  };

  // Crea doc en Supabase directamente desde el componente si tenemos los datos necesarios
  // Si no, delega al padre con el nombre pre-rellenado
  const onCreateDocWithName = async (name: string) => {
    if (!contextoId || !contextoTipo) {
      // Fallback: usa el flujo antiguo del padre
      // No podemos evitar el prompt, pero al menos lo rellenamos
      // con el nombre inline. Sin acceso al padre, simplemente llamamos onCreateDoc.
      onCreateDoc();
      return;
    }
    const supabase = createClient();
    const insertData: Record<string, unknown> = {
      nombre: name,
      contenido: '',
      generado_por_ia: false,
    };
    if (nif) insertData.nif = nif;
    if (contextoTipo === 'reunion') insertData.reunion_id = contextoId;
    else insertData.expediente_id = contextoId;

    const { data: newDoc } = await supabase
      .from('documentos')
      .insert(insertData)
      .select()
      .single();

    if (newDoc) {
      // Notificar al padre para que actualice su estado
      onArchivoUploaded?.({ id: newDoc.id, nombre: newDoc.nombre });
      // Seleccionar el nuevo doc
      onSelectDoc(newDoc.id);
      // Forzar recarga del padre es responsabilidad del padre;
      // aqui disparamos onCreateDoc para que el padre recargue si quiere
      // Pero primero hacemos el doc visible disparando un evento
      // La forma más limpia: re-usar onRenameDoc con id fake no funciona.
      // Llamamos onCreateDoc() para que el padre sepa que algo cambio - 
      // pero el padre tiene prompt(). Usamos window.dispatchEvent:
      window.dispatchEvent(new CustomEvent('doc-created', { detail: newDoc }));
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!contextoId || !contextoTipo) {
      onUploadFile();
      return;
    }
    setUploading(true);
    setUploadError(null);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      try {
        // 1. Subir al bucket 'archivos'
        const ext = file.name.split('.').pop();
        const path = `${contextoTipo}/${contextoId}/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from('archivos')
          .upload(path, file, { upsert: false });

        if (storageError) throw storageError;

        // 2. Insertar fila en tabla archivos
        const insertData: Record<string, unknown> = {
          nombre: file.name,
          storage_path: path,
          mime_type: file.type,
          tamano_bytes: file.size,
        };
        if (nif) insertData.nif = nif;
        if (contextoTipo === 'reunion') insertData.reunion_id = contextoId;
        else insertData.expediente_id = contextoId;

        const { data: archivoRow } = await supabase
          .from('archivos')
          .insert(insertData)
          .select()
          .single();

        if (archivoRow) {
          onArchivoUploaded?.(archivoRow);
          // Extraer texto en background
          if (file.type.includes('pdf') || file.type.includes('text')) {
            fetch('/api/archivos/extract-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ archivoId: archivoRow.id }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(`Error al subir "${file.name}"`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Documentos */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            letterSpacing: '0.5px'
          }}>
            Documentos
          </h3>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              onClick={() => { setCreatingDoc(true); setNewDocName(''); }}
              style={{
                padding: '4px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} />
              Nuevo
            </button>
            {collapseButton}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {documentos.map((doc) => (
            <div
              key={doc.id}
              onClick={() => !editingId && onSelectDoc(doc.id)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: selectedDocId === doc.id ? 'var(--accent)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (selectedDocId !== doc.id) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDocId !== doc.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <FileText size={16} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
              
              {editingId === doc.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(doc.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: '13px'
                  }}
                />
              ) : (
                <span style={{
                  flex: 1,
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {doc.nombre}
                </span>
              )}

              {doc.generado_por_ia && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  IA
                </Badge>
              )}

              {/* Context Toggle */}
              {onContextModeChange && contextSelections && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ContextToggle
                    mode={contextSelections[doc.id] || 'off'}
                    hasInsights={doc.generado_por_ia || false}
                    onChange={(mode) => onContextModeChange(doc.id, mode)}
                  />
                </div>
              )}

              {!editingId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                  }}
                  style={{
                    padding: '2px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    opacity: openMenuId === doc.id ? 1 : 0,
                    transition: 'opacity 0.2s'
                  }}
                  className="doc-menu-btn"
                >
                  <MoreVertical size={14} />
                </button>
              )}

              {openMenuId === doc.id && (
                <div
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '100%',
                    marginTop: '4px',
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    minWidth: '120px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditingId(doc.id);
                      setEditingName(doc.nombre);
                      setOpenMenuId(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px'
                    }}
                  >
                    <Pencil size={14} />
                    Renombrar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${doc.nombre}"?`)) {
                        onDeleteDoc(doc.id);
                        setOpenMenuId(null);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: 'var(--destructive)'
                    }}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Inline: crear nuevo documento */}
        {creatingDoc && (
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <FileText size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <input
              type="text"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateInline();
                if (e.key === 'Escape') { setCreatingDoc(false); setNewDocName(''); }
              }}
              onBlur={handleCreateInline}
              placeholder="Nombre del documento..."
              autoFocus
              style={{
                flex: 1, padding: '5px 8px', borderRadius: '6px',
                border: '1px solid var(--primary)', fontSize: '13px',
                outline: 'none', backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          </div>
        )}
      </div>

      {/* Archivos */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            letterSpacing: '0.5px'
          }}>
            Archivos
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              opacity: uploading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
          {/* Input oculto */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
        </div>

        {uploadError && (
          <p style={{ fontSize: '11px', color: 'var(--destructive)', padding: '4px 8px', marginBottom: '4px' }}>
            {uploadError}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {archivos.length === 0 ? (
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--muted-foreground)', 
              fontStyle: 'italic',
              padding: '8px 12px'
            }}>
              Sin archivos adjuntos
            </p>
          ) : (
            archivos.map((archivo) => (
              <div
                key={archivo.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px'
                }}
              >
                <FileText size={16} style={{ color: 'var(--muted-foreground)' }} />
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {archivo.nombre}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .doc-menu-btn {
          opacity: 0 !important;
        }
        div:hover .doc-menu-btn {
          opacity: 0.7 !important;
        }
        .doc-menu-btn:hover {
          opacity: 1 !important;
          background-color: var(--accent) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
