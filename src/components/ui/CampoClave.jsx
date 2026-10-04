import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cx } from '../../lib/cx'
import { EnvolturaCampo, claseControl } from './Campo'

/**
 * Campo de contraseña con botón para mostrarla u ocultarla. Acepta las mismas props que `Campo`.
 * El botón es type="button" (no envía el formulario) e indica su estado con aria-pressed.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {string} [props.className] Clases del contenedor.
 */
export const CampoClave = forwardRef(function CampoClave(
  { etiqueta, ayuda, error, className, required, id, ...resto },
  ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <EnvolturaCampo etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={required} className={className} id={id}>
      {({ id: idControl, describedBy, invalido }) => (
        <div className="relative">
          <input
            ref={ref}
            id={idControl}
            type={visible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={invalido || undefined}
            required={required}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={cx(claseControl, 'pr-12', invalido && 'border-nc-borde')}
            {...resto}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls={idControl}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-tinta-500 hover:text-halla-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-halla-500"
          >
            {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
      )}
    </EnvolturaCampo>
  )
})
