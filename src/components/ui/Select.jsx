import { forwardRef } from 'react'
import { cx } from '../../lib/cx'
import { EnvolturaCampo, claseControl } from './Campo'

/**
 * Lista desplegable con etiqueta.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {Array<string | {valor: string, etiqueta: string}>} props.opciones
 * @param {string} [props.marcador] Texto de la opción vacía inicial.
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {string} [props.className]
 */
export const Select = forwardRef(function Select(
  { etiqueta, opciones, marcador, ayuda, error, className, required, id, ...resto },
  ref,
) {
  return (
    <EnvolturaCampo etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={required} className={className} id={id}>
      {({ id: idControl, describedBy, invalido }) => (
        <select
          ref={ref}
          id={idControl}
          aria-describedby={describedBy}
          aria-invalid={invalido || undefined}
          required={required}
          className={cx(claseControl, invalido && 'border-nc-borde')}
          {...resto}
        >
          {marcador !== undefined && <option value="">{marcador}</option>}
          {opciones.map((opcion) => {
            const valor = typeof opcion === 'string' ? opcion : opcion.valor
            const texto = typeof opcion === 'string' ? opcion : opcion.etiqueta
            return (
              <option key={valor} value={valor}>
                {texto}
              </option>
            )
          })}
        </select>
      )}
    </EnvolturaCampo>
  )
})
