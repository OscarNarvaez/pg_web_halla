import { COLORES_ZONA, evaluarRiesgo } from '../../lib/riesgo'

/** Nivel del riesgo calculado por la aplicación (probabilidad × impacto con los umbrales), con su tratamiento. */
export function NivelRiesgo({ hallazgo, umbrales }) {
  const e = evaluarRiesgo(hallazgo, umbrales)
  const color = e ? COLORES_ZONA[e.zona] : null
  return (
    <div className="space-y-2" aria-live="polite">
      <div
        className="rounded-lg border px-4 py-3"
        style={color ? { backgroundColor: color.fondo, borderColor: color.borde, color: color.texto } : undefined}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Nivel de riesgo</p>
        <p className="text-2xl font-semibold">{e ? `${e.etiqueta} (${e.puntaje})` : 'Sin evaluar'}</p>
      </div>
      <p className="text-xs text-tinta-500">
        Riesgo inherente = probabilidad × impacto (PR13_GQ):{' '}
        <span className="font-semibold tabular-nums text-tinta-700">{e ? `${e.probabilidad} × ${e.impacto} = ${e.puntaje}` : '—'}</span>
      </p>
      {e && <p className="text-sm text-tinta-700"><span className="font-semibold">Tratamiento:</span> {e.tratamiento}.</p>}
    </div>
  )
}
