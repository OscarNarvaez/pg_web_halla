import { useId, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { ErrorPdf, MAX_MB_PDF, leerPdf, textoDeRango } from '../../../lib/pdf-evidencia'
import { Boton } from '../../ui/Boton'
import { DocumentoAdjunto } from '../DocumentoAdjunto'

/**
 * Carga de un PDF de evidencia. El archivo se lee en el navegador y no se sube: solo su texto pasa al cuadro
 * de evidencia (editable) y su huella SHA-256 queda en el hallazgo. Si es escaneado, se pide describirlo.
 * @param {object} props
 * @param {(r: { texto: string, archivo: { nombre: string, paginas: number, sha256: string } } | null) => void} props.alImportar
 * @param {{ nombre: string, paginas: number } | null} props.archivo PDF adjunto actualmente.
 * @param {number} props.maximo Máximo de caracteres de la evidencia.
 * @param {boolean} [props.deshabilitado]
 * @param {'analisis'|'edicion'} [props.momento='analisis'] Antes del análisis (paso 1) o al editar la evidencia de un hallazgo.
 * @param {boolean} [props.permitirQuitar] Quitar el PDF aunque ya no se pueda cargar otro (p. ej. después del análisis).
 * @param {string} [props.detalle] Texto junto al PDF adjunto (p. ej. «analizado con la IA»).
 */
export function CargarPdf({ alImportar, archivo, maximo, deshabilitado = false, momento = 'analisis', permitirQuitar = !deshabilitado, detalle }) {
  const enEdicion = momento === 'edicion'
  const entrada = useRef(null)
  const id = useId()
  const [estado, setEstado] = useState({ fase: 'inactivo', pdf: null, mensaje: '' })
  const [rango, setRango] = useState({ desde: 1, hasta: 1 })

  const elegir = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    setEstado({ fase: 'leyendo', pdf: null, mensaje: '' })
    try {
      const pdf = await leerPdf(file)
      const meta = { nombre: pdf.nombre, paginas: pdf.paginas, sha256: pdf.sha256 }
      if (pdf.escaneado) {
        alImportar({ texto: '', archivo: meta })
        setEstado({ fase: 'escaneado', pdf, mensaje: '' })
        return
      }
      const todo = textoDeRango(pdf.textos, 1, pdf.paginas)
      if (todo.length <= maximo) {
        alImportar({ texto: todo, archivo: meta })
        setEstado({ fase: 'importado', pdf, mensaje: '' })
        return
      }
      // Demasiado largo para un análisis: el auditor elige qué páginas importar
      let hasta = 1
      while (hasta < pdf.paginas && textoDeRango(pdf.textos, 1, hasta + 1).length <= maximo) hasta++
      setRango({ desde: 1, hasta })
      setEstado({ fase: 'rango', pdf, mensaje: '' })
    } catch (err) {
      if (!(err instanceof ErrorPdf)) console.error('Lectura del PDF:', err)
      setEstado({ fase: 'error', pdf: null, mensaje: err instanceof ErrorPdf ? err.message : 'No se pudo leer el PDF.' })
    }
  }

  const reiniciar = () => setEstado({ fase: 'inactivo', pdf: null, mensaje: '' })
  const pdf = estado.pdf
  const seleccion = pdf && estado.fase === 'rango' ? textoDeRango(pdf.textos, rango.desde, rango.hasta) : ''
  const paginas = pdf ? Array.from({ length: pdf.paginas }, (_, i) => i + 1) : []

  return (
    <div className="space-y-2">
      <input ref={entrada} id={id} type="file" accept="application/pdf,.pdf" onChange={elegir} className="sr-only" disabled={deshabilitado} tabIndex={-1} aria-hidden="true" />
      {archivo ? (
        <DocumentoAdjunto
          nombre={archivo.nombre}
          paginas={archivo.paginas}
          sha256={archivo.sha256}
          detalle={detalle}
          alQuitar={permitirQuitar ? () => { alImportar(null); reiniciar() } : undefined}
        />
      ) : (
        <Boton
          variante="secundario"
          icono={Upload}
          cargando={estado.fase === 'leyendo'}
          onClick={() => entrada.current?.click()}
          disabled={deshabilitado}
          tamano={enEdicion ? 'sm' : 'md'}
          className={enEdicion ? 'border-dashed' : 'w-full border-dashed'}
        >
          {estado.fase === 'leyendo' ? 'Leyendo el PDF…' : 'Cargar un PDF de evidencia'}
        </Boton>
      )}
      <p className="text-xs text-tinta-500">
        Cargue un PDF de evidencia (máximo {MAX_MB_PDF} MB). Si contiene texto legible se extrae; si es escaneado, describa su contenido.
        El archivo no sale de tu computador: se lee aquí y {enEdicion ? 'solo su texto pasa a la evidencia.' : 'solo su texto se analiza.'}
      </p>

      <div aria-live="polite">
        {estado.fase === 'importado' && (
          <p className="rounded-md border border-fort-borde bg-fort-bg px-3 py-2 text-sm text-fort-texto">
            Se importó el texto de {pdf.paginas === 1 ? 'la página' : `las ${pdf.paginas} páginas`} del PDF.{' '}
            {enEdicion ? 'Se agregó al cuadro de evidencia: revísalo, quita lo que no sea evidencia y pulsa «Aplicar».' : 'Revísalo abajo y quita lo que no sea evidencia.'}
          </p>
        )}
        {estado.fase === 'escaneado' && (
          <p role="alert" className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
            El PDF parece escaneado: no tiene texto legible. Describe su contenido en el cuadro de evidencia;{' '}
            {enEdicion ? 'al pulsar «Aplicar» el PDF queda registrado en el hallazgo.' : 'el PDF queda registrado en el hallazgo.'}
          </p>
        )}
        {estado.fase === 'error' && (
          <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{estado.mensaje}</p>
        )}
        {estado.fase === 'rango' && (
          <div className="space-y-2 rounded-md border border-obs-borde bg-obs-bg p-3 text-sm text-obs-texto">
            <p>
              El PDF tiene {textoDeRango(pdf.textos, 1, pdf.paginas).length.toLocaleString('es-CO')} caracteres y el máximo{' '}
              {enEdicion ? 'que se puede agregar a la evidencia' : 'por análisis'} es{' '}
              {maximo.toLocaleString('es-CO')}. Elige qué páginas importar
              {enEdicion ? ' a la evidencia.' : '; el resto lo puedes analizar después como otro hallazgo.'}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold">
                Desde la página
                <select value={rango.desde} onChange={(e) => setRango((r) => ({ desde: Number(e.target.value), hasta: Math.max(r.hasta, Number(e.target.value)) }))}
                  className="mt-1 block rounded-md border-tinta-300 text-sm text-tinta-900">
                  {paginas.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Hasta la página
                <select value={rango.hasta} onChange={(e) => setRango((r) => ({ ...r, hasta: Number(e.target.value) }))}
                  className="mt-1 block rounded-md border-tinta-300 text-sm text-tinta-900">
                  {paginas.filter((n) => n >= rango.desde).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <Boton
                tamano="sm"
                disabled={!seleccion || seleccion.length > maximo}
                onClick={() => {
                  alImportar({ texto: seleccion, archivo: { nombre: pdf.nombre, paginas: pdf.paginas, sha256: pdf.sha256 } })
                  setEstado({ fase: 'importado', pdf, mensaje: '' })
                }}
              >
                Importar páginas
              </Boton>
              <Boton tamano="sm" variante="secundario" icono={X} onClick={reiniciar}>Cancelar</Boton>
            </div>
            <p className="text-xs tabular-nums">
              Selección: {seleccion.length.toLocaleString('es-CO')} caracteres{seleccion.length > maximo ? ' — demasiados, reduce el rango.' : '.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
