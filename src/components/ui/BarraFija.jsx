import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { cx } from '../../lib/cx'

// Separación entre la barra y el borde inferior de la pantalla (bottom-3)
const SEPARACION = 12

/**
 * Barra de acciones pegada al borde inferior de la pantalla mientras se recorre la página.
 * Publica su alto en la variable CSS `--alto-barra-fija` para que los avisos se muestren encima y no tapen sus botones.
 * @param {object} props
 * @param {'div'|'section'} [props.como='div']
 * @param {string} [props.className]
 */
export const BarraFija = forwardRef(function BarraFija({ como: Etiqueta = 'div', className, children, ...resto }, ref) {
  const barra = useRef(null)
  useImperativeHandle(ref, () => barra.current)

  useEffect(() => {
    const el = barra.current
    const raiz = document.documentElement
    const publicar = () => raiz.style.setProperty('--alto-barra-fija', `${el.offsetHeight + SEPARACION}px`)
    publicar()
    const observador = new ResizeObserver(publicar)
    observador.observe(el)
    return () => {
      observador.disconnect()
      raiz.style.removeProperty('--alto-barra-fija')
    }
  }, [])

  return (
    <Etiqueta
      ref={barra}
      className={cx('no-imprimir sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-tinta-100 bg-white p-3 shadow-lg', className)}
      {...resto}
    >
      {children}
    </Etiqueta>
  )
})
