'use client'

import { FileText, Lightbulb, StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ContextIndicatorProps {
  docsInsights: number    // Documentos con insights
  docsFull: number        // Documentos completos
  notesCount: number      // Notas incluidas
  tokenCount?: number     // Total tokens
  charCount?: number      // Total caracteres
  className?: string
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function ContextIndicator({
  docsInsights,
  docsFull,
  notesCount,
  tokenCount,
  charCount,
  className
}: ContextIndicatorProps) {
  const hasContext = (docsInsights + docsFull) > 0 || notesCount > 0

  if (!hasContext) {
    return (
      <div className={cn('text-xs text-muted-foreground py-2 px-3 border-t', className)}>
        Sin documentos en contexto. Usa los iconos para incluirlos.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn('flex items-center justify-between gap-2 py-2 px-3 border-t bg-muted/30', className)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Contexto:</span>

          <div className="flex items-center gap-1.5">
            {/* Badge de insights */}
            {docsInsights > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-amber-600 border-amber-600/50 cursor-default">
                    <Lightbulb className="h-3 w-3" />
                    <span>{docsInsights}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Insights de {docsInsights} documento{docsInsights !== 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Badge de docs completos */}
            {docsFull > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default">
                    <FileText className="h-3 w-3" />
                    <span>{docsFull}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{docsFull} documento{docsFull !== 1 ? 's' : ''} completo{docsFull !== 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {notesCount > 0 && (
              <>
                {(docsInsights > 0 || docsFull > 0) && (
                  <span className="text-muted-foreground">•</span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default">
                      <StickyNote className="h-3 w-3" />
                      <span>{notesCount}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{notesCount} nota{notesCount !== 1 ? 's' : ''}</p>
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
    </TooltipProvider>
  )
}
