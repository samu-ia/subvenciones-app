'use client';

import { FileText, AlertCircle, CheckSquare, Mail, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AITool, getToolLabel } from '@/lib/types/ai-config';
import { useState } from 'react';

interface AIToolsGridProps {
  onExecuteTool: (tool: AITool, input?: string) => Promise<void>;
  disabled?: boolean;
}

interface ToolButton {
  tool: AITool;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const TOOL_BUTTONS: ToolButton[] = [
  {
    tool: 'summary',
    icon: <FileText className="h-4 w-4" />,
    description: 'Resume el expediente/reunión',
    color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-700'
  },
  {
    tool: 'missing-info',
    icon: <AlertCircle className="h-4 w-4" />,
    description: 'Detecta qué información falta',
    color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700'
  },
  {
    tool: 'checklist',
    icon: <CheckSquare className="h-4 w-4" />,
    description: 'Genera checklist de pasos',
    color: 'bg-green-500/10 hover:bg-green-500/20 text-green-700'
  },
  {
    tool: 'email',
    icon: <Mail className="h-4 w-4" />,
    description: 'Redacta un email profesional',
    color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700'
  },
  {
    tool: 'deep-search',
    icon: <Search className="h-4 w-4" />,
    description: 'Búsqueda profunda en contexto',
    color: 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-700'
  }
];

export default function AIToolsGrid({ onExecuteTool, disabled }: AIToolsGridProps) {
  const [executingTool, setExecutingTool] = useState<AITool | null>(null);

  const handleExecute = async (tool: AITool) => {
    setExecutingTool(tool);
    try {
      await onExecuteTool(tool);
    } finally {
      setExecutingTool(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Herramientas
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TOOL_BUTTONS.map(({ tool, icon, description, color }) => (
          <Button
            key={tool}
            variant="outline"
            disabled={disabled || executingTool !== null}
            onClick={() => handleExecute(tool)}
            className={`h-auto flex-col items-start p-3 ${color} border-0 relative`}
          >
            {executingTool === tool && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <span className="font-medium text-sm">{getToolLabel(tool)}</span>
            </div>
            <span className="text-xs opacity-70 text-left">
              {description}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
