# Open Notebook - Referencia de Arquitectura

## 📋 Resumen Ejecutivo

Este documento contiene los elementos clave del sistema [Open Notebook](https://github.com/lfnovo/open-notebook) (21k ⭐) que debemos implementar en nuestro sistema de Expedientes y Reuniones.

---

## 🎯 1. GESTIÓN DE CREDENCIALES (API KEYS)

### Backend (Python/SurrealDB)
Open Notebook usa un sistema completo de gestión de credenciales en base de datos:

```python
# Modelo de dominio
class Credential:
    id: str
    name: str
    provider: str  # openai, anthropic, google, etc.
    modalities: List[str]  # language, embedding, tts, stt
    api_key: str  # ENCRIPTADO con Fernet
    base_url: Optional[str]
    has_api_key: bool
    created: datetime
    updated: datetime
    model_count: int

# API Endpoints
POST /credentials                    # Crear credencial
GET /credentials                     # Listar todas
GET /credentials/{id}                # Obtener una
PUT /credentials/{id}                # Actualizar
DELETE /credentials/{id}             # Eliminar
POST /credentials/{id}/test          # Probar conexión
POST /credentials/{id}/discover      # Descubrir modelos
POST /credentials/migrate-from-env   # Migrar desde .env
GET /credentials/status              # Estado de configuración
```

### Frontend (React/TypeScript)

**Hooks personalizados:**
```typescript
// src/lib/hooks/use-credentials.ts
export const CREDENTIAL_QUERY_KEYS = {
  all: ['credentials'] as const,
  status: ['credentials', 'status'] as const,
  envStatus: ['credentials', 'env-status'] as const,
  byProvider: (provider: string) => ['credentials', 'provider', provider] as const,
  detail: (id: string) => ['credentials', id] as const,
}

export function useCredentialStatus() {
  return useQuery({
    queryKey: CREDENTIAL_QUERY_KEYS.status,
    queryFn: () => credentialsApi.getStatus()
  })
}

export function useCreateCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => credentialsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREDENTIAL_QUERY_KEYS.all })
      toast({ title: 'Credential saved successfully' })
    }
  })
}

export function useTestCredential() {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  return useMutation({
    mutationFn: (credentialId) => credentialsApi.test(credentialId),
    onSuccess: (result, credentialId) => {
      setTestResults(prev => ({ ...prev, [credentialId]: result }))
    }
  })
}
```

**Página de configuración:**
```tsx
// src/app/(dashboard)/settings/api-keys/page.tsx
export default function ApiKeysPage() {
  const { data: credentials } = useCredentials()
  const { data: status } = useCredentialStatus()
  const encryptionReady = status?.encryption_configured ?? true
  
  // Agrupar por provider
  const credentialsByProvider = useMemo(() => {
    const grouped: Record<string, Credential[]> = {}
    credentials?.forEach(cred => {
      if (!grouped[cred.provider]) grouped[cred.provider] = []
      grouped[cred.provider].push(cred)
    })
    return grouped
  }, [credentials])

  return (
    <div className="p-6 space-y-6">
      {/* Advertencia de encriptación */}
      {!encryptionReady && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Encryption key not configured</AlertTitle>
          <AlertDescription>
            Set OPEN_NOTEBOOK_ENCRYPTION_KEY environment variable
          </AlertDescription>
        </Alert>
      )}

      {/* Sección por cada provider */}
      {ALL_PROVIDERS.map(provider => (
        <ProviderSection
          key={provider}
          provider={provider}
          credentials={credentialsByProvider[provider] || []}
          encryptionReady={encryptionReady}
        />
      ))}
    </div>
  )
}

function ProviderSection({ provider, credentials, encryptionReady }) {
  const [addOpen, setAddOpen] = useState(false)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3>{PROVIDER_DISPLAY_NAMES[provider]}</h3>
            {credentials.length > 0 ? (
              <Badge variant="success">✓ Configured</Badge>
            ) : (
              <Badge variant="outline">✗ Not configured</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Lista de credenciales */}
        {credentials.map(cred => (
          <CredentialItem key={cred.id} credential={cred} />
        ))}
        
        {/* Botón agregar */}
        <Button onClick={() => setAddOpen(true)} disabled={!encryptionReady}>
          <Plus /> Add Configuration
        </Button>
      </CardContent>
    </Card>
  )
}

function CredentialItem({ credential }) {
  const testCredential = useTestCredential()
  const { testResults } = testCredential
  
  return (
    <div className="flex items-center justify-between border rounded p-3">
      <div>
        <p className="font-medium">{credential.name}</p>
        <p className="text-sm text-muted">{credential.model_count} models</p>
      </div>
      <div className="flex gap-2">
        {/* Indicador de test */}
        {testResults[credential.id]?.success && <Check className="text-green-500" />}
        
        {/* Botón test */}
        <Button size="sm" onClick={() => testCredential.mutate(credential.id)}>
          <Plug /> Test
        </Button>
        
        {/* Botón discover modelos */}
        <Button size="sm" onClick={() => openDiscoverDialog(credential)}>
          <Wand2 /> Discover Models
        </Button>
        
        {/* Botón editar */}
        <Button size="sm" onClick={() => openEditDialog(credential)}>
          <Edit />
        </Button>
        
        {/* Botón eliminar */}
        <Button size="sm" variant="destructive" onClick={() => handleDelete(credential.id)}>
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

// Dialog para crear/editar credencial
function CredentialFormDialog({ open, onOpenChange, provider, credential }) {
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [modalities, setModalities] = useState<string[]>([])
  
  const createCredential = useCreateCredential()
  const updateCredential = useUpdateCredential()
  
  const handleSubmit = () => {
    if (credential) {
      // Actualizar (solo enviar API key si cambió)
      updateCredential.mutate({
        credentialId: credential.id,
        data: { name, api_key: apiKey || undefined }
      })
    } else {
      // Crear
      createCredential.mutate({
        name: name || `${provider} Config`,
        provider,
        modalities,
        api_key: apiKey
      })
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {credential ? 'Edit' : 'Add'} {PROVIDER_DISPLAY_NAMES[provider]}
          </DialogTitle>
        </DialogHeader>
        
        {/* Campo nombre */}
        <Label>Configuration Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} />
        
        {/* Campo API Key con show/hide */}
        <Label>API Key</Label>
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showApiKey ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {/* Link a documentación */}
        <a href={PROVIDER_DOCS[provider]} target="_blank" className="text-xs text-primary">
          Get API Key →
        </a>
        
        {/* Modalidades (language, embedding, etc) */}
        <Label>Modalities</Label>
        {/* Checkboxes para cada modalidad */}
        
        <DialogFooter>
          <Button onClick={handleSubmit}>
            {credential ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Constantes de providers:**
```typescript
const ALL_PROVIDERS = [
  'openai', 'anthropic', 'google', 'groq', 'mistral', 
  'deepseek', 'xai', 'openrouter', 'ollama', 'azure'
]

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google AI',
  groq: 'Groq',
  // ...
}

