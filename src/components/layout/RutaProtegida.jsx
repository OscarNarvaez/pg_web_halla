import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabaseSinConfigurar } from '../../lib/supabase'
import { AvisoConfiguracion } from './AvisoConfiguracion'
import { PantallaCarga } from './PantallaCarga'
import CompletarPerfil from '../../pages/CompletarPerfil'
import CuentaPendiente from '../../pages/CuentaPendiente'

/**
 * Exige sesión, perfil y cuenta aprobada por un administrador. Sin sesión redirige a /ingresar
 * conservando el destino en location.state.from. (La base de datos aplica la misma regla con RLS.)
 */
export function RutaProtegida() {
  const { sesion, perfil, cargando } = useAuth()
  const location = useLocation()

  if (supabaseSinConfigurar) return <AvisoConfiguracion />
  if (cargando) return <PantallaCarga mensaje="Verificando tu sesión…" />
  if (!sesion) return <Navigate to="/ingresar" replace state={{ from: location }} />
  if (!perfil) return <CompletarPerfil />
  if (!perfil.aprobado) return <CuentaPendiente />
  return <Outlet />
}
