'use client';

import { useState } from 'react';
import {
  Building2, MapPin, Users, BarChart3, Hash, FileText, Bot,
  Upload, Plus, MoreVertical, Pencil, Trash2, Loader2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import type {
  SubvencionDetectada, ClienteSnapshot, EstadoExpediente,
  EstadoInvestigacion,
} from '@/lib/types/notebook';
import SubvencionFolder from './SubvencionFolder';
import { ContextToggle, type ContextMode } from './ContextToggle';
import { createClient } from '@/lib/supabase/client';
import { useRef } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

interface NotebookLeftPanelProps {
  // Datos del cliente
  clienteSnapshot: ClienteSnapshot;

  // Documentos del notebook
  documentos: Documento[];
  archivos: Archivo[];
  selectedDocId: string | null;
  onSelectDoc: (docId: string) => void;
  onCreateDoc: () => void;
  onRenameDoc: (docId: string, newName: string) => void;
  onDeleteDoc: (docId: string) => void;

  // Upload de archivos
  contextoId: string;
  contextoTipo: 'reunion' | 'expediente';
  nif?: string;
  onArchivoUploaded: (archivo: Archivo) => void;

  // RAG context
  contextSelections?: Record<string, ContextMode>;
  onContextModeChange?: (docId: string, mode: ContextMode) => void;

  // Subvenciones
  investigacionEstado: EstadoInvestigacion;
  subvenciones: SubvencionDetectada[];
  subvencionActivaId: string | null;
  onSelectSubvencion: (id: string) => void;
  onChecklistItem: (checklistId: string, done: boolean) => void;
  onChangeEstadoSubvencion: (id: string, estado: EstadoExpediente) => void;
  onDeleteSubvencion: (id: string) => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotebookLeftPanel({
  clienteSnapshot,
  documentos, archivos,
  selectedDocId,
  onSelectDoc, onCreateDoc, onRenameDoc, onDeleteDoc,
  contextoId, contextoTipo, nif, onArchivoUploaded,
  contextSelections, onContextModeChange,
  investigacionEstado,
  subvenciones, subvencionActivaId,
  onSelectSubvencion, onChecklistItem, onChangeEstadoSubvencion, onDeleteSubvencion,
}: NotebookLeftPanelProps) {
  const [sectionCliente, setSectionCliente] = useState(true);
  const [sectionSubvenciones, setSectionSubvenciones] = useState(true);
  const [sectionFuentes, setSectionFuentes] = useState(true);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Subir archivo ──────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contextoId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      // Mismo path que DocumentList: reunion/ (sin plural)
      const path = `${contextoTipo}/${contextoId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('archivos').upload(path, file);
      if (upErr) throw upErr;
      const insertData: Record<string, unknown> = {
        nombre: file.name,
        storage_path: path,
        mime_type: file.type,
        tamano_bytes: file.size,
      };
      if (contextoTipo === 'reunion') insertData.reunion_id = contextoId;
      else insertData.expediente_id = contextoId;
      const { data: archivoRec, error: dbErr } = await supabase.from('archivos').insert(insertData).select().single();
      if (dbErr) throw dbErr;
      if (archivoRec) onArchivoUploaded(archivoRec);
    } catch (err) {
      console.error('Upload error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Crear documento inline ─────────────────────────────────────────────
  const handleCreateInline = async () => {
    const name = newDocName.trim();
    setCreatingDoc(false);
    setNewDocName('');
    if (!name) return;
    const supabase = createClient();
    const docData: Record<string, unknown> = {
      nombre: name,
      contenido: '',
      tipo_documento: 'nota',
      orden: documentos.length,
    };
    if (contextoTipo === 'reunion') docData.reunion_id = contextoId;
    else docData.expediente_id = contextoId;
    const { data: newDoc, error: dbErr } = await supabase.from('documentos').insert(docData).select().single();
    if (dbErr) {
      console.error('Create doc error:', dbErr);
      setUploadError(dbErr.message);
      return;
    }
    if (newDoc) {
      window.dispatchEvent(new CustomEvent('doc-created', { detail: newDoc }));
    }
  };

  const sectionHeader = (title: string, open: boolean, toggle: () => void, badge?: number) => (
    <button onClick={toggle} style={{
      display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
      padding: '6px 0', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
    }}>
      {open
        ? <ChevronDown size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
        : <ChevronRight size={11} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      }
      <span style={{
        fontSize: '10px', fontWeight: '700', letterSpacing: '0.6px',
        textTransform: 'uppercase', color: 'var(--muted-foreground)', flex: 1,
      }}>
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '10px',
          background: 'var(--primary)', color: 'white',
        }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', overflowY: 'auto' }}>
      <input ref={fileInputRef} type="file" onChange={handleUpload} style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.csv" />

      {/* ── SECCIÓN CLIENTE ─────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        {sectionHeader('Cliente', sectionCliente, () => setSectionCliente(v => !v))}
        {sectionCliente && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '4px' }}>
              {clienteSnapshot.nombre || '—'}
            </div>
            <ClienteRow icon={<Hash size={11} />} label="NIF" value={clienteSnapshot.nif} />
            <ClienteRow icon={<BarChart3 size={11} />} label="CNAE" value={clienteSnapshot.cnae} />
            <ClienteRow icon={<Building2 size={11} />} label="Actividad" value={clienteSnapshot.actividad} />
            <ClienteRow icon={<MapPin size={11} />} label="Ciudad" value={clienteSnapshot.ciudad} />
            <ClienteRow icon={<Users size={11} />} label="Tamaño" value={clienteSnapshot.tamano_empresa} />
            {clienteSnapshot.empleados && (
              <ClienteRow icon={<Users size={11} />} label="Empleados" value={String(clienteSnapshot.empleados)} />
            )}
          </div>
        )}
      </div>

      {/* ── SECCIÓN SUBVENCIONES ────────────────────────────────────────── */}
      {(investigacionEstado !== 'pendiente' || subvenciones.length > 0) && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          {sectionHeader('Subvenciones', sectionSubvenciones, () => setSectionSubvenciones(v => !v), subvenciones.length)}
          {sectionSubvenciones && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {investigacionEstado === 'ejecutando' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', background: 'var(--muted)' }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Investigando subvenciones...</span>
                </div>
              )}
              {subvenciones.length === 0 && investigacionEstado === 'completada' && (
                <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', padding: '4px 0' }}>
                  No se encontraron subvenciones relevantes.
                </p>
              )}
              {subvenciones.map(sv => (
                <SubvencionFolder
                  key={sv.id}
                  subvencion={sv}
                  isActive={subvencionActivaId === sv.id}
                  onSelect={onSelectSubvencion}
                  onCheckItem={onChecklistItem}
                  onChangeEstado={onChangeEstadoSubvencion}
                  onDelete={onDeleteSubvencion}
                  onOpenDocumento={onSelectDoc}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SECCIÓN FUENTES / DOCUMENTOS ─────────────────────────────────── */}
      <div style={{ padding: '12px 14px', flex: 1 }}>
        {sectionHeader('Fuentes', sectionFuentes, () => setSectionFuentes(v => !v), documentos.length + archivos.length)}
        {sectionFuentes && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: uploadError ? '4px' : '6px' }}>
              <button
                onClick={() => setCreatingDoc(true)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)',
                  background: 'var(--background)', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: 'var(--foreground)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
              >
                <Plus size={11} /> Nueva nota
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)',
                  background: 'var(--background)', cursor: uploading ? 'wait' : 'pointer',
                  fontSize: '11px', fontWeight: '600', color: 'var(--foreground)',
                  opacity: uploading ? 0.7 : 1, transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--background)')}
              >
                {uploading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={11} />}
                {uploading ? 'Subiendo...' : 'Subir'}
              </button>
            </div>

            {/* Error de upload/create */}
            {uploadError && (
              <div style={{
                padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
                background: '#fef2f2', border: '1px solid #fecaca',
                fontSize: '11px', color: '#dc2626', lineHeight: '1.4',
                display: 'flex', alignItems: 'flex-start', gap: '6px',
              }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span style={{ flex: 1 }}>{uploadError}</span>
                <button onClick={() => setUploadError(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0, fontSize: '13px', flexShrink: 0 }}>
                  ×
                </button>
              </div>
            )}

            {/* Crear doc inline */}
            {creatingDoc && (
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <input
                  autoFocus
                  type="text" value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateInline(); if (e.key === 'Escape') { setCreatingDoc(false); setNewDocName(''); } }}
                  placeholder="Nombre del documento..."
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: '6px',
                    border: '1px solid var(--primary)', fontSize: '12px',
                    background: 'var(--background)', color: 'var(--foreground)', outline: 'none',
                  }}
                />
                <button onClick={handleCreateInline}
                  style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                  ✓
                </button>
              </div>
            )}

            {/* Lista documentos */}
            {documentos.map(doc => (
              <div key={doc.id} style={{ position: 'relative' }}>
                {editingId === doc.id ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input autoFocus type="text" value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameDoc(doc.id, editingName); setEditingId(null); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--primary)', fontSize: '12px', background: 'var(--background)', color: 'var(--foreground)', outline: 'none' }}
                    />
                    <button onClick={() => { onRenameDoc(doc.id, editingName); setEditingId(null); }}
                      style={{ padding: '5px 9px', borderRadius: '6px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>✓</button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 8px', borderRadius: '7px',
                      background: selectedDocId === doc.id ? 'color-mix(in srgb, var(--primary) 8%, var(--background))' : 'none',
                      border: selectedDocId === doc.id ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onClick={() => onSelectDoc(doc.id)}
                    onMouseEnter={e => { if (selectedDocId !== doc.id) e.currentTarget.style.background = 'var(--accent)'; }}
                    onMouseLeave={e => { if (selectedDocId !== doc.id) e.currentTarget.style.background = 'none'; }}
                  >
                    {doc.generado_por_ia
                      ? <Bot size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      : <FileText size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    }
                    <span style={{
                      flex: 1, fontSize: '12px', color: 'var(--foreground)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {doc.nombre}
                    </span>
                    {/* RAG context toggle */}
                    {onContextModeChange && contextSelections && (
                      <div onClick={e => e.stopPropagation()}>
                        <ContextToggle
                          mode={contextSelections[doc.id] ?? 'off'}
                          onChange={mode => onContextModeChange(doc.id, mode)}
                          className="rag-toggle"
                        />
                      </div>
                    )}
                    {/* Menú */}
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === doc.id ? null : doc.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '1px', display: 'flex', flexShrink: 0, opacity: openMenuId === doc.id ? 1 : 0 }}
                      className="menu-btn"
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                )}
                {openMenuId === doc.id && (
                  <div style={{
                    position: 'absolute', right: 0, top: '100%', zIndex: 20,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    minWidth: '140px', overflow: 'hidden',
                  }}
                    onMouseLeave={() => setOpenMenuId(null)}>
                    <button onClick={() => { setEditingId(doc.id); setEditingName(doc.nombre); setOpenMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 13px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--foreground)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <Pencil size={12} /> Renombrar
                    </button>
                    <button onClick={() => { onDeleteDoc(doc.id); setOpenMenuId(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 13px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Archivos adjuntos */}
            {archivos.length > 0 && (
              <>
                <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-foreground)', letterSpacing: '0.4px', textTransform: 'uppercase', padding: '2px 0' }}>
                  Archivos adjuntos
                </div>
                {archivos.map(archivo => (
                  <div key={archivo.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px' }}>
                    <FileText size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {archivo.nombre}
                    </span>
                    {onContextModeChange && contextSelections && (
                      <ContextToggle
                        mode={contextSelections[archivo.id] ?? 'off'}
                        onChange={mode => onContextModeChange(archivo.id, mode)}
                        className="rag-toggle"
                      />
                    )}
                    {archivo.tamano_bytes && (
                      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', flexShrink: 0 }}>
                        {Math.round(archivo.tamano_bytes / 1024)}K
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        div:hover .menu-btn { opacity: 1 !important; }
        .rag-toggle { opacity: 0.3; transition: opacity 0.15s; }
        div:hover .rag-toggle { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

// ─── Fila de dato de cliente ──────────────────────────────────────────────────

function ClienteRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span style={{ color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600', minWidth: '60px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--foreground)' }}>{value}</span>
    </div>
  );
}
