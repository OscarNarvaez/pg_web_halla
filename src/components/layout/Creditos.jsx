import { cx } from '../../lib/cx'

const PORTAFOLIO = 'https://oscarnarvaez.github.io/personalPortfolio/'

/**
 * Crédito del desarrollador para el pie de página: «ZOKY» abre su portafolio en una pestaña nueva.
 * @param {object} props
 * @param {boolean} [props.invertida=false] Sobre fondo oscuro (pantallas con la foto de la fachada).
 * @param {string} [props.className]
 */
export function Creditos({ invertida = false, className }) {
  return (
    <p className={cx('text-xs', invertida ? 'text-tinta-100' : 'text-tinta-500', className)}>
      Desarrollado por:{' '}
      <a
        href={PORTAFOLIO}
        target="_blank"
        rel="noopener noreferrer"
        className={cx('rounded-sm font-semibold underline underline-offset-2', invertida ? 'text-white hover:text-halla-100' : 'text-halla-700 hover:text-halla-600')}
      >
        ZOKY<span className="sr-only"> (se abre en una pestaña nueva)</span>
      </a>
    </p>
  )
}