const PROVIDER_DOCS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey',
  // ...
}

const PROVIDER_MODALITIES: Record<string, string[]> = {
  openai: ['language', 'embedding', 'text_to_speech', 'speech_to_text'],
  anthropic: ['language'],
  google: ['language', 'embedding'],
  // ...
}
```

**API Client:**
```typescript
// src/lib/api/credentials.ts
export const credentialsApi = {
  getStatus: async (): Promise<CredentialStatus> => {
    const response = await apiClient.get('/credentials/status')
    return response.data
  },
  
  list: async (): Promise<Credential[]> => {
    const response = await apiClient.get('/credentials')
    return response.data
  },
  
  create: async (data: CreateCredentialRequest): Promise<Credential> => {
    const response = await apiClient.post('/credentials', data)
    return response.data
  },
  
  update: async (credentialId: string, data: UpdateCredentialRequest): Promise<Credential> => {
    const response = await apiClient.put(`/credentials/${credentialId}`, data)
    return response.data
  },
  
  delete: async (credentialId: string): Promise<void> => {
    await apiClient.delete(`/credentials/${credentialId}`)
  },
  
  test: async (credentialId: string): Promise<TestConnectionResult> => {
    const response = await apiClient.post(`/credentials/${credentialId}/test`)
    return response.data
  },
  
  discover: async (credentialId: string): Promise<DiscoverModelsResponse> => {
    const response = await apiClient.post(`/credentials/${credentialId}/discover`)
    return response.data
  },
  
  registerModels: async (credentialId: string, data: RegisterModelsRequest): Promise<RegisterModelsResponse> => {
    const response = await apiClient.post(`/credentials/${credentialId}/register-models`, data)
    return response.data
  },
  
  migrateFromEnv: async (): Promise<MigrationResult> => {
    const response = await apiClient.post('/credentials/migrate-from-env')
    return response.data
  }
}
```

---

## 🔄 2. CONTEXT MODE (Control granular de contexto)

### Tipos y Estados

```typescript
// Tipo para modo de contexto
export type ContextMode = 'off' | 'insights' | 'full'

