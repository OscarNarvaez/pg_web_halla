import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ChevronDown, RotateCcw, Save, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { actualizarHallazgo } from '../hooks/useHallazgos'
import { useToast } from '../contexts/ToastContext'
import { invocarFuncion } from '../lib/supabase'
import { objetoAuditado } from '../lib/catalogos'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { ProgresoAnalisis } from '../components/hallazgos/ProgresoAnalisis'
import { TarjetaResultado } from '../components/hallazgos/TarjetaResultado'
import { AreaTexto, Boton, EstadoError, EstadoVacio } from '../components/ui'

const MINIMO = 25
const MAXIMO = 6000
const MAXIMO_NOTAS = 2000
const EJEMPLO =
  'Ejemplo: Se revisaron 20 historias clínicas del servicio de Hospitalización y en 5 de ellas no se encontró registrada la valoración de enfermería al ingreso.'
const CAMPOS_EDITABLES = ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'severidad']

/**
 * Pantalla estrella: el auditor describe lo que observó y la IA clasifica y redacta.
 * NO existe ningún selector de clasificación antes del análisis: la clasificación la decide la IA.
 */
export default function HallazgoNuevo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notificar } = useToast()
  const { datos: auditoria, cargando, error: errorAuditoria, recargar } = useAuditoria(id)

  const [texto, setTexto] = useState('')
  const [notas, setNotas] = useState('')
  const [tocado, setTocado] = useState(false)
  const [fase, setFase] = useState('inicio') // inicio | analizando | resultado | error
  const [error, setError] = useState(null)
  const [originales, setOriginales] = useState([])
  const [hallazgos, setHallazgos] = useState([])
  const [meta, setMeta] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [entradaAnalizada, setEntradaAnalizada] = useState('')

  if (cargando) return <PantallaCarga />
  if (errorAuditoria) return <EstadoError mensaje={errorAuditoria} alReintentar={recargar} />
  if (!auditoria) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." />

  const cerrada = auditoria.estado === 'cerrada'
  const textoCorto = texto.trim().length < MINIMO
  const errorTexto = tocado && textoCorto ? `Describe la situación con al menos ${MINIMO} caracteres.` : ''

  const analizar = async () => {
    setTocado(true)
    if (textoCorto || cerrada) return
    setFase('analizando')
    setError(null)
    const entrada = texto.trim()
    const { data, error: err } = await invocarFuncion('clasificar-hallazgo', {
      auditoria_id: id,
      entrada_auditor: entrada,
      contexto: notas.trim() ? { notas: notas.trim() } : undefined,
      persistir: true,
    })
    if (err || !data?.ok) {
      setError(err ?? { mensaje: 'La IA no devolvió un resultado válido. Inténtalo de nuevo.' })
      setFase('error')
      return
    }
    setEntradaAnalizada(entrada)
    setOriginales(data.hallazgos)
    setHallazgos(data.hallazgos)
    setMeta(data.meta)
    setFase('resultado')
  }

  const cambiar = (indice, cambios) => setHallazgos((lista) => lista.map((h, i) => (i === indice ? { ...h, ...cambios } : h)))

  const marcarTodos = async (cambiosPorHallazgo) => {
    for (let i = 0; i < hallazgos.length; i++) {
      const { error: err } = await actualizarHallazgo(hallazgos[i].id, cambiosPorHallazgo(hallazgos[i], i))
      if (err) return err
    }
    return ''
  }

  const guardar = async () => {
    setGuardando(true)
    const err = await marcarTodos((h, i) => {
      const cambios = Object.fromEntries(CAMPOS_EDITABLES.filter((c) => h[c] !== originales[i][c]).map((c) => [c, h[c]]))
      return { ...cambios, estado: 'confirmado' }
    })
    setGuardando(false)
    if (err) return notificar(err, 'error')
    notificar(hallazgos.length > 1 ? `${hallazgos.length} hallazgos guardados` : 'Hallazgo guardado', 'exito')
    navigate(`/app/auditorias/${id}`)
  }

  const descartar = async ({ reanalizar = false } = {}) => {
    setGuardando(true)
    const err = await marcarTodos(() => ({ estado: 'descartado' }))
    setGuardando(false)
    if (err) return notificar(err, 'error')
    setHallazgos([])
    setOriginales([])
    if (reanalizar) return analizar()
    notificar('Resultado descartado. Tu texto sigue aquí por si quieres reescribirlo.', 'info')
    setFase('inicio')
  }

  const editado = hallazgos.some((h, i) => CAMPOS_EDITABLES.some((c) => h[c] !== originales[i]?.[c]))

  return (
    <>
      <Encabezado
        antetitulo={`${auditoria.codigo} · ${objetoAuditado(auditoria)}`}
        titulo="Nuevo hallazgo"
        descripcion="Escribe lo que observaste. La IA determina la clasificación, redacta el hallazgo y busca el requisito en las normas cargadas."
        volver={{ a: `/app/auditorias/${id}`, etiqueta: auditoria.titulo }}
      />

      {cerrada && (
        <p role="alert" className="mb-6 rounded-md border border-obs-borde bg-obs-bg px-4 py-3 text-sm text-obs-texto">
          Esta auditoría está cerrada y no admite hallazgos nuevos.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Entrada */}
        <section aria-labelledby="titulo-entrada" className="space-y-5 rounded-lg border border-tinta-100 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 id="titulo-entrada" className="sr-only">Entrada del auditor</h2>
          <p className="flex gap-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-xs text-obs-texto">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>No escribas datos de pacientes</strong> (nombres, documentos ni números de historia clínica). Describe el
              hecho, no a la persona. Por seguridad, el sistema los retira antes de enviar el texto al servicio de IA.
            </span>
          </p>
          <AreaTexto
            etiqueta="Describe lo que observaste durante la auditoría"
            rows={10}
            required
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => setTocado(true)}
            placeholder={EJEMPLO}
            longitud={texto.trim().length}
            minimo={MINIMO}
            maxLength={MAXIMO}
            error={errorTexto}
            disabled={fase === 'analizando' || cerrada}
          />
          <details className="group rounded-md bg-tinta-50 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-tinta-700">
              ¿Qué conviene incluir?
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-2 text-tinta-500">
              Incluye qué revisaste, cuántos registros, qué encontraste y dónde. Si conoces el procedimiento o la norma
              aplicable, menciónalo: la IA solo cita requisitos que pueda verificar en los documentos cargados.
            </p>
          </details>
          <AreaTexto
            etiqueta="Notas o contexto adicional (opcional)"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            maxLength={MAXIMO_NOTAS}
            disabled={fase === 'analizando' || cerrada}
            ayuda="Por ejemplo: a quién entrevistaste o qué documento consultaste."
          />
          <Boton tamano="lg" icono={Sparkles} onClick={analizar} cargando={fase === 'analizando'} disabled={cerrada || guardando || fase === 'resultado'} className="w-full sm:w-auto">
            Analizar con IA
          </Boton>
          {fase === 'resultado' && (
            <p className="text-xs text-tinta-500">Para analizar otro texto, guarda o descarta primero el resultado actual.</p>
          )}
        </section>

        {/* Resultado */}
        <section aria-labelledby="titulo-resultado" aria-live="polite" className="space-y-4">
          <h2 id="titulo-resultado" className="sr-only">Resultado del análisis</h2>

          {fase === 'inicio' && (
            <EstadoVacio
              icono={Sparkles}
              titulo="El resultado aparecerá aquí"
              descripcion="Verás la clasificación, el hallazgo redactado con la estructura de su categoría, el criterio normativo y la evidencia. Podrás editar cada campo antes de guardar."
            />
          )}

          {fase === 'analizando' && <ProgresoAnalisis />}

          {fase === 'error' && (
            <div role="alert" className="rounded-lg border border-nc-borde bg-nc-bg p-5 text-sm text-nc-texto">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">No se pudo analizar el hallazgo</p>
                  <p className="mt-1">{error?.mensaje}</p>
                  <p className="mt-1 text-xs">Tu texto no se perdió.</p>
                </div>
              </div>
              <Boton variante="secundario" icono={RotateCcw} onClick={analizar} className="mt-4">Reintentar</Boton>
            </div>
          )}

          {fase === 'resultado' && (
            <>
              {hallazgos.length > 1 && (
                <p className="rounded-md border border-om-borde bg-om-bg px-4 py-3 text-sm text-om-texto">
                  Se detectaron {hallazgos.length} situaciones distintas; se guardarán por separado.
                </p>
              )}
              {hallazgos.map((h, i) => (
                <TarjetaResultado
                  key={h.id ?? i}
                  hallazgo={h}
                  encabezado={hallazgos.length > 1 ? `Situación ${i + 1} de ${hallazgos.length}` : undefined}
                  alCambiar={(cambios) => cambiar(i, cambios)}
                  deshabilitado={guardando}
                />
              ))}

              <details className="group rounded-lg border border-tinta-100 bg-white px-4 py-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-tinta-700">
                  Ver texto original del auditor
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-tinta-700">{entradaAnalizada}</p>
                <p className="mt-2 text-xs text-tinta-500">Se conserva tal cual en el registro del hallazgo y no se puede modificar.</p>
              </details>

              {meta && (
                <p className="text-xs text-tinta-500">
                  Modelo {meta.modelo} · {meta.criterios_recuperados} criterios consultados · {(meta.latencia_ms / 1000).toFixed(1)} s
                  {meta.datos_personales_retirados > 0 && ` · ${meta.datos_personales_retirados} dato${meta.datos_personales_retirados === 1 ? '' : 's'} personal${meta.datos_personales_retirados === 1 ? '' : 'es'} retirado${meta.datos_personales_retirados === 1 ? '' : 's'} antes de enviar a la IA`}
                  {editado && ' · editado por ti'}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-tinta-100 pt-4">
                <Boton icono={Save} onClick={guardar} cargando={guardando}>Guardar hallazgo{hallazgos.length > 1 ? 's' : ''}</Boton>
                <Boton variante="secundario" icono={RotateCcw} onClick={() => descartar({ reanalizar: true })} disabled={guardando}>Reanalizar</Boton>
                <Boton variante="peligro" icono={Trash2} onClick={() => descartar()} disabled={guardando}>Descartar</Boton>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
