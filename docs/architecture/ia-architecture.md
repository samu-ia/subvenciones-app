# Sistema de IA Multi-Modelo

Este documento describe la arquitectura del nuevo sistema de IA modular implementado en el proyecto.

## 📋 Visión General

El sistema transforma el panel de IA simple en un **workspace inteligente** con las siguientes capacidades:

- **Notebook Contextual** (Asistente RAG): Chat principal con contexto de documentos
- **Herramientas Especializadas**: Resumen, Checklist, Email, Búsqueda profunda, Información faltante
- **Multi-Proveedor**: OpenAI, Anthropic (Claude), Google (Gemini), OpenRouter, Azure, Custom
- **Configuración Granular**: Cada herramienta puede usar un proveedor y modelo diferente
- **Analytics**: Tracking completo de uso, costos y rendimiento

## 🏗️ Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  AIPanelV2.tsx          │ Panel principal modular           │
│  AIToolsGrid.tsx        │ Grid de herramientas especializadas│
│  AIConfigPanel.tsx      │ Configuración de IA                │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  /api/ia/notebook       │ Endpoint para chat RAG             │
│  /api/ia/tool           │ Endpoint para herramientas         │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Provider Abstraction                       │
├─────────────────────────────────────────────────────────────┤
│  BaseAIProvider         │ Interfaz base                      │
│  OpenAIProvider         │ Implementación OpenAI              │
│  AnthropicProvider      │ Implementación Anthropic           │
│  GoogleProvider         │ Implementación Google              │
│  Factory                │ Creación dinámica de proveedores   │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (Supabase)                      │
├─────────────────────────────────────────────────────────────┤
│  ia_providers           │ Configuración de proveedores       │
│  ia_tool_configs        │ Configuración por herramienta      │
│  ia_tool_executions     │ Analytics y logs                   │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Estructura de Archivos

```
lib/
├── types/
│   └── ai-config.ts              # Tipos TypeScript completos
├── ai/
│   └── providers/
│       ├── base.ts               # Interfaz base para proveedores
│       ├── openai.ts             # Implementación OpenAI
│       ├── anthropic.ts          # Implementación Anthropic
│       ├── google.ts             # Implementación Google
│       └── factory.ts            # Factory para crear providers
└── db/
    └── ia-config.ts              # Funciones CRUD para configs

components/workspace/
├── AIPanelV2.tsx                 # Panel principal (nuevo)
├── AIToolsGrid.tsx               # Grid de herramientas
└── AIConfigPanel.tsx             # Panel de configuración

app/api/ia/
├── notebook/
│   └── route.ts                  # API para chat RAG
└── tool/
    └── route.ts                  # API para herramientas

supabase/migrations/
└── 20260316000003_ia_multimodel_config.sql  # Esquema DB
```

## 🛠️ Herramientas Disponibles

### 1. Notebook (Asistente Contextual)

**Propósito**: Chat principal con RAG (Retrieval Augmented Generation)

**Características**:
- Selección de documentos para contexto
- Modos: Sin contexto, Insights (extracto), Full (completo)
- Cita fuentes automáticamente
- Mantiene historial de conversación
- @mentions para referenciar documentos

**Configuración**:
- Provider y modelo personalizables
- System prompt ajustable
- Temperatura configurable
- Opciones: useDocuments, citeSources, autoSaveResults

### 2. Summary (Resumen)

**Propósito**: Genera resumen estructurado del expediente

**Output**:
- Objetivo principal
- Estado actual
- Información clave
- Próximos pasos

### 3. Missing Info (Información Faltante)

**Propósito**: Detecta documentación o datos faltantes

**Output**:
- Documentos críticos faltantes
- Datos incompletos
- Información adicional recomendada

### 4. Checklist (Lista de Tareas)

**Propósito**: Genera checklist detallado por fases

**Output**:
- Documentación inicial
- Requisitos técnicos
- Presentación
- Seguimiento

### 5. Email

**Propósito**: Redacta emails profesionales al cliente

**Output**:
- Asunto apropiado
- Cuerpo estructurado
- Estado actual
- Próximos pasos
- Cierre profesional

### 6. Deep Search (Búsqueda Profunda)

