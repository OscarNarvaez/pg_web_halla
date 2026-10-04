import { forwardRef } from 'react'
import { cx } from '../../lib/cx'
import { TONOS } from '../../lib/catalogos'

const NEUTROS = {
  neutro: 'bg-tinta-100 text-tinta-700 border-tinta-300',
  marca: 'bg-halla-50 text-halla-700 border-halla-100',
}

/**
 * Etiqueta corta. Siempre lleva texto: el color nunca es el único indicador.
 * @param {object} props
 * @param {'neutro'|'marca'|'nc'|'obs'|'fort'|'om'} [props.tono='neutro']
 * @param {'sm'|'md'|'lg'} [props.tamano='sm']
 * @param {string} [props.className]
 */
export const Badge = forwardRef(function Badge({ tono = 'neutro', tamano = 'sm', className, children, ...resto }, ref) {
  const color = TONOS[tono]?.badge ?? NEUTROS[tono] ?? NEUTROS.neutro
  const tam = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-sm', lg: 'px-4 py-2 text-base' }[tamano]
  return (
    <span
      ref={ref}
      className={cx('inline-flex items-center gap-1.5 rounded-full border font-semibold', color, tam, className)}
      {...resto}
    >
      {children}
    </span>
  )
})