// Estado de selecciones de contexto
export interface ContextSelections {
  sources: Record<string, ContextMode>    // { [sourceId]: mode }
  notes: Record<string, ContextMode>      // { [noteId]: mode }
}
```

### Componente ContextToggle

```tsx
// src/components/common/ContextToggle.tsx
interface ContextToggleProps {
  mode: ContextMode
  hasInsights?: boolean  // Para sources - determina si 'insights' está disponible
  onChange: (mode: ContextMode) => void
  className?: string
}

export function ContextToggle({ mode, hasInsights = false, onChange, className }: ContextToggleProps) {
  const { t } = useTranslation()
  
  const MODE_CONFIG = {
    off: {
      icon: EyeOff,
      label: t.common.contextModes.off,  // "Not included in chat"
      color: 'text-muted-foreground',
      bgColor: 'hover:bg-muted'
    },
    insights: {
      icon: Lightbulb,
      label: t.common.contextModes.insights,  // "Insights only"
      color: 'text-amber-600',
      bgColor: 'hover:bg-amber-50'
    },
    full: {
      icon: FileText,
      label: t.common.contextModes.full,  // "Full content"
      color: 'text-primary',
      bgColor: 'hover:bg-primary/10'
    }
  }
  
  const config = MODE_CONFIG[mode]
  const Icon = config.icon
  
  // Modos disponibles según si tiene insights
  const availableModes: ContextMode[] = hasInsights 
    ? ['off', 'insights', 'full']
    : ['off', 'full']
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Ciclar al siguiente modo
    const currentIndex = availableModes.indexOf(mode)
    const nextIndex = (currentIndex + 1) % availableModes.length
    onChange(availableModes[nextIndex])
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', config.bgColor, className)}
          onClick={handleClick}
        >
          <Icon className={cn('h-4 w-4', config.color)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{config.label}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {t.common.contextModes.clickToCycle}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
```

### Uso en DocumentList

```tsx
// En cada item de documento
<div className="flex items-center justify-between">
  <span>{documento.nombre}</span>
  
  {/* Toggle de contexto */}
  <ContextToggle
    mode={contextSelections[documento.id] || 'off'}
    hasInsights={documento.generado_por_ia}  // Los docs IA tienen "insights"
    onChange={(mode) => onContextModeChange(documento.id, mode)}
  />
</div>
```

### Inicialización de contexto

```tsx
// En la página del notebook/expediente
const [contextSelections, setContextSelections] = useState<ContextSelections>({
  sources: {},
  notes: {}
})

// Inicializar cuando cargan los datos
useEffect(() => {
  if (documentos && documentos.length > 0) {
    setContextSelections(prev => {
      const newSelections = { ...prev.sources }
      documentos.forEach(doc => {
        if (!(doc.id in newSelections)) {
          // Default: 'insights' si tiene insights, sino 'full'
          newSelections[doc.id] = doc.generado_por_ia ? 'insights' : 'full'
        }
      })
      return { ...prev, sources: newSelections }
    })
  }
}, [documentos])

// Handler para cambiar modo
const handleContextModeChange = (itemId: string, mode: ContextMode) => {
  setContextSelections(prev => ({
    ...prev,
    sources: { ...prev.sources, [itemId]: mode }
  }))
}
```

### Backend - Context Builder

```python
# En el backend, procesar las selecciones
async def _add_document_context(self, doc_id: str, inclusion_level: str = "insights"):
    """
    inclusion_level: "not in" | "insights" | "full content"
    """
    if inclusion_level == "not in":
        return
    
    doc = await get_document(doc_id)
    
    if "full content" in inclusion_level:
        # Incluir contenido completo
        context = {
            'id': doc.id,
            'title': doc.nombre,
            'content': doc.contenido,
            'metadata': doc.metadata
        }
    else:
        # Solo insights/resumen
        context = {
            'id': doc.id,
            'title': doc.nombre,
            'summary': doc.metadata.get('summary', doc.contenido[:500])
        }
    
    self.context_items.append(context)
```

---

## 📊 3. CONTEXT INDICATORS (Indicadores de contexto)

### Componente ContextIndicator

```tsx
// src/components/common/ContextIndicator.tsx
interface ContextIndicatorProps {
  sourcesInsights: number  // Cuántos docs con insights
  sourcesFull: number      // Cuántos docs completos
  notesCount: number       // Cuántas notas
  tokenCount?: number      // Total tokens
  charCount?: number       // Total caracteres
  className?: string
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function ContextIndicator({
  sourcesInsights,
  sourcesFull,
  notesCount,
  tokenCount,
  charCount,
  className
}: ContextIndicatorProps) {
  const hasContext = (sourcesInsights + sourcesFull) > 0 || notesCount > 0
  
  if (!hasContext) {
    return (
      <div className="text-xs text-muted-foreground py-2 px-3 border-t">
        No sources or notes included in context. Toggle icons to include them.
      </div>
    )
  }
  
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 border-t bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Context:</span>
        
        <div className="flex items-center gap-1.5">
          {/* Badge de insights */}
          {sourcesInsights > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-600" />
                  <span>{sourcesInsights}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Insights for {sourcesInsights} source{sourcesInsights !== 1 ? 's' : ''}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Badge de docs completos */}
          {sourcesFull > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3 text-primary" />
                  <span>{sourcesFull}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sourcesFull} full source{sourcesFull !== 1 ? 's' : ''}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {notesCount > 0 && (
            <>
              {(sourcesInsights > 0 || sourcesFull > 0) && (
                <span className="text-muted-foreground">•</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <StickyNote className="h-3 w-3" />
                    <span>{notesCount}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{notesCount} full note{notesCount !== 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
      
      {/* Contadores de tokens/chars */}
      {(tokenCount !== undefined || charCount !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {tokenCount !== undefined && tokenCount > 0 && (
            <span>{formatNumber(tokenCount)} tokens</span>
          )}
          {tokenCount !== undefined && charCount !== undefined && tokenCount > 0 && charCount > 0 && (
            <span>/</span>
          )}
          {charCount !== undefined && charCount > 0 && (
            <span>{formatNumber(charCount)} chars</span>
          )}
        </div>
      )}
    </div>
  )
}
```

### Calcular stats de contexto

```tsx
// En ChatColumn o AIPanel
const contextStats = useMemo(() => {
  let sourcesInsights = 0
  let sourcesFull = 0
  let notesCount = 0
  
  // Contar sources por modo
  documentos.forEach(doc => {
    const mode = contextSelections.sources[doc.id]
    if (mode === 'insights') {
      sourcesInsights++
    } else if (mode === 'full') {
      sourcesFull++
    }
  })
  
  // Contar notes incluidas
  notas.forEach(nota => {
    const mode = contextSelections.notes[nota.id]
    if (mode === 'full') {
      notesCount++
    }
  })
  
  return {
    sourcesInsights,
    sourcesFull,
    notesCount,
    tokenCount: chat.tokenCount,
    charCount: chat.charCount
  }
}, [documentos, notas, contextSelections, chat.tokenCount, chat.charCount])

// Usar en el render
<ContextIndicator {...contextStats} />
```

---

## 📁 4. COLLAPSIBLE COLUMNS (Columnas colapsables)

### Store Zustand para estado

```typescript
// src/lib/stores/workspace-columns-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceColumnsState {
  documentosCollapsed: boolean
  aiCollapsed: boolean
  toggleDocumentos: () => void
  toggleAI: () => void
  setDocumentos: (collapsed: boolean) => void
  setAI: (collapsed: boolean) => void
}

export const useWorkspaceColumnsStore = create<WorkspaceColumnsState>()(
  persist(
    (set) => ({
      documentosCollapsed: false,
      aiCollapsed: false,
      toggleDocumentos: () => set(state => ({ documentosCollapsed: !state.documentosCollapsed })),
      toggleAI: () => set(state => ({ aiCollapsed: !state.aiCollapsed })),
      setDocumentos: (collapsed) => set({ documentosCollapsed: collapsed }),
      setAI: (collapsed) => set({ aiCollapsed: collapsed }),
    }),
    {
      name: 'workspace-columns-storage',
    }
  )
)
```

### Componente CollapsibleColumn

```tsx
// src/components/workspace/CollapsibleColumn.tsx
import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronLeft, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleColumnProps {
  isCollapsed: boolean
  onToggle: () => void
  collapsedIcon: LucideIcon
  collapsedLabel: string
  children: ReactNode
}

export function CollapsibleColumn({
  isCollapsed,
  onToggle,
  collapsedIcon: CollapsedIcon,
  collapsedLabel,
  children,
}: CollapsibleColumnProps) {
  // Detectar si es texto CJK (chino/japonés/coreano)
  const isCJK = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(collapsedLabel)
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className={cn(
                'flex flex-col items-center justify-center gap-3',
                'w-12 h-full min-h-0',
                'border rounded-lg',
                'bg-card hover:bg-accent/50',
                'transition-all duration-150',
                'cursor-pointer group',
                'py-6'
              )}
              aria-label={`Expand ${collapsedLabel}`}
            >
              <CollapsedIcon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
              <div
                className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap"
                style={{ 
                  writingMode: 'vertical-rl', 
                  transform: isCJK ? 'none' : 'rotate(180deg)', 
                  textOrientation: 'mixed' 
                }}
              >
                {collapsedLabel}
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Expand {collapsedLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return (
    <div className="h-full min-h-0 transition-all duration-150">
      {children}
    </div>
  )
}

// Factory function para crear botón de collapse en headers
export function createCollapseButton(onToggle: () => void, label: string) {
  return (
    <div className="hidden lg:block">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="h-7 w-7 hover:bg-accent"
              aria-label={`Collapse ${label}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Collapse {label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
```

### Uso en página de workspace

```tsx
// En expedientes/[id]/page.tsx
export default function ExpedientePage() {
  const { documentosCollapsed, aiCollapsed, toggleDocumentos, toggleAI } = useWorkspaceColumnsStore()
  
  return (
    <div className="flex h-full min-h-0 gap-6">
      {/* Columna Documentos */}
      <div className={cn(
        'transition-all duration-150',
        documentosCollapsed ? 'w-12 flex-shrink-0' : 'flex-none basis-1/4'
      )}>
        <CollapsibleColumn
          isCollapsed={documentosCollapsed}
          onToggle={toggleDocumentos}
          collapsedIcon={FileText}
          collapsedLabel="Documentos"
        >
          <DocumentList
            documentos={documentos}
            collapseButton={createCollapseButton(toggleDocumentos, 'Documentos')}
          />
        </CollapsibleColumn>
      </div>
      
      {/* Columna Editor - siempre expandida */}
      <div className="flex-1 min-w-0">
        <RichTextEditor content={content} onChange={handleChange} />
      </div>
      
      {/* Columna IA */}
      <div className={cn(
        'transition-all duration-150',
        aiCollapsed ? 'w-12 flex-shrink-0' : 'flex-none basis-1/4'
      )}>
        <CollapsibleColumn
          isCollapsed={aiCollapsed}
          onToggle={toggleAI}
          collapsedIcon={Bot}
          collapsedLabel="Asistente IA"
        >
          <AIPanel
            messages={messages}
            contextStats={contextStats}
            collapseButton={createCollapseButton(toggleAI, 'IA')}
          />
        </CollapsibleColumn>
      </div>
    </div>
  )
}
```

### DocumentList con botón collapse

```tsx
function DocumentList({ documentos, collapseButton }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Documentos</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCreate}>
              <Plus />
            </Button>
            {collapseButton}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {/* Lista de documentos */}
      </CardContent>
    </Card>
  )
}
```

---

## 📱 5. MOBILE TABS (Responsive para móvil)

```tsx
// En la página del workspace
export default function ExpedientePage() {
  const [mobileActiveTab, setMobileActiveTab] = useState<'documentos' | 'editor' | 'ia'>('editor')
  const isDesktop = useIsDesktop()  // Hook custom useMediaQuery
  
  const { documentosCollapsed, aiCollapsed } = useWorkspaceColumnsStore()
  
  return (
    <div className="flex flex-col h-full">
      {/* Mobile: Tabs */}
      {!isDesktop && (
        <>
          <div className="lg:hidden mb-4">
            <Tabs value={mobileActiveTab} onValueChange={(v) => setMobileActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="documentos" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="editor" className="gap-2">
                  <Edit className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="ia" className="gap-2">
                  <Bot className="h-4 w-4" />
                  IA
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Mostrar solo tab activo */}
          <div className="flex-1 overflow-hidden lg:hidden">
            {mobileActiveTab === 'documentos' && (
              <DocumentList documentos={documentos} />
            )}
            {mobileActiveTab === 'editor' && (
              <RichTextEditor content={content} />
            )}
            {mobileActiveTab === 'ia' && (
              <AIPanel messages={messages} />
            )}
          </div>
        </>
      )}
      
      {/* Desktop: Layout de 3 columnas colapsables */}
      <div className="hidden lg:flex h-full min-h-0 gap-6">
        <div className={cn(documentosCollapsed ? 'w-12' : 'basis-1/4')}>
          <CollapsibleColumn isCollapsed={documentosCollapsed} ...>
            <DocumentList />
          </CollapsibleColumn>
        </div>
        
        <div className="flex-1">
          <RichTextEditor />
        </div>
        
        <div className={cn(aiCollapsed ? 'w-12' : 'basis-1/4')}>
          <CollapsibleColumn isCollapsed={aiCollapsed} ...>
            <AIPanel />
          </CollapsibleColumn>
        </div>
      </div>
    </div>
  )
}

// Hook custom para detectar desktop
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return isDesktop
}
```

---

## 💬 6. MULTIPLE CHAT SESSIONS (Sesiones de chat)

### Schema de base de datos

```sql
-- Nueva tabla para sesiones de chat
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reunion_id UUID REFERENCES reuniones(id),
    expediente_id UUID REFERENCES expediente(id),
    titulo VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_contexto CHECK (
        (reunion_id IS NOT NULL AND expediente_id IS NULL) OR
        (reunion_id IS NULL AND expediente_id IS NOT NULL)
    )
);

-- Agregar session_id a ia_interacciones
ALTER TABLE ia_interacciones
ADD COLUMN session_id UUID REFERENCES chat_sessions(id);

CREATE INDEX idx_chat_sessions_reunion ON chat_sessions(reunion_id);
CREATE INDEX idx_chat_sessions_expediente ON chat_sessions(expediente_id);
CREATE INDEX idx_ia_interacciones_session ON ia_interacciones(session_id);
```

### Componente SessionManager

```tsx
// src/components/workspace/SessionManager.tsx
interface SessionManagerProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
}

export function SessionManager({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession
}: SessionManagerProps) {
  const [open, setOpen] = useState(false)
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Sessions ({sessions.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat Sessions</DialogTitle>
          <DialogDescription>
            Manage your conversation sessions
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className={cn(
                'flex items-center justify-between p-3 border rounded',
                session.id === currentSessionId && 'border-primary bg-primary/5'
              )}
            >
              <div className="flex-1" onClick={() => onSelectSession(session.id)}>
                <p className="font-medium">{session.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(session.created_at))} ago
                </p>
              </div>
              
              {session.id !== currentSessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteSession(session.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button onClick={onCreateSession}>
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Integración en AIPanel

```tsx
// src/components/workspace/AIPanel.tsx
export function AIPanel({ expedienteId, documentos, contextSelections }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  
  // Cargar sesiones
  useEffect(() => {
    loadSessions()
  }, [expedienteId])
  
  const loadSessions = async () => {
    const response = await fetch(`/api/chat-sessions?expedienteId=${expedienteId}`)
    const data = await response.json()
    setSessions(data)
    
    // Seleccionar la sesión más reciente o crear una nueva
    if (data.length > 0) {
      setCurrentSessionId(data[0].id)
    } else {
      handleCreateSession()
    }
  }
  
  const handleCreateSession = async () => {
    const response = await fetch('/api/chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expedienteId, titulo: 'New Chat' })
    })
    const newSession = await response.json()
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setMessages([])
  }
  
  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId)
    
    // Cargar mensajes de la sesión
    const response = await fetch(`/api/ia/chat/history?sessionId=${sessionId}`)
    const history = await response.json()
    setMessages(history)
  }
  
  const handleDeleteSession = async (sessionId: string) => {
    await fetch(`/api/chat-sessions/${sessionId}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    
    if (sessionId === currentSessionId) {
      if (sessions.length > 1) {
        handleSelectSession(sessions[0].id)
      } else {
        handleCreateSession()
      }
    }
  }
  
  const handleSendMessage = async (content: string) => {
    // Incluir session_id en la petición
    const response = await fetch('/api/ia/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: content,
        expedienteId,
        sessionId: currentSessionId,
        contextSelections
      })
    })
    
    // ...resto del código
  }
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Asistente IA</CardTitle>
          <SessionManager
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>
        
        {/* Context Indicator */}
        <ContextIndicator {...contextStats} />
      </CardHeader>
      
      {/* ... resto del chat ... */}
    </Card>
  )
}
```

---

## 💾 7. "SAVE AS DOCUMENT" (Guardar respuesta como documento)

```tsx
// En AIPanel, agregar botón a cada mensaje de IA
function AIMessage({ message, onSaveAsDocument }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [documentName, setDocumentName] = useState('')
  
  const handleSave = async () => {
    await onSaveAsDocument({
      nombre: documentName || detectarNombreDocumento(message.content),
      contenido: message.content,
      generado_por_ia: true,
      prompt_usado: message.prompt,
      tipo_documento: 'respuesta_ia'
    })
    setShowSaveDialog(false)
  }
  
  return (
    <div className="message-ia">
      <div className="content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      
      <div className="actions">
        <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Guardar como documento
        </Button>
      </div>
      
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como documento</DialogTitle>
          </DialogHeader>
          
          <Label>Nombre del documento</Label>
          <Input
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            placeholder="Ej: Resumen de reunión"
          />
          
          <DialogFooter>
            <Button onClick={handleSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// En AIPanel
const handleSaveAsDocument = async (docData) => {
  const response = await fetch('/api/documentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...docData,
      expediente_id: expedienteId,
      orden: documentos.length
    })
  })
  
  const newDoc = await response.json()
  onDocumentCreated(newDoc)
  
  toast({
    title: 'Documento guardado',
    description: `"${newDoc.nombre}" se agregó a la lista`
  })
}
```

---

## 🎨 8. UI/UX IMPROVEMENTS

### Badges y estados visuales

```tsx
// Badge para documentos generados por IA
{documento.generado_por_ia && (
  <Badge variant="secondary" className="text-xs">
    <Bot className="h-3 w-3 mr-1" />
    IA
  </Badge>
)}

// Badge para tipo de documento
{documento.tipo_documento && (
  <Badge variant="outline" className="text-xs">
    {TIPO_DOCUMENTO_LABELS[documento.tipo_documento]}
  </Badge>
)}
```

### Loading states mejorados

```tsx
// Loading spinner con size
<LoadingSpinner size="lg" />

// Skeleton loaders para listas
{isLoading ? (
  <div className="space-y-3">
    {[1,2,3,4,5].map(i => (
      <Skeleton key={i} className="h-20 w-full" />
    ))}
  </div>
) : (
  // contenido real
)}
```

### Empty states informativos

```tsx
<EmptyState
  icon={FileText}
  title="No hay documentos todavía"
  description="Crea tu primer documento para comenzar"
  action={
    <Button onClick={handleCreate}>
      <Plus className="h-4 w-4 mr-2" />
      Crear documento
    </Button>
  }
/>
```

---

## 📝 RESUMEN DE IMPLEMENTACIÓN

### Prioridad 1 (Crítico):
1. ✅ **Sistema de credenciales completo** - Base de datos + UI de configuración
2. ✅ **ContextMode toggles** - Control granular off/insights/full
3. ✅ **Context indicators** - Badges mostrando qué está en contexto

### Prioridad 2 (Importante):
4. ✅ **Collapsible columns** - Columnas que colapsan con animación
5. ✅ **Mobile tabs** - Responsive para móvil con tabs
6. ✅ **Save as document** - Botón en respuestas de IA

### Prioridad 3 (Nice to have):
7. ✅ **Multiple chat sessions** - Historial de conversaciones
8. ✅ **UI improvements** - Badges, loading states, empty states

---

## 🔗 RECURSOS

- **Repositorio:** https://github.com/lfnovo/open-notebook
- **Documentación:** Ver carpeta `docs/` en el repo
- **Demo:** https://opennotebook.io
- **Stack tecnológico:**
  - Frontend: Next.js 14, TypeScript, TanStack Query, Zustand, Tailwind CSS, shadcn/ui
  - Backend: FastAPI, Python 3.11+, SurrealDB
  - IA: OpenAI, Anthropic, Google, Groq, Ollama (multi-provider)

---

## 📌 NOTAS IMPORTANTES

1. **Encriptación:** Open Notebook usa Fernet (symmetric encryption) para API keys en DB
2. **Persistencia:** Zustand con middleware `persist` guarda estado en localStorage
3. **Cache:** TanStack Query maneja toda la cache de datos con invalidación automática
4. **Internacionalización:** Sistema completo de traducciones con `useTranslation` hook
5. **Validación:** Zod para schemas de formularios
6. **Testing:** Usa hooks para testeo de conexiones antes de guardar credenciales
