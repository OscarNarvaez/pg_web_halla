import { forwardRef, useId } from 'react'
import { cx } from '../../lib/cx'

export const claseControl =
  'block w-full rounded-lg border-tinta-300 bg-white text-tinta-900 shadow-sm placeholder:text-tinta-300 focus:border-halla-500 focus:ring-halla-500 disabled:bg-tinta-50 disabled:text-tinta-500'

/**
 * Envoltorio accesible de etiqueta + control + ayuda + error.
 * Asocia el `<label>` y enlaza ayuda y error con `aria-describedby`.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {boolean} [props.requerido]
 * @param {(ids: {id: string, describedBy?: string, invalido: boolean}) => import('react').ReactNode} props.children
 * @param {string} [props.className]
 */
export function EnvolturaCampo({ etiqueta, ayuda, error, requerido, children, className, id: idExterno }) {
  const idGenerado = useId()
  const id = idExterno ?? idGenerado
  const idAyuda = ayuda ? `${id}-ayuda` : null
  const idError = error ? `${id}-error` : null
  const describedBy = [idAyuda, idError].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-tinta-700">
        {etiqueta}
        {requerido && (
          <span className="text-nc-texto" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children({ id, describedBy, invalido: Boolean(error) })}
      {ayuda && (
        <p id={idAyuda} className="text-xs text-tinta-500">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-sm font-medium text-nc-texto" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Campo de texto con etiqueta. Acepta todas las props de `<input>`.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {string} [props.className] Clases del contenedor.
 */
export const Campo = forwardRef(function Campo(
  { etiqueta, ayuda, error, className, required, id, ...resto },
  ref,
) {
  return (
    <EnvolturaCampo etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={required} className={className} id={id}>
      {({ id: idControl, describedBy, invalido }) => (
        <input
          ref={ref}
          id={idControl}
          aria-describedby={describedBy}
          aria-invalid={invalido || undefined}
          required={required}
          className={cx(claseControl, invalido && 'border-nc-borde')}
          {...resto}
        />
      )}
    </EnvolturaCampo>
  )
})
