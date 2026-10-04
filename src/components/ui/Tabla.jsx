import { forwardRef } from 'react'
import { cx } from '../../lib/cx'

/**
 * Tabla con desplazamiento horizontal en pantallas pequeñas.
 * @param {object} props
 * @param {string} props.descripcion Texto para lectores de pantalla (`<caption>` oculto).
 * @param {Array<{clave: string, titulo: string, className?: string}>} props.columnas
 * @param {Array<object>} props.filas
 * @param {(fila: object, columna: {clave: string}) => import('react').ReactNode} [props.celda]
 * @param {(fila: object) => string} [props.claveFila]
 * @param {string} [props.className]
 */
export const Tabla = forwardRef(function Tabla(
  { descripcion, columnas, filas, celda = (fila, col) => fila[col.clave], claveFila = (f) => f.id, className },
  ref,
) {
  return (
    <div ref={ref} className={cx('overflow-x-auto', className)}>
      <table className="min-w-full divide-y divide-tinta-100 text-sm">
        <caption className="sr-only">{descripcion}</caption>
        <thead className="bg-tinta-50">
          <tr>
            {columnas.map((col) => (
              <th
                key={col.clave}
                scope="col"
                className={cx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500', col.className)}
              >
                {col.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-tinta-100 bg-white">
          {filas.map((fila) => (
            <tr key={claveFila(fila)} className="align-top hover:bg-tinta-50/60">
              {columnas.map((col) => (
                <td key={col.clave} className={cx('px-4 py-3 align-middle', col.className)}>
                  {celda(fila, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
