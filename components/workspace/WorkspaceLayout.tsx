'use client';

import { ReactNode } from 'react';

interface WorkspaceLayoutProps {
  documentList: ReactNode;
  editor: ReactNode;
  aiPanel: ReactNode;
  header?: ReactNode;
}

export default function WorkspaceLayout({
  documentList,
  editor,
  aiPanel,
  header
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
          padding: '16px 24px',
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
        gridTemplateColumns: '280px 1fr 320px',
        gap: '0',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Columna Izquierda: Documentos */}
        <div style={{
          borderRight: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          overflowY: 'auto',
          padding: '16px'
        }}>
          {documentList}
        </div>

        {/* Columna Central: Editor */}
        <div style={{
          overflowY: 'auto',
          backgroundColor: 'var(--background)',
          padding: '32px'
        }}>
          {editor}
        </div>

        {/* Columna Derecha: IA */}
        <div style={{
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--card)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {aiPanel}
        </div>
      </div>
    </div>
  );
}