**Propósito**: Análisis exhaustivo de un tema específico

**Output**:
- Información de todos los documentos
- Referencias cruzadas
- Fuentes consultadas
- Recomendaciones

## 🔌 Proveedores Soportados

### OpenAI
- **Modelos**: gpt-4-turbo, gpt-4, gpt-3.5-turbo
- **Config**: API Key, Organization (opcional)
- **Streaming**: ✅ Soportado

### Anthropic (Claude)
- **Modelos**: claude-3-opus, claude-3-sonnet, claude-3-haiku
- **Config**: API Key
- **Streaming**: ✅ Soportado

### Google (Gemini)
- **Modelos**: gemini-1.5-pro, gemini-1.5-flash, gemini-pro
- **Config**: API Key
- **Streaming**: ✅ Soportado

### OpenRouter
- **Descripción**: Acceso unificado a múltiples modelos
- **Config**: API Key, Base URL opcional
- **Streaming**: ✅ Soportado (depende del modelo)

### Azure OpenAI
- **Descripción**: OpenAI hospedado en Azure
- **Config**: API Key, Base URL (endpoint Azure), Organization
- **Streaming**: ✅ Soportado

### Custom
- **Descripción**: API compatible con OpenAI
- **Config**: API Key, Base URL (requerido)
- **Streaming**: Depende de la implementación

## 💾 Base de Datos

### Tabla: `ia_providers`

Almacena configuración de proveedores por usuario.

```sql
CREATE TABLE ia_providers (
  user_id UUID REFERENCES auth.users,
  provider TEXT CHECK (provider IN ('openai', 'anthropic', 'google', 'openrouter', 'azure', 'custom')),
  api_key TEXT NOT NULL,
  base_url TEXT,
  organization TEXT,
  enabled BOOLEAN DEFAULT true,
  UNIQUE (user_id, provider)
);
```

### Tabla: `ia_tool_configs`

Configuración específica por herramienta y workspace.

```sql
CREATE TABLE ia_tool_configs (
  user_id UUID REFERENCES auth.users,
  workspace_type TEXT CHECK (workspace_type IN ('expediente', 'reunion', 'global')),
  tool TEXT CHECK (tool IN ('notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search')),
  enabled BOOLEAN DEFAULT true,
  provider TEXT,
  model TEXT,
  system_prompt TEXT,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  stream_enabled BOOLEAN DEFAULT true,
  config JSONB,
  UNIQUE (user_id, workspace_type, tool)
);
```

### Tabla: `ia_tool_executions`

Analytics y logs de ejecuciones.

```sql
CREATE TABLE ia_tool_executions (
  user_id UUID REFERENCES auth.users,
  workspace_id UUID,
  workspace_type TEXT,
  tool TEXT,
  provider TEXT,
  model TEXT,
  input_text TEXT,
  output_text TEXT,
  success BOOLEAN,
  error_message TEXT,
  tokens_used INTEGER,
  execution_time_ms INTEGER,
  sources_used JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Uso

### Configurar Proveedor

```typescript
import { saveProviderConfig } from '@/lib/db/ia-config';

await saveProviderConfig(userId, {
  provider: 'openai',
  apiKey: 'sk-...',
  organization: 'org-...',
  enabled: true
});
```

### Configurar Herramienta

```typescript
import { saveToolConfig } from '@/lib/db/ia-config';

await saveToolConfig(userId, {
  tool: 'notebook',
  workspaceType: 'expediente',
  enabled: true,
  provider: 'openai',
  model: 'gpt-4-turbo',
  systemPrompt: 'Eres un asistente especializado...',
  temperature: 0.7,
  maxTokens: 4000,
  streamEnabled: true
});
```

### Usar Notebook

```typescript
const response = await fetch('/api/ia/notebook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '¿Qué documentos faltan?',
    context: '[Documento: Memoria]\nContenido...',
    contextoId: 'exp-123',
    contextoTipo: 'expediente',
    history: [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Hola, ¿en qué puedo ayudarte?' }
    ]
  })
});

