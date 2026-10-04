import { forwardRef } from 'react'
import { cx } from '../../lib/cx'

/**
 * Mensaje para listas o vistas sin datos. Debe explicar el siguiente paso, no solo decir «no hay datos».
 * @param {object} props
 * @param {import('react').ComponentType} [props.icono]
 * @param {string} props.titulo
 * @param {string} [props.descripcion]
 * @param {import('react').ReactNode} [props.accion]
 * @param {string} [props.className]
 */
export const EstadoVacio = forwardRef(function EstadoVacio(
  { icono: Icono, titulo, descripcion, accion, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx('flex flex-col items-center rounded-lg border border-dashed border-tinta-300 px-6 py-10 text-center', className)}
    >
      {Icono && <Icono className="mb-3 size-10 text-tinta-300" aria-hidden="true" />}
      <h3 className="text-base font-semibold text-tinta-900">{titulo}</h3>
      {descripcion && <p className="mt-1 max-w-md text-sm text-tinta-500">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
})

/** Mensaje de error de carga con opción de reintentar. */
export function EstadoError({ mensaje, alReintentar, className }) {
  return (
    <div role="alert" className={cx('rounded-lg border border-nc-borde bg-nc-bg px-4 py-3 text-sm text-nc-texto', className)}>
      <p className="font-semibold">No se pudo cargar la información.</p>
      <p className="mt-1">{mensaje}</p>
      {alReintentar && (
        <button type="button" onClick={alReintentar} className="mt-2 font-semibold underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  )
}
