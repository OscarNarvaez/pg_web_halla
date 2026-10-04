import { useId } from 'react'
import { ESCALA_PROBABILIDAD, NIVELES_IMPACTO, ZONAS_RIESGO } from '../../lib/catalogos'
import { COLORES_ZONA, ORDEN_ZONAS, zonaDe } from '../../lib/riesgo'
import { cx } from '../../lib/cx'

const VALORES = [1, 2, 3, 4, 5]

/**
 * Mapa de calor 5 × 5 del PR13_GQ (probabilidad × impacto). Es una tabla real: se lee con lector de pantalla y
 * cada casilla dice su puntaje y su nivel en texto, así que el color nunca es la única señal.
 * @param {object} props
 * @param {{ bajo: number, moderado: number, alto: number }} props.umbrales
 * @param {Record<string, number>} [props.conteo] Hallazgos por casilla ('p-i' → n).
 * @param {{ probabilidad: number, impacto: number } | null} [props.actual] Casilla del hallazgo que se edita.
 * @param {(probabilidad: number, impacto: number) => void} [props.alElegir] Si se pasa, cada casilla es un botón.
 * @param {string} [props.titulo]
 * @param {boolean} [props.deshabilitado]
 * @param {boolean} [props.compacto] Para columnas angostas: cada casilla muestra la inicial del nivel (la leyenda la explica).
 */
export function MapaCalor({ umbrales, conteo = {}, actual = null, alElegir, titulo = 'Mapa de calor 5 × 5', deshabilitado = false, compacto = false }) {
  const idTitulo = useId()
  const rangos = {
    BAJA: `1–${umbrales.bajo}`,
    MODERADA: `${umbrales.bajo + 1}–${umbrales.moderado}`,
    ALTA: `${umbrales.moderado + 1}–${umbrales.alto}`,
    EXTREMA: `${umbrales.alto + 1}–25`,
  }

  return (
    <figure aria-labelledby={idTitulo}>
      <figcaption id={idTitulo} className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-500">{titulo}</figcaption>
      <div className="flex gap-1.5">
        <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-tinta-500 [writing-mode:vertical-rl] rotate-180">
          Impacto
        </span>
        <table className="w-full table-fixed border-separate border-spacing-1">
          <caption className="sr-only">
            Filas: impacto de 5 (catastrófico) a 1 (insignificante). Columnas: probabilidad de 1 (raro) a 5 (casi seguro). Cada casilla indica el puntaje (probabilidad × impacto), el nivel y los hallazgos que tiene.
          </caption>
          <tbody>
            {[...VALORES].reverse().map((impacto) => (
              <tr key={impacto}>
                <th scope="row" className="w-6 text-right text-xs font-semibold tabular-nums text-tinta-500" title={NIVELES_IMPACTO[impacto - 1]}>
                  {impacto}
                  <span className="sr-only"> ({NIVELES_IMPACTO[impacto - 1]})</span>
                </th>
                {VALORES.map((probabilidad) => {
                  const puntaje = probabilidad * impacto
                  const zona = zonaDe(puntaje, umbrales)
                  const color = COLORES_ZONA[zona]
                  const n = conteo[`${probabilidad}-${impacto}`] ?? 0
                  const esActual = actual?.probabilidad === probabilidad && actual?.impacto === impacto
                  const descripcion = `Probabilidad ${probabilidad} (${ESCALA_PROBABILIDAD[probabilidad - 1].categoria}) × impacto ${impacto} (${NIVELES_IMPACTO[impacto - 1]}) = ${puntaje}, nivel ${ZONAS_RIESGO[zona].etiqueta}${n ? `, ${n} hallazgo${n === 1 ? '' : 's'}` : ''}${esActual ? ', este hallazgo' : ''}`
                  const contenido = (
                    <>
                      <span className="block text-sm font-bold tabular-nums leading-none">{puntaje}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold leading-none sm:text-[11px]">
                        <span className={compacto ? undefined : 'sm:hidden'}>{ZONAS_RIESGO[zona].etiqueta.charAt(0)}</span>
                        {!compacto && <span className="hidden sm:inline">{ZONAS_RIESGO[zona].etiqueta}</span>}
                      </span>
                      {n > 0 && (
                        <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-tinta-900 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-white">
                          {n}
                        </span>
                      )}
                    </>
                  )
                  const clase = cx(
                    'relative flex h-12 w-full flex-col items-center justify-center rounded-md border text-center sm:h-14',
                    esActual && 'outline outline-[3px] outline-offset-1 outline-tinta-900',
                  )
                  const estilo = { backgroundColor: color.fondo, borderColor: color.borde, color: color.texto }
                  return (
                    <td key={probabilidad} className="p-0">
                      {alElegir ? (
                        <button
                          type="button"
                          onClick={() => alElegir(probabilidad, impacto)}
                          disabled={deshabilitado}
                          aria-pressed={esActual}
                          aria-label={descripcion}
                          title={descripcion}
                          className={cx(clase, 'transition-transform hover:scale-[1.04] disabled:cursor-not-allowed disabled:hover:scale-100')}
                          style={estilo}
                        >
                          {contenido}
                        </button>
                      ) : (
                        <div className={clase} style={estilo} title={descripcion}>
                          {contenido}
                          <span className="sr-only">{descripcion}</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td />
              {VALORES.map((probabilidad) => (
                <th key={probabilidad} scope="col" className="pt-1 text-xs font-semibold tabular-nums text-tinta-500" title={ESCALA_PROBABILIDAD[probabilidad - 1].categoria}>
                  {probabilidad}
                  <span className="sr-only"> ({ESCALA_PROBABILIDAD[probabilidad - 1].categoria})</span>
                </th>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p aria-hidden="true" className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-tinta-500">Probabilidad →</p>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Niveles de riesgo">
        {ORDEN_ZONAS.map((z) => (
          <li key={z} className="inline-flex items-center gap-1.5 text-xs text-tinta-700">
            <span aria-hidden="true" className="size-3.5 rounded-sm border" style={{ backgroundColor: COLORES_ZONA[z].fondo, borderColor: COLORES_ZONA[z].borde }} />
            <span className="font-semibold">{compacto && `${ZONAS_RIESGO[z].etiqueta.charAt(0)} · `}{ZONAS_RIESGO[z].etiqueta}</span>
            <span className="tabular-nums text-tinta-500">{rangos[z]}</span>
          </li>
        ))}
      </ul>
      {Object.keys(conteo).length > 0 && (
        <p className="mt-2 text-xs text-tinta-500">El círculo oscuro indica cuántos hallazgos de la auditoría están en esa casilla.</p>
      )}
    </figure>
  )
}
