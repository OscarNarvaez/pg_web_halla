import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RutaProtegida } from './components/layout/RutaProtegida'
import { AppShell } from './components/layout/AppShell'
import { PantallaCarga } from './components/layout/PantallaCarga'
import Landing from './pages/Landing'
import Login from './pages/Login'
import NoEncontrada from './pages/NoEncontrada'

// Las pantallas internas se cargan bajo demanda (recharts, jspdf y docx pesan)
const Registro = lazy(() => import('./pages/Registro'))
const RecuperarClave = lazy(() => import('./pages/RecuperarClave'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Auditorias = lazy(() => import('./pages/Auditorias'))
const AuditoriaNueva = lazy(() => import('./pages/AuditoriaNueva'))
const AuditoriaDetalle = lazy(() => import('./pages/AuditoriaDetalle'))
const HallazgoNuevo = lazy(() => import('./pages/HallazgoNuevo'))
const Informe = lazy(() => import('./pages/Informe'))
const MatrizConsolidada = lazy(() => import('./pages/MatrizConsolidada'))
const ListaVerificacion = lazy(() => import('./pages/ListaVerificacion'))
const Normas = lazy(() => import('./pages/Normas'))
const AdminAuditores = lazy(() => import('./pages/AdminAuditores'))

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PantallaCarga />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/recuperar" element={<RecuperarClave />} />

          <Route path="/app" element={<RutaProtegida />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="auditorias" element={<Auditorias />} />
              <Route path="auditorias/nueva" element={<AuditoriaNueva />} />
              <Route path="auditorias/:id" element={<AuditoriaDetalle />} />
              <Route path="auditorias/:id/hallazgos/nuevo" element={<HallazgoNuevo />} />
              <Route path="auditorias/:id/matriz" element={<MatrizConsolidada />} />
              <Route path="auditorias/:id/lista" element={<ListaVerificacion />} />
              <Route path="auditorias/:id/informe" element={<Informe />} />
              <Route path="normas" element={<Normas />} />
              <Route path="admin/auditores" element={<AdminAuditores />} />
              <Route path="*" element={<NoEncontrada />} />
            </Route>
          </Route>

          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
