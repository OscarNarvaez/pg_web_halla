import { forwardRef } from 'react'
import { cx } from '../../lib/cx'

/**
 * Contenedor con borde, fondo blanco y sombra suave.
 * @param {object} props
 * @param {string} [props.titulo]
 * @param {string} [props.descripcion]
 * @param {import('react').ReactNode} [props.acciones] Botones alineados a la derecha del título.
 * @param {'section'|'div'|'article'} [props.como='section']
 * @param {boolean} [props.sinRelleno] Quita el padding interno (útil para tablas).
 * @param {string} [props.className]
 */
export const Tarjeta = forwardRef(function Tarjeta(
  { titulo, descripcion, acciones, como: Etiqueta = 'section', sinRelleno = false, className, children, ...resto },
  ref,
) {
  return (
    <Etiqueta
      ref={ref}
      className={cx('rounded-lg border border-tinta-100 bg-white shadow-sm', !sinRelleno && 'p-5 sm:p-6', className)}
      {...resto}
    >
      {(titulo || acciones) && (
        <header className={cx('flex flex-wrap items-start justify-between gap-3', sinRelleno ? 'p-5 sm:p-6' : 'mb-4')}>
          <div className="min-w-0">
            {titulo && <h2 className="text-lg font-semibold text-tinta-900">{titulo}</h2>}
            {descripcion && <p className="mt-1 text-sm text-tinta-500">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </header>
      )}
      {children}
    </Etiqueta>
  )
})
