import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cx } from '../../lib/cx'
import { claseControl } from './Campo'

const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Selección de una o varias opciones de una lista cerrada (por ejemplo, cargos). Un botón despliega la lista
 * con un buscador y casillas nativas (accesibles con teclado sin código extra); lo elegido se muestra debajo
 * como etiquetas que se pueden quitar. Se integra con react-hook-form mediante `Controller`.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string[]} props.opciones
 * @param {string[]} props.valor Opciones elegidas.
 * @param {(valor: string[]) => void} props.alCambiar
 * @param {() => void} [props.alSalir] Se llama al cerrar la lista (marca el campo como tocado).
 * @param {number} [props.maximo]
 * @param {string} [props.marcador] Texto del botón cuando no hay nada elegido.
 * @param {string} [props.nombreOpcion='opción'] Para el buscador y los anuncios («cargo»).
 * @param {string} [props.ayuda]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export const SelectorMultiple = forwardRef(function SelectorMultiple(
  {
    etiqueta, opciones, valor = [], alCambiar, alSalir, maximo, marcador = 'Elige una o varias opciones', nombreOpcion = 'opción',
    ayuda, error, required, disabled = false, className, id: idExterno,
  },
  ref,
) {
  const idGenerado = useId()
  const id = idExterno ?? idGenerado
  const [abierto, setAbierto] = useState(false)
  const [filtro, setFiltro] = useState('')
  const contenedor = useRef(null)
  const boton = useRef(null)
  const buscador = useRef(null)
  // react-hook-form enfoca el botón cuando el campo tiene un error
  useImperativeHandle(ref, () => boton.current)

  const elegidos = Array.isArray(valor) ? valor : []
  const lleno = Boolean(maximo) && elegidos.length >= maximo
  const filtradas = opciones.filter((o) => sinTildes(o).includes(sinTildes(filtro.trim())))
  const idPanel = `${id}-panel`
  const idEtiqueta = `${id}-etiqueta`
  const idResumen = `${id}-resumen`
  const idAyuda = ayuda ? `${id}-ayuda` : null
  const idError = error ? `${id}-error` : null
  const resumen = elegidos.length === 0 ? marcador : `${elegidos.length} ${elegidos.length === 1 ? 'elegido' : 'elegidos'}`

  const cerrar = ({ enfocar = false } = {}) => {
    setAbierto(false)
    setFiltro('')
    alSalir?.()
    if (enfocar) boton.current?.focus()
  }

  // Clic fuera de la lista: se cierra
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => {
      if (!contenedor.current?.contains(e.target)) {
        setAbierto(false)
        setFiltro('')
        alSalir?.()
      }
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto, alSalir])

  useEffect(() => {
    if (abierto) buscador.current?.focus()
  }, [abierto])

  const alternar = (opcion) => {
    if (elegidos.includes(opcion)) alCambiar(elegidos.filter((x) => x !== opcion))
    else if (!lleno) alCambiar([...elegidos, opcion])
  }

  return (
    <div
      ref={contenedor}
      className={cx('space-y-1.5', className)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && abierto) {
          e.stopPropagation()
          cerrar({ enfocar: true })
        }
      }}
    >
      <label id={idEtiqueta} htmlFor={id} className="block text-sm font-medium text-tinta-700">
        {etiqueta}
        {required && <span className="text-nc-texto" aria-hidden="true"> *</span>}
      </label>
      <button
        ref={boton}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-expanded={abierto}
        aria-controls={idPanel}
        aria-labelledby={`${idEtiqueta} ${idResumen}`}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cx(claseControl, 'flex min-h-11 items-center justify-between gap-2 border px-3 py-2 text-left text-sm', error && 'border-nc-borde')}
      >
        <span id={idResumen} className={elegidos.length ? 'text-tinta-900' : 'text-tinta-500'}>{resumen}</span>
        <ChevronDown className={cx('size-4 shrink-0 text-tinta-500 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
      </button>

      {abierto && (
        <div id={idPanel} className="rounded-lg border border-tinta-100 bg-white p-2 shadow-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-300" aria-hidden="true" />
            <input
              ref={buscador}
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label={`Buscar ${nombreOpcion}`}
              placeholder={`Buscar ${nombreOpcion}…`}
              className={cx(claseControl, 'pl-9 text-sm')}
            />
          </div>
          <fieldset className="mt-2">
            <legend className="sr-only">{etiqueta}</legend>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
              {filtradas.map((opcion) => {
                const marcado = elegidos.includes(opcion)
                return (
                  <li key={opcion}>
                    <label
                      className={cx(
                        'flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm',
                        marcado ? 'bg-halla-50 text-tinta-900' : 'text-tinta-700 hover:bg-tinta-50',
                        !marcado && lleno && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={!marcado && lleno}
                        onChange={() => alternar(opcion)}
                        className="mt-0.5 size-4 shrink-0 rounded border-tinta-300 text-halla-700 focus:ring-halla-500"
                      />
                      {opcion}
                    </label>
                  </li>
                )
              })}
              {filtradas.length === 0 && <li className="px-2 py-1.5 text-sm text-tinta-500">Ningún {nombreOpcion} coincide con «{filtro.trim()}».</li>}
            </ul>
          </fieldset>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-tinta-100 pt-2">
            <p className="text-xs text-tinta-500" aria-live="polite">
              {lleno ? `Máximo ${maximo}: quita uno para elegir otro.` : maximo ? `Puedes elegir hasta ${maximo}.` : ''}
            </p>
            <button type="button" onClick={() => cerrar({ enfocar: true })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-halla-700 hover:bg-halla-50">
              <Check className="size-4" aria-hidden="true" /> Listo
            </button>
          </div>
        </div>
      )}

      {elegidos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${etiqueta}: elegidos`}>
          {elegidos.map((opcion) => (
            <li key={opcion} className="inline-flex items-center gap-1 rounded-full border border-halla-100 bg-halla-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-halla-700">
              {opcion}
              <button
                type="button"
                disabled={disabled}
                onClick={() => alCambiar(elegidos.filter((x) => x !== opcion))}
                aria-label={`Quitar ${opcion}`}
                className="rounded-full p-0.5 hover:bg-halla-100"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {ayuda && <p id={idAyuda} className="text-xs text-tinta-500">{ayuda}</p>}
      {error && <p id={idError} className="text-sm font-medium text-nc-texto" role="alert">{error}</p>}
    </div>
  )
})
