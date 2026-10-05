import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cx } from '../../lib/cx'
import { claseControl } from '../ui/Campo'

/**
 * Texto que se edita en el sitio: clic (o Enter) para editar, Guardar o Cancelar.
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} props.valor
 * @param {(nuevo: string) => void} props.alGuardar
 * @param {boolean} [props.deshabilitado]
 * @param {boolean} [props.destacado] Texto principal, en tipografía de lectura.
 * @param {number} [props.minimo] Mínimo de caracteres para aceptar el cambio.
 * @param {number} [props.maximo] Máximo de caracteres.
 * @param {string} [props.marcador] Texto que se muestra cuando el campo está vacío.
 * @param {boolean} [props.cambioExtra] Hay algo más por aplicar (p. ej. un PDF): «Aplicar» guarda aunque el texto no cambie.
 * @param {() => void} [props.alCancelar]
 * El `ref` expone `agregar(texto)` (abre la edición con el texto añadido al final) y `quitar(texto)`.
 */
export const CampoEditable = forwardRef(function CampoEditable(
  { etiqueta, valor, alGuardar, deshabilitado = false, destacado = false, minimo = 1, maximo, marcador = 'Sin definir', cambioExtra = false, alCancelar },
  ref,
) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(valor ?? '')
  const [alFinal, setAlFinal] = useState(0) // tras agregar texto, el cursor va al final y se ve lo agregado
  const area = useRef(null)
  const id = useId()

  useEffect(() => {
    const a = area.current
    if (!alFinal || !a) return
    a.focus()
    a.setSelectionRange(a.value.length, a.value.length)
    a.scrollTop = a.scrollHeight
    a.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [alFinal])

  useImperativeHandle(ref, () => ({
    agregar(texto) {
      const extra = String(texto ?? '').trim()
      const base = (editando ? borrador : valor ?? '').trim()
      setBorrador(extra ? (base ? `${base}\n\n${extra}` : extra) : base)
      setEditando(true)
      setAlFinal((n) => n + 1)
    },
    quitar(texto) {
      const extra = String(texto ?? '').trim()
      if (extra) setBorrador((b) => b.replace(extra, '').replace(/\n{3,}/g, '\n\n').trim())
    },
  }), [editando, borrador, valor])

  const empezar = () => {
    setBorrador(valor ?? '')
    setEditando(true)
  }
  useEffect(() => {
    if (editando) area.current?.focus()
  }, [editando])

  const guardar = () => {
    const limpio = borrador.trim()
    if (limpio.length < minimo) return
    if (limpio !== valor || cambioExtra) alGuardar(limpio)
    setEditando(false)
  }
  const cancelar = () => {
    setEditando(false)
    alCancelar?.()
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span id={`${id}-etiqueta`} className="text-xs font-semibold uppercase tracking-wide text-tinta-500">
          {etiqueta}
        </span>
      </div>
      {editando ? (
        <div>
          <textarea
            ref={area}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault() // dentro de un modal, Esc cancela la edición sin cerrar el modal
                cancelar()
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar()
            }}
            rows={Math.min(12, Math.max(3, Math.ceil(borrador.length / 80)))}
            aria-labelledby={`${id}-etiqueta`}
            maxLength={maximo}
            className={cx(claseControl, 'text-sm leading-relaxed')}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={guardar} disabled={borrador.trim().length < minimo}
              className="inline-flex min-h-9 items-center gap-1 rounded-md bg-halla-700 px-3 text-sm font-semibold text-white hover:bg-halla-600 disabled:bg-tinta-300">
              <Check className="size-4" aria-hidden="true" /> Aplicar
            </button>
            <button type="button" onClick={cancelar}
              className="inline-flex min-h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-tinta-700 hover:bg-tinta-50">
              <X className="size-4" aria-hidden="true" /> Cancelar
            </button>
            <span className="text-xs text-tinta-500">Ctrl + Enter para aplicar · Esc para cancelar</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={empezar}
          aria-label={`${etiqueta}: ${valor || marcador}. Editar`}
          className={cx(
            'group relative block w-full rounded-md border border-transparent px-2 py-1.5 -mx-2 text-left transition-colors',
            !deshabilitado && 'hover:border-tinta-100 hover:bg-tinta-50',
            destacado ? 'font-serif text-[15px] leading-relaxed text-tinta-900' : 'text-sm leading-relaxed text-tinta-700',
          )}
        >
          <span className={cx('block whitespace-pre-wrap pr-6', !valor && 'italic text-tinta-500')}>{valor || marcador}</span>
          {!deshabilitado && (
            <Pencil className="absolute right-2 top-2 size-3.5 text-tinta-300 group-hover:text-halla-600" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
})
