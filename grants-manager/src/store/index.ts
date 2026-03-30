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
  urgentPinnedIds: string[]
  setSidebarCollapsed: (v: boolean) => void
  updateExpedienteEstado: (id: string, estado: EstadoExpediente) => void
  marcarAlertaVista: (id: string) => void
  addAlerta: (alerta: Alerta) => void
  toggleUrgentPin: (id: string) => void
  addHistorialEntry: (expedienteId: string, texto: string, usuario: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  clientes,
  convocatorias,
  expedientes,
  alertas,
  gestores,
  sidebarCollapsed: false,
  urgentPinnedIds: [],
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
  addAlerta: (alerta) =>
    set((s) => ({ alertas: [...s.alertas, alerta] })),
  toggleUrgentPin: (id) =>
    set((s) => ({
      urgentPinnedIds: s.urgentPinnedIds.includes(id)
        ? s.urgentPinnedIds.filter((pid) => pid !== id)
        : [...s.urgentPinnedIds, id],
    })),
  addHistorialEntry: (expedienteId, texto, usuario) =>
    set((s) => ({
      expedientes: s.expedientes.map((e) =>
        e.id === expedienteId
          ? {
              ...e,
              historial: [
                ...e.historial,
                {
                  id: `h${Date.now()}`,
                  estadoAnterior: e.estado,
                  estadoNuevo: e.estado,
                  fecha: new Date(),
                  usuario,
                  comentario: texto,
                },
              ],
            }
          : e
      ),
    })),
}))
