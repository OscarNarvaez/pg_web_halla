import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CLASIFICACIONES, ORDEN_INFORME, TONOS } from '../../lib/catalogos'

function Ayuda({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-tinta-100 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-2 font-semibold text-tinta-900">
        <span className="size-2.5 rounded-sm" style={{ background: d.color }} aria-hidden="true" />
        {d.etiqueta}
      </p>
      <p className="mt-0.5 text-tinta-700">
        {d.total} {d.total === 1 ? 'hallazgo' : 'hallazgos'}
        {d.porcentaje !== null && ` · ${d.porcentaje} %`}
      </p>
    </div>
  )
}

/**
 * Hallazgos por clasificación (una sola serie: la etiqueta del eje identifica cada columna y el
 * color semántico la refuerza). Incluye una tabla para lectores de pantalla.
 * @param {{ conteo: Record<string, number>, alto?: number, animar?: boolean }} props
 */
export function GraficaClasificaciones({ conteo, alto = 240, animar = true }) {
  const total = ORDEN_INFORME.reduce((s, c) => s + (conteo[c] ?? 0), 0)
  const datos = ORDEN_INFORME.map((c) => ({
    clave: c,
    etiqueta: CLASIFICACIONES[c].plural,
    corta: { NO_CONFORMIDAD: 'No conf.', OBSERVACION: 'Observ.', OPORTUNIDAD_DE_MEJORA: 'Op. mejora', FORTALEZA: 'Fortalezas' }[c],
    total: conteo[c] ?? 0,
    porcentaje: total ? Math.round(((conteo[c] ?? 0) / total) * 100) : null,
    color: TONOS[CLASIFICACIONES[c].tono].solido,
  }))

  return (
    <figure>
      <div style={{ height: alto }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 22, right: 8, bottom: 0, left: -18 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#e6eaee" strokeWidth={1} />
            <XAxis dataKey="corta" tickLine={false} axisLine={{ stroke: '#9fb0bf' }} tick={{ fill: '#4a6072', fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#4a6072', fontSize: 12 }} width={44} />
            <Tooltip content={<Ayuda />} cursor={{ fill: '#f4f6f8' }} />
            <Bar dataKey="total" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={animar}>
              {datos.map((d) => <Cell key={d.clave} fill={d.color} />)}
              <LabelList dataKey="total" position="top" fill="#2b3b49" fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Hallazgos por clasificación</caption>
        <thead>
          <tr><th scope="col">Clasificación</th><th scope="col">Hallazgos</th><th scope="col">Porcentaje</th></tr>
        </thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.clave}><th scope="row">{d.etiqueta}</th><td>{d.total}</td><td>{d.porcentaje ?? 0} %</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
