import { AlertTriangle, Info } from 'lucide-react'
import { cx } from '../../lib/cx'

const ADVERTENCIA = /^(Revisa la redacción|Completa el riesgo|La IA no propuso controles)/

/** Avisos de la validación de la IA (V2–V7). Con `filtro`, solo los que coinciden. */
export function AvisosHallazgo({ avisos = [], filtro }) {
  const lista = filtro ? avisos.filter((a) => filtro.test(a)) : avisos
  if (!lista.length) return null
  return (
    <ul className="space-y-2">
      {lista.map((aviso) => {
        const advertencia = ADVERTENCIA.test(aviso)
        const Icono = advertencia ? AlertTriangle : Info
        return (
          <li
            key={aviso}
            className={cx(
              'flex gap-2 rounded-md border px-3 py-2 text-sm',
              advertencia ? 'border-obs-borde bg-obs-bg text-obs-texto' : 'border-om-borde bg-om-bg text-om-texto',
            )}
          >
            <Icono className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {aviso}
          </li>
        )
      })}
    </ul>
  )
}
