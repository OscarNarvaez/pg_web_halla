import { Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { Boton } from '../components/ui'

/** Cuenta creada pero aún no aprobada por un administrador: no tiene acceso a ningún dato. */
export default function CuentaPendiente() {
  const { perfil, usuario, salir, recargarPerfil } = useAuth()
  return (
    <LayoutPublico titulo="Tu cuenta está pendiente de aprobación">
      <div className="flex gap-3 text-sm text-tinta-700">
        <Clock className="size-6 shrink-0 text-halla-600" aria-hidden="true" />
        <div className="space-y-2">
          <p>
            Hola, {perfil?.nombre_completo?.split(' ')[0]}. Registramos tu cuenta (<strong>{usuario?.email}</strong>), pero por
            seguridad un administrador debe aprobarla antes de que puedas registrar auditorías y consultar las normas.
          </p>
          <p>Avísale al administrador de la plataforma en el área de Calidad. Cuando la apruebe, vuelve a ingresar.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Boton variante="fantasma" onClick={salir}>Salir</Boton>
        <Boton variante="secundario" onClick={recargarPerfil}>Ya me aprobaron</Boton>
      </div>
    </LayoutPublico>
  )
}
