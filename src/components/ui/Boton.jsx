import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cx } from '../../lib/cx'

const VARIANTES = {
  primario: 'bg-halla-700 text-white hover:bg-halla-600 disabled:bg-tinta-300',
  secundario: 'border border-tinta-300 bg-white text-tinta-900 hover:bg-tinta-50 disabled:text-tinta-300',
  fantasma: 'text-halla-700 hover:bg-halla-50 disabled:text-tinta-300',
  peligro: 'border border-nc-borde bg-white text-nc-texto hover:bg-nc-bg disabled:text-tinta-300',
}

const TAMANOS = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-sm gap-2',
  lg: 'min-h-12 px-6 text-base gap-2',
}

const BASE =
  'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halla-500 focus-visible:ring-offset-2'

/**
 * Botón de la aplicación.
 * @param {object} props
 * @param {'primario'|'secundario'|'fantasma'|'peligro'} [props.variante='primario']
 * @param {'sm'|'md'|'lg'} [props.tamano='md']
 * @param {boolean} [props.cargando] Muestra un indicador y deshabilita el botón.
 * @param {import('react').ComponentType} [props.icono] Icono de lucide-react a la izquierda.
 * @param {string} [props.className]
 */
export const Boton = forwardRef(function Boton(
  { variante = 'primario', tamano = 'md', cargando = false, icono: Icono, className, children, disabled, type = 'button', ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cx(
        BASE,
        'disabled:cursor-not-allowed',
        VARIANTES[variante],
        TAMANOS[tamano],
        className,
      )}
      {...resto}
    >
      {cargando ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        Icono && <Icono className="size-4 shrink-0" aria-hidden="true" />
      )}
      {children}
    </button>
  )
})

/**
 * Enlace de navegación con aspecto de botón (no se anida un <button> dentro de un <a>).
 * @param {object} props
 * @param {string} props.a Ruta de destino.
 * @param {boolean} [props.deshabilitado] Se muestra como botón inactivo y no navega.
 */
export const BotonEnlace = forwardRef(function BotonEnlace(
  { a, variante = 'primario', tamano = 'md', icono: Icono, deshabilitado = false, className, children, ...resto },
  ref,
) {
  const clases = cx(BASE, VARIANTES[variante], TAMANOS[tamano], className)
  if (deshabilitado) {
    return (
      <span ref={ref} role="link" aria-disabled="true" className={cx(clases, 'cursor-not-allowed opacity-50')} {...resto}>
        {Icono && <Icono className="size-4 shrink-0" aria-hidden="true" />}
        {children}
      </span>
    )
  }
  return (
    <Link ref={ref} to={a} className={clases} {...resto}>
      {Icono && <Icono className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </Link>
  )
})
