import { forwardRef } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cx } from '../../lib/cx'

const ESTILOS = {
  exito: { clase: 'border-fort-borde bg-fort-bg text-fort-texto', Icono: CheckCircle2 },
  error: { clase: 'border-nc-borde bg-nc-bg text-nc-texto', Icono: AlertTriangle },
  aviso: { clase: 'border-obs-borde bg-obs-bg text-obs-texto', Icono: AlertTriangle },
  info: { clase: 'border-om-borde bg-om-bg text-om-texto', Icono: Info },
}

/**
 * Notificación breve. Se apila en la esquina inferior mediante `ToastContext`.
 * @param {object} props
 * @param {'exito'|'error'|'aviso'|'info'} [props.tipo='info']
 * @param {string} props.mensaje
 * @param {() => void} [props.alCerrar]
 * @param {string} [props.className]
 */
export const Toast = forwardRef(function Toast({ tipo = 'info', mensaje, alCerrar, className }, ref) {
  const { clase, Icono } = ESTILOS[tipo] ?? ESTILOS.info
  return (
    <div
      ref={ref}
      role={tipo === 'error' ? 'alert' : 'status'}
      className={cx('pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg', clase, className)}
    >
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{mensaje}</p>
      {alCerrar && (
        <button type="button" onClick={alCerrar} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Cerrar notificación">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
})
