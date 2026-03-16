'use client';

import { useState } from 'react';
import { FileText, Plus, Upload, MoreVertical, Pencil, Trash2, Bot } from 'lucide-react';
import { ContextToggle, type ContextMode } from './ContextToggle';
import { Badge } from '@/components/ui/badge';

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
  collapseButton
}: DocumentListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleRename = (docId: string) => {
    if (editingName.trim()) {
      onRenameDoc(docId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
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
              onClick={onCreateDoc}
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
            onClick={onUploadFile}
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
            <Upload size={14} />
            Subir
          </button>
        </div>

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

      <style jsx>{`
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
      `}</style>
    </div>
  );
}
