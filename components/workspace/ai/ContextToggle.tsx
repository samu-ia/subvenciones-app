'use client'

import { EyeOff, Lightbulb, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type ContextMode = 'off' | 'insights' | 'full'

interface ContextToggleProps {
  mode: ContextMode
  hasInsights?: boolean  // Para documentos - determina si 'insights' está disponible
  onChange: (mode: ContextMode) => void
  className?: string
}

export function ContextToggle({ mode, hasInsights = false, onChange, className }: ContextToggleProps) {
  const MODE_CONFIG = {
    off: {
      icon: EyeOff,
      label: 'No incluido en chat',
      color: 'text-muted-foreground',
      bgColor: 'hover:bg-muted'
    },
    insights: {
      icon: Lightbulb,
      label: 'Solo insights',
      color: 'text-amber-600',
      bgColor: 'hover:bg-amber-50 dark:hover:bg-amber-950'
    },
    full: {
      icon: FileText,
      label: 'Contenido completo',
      color: 'text-primary',
      bgColor: 'hover:bg-primary/10'
    }
  } as const

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0 transition-colors', config.bgColor, className)}
            onClick={handleClick}
          >
            <Icon className={cn('h-4 w-4', config.color)} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Click para cambiar
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
