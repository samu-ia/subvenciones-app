'use client';

import { ReactNode } from 'react';

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

      {/* Main Workspace - 3 columnas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 360px',
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Columna Izquierda: Panel notebook (fuentes, cliente, subvenciones) */}
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
        }}>
          {editor}
        </div>

        {/* Columna Derecha: IA */}
        <div style={{
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {aiPanel}
        </div>
      </div>
    </div>
  );
}
