'use client';

import { ReactNode, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkspaceLayoutProps {
  documentList: ReactNode;
  editor: ReactNode;
  aiPanel: ReactNode;
  header?: ReactNode;
  /** Slot de pie de la columna izquierda (e.g. DeepSearchButton) */
  leftFooter?: ReactNode;
}

export default function WorkspaceLayout({
  documentList,
  editor,
  aiPanel,
  header,
  leftFooter,
}: WorkspaceLayoutProps) {
  const [aiCollapsed, setAiCollapsed] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)'
    }}>
      {/* Header */}
      {header && (
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          flexShrink: 0
        }}>
          {header}
        </div>
      )}

      {/* Main Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: aiCollapsed ? '300px 1fr 0px' : '300px 1fr 360px',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        transition: 'grid-template-columns 0.2s ease',
      }}>
        {/* Columna Izquierda */}
        <div style={{
          borderRight: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {documentList}
          </div>
          {leftFooter && (
            <div style={{ flexShrink: 0 }}>
              {leftFooter}
            </div>
          )}
        </div>

        {/* Columna Central: Editor */}
        <div style={{
          overflowY: 'auto',
          backgroundColor: 'var(--background)',
          padding: '36px 40px',
          position: 'relative',
        }}>
          {editor}
          {/* Botón toggle panel IA */}
          <button
            onClick={() => setAiCollapsed(v => !v)}
            title={aiCollapsed ? 'Mostrar asistente IA' : 'Ocultar asistente IA'}
            style={{
              position: 'fixed',
              right: aiCollapsed ? '8px' : '368px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 30,
              width: '22px',
              height: '48px',
              borderRadius: '6px 0 0 6px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-foreground)',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
              transition: 'right 0.2s ease',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            {aiCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {/* Columna Derecha: IA */}
        <div style={{
          borderLeft: aiCollapsed ? 'none' : '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          width: aiCollapsed ? 0 : undefined,
        }}>
          {!aiCollapsed && aiPanel}
        </div>
      </div>
    </div>
  );
}
