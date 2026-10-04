import { useId } from 'react'
import { Sparkles } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * Escala de 1 a 5 con botones (aria-pressed), como en el PR13_GQ. Debajo muestra la descripción del valor elegido.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {number | null} props.valor
 * @param {{ valor: number, etiqueta: string, descripcion: string }[]} props.opciones
 * @param {(valor: number) => void} props.alCambiar
 * @param {number | null} [props.propuesto] Valor que propuso la IA (se señala).
 * @param {boolean} [props.deshabilitado]
 */
export function SelectorEscala({ etiqueta, valor, opciones, alCambiar, propuesto = null, deshabilitado = false }) {
  const id = useId()
  const elegida = opciones.find((o) => o.valor === valor)
  return (
    <div role="group" aria-labelledby={`${id}-etiqueta`}>
      <p id={`${id}-etiqueta`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-500">{etiqueta}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {opciones.map((o) => {
          const activo = o.valor === valor
          return (
            <button
              key={o.valor}
              type="button"
              disabled={deshabilitado}
              aria-pressed={activo}
              aria-describedby={activo ? `${id}-descripcion` : undefined}
              onClick={() => alCambiar(o.valor)}
              title={o.descripcion}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center rounded-md border px-1 py-1.5 text-center transition-colors disabled:cursor-not-allowed',
                activo ? 'border-tinta-900 bg-tinta-900 text-white' : 'border-tinta-300 bg-white text-tinta-900 hover:border-tinta-500',
              )}
            >
              <span className="text-base font-bold tabular-nums leading-none">{o.valor}</span>
              <span className={cx('mt-1 text-[10px] leading-tight sm:text-[11px]', activo ? 'text-tinta-100' : 'text-tinta-500')}>{o.etiqueta}</span>
            </button>
          )
        })}
      </div>
      <p id={`${id}-descripcion`} className="mt-2 min-h-10 text-xs leading-relaxed text-tinta-700">
        {elegida ? (
          <>
            <span className="font-semibold">{elegida.valor} · {elegida.etiqueta}:</span> {elegida.descripcion}
            {propuesto === elegida.valor && (
              <span className="ml-1 inline-flex items-center gap-1 text-halla-700"><Sparkles className="size-3" aria-hidden="true" />propuesto por la IA</span>
            )}
          </>
        ) : (
          <span className="italic text-tinta-500">Sin definir: elige un valor de la escala.</span>
        )}
      </p>
    </div>
  )
}
