import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Modal } from '../ui'

function Opcion({ icono: Icono, titulo, descripcion, alPulsar }) {
  const id = useId()
  return (
    <li>
      <button
        type="button"
        onClick={alPulsar}
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-descripcion`}
        className="group flex w-full items-start gap-3 rounded-lg border border-tinta-100 bg-white p-4 text-left transition-colors hover:border-halla-500 hover:bg-halla-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-halla-500"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-halla-50 text-halla-700 group-hover:bg-white">
          <Icono className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span id={`${id}-titulo`} className="block font-semibold text-tinta-900">{titulo}</span>
          <span id={`${id}-descripcion`} className="mt-0.5 block text-sm text-tinta-500">{descripcion}</span>
        </span>
        <ChevronRight className="mt-2.5 size-5 shrink-0 text-tinta-300 group-hover:text-halla-700" aria-hidden="true" />
      </button>
    </li>
  )
}

/**
 * Pregunta con opciones grandes (lista de verificación o auditoría). Cerrar el modal equivale a `alCerrar`.
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.alCerrar
 * @param {string} props.titulo
 * @param {import('react').ReactNode} [props.descripcion]
 * @param {{ icono: import('react').ComponentType, titulo: string, descripcion: string, alPulsar: () => void }[]} props.opciones
 */
export function ModalEleccion({ abierto, alCerrar, titulo, descripcion, opciones }) {
  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo={titulo} ancho="md">
      {descripcion && <div className="mb-4 space-y-1 text-sm text-tinta-700">{descripcion}</div>}
      <ul className="space-y-3">
        {opciones.map((o) => <Opcion key={o.titulo} {...o} />)}
      </ul>
    </Modal>
  )
}
