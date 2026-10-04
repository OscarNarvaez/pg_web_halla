import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react'
import { X } from 'lucide-react'
import { cx } from '../../lib/cx'

/**
 * Diálogo modal basado en `<dialog>` nativo: trae foco atrapado y cierre con Esc sin dependencias.
 * @param {object} props
 * @param {boolean} props.abierto
 * @param {() => void} props.alCerrar
 * @param {string} props.titulo
 * @param {import('react').ReactNode} [props.pie] Acciones al final del modal.
 * @param {'md'|'lg'|'xl'} [props.ancho='lg']
 * @param {string} [props.className]
 */
export const Modal = forwardRef(function Modal(
  { abierto, alCerrar, titulo, pie, ancho = 'lg', className, children },
  ref,
) {
  const dialogo = useRef(null)
  const idTitulo = useId()
  useImperativeHandle(ref, () => dialogo.current)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  const anchos = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => {
        // clic en el fondo (fuera de la caja) cierra el modal
        if (e.target === dialogo.current) alCerrar()
      }}
      className={cx(
        'w-[calc(100%-2rem)] rounded-lg border-0 bg-white p-0 text-tinta-900 shadow-xl backdrop:bg-tinta-900/50',
        anchos[ancho],
        className,
      )}
    >
      {abierto && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-tinta-100 px-5 py-4">
            <h2 id={idTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              className="rounded-md p-1 text-tinta-500 hover:bg-tinta-50 hover:text-tinta-900"
              aria-label="Cerrar"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {pie && <footer className="flex flex-wrap justify-end gap-2 border-t border-tinta-100 px-5 py-3">{pie}</footer>}
        </div>
      )}
    </dialog>
  )
})
