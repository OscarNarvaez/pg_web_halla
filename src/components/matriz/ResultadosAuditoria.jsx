import { useMemo, useRef, useState } from 'react'
import { CLASIFICACIONES, TONOS } from '../../lib/catalogos'
import { ORDEN_RESULTADOS, SIGLAS, resultadosAuditoria, tintaSobre } from '../../lib/resultados'
import { cx } from '../../lib/cx'

// Colores por clasificación: los de toda la aplicación (validados para daltonismo con el skill dataviz). Rojo y
// verde quedan juntos en el piso de separación para deuteranopía: por eso cada segmento lleva separación blanca,
// su número cuando cabe, la leyenda con cifras y el detalle en texto.
const color = (c) => TONOS[CLASIFICACIONES[c].tono].solido
const etiqueta = (c) => CLASIFICACIONES[c].etiqueta
const hallazgos = (n) => `${n} ${n === 1 ? 'hallazgo' : 'hallazgos'}`
const ROTULO = 'text-xs font-semibold uppercase tracking-wider text-tinta-500'

/** Globo de ayuda que sigue al puntero sobre un segmento (la leyenda y la tabla tienen las mismas cifras). */
function useAyuda() {
  const contenedor = useRef(null)
  const [ayuda, setAyuda] = useState(null)
  const mostrar = (texto) => (e) => {
    const r = contenedor.current?.getBoundingClientRect()
    if (r) setAyuda({ texto, x: e.clientX - r.left, y: e.clientY - r.top, ancho: r.width })
  }
  const globo = ayuda && (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 max-w-[14rem] -translate-y-full rounded-md border border-tinta-100 bg-white px-3 py-2 text-xs text-tinta-900 shadow-lg"
      style={{ left: Math.max(0, Math.min(ayuda.x - 8, ayuda.ancho - 160)), top: ayuda.y - 10 }}
    >
      {ayuda.texto}
    </div>
  )
  return { contenedor, globo, mostrar, ocultar: () => setAyuda(null) }
}

const punto = (radio, grados) => {
  const t = ((grados - 90) * Math.PI) / 180
  return [100 + radio * Math.cos(t), 100 + radio * Math.sin(t)]
}

/** Sector de anillo entre dos ángulos (en grados, desde las 12 en punto). */
function arco(desde, hasta, R = 92, r = 54) {
  const fin = hasta - desde >= 359.99 ? desde + 359.99 : hasta
  const grande = fin - desde > 180 ? 1 : 0
  const [p1, p2, p3, p4] = [punto(R, desde), punto(R, fin), punto(r, fin), punto(r, desde)]
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  return `M ${f(p1)} A ${R} ${R} 0 ${grande} 1 ${f(p2)} L ${f(p3)} A ${r} ${r} 0 ${grande} 0 ${f(p4)} Z`
}

/** Gráfico circular (anillo) con el total al centro y el número de cada clasificación sobre su segmento. */
function Dona({ datos, total }) {
  const { contenedor, globo, mostrar, ocultar } = useAyuda()
  // Cada segmento empieza donde terminó el anterior
  const segmentos = datos.filter((d) => d.n).reduce((acc, d) => {
    const desde = acc.at(-1)?.hasta ?? 0
    const barrido = (360 * d.n) / total
    return [...acc, { ...d, desde, hasta: desde + barrido, medio: desde + barrido / 2, barrido }]
  }, [])
  const descripcion = total
    ? `Gráfico circular: ${hallazgos(total)}. ${datos.map((d) => `${etiqueta(d.clasificacion)} ${d.n} (${d.porcentaje} %)`).join(', ')}.`
    : 'Gráfico circular sin hallazgos.'
  return (
    <div ref={contenedor} className="relative shrink-0" onMouseLeave={ocultar}>
      <svg viewBox="0 0 200 200" className="size-44" role="img" aria-label={descripcion}>
        <circle cx="100" cy="100" r="73" fill="none" stroke="#e6eaee" strokeWidth="38" />
        {segmentos.map((s) => {
          const [x, y] = punto(73, s.medio)
          return (
            <g key={s.clasificacion} onMouseMove={mostrar(`${etiqueta(s.clasificacion)}: ${hallazgos(s.n)} (${s.porcentaje} %)`)}>
              {/* El trazo del color de la superficie separa los segmentos (2 px) */}
              <path d={arco(s.desde, s.hasta)} fill={color(s.clasificacion)} stroke="#ffffff" strokeWidth={segmentos.length > 1 ? 2 : 0} strokeLinejoin="round" />
              {s.barrido >= 24 && (
                <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={tintaSobre(color(s.clasificacion))} aria-hidden="true">{s.n}</text>
              )}
            </g>
          )
        })}
        <text x="100" y="104" textAnchor="middle" fontSize="36" fontWeight="700" fill="#16222c" aria-hidden="true">{total}</text>
        <text x="100" y="124" textAnchor="middle" fontSize="12" fill="#4a6072" aria-hidden="true">{total === 1 ? 'hallazgo' : 'hallazgos'}</text>
      </svg>
      {globo}
    </div>
  )
}

function Leyenda({ compacta = false }) {
  return (
    <ul className={cx('flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-500', compacta && 'mb-1')} aria-label="Colores por clasificación">
      {ORDEN_RESULTADOS.map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color(c) }} aria-hidden="true" />{etiqueta(c)}
        </li>
      ))}
    </ul>
  )
}

