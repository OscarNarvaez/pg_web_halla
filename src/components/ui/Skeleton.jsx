import { forwardRef } from 'react'
import { cx } from '../../lib/cx'

/**
 * Bloque de carga animado. Oculto para lectores de pantalla: anuncia la carga con `aria-busy` en el contenedor.
 * @param {object} props
 * @param {string} [props.className] Define alto y ancho (p. ej. `h-4 w-1/2`).
 */
export const Skeleton = forwardRef(function Skeleton({ className, ...resto }, ref) {
  return <div ref={ref} aria-hidden="true" className={cx('animate-pulse rounded-md bg-tinta-100', className)} {...resto} />
})

/** Varias líneas de texto en carga. */
export function SkeletonTexto({ lineas = 3, className }) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lineas }, (_, i) => (
        <Skeleton key={i} className={cx('h-4', i === lineas - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
