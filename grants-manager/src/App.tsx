import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PageWrapper } from './components/layout/PageWrapper'
import { Dashboard } from './pages/dashboard/Dashboard'
import { Clientes } from './pages/clientes/Clientes'
import { ClienteDetalle } from './pages/clientes/ClienteDetalle'
import { Convocatorias } from './pages/convocatorias/Convocatorias'
import { Expedientes } from './pages/expedientes/Expedientes'
import { ExpedienteDetalle } from './pages/expedientes/ExpedienteDetalle'
import { Alertas } from './pages/alertas/Alertas'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PageWrapper>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalle />} />
            <Route path="/convocatorias" element={<Convocatorias />} />
            <Route path="/expedientes" element={<Expedientes />} />
            <Route path="/expedientes/:id" element={<ExpedienteDetalle />} />
            <Route path="/alertas" element={<Alertas />} />
          </Routes>
        </PageWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
