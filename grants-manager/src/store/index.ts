import { create } from 'zustand'
import { clientes, convocatorias, expedientes, alertas, gestores } from '../lib/mockData'
import type { Cliente, Convocatoria, Expediente, Alerta, Gestor, EstadoExpediente } from '../types'

interface AppState {
  clientes: Cliente[]
  convocatorias: Convocatoria[]
  expedientes: Expediente[]
  alertas: Alerta[]
  gestores: Gestor[]
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  updateExpedienteEstado: (id: string, estado: EstadoExpediente) => void
  marcarAlertaVista: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  clientes,
  convocatorias,
  expedientes,
  alertas,
  gestores,
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  updateExpedienteEstado: (id, estado) =>
    set((s) => ({
      expedientes: s.expedientes.map((e) =>
        e.id === id
          ? {
              ...e,
              estado,
              historial: [
                ...e.historial,
                { id: `h${Date.now()}`, estadoAnterior: e.estado, estadoNuevo: estado, fecha: new Date(), usuario: 'Gestor' },
              ],
            }
          : e
      ),
    })),
  marcarAlertaVista: (id) =>
    set((s) => ({
      alertas: s.alertas.map((a) => (a.id === id ? { ...a, estado: 'vista' as const } : a)),
    })),
}))
