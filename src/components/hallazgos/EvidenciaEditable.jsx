import { useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { fechaHora } from '../../lib/formato'
import { CampoEditable } from './CampoEditable'
import { CargarPdf } from './asistente/CargarPdf'

// Máximo de texto que se agrega a la evidencia desde un PDF (el mismo de un análisis)
const MAXIMO_PDF = 6000

function PdfRegistrado({ pdf, detalle, alQuitar }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-tinta-100 bg-tinta-50 px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-halla-700" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium text-tinta-900" title={`${pdf.nombre} · SHA-256 ${pdf.sha256}`}>{pdf.nombre}</span>
      <span className="text-xs text-tinta-500">{pdf.paginas} pág. · {detalle}</span>
      {alQuitar && (
        <button type="button" onClick={alQuitar} aria-label={`Quitar el PDF ${pdf.nombre} del hallazgo`}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-tinta-700 hover:bg-white">
          <X className="size-3.5" aria-hidden="true" /> Quitar
        </button>
      )}
    </li>
  )
}

/**
 * Evidencia de un hallazgo, editable, con la opción de cargar un PDF (paso 4 del asistente, detalle y matriz).
 * El texto del PDF se agrega al cuadro de evidencia para revisarlo; al pulsar «Aplicar» se guarda junto con la
 * huella del PDF en `evidencia_anexos` (migración 0012). El PDF que analizó la IA (`evidencia_archivo`) no cambia.
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
        <CargarPdf key={cargador} momento="edicion" archivo={pendiente?.archivo ?? null} maximo={MAXIMO_PDF} alImportar={importar} />
      )}
      {aviso && <p role="alert" className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">{aviso}</p>}
      {(analizado || anexos.length > 0) && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-tinta-500">PDF de evidencia registrados</p>
          <ul className="space-y-2">
            {analizado && <PdfRegistrado pdf={analizado} detalle="analizado con la IA" />}
            {anexos.map((a) => (
              <PdfRegistrado
                key={a.sha256}
                pdf={a}
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
