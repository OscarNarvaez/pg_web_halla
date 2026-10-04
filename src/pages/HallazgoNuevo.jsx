import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, ChevronDown, RotateCcw, Send, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { actualizarHallazgo, useHallazgos } from '../hooks/useHallazgos'
import { useToast } from '../contexts/ToastContext'
import { invocarFuncion } from '../lib/supabase'
import { CLASIFICACIONES, objetoAuditado } from '../lib/catalogos'
import { conteoPorCasilla } from '../lib/riesgo'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { ProgresoAnalisis } from '../components/hallazgos/ProgresoAnalisis'
import { IndicadorPasos } from '../components/hallazgos/asistente/IndicadorPasos'
import { PASOS } from '../components/hallazgos/asistente/pasos'
import { CargarPdf } from '../components/hallazgos/asistente/CargarPdf'
import { PasoRequisito } from '../components/hallazgos/asistente/PasoRequisito'
import { PasoClasificacion } from '../components/hallazgos/asistente/PasoClasificacion'
import { PasoRedaccion } from '../components/hallazgos/asistente/PasoRedaccion'
import { PasoRiesgo } from '../components/hallazgos/asistente/PasoRiesgo'
import { PasoControles } from '../components/hallazgos/asistente/PasoControles'
import { PasoEnviar } from '../components/hallazgos/asistente/PasoEnviar'
import { AreaTexto, Boton, EstadoError, EstadoVacio } from '../components/ui'

const MINIMO = 25
const MAXIMO = 6000
const MAXIMO_NOTAS = 2000
const EJEMPLO =
  'Ejemplo: Se revisaron 20 historias clínicas del servicio de Hospitalización y en 5 de ellas no se encontró registrada la valoración de enfermería al ingreso.'
// Campos que el auditor puede ajustar en los pasos 2 a 6 (se guardan al cambiar de paso)
const CAMPOS = [
  'clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'severidad',
  'riesgo_descripcion', 'riesgo_dimension', 'riesgo_probabilidad', 'riesgo_impacto', 'riesgo_justificacion', 'controles',
]
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Asistente de 7 pasos: evidencia → requisito → clasificación → redacción → riesgo → controles → matriz.
 * NO existe ningún selector de clasificación antes del análisis: la clasificación la decide la IA.
 */
