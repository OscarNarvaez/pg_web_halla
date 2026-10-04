import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabaseSinConfigurar } from '../../lib/supabase'
import { AvisoConfiguracion } from './AvisoConfiguracion'
import { PantallaCarga } from './PantallaCarga'
import CompletarPerfil from '../../pages/CompletarPerfil'

/** Exige sesión y perfil. Sin sesión redirige a /ingresar conservando el destino en location.state.from. */
export function RutaProtegida() {
  const { sesion, perfil, cargando } = useAuth()
  const location = useLocation()

  if (supabaseSinConfigurar) return <AvisoConfiguracion />
  if (cargando) return <PantallaCarga mensaje="Verificando tu sesión…" />
  if (!sesion) return <Navigate to="/ingresar" replace state={{ from: location }} />
  if (!perfil) return <CompletarPerfil />
  return <Outlet />
}
