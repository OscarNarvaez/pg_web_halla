import { FileText, Trash2, X } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * Un documento cargado (PDF de evidencia), con su botón «Quitar» siempre visible y una X que aparece al pasar el
 * puntero por encima (decisión del dueño, 5/10/2026). Las dos quitan el documento; en pantallas táctiles, sin puntero,
 * queda el botón. La X es un atajo para el ratón: no suma otra parada al tabular.
 * @param {object} props
 * @param {string} props.nombre
 * @param {number} props.paginas
 * @param {string} [props.detalle] p. ej. «analizado con la IA» o «agregado el 05/10/2026 14:05»
 * @param {string} [props.sha256] se muestra al pasar el puntero sobre el nombre
 * @param {() => void} [props.alQuitar] sin esta función el documento se muestra sin acciones
 * @param {'li'|'div'} [props.como='div']
 */
export function DocumentoAdjunto({ nombre, paginas, detalle, sha256, alQuitar, como: Etiqueta = 'div' }) {
  return (
    <Etiqueta
      className={cx(
        'group relative flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-sm transition-colors',
        alQuitar ? 'border-halla-100 bg-halla-50 hover:border-nc-borde' : 'border-tinta-100 bg-tinta-50',
      )}
    >
      <FileText className="size-4 shrink-0 text-halla-700" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium text-tinta-900" title={sha256 ? `${nombre} · SHA-256 ${sha256}` : nombre}>{nombre}</span>
      <span className="text-xs text-tinta-500">{paginas} pág.{detalle ? ` · ${detalle}` : ''}</span>
      {alQuitar && (
        <>
          <button
            type="button"
            onClick={alQuitar}
            aria-label={`Quitar el PDF ${nombre}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-tinta-300 bg-white px-2 text-xs font-semibold text-tinta-700 hover:border-nc-borde hover:bg-nc-bg hover:text-nc-texto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halla-500"
          >
            <Trash2 className="size-3.5" aria-hidden="true" /> Quitar
          </button>
          <button
            type="button"
            onClick={alQuitar}
            tabIndex={-1}
            aria-hidden="true"
            title={`Quitar ${nombre}`}
            className="pointer-events-none absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-nc-solido text-white opacity-0 shadow-md transition-opacity hover:bg-nc-texto group-hover:pointer-events-auto group-hover:opacity-100"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </Etiqueta>
  )
}
