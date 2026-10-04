import { useAuth } from '../contexts/AuthContext'
import { objetoAuditado } from '../lib/catalogos'

/** Perfil del auditor autenticado y datos derivados. */
export function usePerfil() {
  const { perfil, guardarPerfil, errorPerfil, recargarPerfil } = useAuth()
  return {
    perfil,
    guardarPerfil,
    errorPerfil,
    recargarPerfil,
    objeto: perfil ? objetoAuditado(perfil) : '',
    primerNombre: perfil?.nombre_completo?.trim().split(/\s+/)[0] ?? '',
  }
}
