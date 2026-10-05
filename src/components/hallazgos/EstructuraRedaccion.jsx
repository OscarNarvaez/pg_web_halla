import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { CLASIFICACIONES, ESTRUCTURAS } from '../../lib/catalogos'

const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Fórmula de redacción de la categoría y, si el hallazgo corregido no la sigue, qué le falta (`problemasDeEstructura`).
 * Es una guía: no impide guardar ni validar, porque la verificación es heurística.
 */
export function EstructuraRedaccion({ clasificacion, problemas }) {
  const estructura = ESTRUCTURAS[clasificacion]
  if (!estructura) return null
  const categoria = CLASIFICACIONES[clasificacion]?.etiqueta.toLowerCase()
  if (!problemas.length) {
    return (
      <p className="mt-2 flex gap-1.5 text-xs text-tinta-500">
        <CheckCircle2 className="mt-px size-3.5 shrink-0 text-fort-texto" aria-hidden="true" />
        <span>Sigue la fórmula de la {categoria}: <span className="font-medium text-tinta-700">{estructura.formula}</span></span>
      </p>
    )
  }
  return (
    <div role="status" className="mt-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
      <p className="flex gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Ajusta la redacción a la fórmula de la {categoria}: {estructura.formula}
      </p>
      <ul className="ml-6 mt-1 list-disc space-y-0.5">
        {problemas.map((p) => <li key={p}>{mayuscula(p)}.</li>)}
      </ul>
      <p className="ml-6 mt-1.5 text-xs">Ejemplo: «{estructura.ejemplo}»</p>
    </div>
  )
}