const data = await response.json();
// { response: '...', sources: [...], metadata: { ... } }
```

### Ejecutar Herramienta

```typescript
const response = await fetch('/api/ia/tool', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'summary',
    context: '[Documento: Memoria]\nContenido...',
    contextoId: 'exp-123',
    contextoTipo: 'expediente',
    input: 'Genera un resumen ejecutivo' // opcional
  })
});

const data = await response.json();
// { response: '...', sources: [...], metadata: { tool, model, provider, tokensUsed, executionTime } }
```

## 📊 Analytics

### Obtener Estadísticas

```typescript
import { getToolExecutionStats } from '@/lib/db/ia-config';

const stats = await getToolExecutionStats(userId, 'notebook', workspaceId);
// {
//   totalExecutions: 150,
//   successRate: 98.7,
//   averageTokens: 450,
//   averageExecutionTime: 1200,
//   totalCost: 0.45
// }
```

## 🔐 Seguridad

- **API Keys**: Almacenadas encriptadas en la base de datos
- **Row Level Security**: Usuarios solo acceden a sus propias configs
- **Validación**: Schemas estrictos en todas las APIs
- **Rate Limiting**: Implementar en producción (TODO)

## 🎯 Próximos Pasos

### Funcionalidad Pendiente

- [ ] Implementar autenticación real (obtener userId del token)
- [ ] @mentions con autocomplete en el chat
- [ ] Diálogo de "guardar resultado como documento"
- [ ] Dashboard de analytics
- [ ] Rate limiting por usuario
- [ ] Caché de respuestas frecuentes
- [ ] Soporte para imágenes (GPT-4 Vision, Claude Vision)
- [ ] Herramientas personalizadas por usuario

### Integración

- [ ] Reemplazar `AIPanel.tsx` por `AIPanelV2.tsx` en páginas activas
- [ ] Probar con proveedores reales (OpenAI, Anthropic, Google)
- [ ] Configurar variables de entorno para API keys de desarrollo
- [ ] Migrar usuarios existentes al nuevo sistema

## 📝 Changelog

### v2.0.0 - Arquitectura Multi-Modelo (2026-03-16)

**Agregado**:
- Sistema modular de IA con separación Notebook / Herramientas / Config
- Soporte para 6 proveedores (OpenAI, Anthropic, Google, OpenRouter, Azure, Custom)
- 6 herramientas especializadas (notebook, summary, missing-info, checklist, email, deep-search)
- Configuración granular por herramienta y workspace
- Analytics completo de ejecuciones
- Base de datos con 3 tablas nuevas + 12 índices
- Abstracción de proveedores con interfaz unificada
- Streaming de respuestas soportado

**Componentes**:
- `AIPanelV2.tsx`: Panel principal modular
- `AIToolsGrid.tsx`: Grid de herramientas
- `AIConfigPanel.tsx`: Configuración con 3 vistas
- `lib/ai/providers/*`: Capa de abstracción
- `lib/db/ia-config.ts`: CRUD de configuraciones
- `/api/ia/notebook`: Endpoint RAG
- `/api/ia/tool`: Endpoint herramientas

**Migración**:
- SQL: `20260316000003_ia_multimodel_config.sql` (ejecutada ✅)
- Tipos: `lib/types/ai-config.ts` (2270+ líneas)
- Proveedores: Base, OpenAI, Anthropic, Google, Factory

## 🤝 Contribución

Para agregar un nuevo proveedor:

1. Crear `lib/ai/providers/nuevo-proveedor.ts` extendiendo `BaseAIProvider`
2. Implementar métodos: `complete()`, `streamComplete()`, `estimateCost()`
3. Agregar al factory en `lib/ai/providers/factory.ts`
4. Agregar tipo en `lib/types/ai-config.ts` → `AIProvider`
5. Actualizar `DEFAULT_TOOL_CONFIGS` con modelos disponibles

Para agregar una nueva herramienta:

1. Agregar tipo en `lib/types/ai-config.ts` → `AITool`
2. Agregar config por defecto en `DEFAULT_TOOL_CONFIGS`
3. Agregar botón en `components/workspace/AIToolsGrid.tsx`
4. Actualizar endpoint `/api/ia/tool/route.ts` si tiene lógica especial
5. Agregar icon y label helpers

## 📚 Referencias

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)
- [Google AI Docs](https://ai.google.dev/docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
