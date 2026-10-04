import { forwardRef, useId } from 'react'
import { cx } from '../../lib/cx'

/**
 * Casilla de verificación con etiqueta clicable.
 * @param {object} props
 * @param {import('react').ReactNode} props.etiqueta
 * @param {string} [props.ayuda]
 * @param {string} [props.className]
 */
export const Checkbox = forwardRef(function Checkbox({ etiqueta, ayuda, className, id: idExterno, ...resto }, ref) {
  const idGenerado = useId()
  const id = idExterno ?? idGenerado
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        className="mt-0.5 size-4 rounded border-tinta-300 text-halla-700 focus:ring-halla-500"
        {...resto}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-tinta-900">
          {etiqueta}
        </label>
        {ayuda && (
          <p id={`${id}-ayuda`} className="text-tinta-500">
            {ayuda}
          </p>
        )}
      </div>
    </div>
  )
})
