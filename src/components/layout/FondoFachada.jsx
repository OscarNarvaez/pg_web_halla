import fachada768 from '../../assets/fachada-hila-768.webp'
import fachada1536 from '../../assets/fachada-hila-1536.webp'
import { cx } from '../../lib/cx'

/**
 * Foto de la fachada del hospital como fondo decorativo de las pantallas públicas.
 * Siempre va debajo de un velo oscuro (`bg-tinta-900/…`): sin él, el texto blanco pierde contraste sobre el cielo.
 * El encuadre se corre a la derecha para que en móvil se vea la torre con el nombre del hospital.
 */
export function FondoFachada({ className }) {
  return (
    <img
      src={fachada1536}
      srcSet={`${fachada768} 768w, ${fachada1536} 1536w`}
      sizes="100vw"
      alt=""
      aria-hidden="true"
      // En minúscula: React 18.3 no conoce fetchPriority y avisaría en consola (lo soporta desde React 19)
      // eslint-disable-next-line react/no-unknown-property
      fetchpriority="high"
      decoding="async"
      className={cx('pointer-events-none size-full select-none object-cover object-[75%_center]', className)}
    />
  )
}
