import { useId, useState } from 'react'
import { BookOpenText, CircleHelp } from 'lucide-react'
import { MARCADOR_PENDIENTE } from '../../lib/catalogos'
import { ModalCriterio } from './ModalCriterio'

const AYUDA_PENDIENTE = 'La IA no encontró un requisito verificable; identifícalo manualmente.'

/** Chips de los criterios citados (clic: texto completo del numeral) o chip gris de requisito pendiente. */
export function ChipsCriterios({ citados = [], criterioRequisito }) {
  const [abierto, setAbierto] = useState(null)
  const idAyuda = useId()
  const pendiente = !citados.length || criterioRequisito === MARCADOR_PENDIENTE

  return (
    <div className="flex flex-wrap gap-2">
      {citados.map((c) => (
        <button
          key={`${c.criterio_id}-${c.numeral}`}
          type="button"
          onClick={() => setAbierto(c.criterio_id)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-halla-100 bg-halla-50 px-3 text-xs font-semibold text-halla-700 hover:border-halla-400"
          title={c.titulo}
        >
          <BookOpenText className="size-3.5" aria-hidden="true" />
          {c.documento}
          {c.numeral ? ` · ${c.numeral}` : ''}
          <span className="sr-only">: ver el texto completo del criterio</span>
        </button>
      ))}
      {pendiente && citados.length === 0 && (
        <span className="group relative inline-flex">
          <span
            tabIndex={0}
            aria-describedby={idAyuda}
            className="inline-flex min-h-8 cursor-help items-center gap-1.5 rounded-full border border-tinta-300 bg-tinta-100 px-3 text-xs font-semibold text-tinta-700"
          >
            <CircleHelp className="size-3.5" aria-hidden="true" />
            Requisito pendiente
          </span>
          <span
            id={idAyuda}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-64 rounded-md bg-tinta-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {AYUDA_PENDIENTE}
          </span>
        </span>
      )}
      <ModalCriterio criterioId={abierto} alCerrar={() => setAbierto(null)} />
    </div>
  )
}
