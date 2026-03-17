'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect, useCallback } from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Heading1, Heading2, Heading3, Undo2, Redo2 } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  placeholder?: string;
  autoSaveDelay?: number;
  lastSaved?: Date | null;
}

export default function RichTextEditor({
  content,
  onChange,
  onSave,
  placeholder = 'Empieza a escribir...',
  autoSaveDelay = 1000,
  lastSaved
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: var(--primary); text-decoration: underline;'
        }
      })
    ],
    content,
    editorProps: {
      attributes: {
        style: 'outline: none; min-height: 400px; padding: 24px; font-size: 15px; line-height: 1.7;'
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    }
  });

  // Auto-save con debounce
  useEffect(() => {
    if (!onSave || !editor) return;

    const timeoutId = setTimeout(() => {
      const html = editor.getHTML();
      if (html !== content) {
        onSave(html);
      }
    }, autoSaveDelay);

    return () => clearTimeout(timeoutId);
  }, [content, onSave, autoSaveDelay, editor]);

  // Actualizar contenido cuando cambia externamente
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleHeading = useCallback((level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const setLink = useCallback(() => {
    const url = window.prompt('URL:');
    if (url) {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const undo = useCallback(() => { editor?.chain().focus().undo().run(); }, [editor]);
  const redo = useCallback(() => { editor?.chain().focus().redo().run(); }, [editor]);

  if (!editor) {
    return <div>Cargando editor...</div>;
  }

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 5) return 'hace un momento';
    if (diff < 60) return `hace ${diff}s`;
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        backgroundColor: 'var(--card)'
      }}>
        <button
          onClick={toggleBold}
          className={editor.isActive('bold') ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('bold') ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Negrita"
        >
          <Bold size={16} />
        </button>

        <button
          onClick={toggleItalic}
          className={editor.isActive('italic') ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('italic') ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Cursiva"
        >
          <Italic size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 4px' }} />

        <button
          onClick={() => toggleHeading(1)}
          className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('heading', { level: 1 }) ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Título 1"
        >
          <Heading1 size={16} />
        </button>

        <button
          onClick={() => toggleHeading(2)}
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('heading', { level: 2 }) ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Título 2"
        >
          <Heading2 size={16} />
        </button>

        <button
          onClick={() => toggleHeading(3)}
          className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('heading', { level: 3 }) ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Título 3"
        >
          <Heading3 size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 4px' }} />

        <button
          onClick={toggleBulletList}
          className={editor.isActive('bulletList') ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('bulletList') ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Lista"
        >
          <List size={16} />
        </button>

        <button
          onClick={toggleOrderedList}
          className={editor.isActive('orderedList') ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('orderedList') ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Lista numerada"
        >
          <ListOrdered size={16} />
        </button>

        <button
          onClick={setLink}
          className={editor.isActive('link') ? 'active' : ''}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: editor.isActive('link') ? 'var(--accent)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Enlace"
        >
          <LinkIcon size={16} />
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 4px' }} />

        <button
          onClick={undo}
          disabled={!editor.can().undo()}
          style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none',
            backgroundColor: 'transparent', cursor: editor.can().undo() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center',
            opacity: editor.can().undo() ? 1 : 0.35,
          }}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>

        <button
          onClick={redo}
          disabled={!editor.can().redo()}
          style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none',
            backgroundColor: 'transparent', cursor: editor.can().redo() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center',
            opacity: editor.can().redo() ? 1 : 0.35,
          }}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'white'
      }}>
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 0.67em 0;
        }
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 700;
          margin: 0.75em 0;
        }
        .ProseMirror h3 {
          font-size: 1.17em;
          font-weight: 700;
          margin: 0.83em 0;
        }
        .ProseMirror p {
          margin: 0.5em 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ProseMirror li {
          margin: 0.25em 0;
        }
        .ProseMirror a {
          color: var(--primary);
          text-decoration: underline;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
