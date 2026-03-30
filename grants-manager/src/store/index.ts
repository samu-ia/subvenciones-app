import { create } from 'zustand'
import { clientes, convocatorias, expedientes, alertas, gestores, presupuestos as initialPresupuestos } from '../lib/mockData'
import type { Cliente, Convocatoria, Expediente, Alerta, Gestor, EstadoExpediente, Presupuesto } from '../types'

interface AppState {
  clientes: Cliente[]
  convocatorias: Convocatoria[]
  expedientes: Expediente[]
  alertas: Alerta[]
  gestores: Gestor[]
  presupuestos: Presupuesto[]
  sidebarCollapsed: boolean
  urgentPinnedIds: string[]
  setSidebarCollapsed: (v: boolean) => void
  updateExpedienteEstado: (id: string, estado: EstadoExpediente, usuario?: string) => void
  marcarAlertaVista: (id: string) => void
  addAlerta: (alerta: Alerta) => void
  toggleUrgentPin: (id: string) => void
  addHistorialEntry: (expedienteId: string, texto: string, usuario: string) => void
  addNota: (expedienteId: string, texto: string, autor: string) => void
  addPresupuesto: (presupuesto: Presupuesto) => void
  updatePresupuestoEstado: (id: string, estado: Presupuesto['estado']) => void
}

export const useAppStore = create<AppState>((set) => ({
  clientes,
  convocatorias,
  expedientes,
  alertas,
  gestores,
  presupuestos: initialPresupuestos,
  sidebarCollapsed: false,
  urgentPinnedIds: [],
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  updateExpedienteEstado: (id, estado, usuario = 'Gestor') =>
    set((s) => ({
      expedientes: s.expedientes.map((e) =>
        e.id === id
          ? {
              ...e,
              estado,
              historial: [
                ...e.historial,
                { id: `h${Date.now()}`, estadoAnterior: e.estado, estadoNuevo: estado, fecha: new Date(), usuario },
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
  addNota: (expedienteId, texto, autor) =>
    set((s) => ({
      expedientes: s.expedientes.map((e) =>
        e.id === expedienteId
          ? {
              ...e,
              notas: [
                ...e.notas,
                {
                  id: `n${Date.now()}`,
                  texto,
                  fecha: new Date(),
                  autor,
                },
              ],
            }
          : e
      ),
    })),
  addPresupuesto: (presupuesto) =>
    set((s) => ({ presupuestos: [...s.presupuestos, presupuesto] })),
  updatePresupuestoEstado: (id, estado) =>
    set((s) => ({
      presupuestos: s.presupuestos.map((p) =>
        p.id === id
          ? {
              ...p,
              estado,
              fechaRecepcion: (estado === 'recibido' || estado === 'seleccionado') && !p.fechaRecepcion
                ? new Date()
                : p.fechaRecepcion,
            }
          : p
      ),
    })),
}))
