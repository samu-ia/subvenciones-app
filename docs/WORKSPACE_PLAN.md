# 📋 Plan de Implementación: Workspace Unificado con IA

## 🎯 Objetivo
Crear un **workspace de documentos con IA contextual** unificado para Reuniones y Expedientes.

## 🏗️ Arquitectura

### Estructura Visual (3 Columnas)
```
┌─────────────────────────────────────────────────────────────┐
│  Header: Cliente | Reunión/Expediente | Estado              │
├───────────┬─────────────────────────────┬───────────────────┤
│           │                             │                   │
│ DOCUMENTOS│      EDITOR RICO            │   PANEL IA        │
│           │                             │                   │
│ • Memoria │  # Título del documento     │ 💬 Chat           │
│ • Notas   │                             │ ┌───────────────┐ │
│ • Check   │  Contenido editable con:    │ │ Pregunta...   │ │
│           │  - Negrita/cursiva          │ └───────────────┘ │
│ Archivos: │  - Títulos                  │                   │
│ □ doc.pdf │  - Listas                   │ 🎯 Acciones:      │
│           │  - Enlaces                  │ • Resumen         │
│ + Nuevo   │                             │ • Detectar info   │
│ ⬆ Upload  │  Autosave: hace 2s          │ • Preparar doc    │
│           │                             │                   │
│           │                             │ 🔍 B. Profunda    │
└───────────┴─────────────────────────────┴───────────────────┘
```

## 📦 Stack Técnico

### Editor de Texto Rico
- **Tiptap** (basado en ProseMirror)
- Extensiones: Bold, Italic, Heading, BulletList, Link
- Autosave con debounce 1000ms
- Soporte para inserción programática (IA)

### Base de Datos
```sql
-- Tabla documentos (ya existe, mejorar)
ALTER TABLE documentos 
  ADD COLUMN tipo_documento TEXT,
  ADD COLUMN metadata JSONB,
  ADD COLUMN generado_por_ia BOOLEAN DEFAULT false,
  ADD COLUMN prompt_usado TEXT;

-- Nueva tabla archivos
CREATE TABLE archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID REFERENCES expediente(id),
  reunion_id UUID REFERENCES reuniones(id),
  nombre TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes BIGINT,
  texto_extraido TEXT, -- para RAG
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para historial de IA
CREATE TABLE ia_interacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT, -- 'chat', 'generacion', 'busqueda_profunda'
  contexto_id UUID, -- reunion_id o expediente_id
  contexto_tipo TEXT, -- 'reunion' o 'expediente'
  prompt TEXT,
  respuesta TEXT,
  documentos_usados UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API de IA
```typescript
// app/api/ia/chat/route.ts
POST /api/ia/chat
{
  contextoId: string,
  contextoTipo: 'reunion' | 'expediente',
  mensaje: string,
  documentosReferenciados: string[]
}

// app/api/ia/generar/route.ts
POST /api/ia/generar
{
  contextoId: string,
  tipo: 'resumen' | 'checklist' | 'busqueda_profunda',
  prompt?: string
}

// app/api/ia/editar/route.ts
POST /api/ia/editar
{
  documentoId: string,
  instruccion: string
}
```

## 🧩 Componentes a Crear

### 1. `WorkspaceLayout.tsx`
Layout de 3 columnas responsive

### 2. `DocumentList.tsx`
- Lista de documentos
- Crear/Renombrar/Eliminar
- Upload de archivos
- Selector de documento activo

### 3. `RichTextEditor.tsx`
- Editor Tiptap
- Toolbar (B, I, H1-H3, UL, Link)
- Autosave
- Indicador de guardado

### 4. `AIPanel.tsx`
- Chat contextual
- Botones de acciones rápidas
- Sistema de @referencias
- Streaming de respuestas

### 5. `DeepSearchModal.tsx`
- Modal para búsqueda profunda
- Prompt editable
- Generación de documento

## 📝 Fases de Implementación

### Fase 1: Fundamentos (Day 1-2)
- [ ] Instalar Tiptap y dependencias
- [ ] Crear WorkspaceLayout base
- [ ] Migrar esquema de BD
- [ ] Crear componente RichTextEditor

### Fase 2: Gestión de Documentos (Day 2-3)
- [ ] Componente DocumentList
- [ ] CRUD de documentos
- [ ] Sistema de archivos
- [ ] Migrar storage a Supabase

### Fase 3: IA Contextual (Day 3-5)
- [ ] API endpoints para IA
- [ ] Chat con contexto
- [ ] Botones de acciones
- [ ] Sistema de @referencias

### Fase 4: Features Avanzadas (Day 5-7)
- [ ] Búsqueda profunda
- [ ] RAG sobre documentos/archivos
- [ ] Edición de documentos con IA
- [ ] Historial de interacciones

### Fase 5: Integración (Day 7-8)
- [ ] Migrar /reuniones/[id]
- [ ] Migrar /expedientes/[id]
- [ ] Testing completo
- [ ] Ajustes UX

## 🚀 Próximos Pasos Inmediatos

1. **Instalar dependencias**
   ```bash
   npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
   npm install ai openai @ai-sdk/openai
   ```

2. **Crear migración de BD**
   - Mejorar tabla documentos
   - Crear tabla archivos
   - Crear tabla ia_interacciones

3. **Implementar WorkspaceLayout**
   - Estructura de 3 columnas
   - Responsive design
   - Estado compartido

4. **Crear RichTextEditor**
   - Configurar Tiptap
   - Implementar toolbar
   - Autosave funcional

## 💡 Decisiones de Diseño

- **Mismo código para Reuniones y Expedientes**: Solo cambia el contexto
- **Documentos como primera clase**: Todo generado por IA se guarda
- **RAG automático**: Archivos PDF se extraen a texto
- **Streaming**: Respuestas de IA en tiempo real
- **@referencias**: Syntax sugar para incluir documentos en prompts

## ⚠️ Consideraciones

- Supabase Storage para archivos grandes
- Rate limiting en endpoints de IA
- Caché de contexto para reducir costos
- Rollback si algo falla (mantener código actual)
