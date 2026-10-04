import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { MARCADOR_PENDIENTE } from '../../../lib/catalogos'
import { COLORES_ZONA, controlesAdoptados, evaluarRiesgo, faltantesParaValidar, requiereRiesgo } from '../../../lib/riesgo'
import { extracto } from '../../../lib/formato'
import { BadgeClasificacion } from '../BadgeClasificacion'

/**
 * Paso 7: resumen de lo que se envía a la matriz consolidada. Los hallazgos llegan como «Pendiente»: el
 * auditor los valida en la matriz, y solo con todos validados se puede descargar.
 */
export function PasoEnviar({ hallazgos, umbrales, alCorregir }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-700">
        Se enviarán {hallazgos.length === 1 ? 'el hallazgo' : `los ${hallazgos.length} hallazgos`} a la matriz consolidada en estado <strong>Pendiente</strong>.
        Allí podrás marcarlos como <strong>Validado</strong> o <strong>Se sugiere hacer cambios</strong>; la matriz solo se descarga cuando todos estén validados.
      </p>
      <ul className="space-y-3">
        {hallazgos.map((h, i) => {
          const e = evaluarRiesgo(h, umbrales)
          const faltan = faltantesParaValidar(h)
          return (
            <li key={h.id ?? i} className="rounded-lg border border-tinta-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-tinta-500">{h.consecutivo ? `H-${String(h.consecutivo).padStart(2, '0')}` : `Situación ${i + 1}`}</span>
                <BadgeClasificacion clasificacion={h.clasificacion} />
                {requiereRiesgo(h) && e && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: COLORES_ZONA[e.zona].fondo, borderColor: COLORES_ZONA[e.zona].borde, color: COLORES_ZONA[e.zona].texto }}>
                    Riesgo {e.etiqueta} ({e.puntaje})
                  </span>
                )}
              </div>
              <p className="mt-2 font-serif text-[15px] leading-relaxed text-tinta-900">{extracto(h.hallazgo_corregido, 240)}</p>
              <dl className="mt-2 grid gap-1 text-xs text-tinta-500 sm:grid-cols-[8rem_1fr]">
                <dt className="font-semibold">Requisito</dt>
                <dd>{h.criterio_requisito === MARCADOR_PENDIENTE ? <span className="italic">pendiente de identificación</span> : extracto(h.criterio_requisito, 160)}</dd>
                {requiereRiesgo(h) && (
                  <>
                    <dt className="font-semibold">Controles</dt>
                    <dd>{controlesAdoptados(h).length} adoptado{controlesAdoptados(h).length === 1 ? '' : 's'}</dd>
                  </>
                )}
              </dl>
              {faltan.length > 0 ? (
                <p className="mt-3 flex gap-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Para validarlo en la matriz falta {faltan.join(', ')}.{' '}
                    <button type="button" className="font-semibold underline" onClick={() => alCorregir(i, faltan.some((f) => f.includes('control')) && faltan.length === 1 ? 6 : 5)}>
                      Completar ahora
                    </button>
                  </span>
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm text-fort-texto">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> Completo: listo para validar en la matriz.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
