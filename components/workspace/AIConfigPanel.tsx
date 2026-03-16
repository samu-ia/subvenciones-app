'use client';

import { useState } from 'react';
import { Settings, X, Save, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  AIProvider, 
  AITool, 
  ToolConfig, 
  ProviderConfig,
  AVAILABLE_MODELS,
  DEFAULT_TOOL_CONFIGS,
  getToolLabel,
  getProviderLabel
} from '@/lib/types/ai-config';

interface AIConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  workspaceType: 'expediente' | 'reunion';
}

type ConfigView = 'main' | 'tool' | 'provider';

export default function AIConfigPanel({
  isOpen,
  onClose,
  userId,
  workspaceType
}: AIConfigPanelProps) {
  const [currentView, setCurrentView] = useState<ConfigView>('main');
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  
  // Estado de configuraciones (en producción vendría de la DB)
  const [toolConfigs, setToolConfigs] = useState<Record<AITool, ToolConfig>>(
    Object.fromEntries(
      Object.entries(DEFAULT_TOOL_CONFIGS).map(([tool, config]) => [
        tool,
        { ...config, user_id: userId, workspace_type: workspaceType } as ToolConfig
      ])
    ) as Record<AITool, ToolConfig>
  );
  
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([
    { provider: 'openai', enabled: true },
    { provider: 'anthropic', enabled: false },
    { provider: 'google', enabled: false },
    { provider: 'openrouter', enabled: false }
  ]);

  if (!isOpen) return null;

  const tools: AITool[] = ['notebook', 'summary', 'missing-info', 'checklist', 'email', 'deep-search'];

  const renderMainView = () => (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
          Herramientas de IA
        </h3>
        <div className="space-y-2">
          {tools.map(tool => {
            const config = toolConfigs[tool];
            return (
              <button
                key={tool}
                onClick={() => {
                  setSelectedTool(tool);
                  setCurrentView('tool');
                }}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="text-left">
                    <div className="font-medium">{getToolLabel(tool)}</div>
                    <div className="text-xs text-muted-foreground">
                      {getProviderLabel(config.provider)} · {config.model}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
          Proveedores
        </h3>
        <div className="space-y-2">
          {providerConfigs.map(provider => (
            <button
              key={provider.provider}
              onClick={() => {
                setSelectedProvider(provider.provider);
                setCurrentView('provider');
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${provider.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="font-medium">{getProviderLabel(provider.provider)}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderToolConfig = () => {
    if (!selectedTool) return null;
    const config = toolConfigs[selectedTool];

    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('main')}
          className="self-start -ml-2"
        >
          ← Volver
        </Button>

        <div>
          <h3 className="text-lg font-semibold mb-4">{getToolLabel(selectedTool)}</h3>
          
          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg mb-4">
            <span className="font-medium">Activado</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                setToolConfigs(prev => ({
                  ...prev,
                  [selectedTool]: { ...config, enabled: e.target.checked }
                }));
              }}
              className="w-4 h-4"
            />
          </div>

          {/* Provider selection */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Proveedor</label>
            <select
              value={config.provider}
              onChange={(e) => {
                const newProvider = e.target.value as AIProvider;
                const availableModels = AVAILABLE_MODELS[newProvider];
                setToolConfigs(prev => ({
                  ...prev,
                  [selectedTool]: { 
                    ...config, 
                    provider: newProvider,
                    model: availableModels[0]?.id || ''
                  }
                }));
              }}
              className="w-full p-2 border rounded-lg"
            >
              {providerConfigs.filter(p => p.enabled).map(p => (
                <option key={p.provider} value={p.provider}>
                  {getProviderLabel(p.provider)}
                </option>
              ))}
            </select>
          </div>

          {/* Model selection */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Modelo</label>
            <select
              value={config.model}
              onChange={(e) => {
                setToolConfigs(prev => ({
                  ...prev,
                  [selectedTool]: { ...config, model: e.target.value }
                }));
              }}
              className="w-full p-2 border rounded-lg"
            >
              {AVAILABLE_MODELS[config.provider]?.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.contextWindow.toLocaleString()} tokens)
                </option>
              ))}
            </select>
          </div>

          {/* Temperature */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">
              Temperatura: {config.temperature?.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature || 0.7}
              onChange={(e) => {
                setToolConfigs(prev => ({
                  ...prev,
                  [selectedTool]: { ...config, temperature: parseFloat(e.target.value) }
                }));
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Preciso</span>
              <span>Creativo</span>
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Prompt del Sistema</label>
            <textarea
              value={config.systemPrompt || ''}
              onChange={(e) => {
                setToolConfigs(prev => ({
                  ...prev,
                  [selectedTool]: { ...config, systemPrompt: e.target.value }
                }));
              }}
              rows={6}
              className="w-full p-2 border rounded-lg text-sm"
              placeholder="Instrucciones para el modelo..."
            />
          </div>

          {/* Notebook-specific config */}
          {selectedTool === 'notebook' && config.notebookConfig && (
            <div className="space-y-3 p-4 bg-accent/30 rounded-lg">
              <h4 className="font-medium text-sm">Configuración del Notebook</h4>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.notebookConfig.useDocuments}
                  onChange={(e) => {
                    setToolConfigs(prev => ({
                      ...prev,
                      [selectedTool]: {
                        ...config,
                        notebookConfig: { ...config.notebookConfig!, useDocuments: e.target.checked }
                      }
                    }));
                  }}
                />
                <span className="text-sm">Usar documentos</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.notebookConfig.citeSources}
                  onChange={(e) => {
                    setToolConfigs(prev => ({
                      ...prev,
                      [selectedTool]: {
                        ...config,
                        notebookConfig: { ...config.notebookConfig!, citeSources: e.target.checked }
                      }
                    }));
                  }}
                />
                <span className="text-sm">Citar fuentes</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.notebookConfig.autoSaveResults}
                  onChange={(e) => {
                    setToolConfigs(prev => ({
                      ...prev,
                      [selectedTool]: {
                        ...config,
                        notebookConfig: { ...config.notebookConfig!, autoSaveResults: e.target.checked }
                      }
                    }));
                  }}
                />
                <span className="text-sm">Guardar resultados automáticamente</span>
              </label>
            </div>
          )}

          <Button className="w-full mt-4">
            <Save className="h-4 w-4 mr-2" />
            Guardar configuración
          </Button>
        </div>
      </div>
    );
  };

  const renderProviderConfig = () => {
    if (!selectedProvider) return null;
    const config = providerConfigs.find(p => p.provider === selectedProvider);
    if (!config) return null;

    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentView('main')}
          className="self-start -ml-2"
        >
          ← Volver
        </Button>

        <div>
          <h3 className="text-lg font-semibold mb-4">{getProviderLabel(selectedProvider)}</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
              <span className="font-medium">Activado</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => {
                  setProviderConfigs(prev =>
                    prev.map(p =>
                      p.provider === selectedProvider
                        ? { ...p, enabled: e.target.checked }
                        : p
                    )
                  );
                }}
                className="w-4 h-4"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <input
                type="password"
                value={config.apiKey || ''}
                onChange={(e) => {
                  setProviderConfigs(prev =>
                    prev.map(p =>
                      p.provider === selectedProvider
                        ? { ...p, apiKey: e.target.value }
                        : p
                    )
                  );
                }}
                placeholder="sk-..."
                className="w-full p-2 border rounded-lg"
              />
            </div>

            {selectedProvider === 'openai' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization ID (opcional)</label>
                <input
                  type="text"
                  value={config.organization || ''}
                  onChange={(e) => {
                    setProviderConfigs(prev =>
                      prev.map(p =>
                        p.provider === selectedProvider
                          ? { ...p, organization: e.target.value }
                          : p
                      )
                    );
                  }}
                  placeholder="org-..."
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            )}

            {selectedProvider === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Base URL</label>
                <input
                  type="text"
                  value={config.baseUrl || ''}
                  onChange={(e) => {
                    setProviderConfigs(prev =>
                      prev.map(p =>
                        p.provider === selectedProvider
                          ? { ...p, baseUrl: e.target.value }
                          : p
                      )
                    );
                  }}
                  placeholder="https://..."
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            )}

            <Button className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Guardar configuración
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="font-semibold">Configuración de IA</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentView === 'main' && renderMainView()}
          {currentView === 'tool' && renderToolConfig()}
          {currentView === 'provider' && renderProviderConfig()}
        </div>
      </div>
    </>
  );
}
