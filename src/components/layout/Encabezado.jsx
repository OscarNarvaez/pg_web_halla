import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/** Encabezado de página con título, descripción, enlace de regreso y acciones. */
export function Encabezado({ titulo, descripcion, volver, acciones, antetitulo }) {
  return (
    <header className="mb-6">
      {volver && (
        <Link to={volver.a} className="no-imprimir mb-3 inline-flex items-center gap-1 text-sm font-medium text-halla-700 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {volver.etiqueta}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {antetitulo && <p className="text-xs font-semibold uppercase tracking-wider text-halla-700">{antetitulo}</p>}
          <h1 className="mt-0.5 text-2xl font-semibold text-tinta-900 sm:text-3xl">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-3xl text-sm text-tinta-500">{descripcion}</p>}
        </div>
        {acciones && <div className="no-imprimir flex flex-wrap gap-2">{acciones}</div>}
      </div>
    </header>
  )
}
