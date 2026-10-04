import { Check } from 'lucide-react'
import { cx } from '../../../lib/cx'
import { PASOS } from './pasos'

/**
 * Indicador de los 7 pasos. Los pasos 2 a 7 se habilitan cuando la IA termina el análisis.
 * @param {object} props
 * @param {number} props.actual
 * @param {number} props.hasta Último paso al que se puede ir.
 * @param {(n: number) => void} props.alIr
 */
export function IndicadorPasos({ actual, hasta, alIr }) {
  return (
    <nav aria-label="Pasos del registro del hallazgo" className="mb-6">
      <ol className="grid grid-cols-7 gap-1 sm:gap-2">
        {PASOS.map((p) => {
          const hecho = p.n < actual
          const esActual = p.n === actual
          const habilitado = p.n <= hasta && !esActual
          return (
            <li key={p.n} className="min-w-0">
              <button
                type="button"
                onClick={() => alIr(p.n)}
                disabled={!habilitado}
                aria-current={esActual ? 'step' : undefined}
                aria-label={`Paso ${p.n}: ${p.titulo}${hecho ? ' (revisado)' : ''}`}
                className="group flex w-full flex-col items-center gap-1 rounded-md py-1 text-center disabled:cursor-default"
              >
                <span
                  className={cx(
                    'grid size-8 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums transition-colors',
                    esActual && 'border-halla-700 bg-halla-700 text-white',
                    hecho && 'border-halla-700 bg-white text-halla-700 group-enabled:group-hover:bg-halla-50',
                    !esActual && !hecho && 'border-tinta-300 bg-white text-tinta-500',
                  )}
                >
                  {hecho ? <Check className="size-4" aria-hidden="true" /> : p.n}
                </span>
                <span className={cx('hidden w-full truncate text-xs md:block', esActual ? 'font-semibold text-tinta-900' : 'text-tinta-500')}>{p.titulo}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-sm text-tinta-700 md:hidden">
        <span className="font-semibold">Paso {actual} de 7 · {PASOS[actual - 1].titulo}.</span>
      </p>
    </nav>
  )
}
