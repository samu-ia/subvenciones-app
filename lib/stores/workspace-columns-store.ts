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
      toggleDocumentos: () => set((state) => ({ documentosCollapsed: !state.documentosCollapsed })),
      toggleAI: () => set((state) => ({ aiCollapsed: !state.aiCollapsed })),
      setDocumentos: (collapsed) => set({ documentosCollapsed: collapsed }),
      setAI: (collapsed) => set({ aiCollapsed: collapsed }),
    }),
    {
      name: 'workspace-columns-storage',
    }
  )
)