/** Una norma: su nombre, el total y una barra apilada por clasificación, proporcional a la norma con más hallazgos. */
function BarraNorma({ fila, maximo, mostrar }) {
  const presentes = ORDEN_RESULTADOS.filter((c) => fila.conteo[c])
  const largo = maximo ? (100 * fila.total) / maximo : 0
  return (
    <li className="space-y-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0 font-semibold text-tinta-900 [overflow-wrap:anywhere]">{fila.norma}</span>
        <span className="font-bold tabular-nums text-tinta-900">{fila.total}</span>
      </div>
      <div className="h-[22px] rounded bg-tinta-50">
        {/* Extremo de datos redondeado (4 px), recto en la línea base; 2 px de superficie entre segmentos */}
        <div className="flex h-full gap-[2px] overflow-hidden rounded-r" style={{ width: `${largo}%` }}>
          {presentes.map((c) => {
            const ancho = (100 * fila.conteo[c]) / fila.total
            return (
              <div
                key={c}
                className="flex h-full items-center justify-center text-xs font-bold"
                style={{ flexGrow: fila.conteo[c], flexBasis: 0, background: color(c), color: tintaSobre(color(c)) }}
                onMouseMove={mostrar(`${fila.norma} · ${etiqueta(c)}: ${hallazgos(fila.conteo[c])}`)}
              >
                {/* El número solo va dentro si el segmento tiene espacio (si no, lo dicen la leyenda y el detalle) */}
                {ancho * (largo / 100) >= 8 && <span aria-hidden="true">{fila.conteo[c]}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-tinta-500">{presentes.map((c) => `${etiqueta(c)}: ${fila.conteo[c]}`).join(' · ')}</p>
    </li>
  )
}

/**
 * «Resultados de la auditoría» (consolidado, debajo de la matriz): hallazgos por clasificación en un anillo con su
 * leyenda y siglas, y su distribución por norma o documento en barras apiladas. Incluye tablas para lectores de pantalla.
 * @param {{ hallazgos: object[] }} props hallazgos de la auditoría (los descartados no cuentan)
 */
export function ResultadosAuditoria({ hallazgos: lista }) {
  const r = useMemo(() => resultadosAuditoria(lista), [lista])
  const { contenedor, globo, mostrar, ocultar } = useAyuda()
  return (
    <section aria-labelledby="titulo-resultados" className="mt-8 space-y-5 rounded-lg border border-tinta-100 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-halla-700">Consolidado</p>
        <h2 id="titulo-resultados" className="font-serif text-2xl font-semibold text-tinta-900">Resultados de la auditoría</h2>
      </div>
      {!r.total && (
        <p className="rounded-md border border-om-borde bg-om-bg px-4 py-3 text-sm text-om-texto">
          Aún no hay hallazgos registrados. Analice un hallazgo y regístrelo en la matriz para ver los gráficos.
        </p>
      )}

      <div className="flex flex-wrap gap-8">
        <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-4">
          <h3 className={ROTULO}>Hallazgos por clasificación</h3>
          <div className="flex flex-wrap items-center gap-5">
            <Dona datos={r.porClasificacion} total={r.total} />
            <ul className="flex min-w-[11rem] flex-1 flex-col gap-3" aria-label="Hallazgos por clasificación">
              {r.porClasificacion.map((d) => (
                <li key={d.clasificacion} className="flex items-center gap-2.5 text-sm text-tinta-900">
                  <span className="size-3.5 shrink-0 rounded-[3px]" style={{ background: color(d.clasificacion) }} aria-hidden="true" />
                  <span className="flex-1">{etiqueta(d.clasificacion)}</span>
                  <strong className="tabular-nums">{d.n}</strong>
                  <span className="w-12 text-right text-xs tabular-nums text-tinta-500">{d.porcentaje} %</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Resumen por sigla">
            {r.porClasificacion.map((d) => (
              <li key={d.clasificacion} className={cx('rounded-full border px-3 py-1 text-sm font-semibold', TONOS[CLASIFICACIONES[d.clasificacion].tono].badge)}>
                <abbr title={etiqueta(d.clasificacion)} className="no-underline">{SIGLAS[d.clasificacion]}</abbr>: {d.n}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3">
          <h3 className={ROTULO}>Distribución de hallazgos por norma o documento</h3>
          <Leyenda compacta />
          {r.normas.length > 0 && (
            <div ref={contenedor} className="relative" onMouseLeave={ocultar}>
              <ul className="space-y-4" aria-hidden="true">
                {r.normas.map((f) => <BarraNorma key={f.norma} fila={f} maximo={r.maximo} mostrar={mostrar} />)}
              </ul>
              {globo}
              <p className="mt-3 text-xs text-tinta-500">Un hallazgo que cita varias normas cuenta en cada una.</p>
              <div className="sr-only">
                <table>
                  <caption>Distribución de hallazgos por norma o documento</caption>
                  <thead>
                    <tr><th scope="col">Norma o documento</th>{ORDEN_RESULTADOS.map((c) => <th key={c} scope="col">{etiqueta(c)}</th>)}<th scope="col">Total</th></tr>
                  </thead>
                  <tbody>
                    {r.normas.map((f) => (
                      <tr key={f.norma}><th scope="row">{f.norma}</th>{ORDEN_RESULTADOS.map((c) => <td key={c}>{f.conteo[c]}</td>)}<td>{f.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
