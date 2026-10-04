import { forwardRef } from 'react'
import { cx } from '../../lib/cx'
import { EnvolturaCampo, claseControl } from './Campo'

/**
 * Área de texto con etiqueta y contador opcional de caracteres.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {number} [props.longitud] Longitud actual del texto, para el contador.
 * @param {number} [props.minimo] Mínimo de caracteres recomendado (se muestra en el contador).
 * @param {string} [props.className]
 */
export const AreaTexto = forwardRef(function AreaTexto(
  { etiqueta, ayuda, error, className, required, longitud, minimo, rows = 4, id, ...resto },
  ref,
) {
  return (
    <EnvolturaCampo etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={required} className={className} id={id}>
      {({ id: idControl, describedBy, invalido }) => (
        <div>
          <textarea
            ref={ref}
            id={idControl}
            rows={rows}
            aria-describedby={describedBy}
            aria-invalid={invalido || undefined}
            required={required}
            className={cx(claseControl, 'resize-y leading-relaxed', invalido && 'border-nc-borde')}
            {...resto}
          />
          {typeof longitud === 'number' && (
            <p
              className={cx(
                'mt-1 text-right text-xs tabular-nums',
                minimo && longitud < minimo ? 'text-tinta-500' : 'text-halla-700',
              )}
              aria-live="polite"
            >
              {longitud} caracteres{minimo ? ` · mínimo ${minimo}` : ''}
            </p>
          )}
        </div>
      )}
    </EnvolturaCampo>
  )
})
