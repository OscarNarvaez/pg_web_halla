import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { INSTITUCION } from '../../lib/catalogos'
import logo from '../../assets/logo-hila.webp'

/**
 * Marca de halla con el logo del hospital. El logo va sobre un disco blanco: su texto perimetral es oscuro
 * y desaparecería sobre los fondos `invertida` (barra lateral y pantallas con la foto de la fachada).
 */
export function Marca({ a = '/', invertida = false, conInstitucion = false, className }) {
  return (
    <Link to={a} className={cx('group inline-flex items-center gap-2.5 rounded-md', className)} aria-label="halla, ir al inicio">
      <img src={logo} alt="" width="40" height="40" className="size-10 shrink-0 rounded-full bg-white p-0.5" />
      <span className="leading-tight">
        <span className={cx('block font-serif text-xl font-semibold', invertida ? 'text-white' : 'text-tinta-900')}>halla</span>
        {conInstitucion && (
          <span className={cx('block text-[11px] font-medium uppercase tracking-wider', invertida ? 'text-halla-100' : 'text-tinta-500')}>
            {INSTITUCION.sigla} · {INSTITUCION.ciudad}
          </span>
        )}
      </span>
    </Link>
  )
}
