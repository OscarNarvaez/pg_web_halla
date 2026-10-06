import { useRef, useState } from 'react'
import { fechaHora } from '../../lib/formato'
import { CampoEditable } from './CampoEditable'
import { CargarPdf } from './asistente/CargarPdf'
import { DocumentoAdjunto } from './DocumentoAdjunto'

// Máximo de texto que se agrega a la evidencia desde un PDF (el mismo de un análisis)
const MAXIMO_PDF = 6000

/**
 * Evidencia de un hallazgo, editable, con la opción de cargar un PDF (paso 4 del asistente, detalle y matriz).
 * El texto del PDF se agrega al cuadro de evidencia para revisarlo; al pulsar «Aplicar» se guarda junto con la
 * huella del PDF en `evidencia_anexos` (migración 0012). Cualquier PDF registrado se puede quitar; el que analizó la IA
 * (`evidencia_archivo`) solo se puede quitar, no reemplazar, y el historial conserva cuál era (0014).
 */
export function EvidenciaEditable({ hallazgo, alCambiar, deshabilitado = false }) {
  const campo = useRef(null)
  const [pendiente, setPendiente] = useState(null) // PDF cargado que se registra al aplicar: { texto, archivo }
  const [aviso, setAviso] = useState('')
  const [cargador, setCargador] = useState(0) // reinicia el cargador (y sus mensajes) al aplicar o cancelar
  const anexos = hallazgo.evidencia_anexos ?? []
  const analizado = hallazgo.evidencia_archivo
  const registrados = [analizado?.sha256, ...anexos.map((a) => a.sha256)].filter(Boolean)

  const reiniciar = () => {
    setPendiente(null)
    setCargador((n) => n + 1)
  }

  const importar = (r) => {
    setAviso('')
    if (!r) {
      campo.current?.quitar(pendiente?.texto)
      return setPendiente(null)
    }
    if (registrados.includes(r.archivo.sha256)) {
      setAviso(`El PDF ${r.archivo.nombre} ya está registrado en este hallazgo.`)
      return setCargador((n) => n + 1)
    }
    if (pendiente) campo.current?.quitar(pendiente.texto) // se reemplaza el PDF que aún no se había aplicado
    setPendiente(r)
    campo.current?.agregar(r.texto)
  }

  const aplicar = (texto) => {
    alCambiar({
      ...(texto !== hallazgo.evidencia ? { evidencia: texto } : {}),
      ...(pendiente ? { evidencia_anexos: [...anexos, pendiente.archivo] } : {}),
    })
    reiniciar()
  }

  return (
    <div className="space-y-3">
      <CampoEditable ref={campo} etiqueta="Evidencia" valor={hallazgo.evidencia} deshabilitado={deshabilitado} minimo={5}
        cambioExtra={Boolean(pendiente)} alGuardar={aplicar} alCancelar={reiniciar} />
      {!deshabilitado && (
        <CargarPdf key={cargador} momento="edicion" archivo={pendiente?.archivo ?? null} detalle="se registra al aplicar" maximo={MAXIMO_PDF} alImportar={importar} />
      )}
      {aviso && <p role="alert" className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">{aviso}</p>}
      {(analizado || anexos.length > 0) && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-tinta-500">PDF de evidencia registrados</p>
          <ul className="space-y-3 pt-1">
            {analizado && (
              <DocumentoAdjunto como="li" nombre={analizado.nombre} paginas={analizado.paginas} sha256={analizado.sha256} detalle="analizado con la IA"
                alQuitar={deshabilitado ? undefined : () => alCambiar({ evidencia_archivo: null })} />
            )}
            {anexos.map((a) => (
              <DocumentoAdjunto
                key={a.sha256}
                como="li"
                nombre={a.nombre}
                paginas={a.paginas}
                sha256={a.sha256}
                detalle={a.agregado_en ? `agregado el ${fechaHora(a.agregado_en)}` : 'agregado al editar'}
                alQuitar={deshabilitado ? undefined : () => alCambiar({ evidencia_anexos: anexos.filter((x) => x.sha256 !== a.sha256) })}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