export default function HallazgoNuevo() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notificar } = useToast()
  const { datos: auditoria, cargando, error: errorAuditoria, recargar } = useAuditoria(id)
  const { datos: deLaAuditoria } = useHallazgos(id)

  const [paso, setPaso] = useState(1)
  const [texto, setTexto] = useState('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [tocado, setTocado] = useState(false)
  const [fase, setFase] = useState('inicio') // inicio | analizando | error | analizado
  const [error, setError] = useState(null)
  const [propuestas, setPropuestas] = useState([]) // salida original de la IA (para señalar sus valores)
  const [guardados, setGuardados] = useState([]) // último estado guardado de cada hallazgo
  const [hallazgos, setHallazgos] = useState([])
  const [indice, setIndice] = useState(0)
  const [meta, setMeta] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [entradaAnalizada, setEntradaAnalizada] = useState('')

  // Mapa de calor: los hallazgos ya registrados en la auditoría más los de este análisis
  const conteo = useMemo(() => {
    const ids = new Set(hallazgos.map((h) => h.id))
    return conteoPorCasilla([...deLaAuditoria.filter((h) => !ids.has(h.id)), ...hallazgos])
  }, [deLaAuditoria, hallazgos])

  if (cargando) return <PantallaCarga />
  if (errorAuditoria) return <EstadoError mensaje={errorAuditoria} alReintentar={recargar} />
  if (!auditoria) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." />

  const cerrada = auditoria.estado === 'cerrada'
  const analizado = fase === 'analizado'
  const largo = texto.trim().length
  const errorTexto = tocado && largo < MINIMO
    ? `Describe la situación con al menos ${MINIMO} caracteres.`
    : largo > MAXIMO ? `El texto supera los ${MAXIMO.toLocaleString('es-CO')} caracteres: recórtalo o divídelo en varios hallazgos.` : ''
  const h = hallazgos[indice]

  const analizar = async () => {
    setTocado(true)
    if (largo < MINIMO || largo > MAXIMO || cerrada) return
    setFase('analizando')
    setError(null)
    const entrada = texto.trim()
    const { data, error: err } = await invocarFuncion('clasificar-hallazgo', {
      auditoria_id: id,
      entrada_auditor: entrada,
      contexto: notas.trim() ? { notas: notas.trim() } : undefined,
      evidencia_archivo: archivo ?? undefined,
      persistir: true,
    })
    if (err || !data?.ok) {
      setError(err ?? { mensaje: 'La IA no devolvió un resultado válido. Inténtalo de nuevo.' })
      setFase('error')
      return
    }
    setEntradaAnalizada(entrada)
    setPropuestas(data.hallazgos)
    setGuardados(data.hallazgos)
    setHallazgos(data.hallazgos)
    setIndice(0)
    setMeta(data.meta)
    setFase('analizado')
    setPaso(2)
  }

  const cambiar = (cambios) => setHallazgos((lista) => lista.map((x, i) => (i === indice ? { ...x, ...cambios } : x)))

  /** Guarda lo que el auditor cambió desde el último guardado. Devuelve false si algo falló. */
  const guardarPendientes = async () => {
    const nuevos = [...guardados]
    const actuales = [...hallazgos]
    let ok = true
    setGuardando(true)
    for (let i = 0; i < hallazgos.length; i++) {
      const cambios = Object.fromEntries(CAMPOS.filter((c) => !igual(hallazgos[i][c], guardados[i][c])).map((c) => [c, hallazgos[i][c]]))
      if (!Object.keys(cambios).length) continue
      if ((guardados[i].estado ?? 'generado') === 'generado') cambios.estado = 'editado'
      const { data, error: err } = await actualizarHallazgo(hallazgos[i].id, cambios)
      if (err) {
        notificar(err, 'error')
        ok = false
        break
      }
      nuevos[i] = data
      actuales[i] = { ...actuales[i], ...data }
    }
    setGuardando(false)
    setGuardados(nuevos)
    setHallazgos(actuales)
    return ok
  }

  const ir = async (n) => {
    if (n === paso) return
    if (analizado && !(await guardarPendientes())) return
    setPaso(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const corregir = (i, n) => {
    setIndice(i)
    ir(n)
  }

  const enviar = async () => {
    if (!(await guardarPendientes())) return
    notificar(
      hallazgos.length > 1 ? `${hallazgos.length} hallazgos enviados a la matriz consolidada` : 'Hallazgo enviado a la matriz consolidada',
      'exito',
    )
    navigate(`/app/auditorias/${id}/matriz`)
  }

  const descartar = async ({ reanalizar = false } = {}) => {
    setGuardando(true)
    for (const x of hallazgos) {
      const { error: err } = await actualizarHallazgo(x.id, { estado: 'descartado' })
      if (err) {
        setGuardando(false)
        return notificar(err, 'error')
      }
    }
    setGuardando(false)
    setHallazgos([])
    setGuardados([])
    setPropuestas([])
    setPaso(1)
    if (reanalizar) return analizar()
    setFase('inicio')
    notificar('Resultado descartado. Tu texto sigue aquí por si quieres reescribirlo.', 'info')
  }

  const pasoActual = PASOS[paso - 1]

  return (
    <>
      <Encabezado
        antetitulo={`${auditoria.codigo} · ${objetoAuditado(auditoria)}`}
        titulo="Nuevo hallazgo"
        descripcion="La plataforma te guía paso a paso: la IA identifica el requisito, clasifica, redacta, evalúa el riesgo y propone controles; tú revisas cada paso."
        volver={{ a: `/app/auditorias/${id}`, etiqueta: auditoria.titulo }}
      />

      {cerrada && (
        <p role="alert" className="mb-6 rounded-md border border-obs-borde bg-obs-bg px-4 py-3 text-sm text-obs-texto">
          Esta auditoría está cerrada y no admite hallazgos nuevos.
        </p>
      )}

      <IndicadorPasos actual={paso} hasta={analizado ? 7 : 1} alIr={ir} />

      {paso === 1 ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <section aria-labelledby="titulo-entrada" className="space-y-5 rounded-lg border border-tinta-100 bg-white p-5 shadow-sm">
            <div>
              <h2 id="titulo-entrada" className="text-lg font-semibold text-tinta-900">1. Evidencia</h2>
              <p className="mt-1 text-sm text-tinta-500">{PASOS[0].descripcion}</p>
            </div>
            <p className="flex gap-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-xs text-obs-texto">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>No escribas datos de pacientes</strong> (nombres, documentos ni números de historia clínica). Describe el
                hecho, no a la persona. Por seguridad, el sistema los retira antes de enviar el texto al servicio de IA.
              </span>
            </p>
            <CargarPdf
              archivo={archivo}
              maximo={MAXIMO}
              deshabilitado={fase === 'analizando' || analizado || cerrada}
              alImportar={(r) => {
                setArchivo(r?.archivo ?? null)
                if (r?.texto) setTexto((t) => (t.trim() ? `${t.trim()}\n\n${r.texto}` : r.texto))
              }}
            />
            <AreaTexto
              etiqueta="Describe lo que observaste durante la auditoría"
              rows={10}
              required
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => setTocado(true)}
              placeholder={EJEMPLO}
              longitud={largo}
              minimo={MINIMO}
              error={errorTexto}
              disabled={fase === 'analizando' || analizado || cerrada}
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
              disabled={fase === 'analizando' || analizado || cerrada}
              ayuda="Por ejemplo: a quién entrevistaste o qué documento consultaste."
            />
            {analizado ? (
              <div className="space-y-3 border-t border-tinta-100 pt-4">
                <p className="text-xs text-tinta-500">Este texto ya se analizó. Para analizar otro, descarta el resultado o envíalo a la matriz.</p>
                <div className="flex flex-wrap gap-2">
                  <Boton icono={ArrowRight} onClick={() => ir(2)} disabled={guardando}>Siguiente: requisito</Boton>
                  <Boton variante="secundario" icono={RotateCcw} onClick={() => descartar({ reanalizar: true })} disabled={guardando}>Reanalizar</Boton>
                  <Boton variante="peligro" icono={Trash2} onClick={() => descartar()} disabled={guardando}>Descartar</Boton>
                </div>
              </div>
            ) : (
              <Boton tamano="lg" icono={Sparkles} onClick={analizar} cargando={fase === 'analizando'} disabled={cerrada} className="w-full sm:w-auto">
                Analizar con IA
              </Boton>
            )}
          </section>

          <section aria-labelledby="titulo-estado" aria-live="polite" className="space-y-4 lg:sticky lg:top-6">
            <h2 id="titulo-estado" className="sr-only">Estado del análisis</h2>
            {(fase === 'inicio' || analizado) && (
              <EstadoVacio
                icono={Sparkles}
                titulo={analizado ? 'Análisis listo' : 'Después del análisis, paso a paso'}
                descripcion="Verás la norma, el numeral y el requisito; la clasificación; el hallazgo redactado; el riesgo con su mapa de calor y los controles recomendados. Podrás ajustar cada paso antes de enviarlo a la matriz consolidada."
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
          </section>
        </div>
      ) : (
        <section aria-labelledby="titulo-paso" className="rounded-lg border border-tinta-100 bg-white shadow-sm">
          <div className="border-b border-tinta-100 p-5">
            <h2 id="titulo-paso" className="text-lg font-semibold text-tinta-900">{paso}. {pasoActual.titulo === 'Matriz' ? 'Enviar a la matriz consolidada' : pasoActual.titulo}</h2>
            <p className="mt-1 text-sm text-tinta-500">{pasoActual.descripcion}</p>
            {hallazgos.length > 1 && paso < 7 && (
              <div className="mt-4">
                <p className="mb-2 rounded-md border border-om-borde bg-om-bg px-3 py-2 text-sm text-om-texto">
                  Se detectaron {hallazgos.length} situaciones distintas; se registran como hallazgos separados. Revisa cada una.
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Situación">
                  {hallazgos.map((x, i) => (
                    <button
                      key={x.id ?? i}
                      type="button"
                      onClick={() => setIndice(i)}
                      aria-pressed={i === indice}
                      className={cx(
                        'rounded-full border px-3 py-1.5 text-sm font-medium',
                        i === indice ? 'border-tinta-900 bg-tinta-900 text-white' : 'border-tinta-300 bg-white text-tinta-700 hover:border-tinta-500',
                      )}
                    >
                      Situación {i + 1} · {CLASIFICACIONES[x.clasificacion]?.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-5" aria-live="polite">
            {paso === 2 && <PasoRequisito key={h.id} hallazgo={h} alCambiar={cambiar} deshabilitado={guardando} />}
            {paso === 3 && <PasoClasificacion key={h.id} hallazgo={h} alCambiar={cambiar} deshabilitado={guardando} />}
            {paso === 4 && (
              <div className="space-y-5">
                <PasoRedaccion key={h.id} hallazgo={h} alCambiar={cambiar} deshabilitado={guardando} />
                <details className="group rounded-lg border border-tinta-100 px-4 py-3 text-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-tinta-700">
                    Ver texto original del auditor
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-tinta-700">{entradaAnalizada}</p>
                  <p className="mt-2 text-xs text-tinta-500">Se conserva tal cual en el registro del hallazgo y no se puede modificar.</p>
                </details>
              </div>
            )}
            {paso === 5 && (
              <PasoRiesgo
                key={h.id}
                hallazgo={h}
                alCambiar={cambiar}
                conteo={conteo}
                propuesta={propuestas[indice]}
                deshabilitado={guardando}
              />
            )}
            {paso === 6 && <PasoControles key={h.id} hallazgo={h} alCambiar={cambiar} deshabilitado={guardando} />}
            {paso === 7 && <PasoEnviar hallazgos={hallazgos} alCorregir={corregir} />}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-tinta-100 p-5">
            <Boton variante="secundario" icono={ArrowLeft} onClick={() => ir(paso - 1)} disabled={guardando}>Anterior</Boton>
            {paso < 7 ? (
              <Boton icono={ArrowRight} onClick={() => ir(paso + 1)} cargando={guardando}>Siguiente: {PASOS[paso].titulo.toLowerCase()}</Boton>
            ) : (
              <Boton icono={Send} onClick={enviar} cargando={guardando}>Enviar a la matriz consolidada</Boton>
            )}
            {meta && (
              <p className="w-full text-xs text-tinta-500 sm:ml-auto sm:w-auto">
                Modelo {meta.modelo} · {meta.criterios_recuperados} criterios consultados · {(meta.latencia_ms / 1000).toFixed(1)} s
                {meta.datos_personales_retirados > 0 && ` · ${meta.datos_personales_retirados} dato${meta.datos_personales_retirados === 1 ? '' : 's'} personal${meta.datos_personales_retirados === 1 ? '' : 'es'} retirado${meta.datos_personales_retirados === 1 ? '' : 's'} antes de enviar a la IA`}
              </p>
            )}
          </div>
        </section>
      )}
    </>
  )
}
