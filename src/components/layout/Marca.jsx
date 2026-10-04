import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { INSTITUCION } from '../../lib/catalogos'

/** Logotipo tipográfico de halla. Mientras no exista el logo oficial del hospital, la marca es solo texto. */
export function Marca({ a = '/', invertida = false, conInstitucion = false, className }) {
  return (
    <Link to={a} className={cx('group inline-flex items-center gap-2.5 rounded-md', className)} aria-label="halla, ir al inicio">
      <span
        aria-hidden="true"
        className={cx(
          'grid size-8 place-items-center rounded-lg font-serif text-lg font-semibold',
          invertida ? 'bg-white text-halla-700' : 'bg-halla-700 text-white',
        )}
      >
        h
      </span>
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
