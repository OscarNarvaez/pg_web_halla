import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, CloudOff, FileDown, Loader2, PencilLine, Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { MARCAS_VERIFICACION, objetoAuditado } from '../lib/catalogos'
import { hora } from '../lib/formato'
import { registrarGuardado } from '../lib/guardado-pendiente'
import {
  CAMPOS_INFORMACION, COLUMNAS_LISTA, MAX_FILAS, MAX_SECCIONES, TEXTOS_LISTA, filaVacia, listaInicial, seccionVacia,
} from '../lib/lista-verificacion'
import { mensajeError, supabase } from '../lib/supabase'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { Boton, BotonEnlace, EstadoError, EstadoVacio, claseControl } from '../components/ui'

const ESPERA_GUARDADO = 1500 // guardado automático tras la última tecla
const BARRA = 'bg-[#c0c0c0] px-3 py-1.5 text-center text-sm font-bold uppercase text-black'
// Columnas de la lista en escritorio: requisito, pregunta, documentos, cuatro marcas, anotaciones y quitar
const COLUMNAS = 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_repeat(4,2.75rem)_minmax(0,1.8fr)_2.5rem]'

function Texto({ etiqueta, valor, alCambiar, deshabilitado, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-tinta-500 lg:sr-only">{etiqueta}</span>
      <textarea
        rows={2}
        value={valor}
        maxLength={2000}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(e.target.value)}
        // Crece con el texto (Chrome, Edge, Safari); en otros navegadores se puede agrandar a mano
        style={{ fieldSizing: 'content' }}
        className={cx(claseControl, 'min-h-[3.25rem] resize-y px-2 py-1.5 text-sm leading-snug')}
      />
    </label>
  )
}

/** Una fila de la lista: en escritorio, una fila de tabla; en el celular, una tarjeta con sus campos. */
function Fila({ fila, numero, alCambiar, alQuitar, deshabilitado }) {
  const cambiar = (campo) => (valor) => alCambiar({ ...fila, [campo]: valor })
  return (
    <li className={cx('grid gap-2 rounded-lg border border-tinta-100 p-3 lg:gap-0 lg:rounded-none lg:border-0 lg:border-b lg:p-0', COLUMNAS)}>
      <Texto etiqueta={`${COLUMNAS_LISTA.requisito} (fila ${numero})`} valor={fila.requisito} alCambiar={cambiar('requisito')} deshabilitado={deshabilitado} className="lg:border-r lg:p-1" />
      <Texto etiqueta={`${COLUMNAS_LISTA.pregunta} (fila ${numero})`} valor={fila.pregunta} alCambiar={cambiar('pregunta')} deshabilitado={deshabilitado} className="lg:border-r lg:p-1" />
      <Texto etiqueta={`${COLUMNAS_LISTA.documentos} (fila ${numero})`} valor={fila.documentos} alCambiar={cambiar('documentos')} deshabilitado={deshabilitado} className="lg:border-r lg:p-1" />
      <div role="group" aria-label={`Marca de la fila ${numero}`} className="flex gap-2 lg:contents">
        {MARCAS_VERIFICACION.map((m) => {
          const activa = fila.marca === m.valor
          return (
            <div key={m.valor} className="lg:flex lg:items-center lg:justify-center lg:border-r">
              <button
                type="button"
                disabled={deshabilitado}
                aria-pressed={activa}
                aria-label={`${m.valor}: ${m.etiqueta}`}
                title={m.etiqueta}
                onClick={() => alCambiar({ ...fila, marca: activa ? null : m.valor })}
                className={cx(
                  'grid size-9 place-items-center rounded-md border text-xs font-bold',
                  activa ? 'border-tinta-900 bg-tinta-900 text-white' : 'border-tinta-300 bg-white text-tinta-700 hover:border-tinta-500',
                )}
              >
                {activa ? 'X' : <span className="lg:sr-only">{m.valor}</span>}
              </button>
            </div>
          )
        })}
      </div>
      <Texto etiqueta={`${COLUMNAS_LISTA.anotaciones} (fila ${numero})`} valor={fila.anotaciones} alCambiar={cambiar('anotaciones')} deshabilitado={deshabilitado} className="lg:border-r lg:p-1" />
      <div className="flex items-center justify-end lg:justify-center">
        {!deshabilitado && (
          <button type="button" onClick={alQuitar} aria-label={`Quitar la fila ${numero}`} className="rounded-md p-2 text-tinta-500 hover:bg-nc-bg hover:text-nc-texto">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  )
}

function EstadoGuardado({ estado, guardadoEn }) {
  const estados = {
    guardado: { icono: Check, texto: guardadoEn ? `Cambios guardados a las ${hora(guardadoEn)}` : 'Cambios guardados', clase: 'text-fort-texto' },
    pendiente: { icono: PencilLine, texto: 'Cambios sin guardar', clase: 'text-tinta-500' },
    guardando: { icono: Loader2, texto: 'Guardando…', clase: 'text-tinta-500', girar: true },
    error: { icono: CloudOff, texto: 'No se pudo guardar: pulsa «Guardar cambios»', clase: 'text-nc-texto' },
  }
  const e = estados[estado]
  return (
    <p className={cx('inline-flex min-w-0 items-center gap-1.5 text-sm font-medium', e.clase)} role="status" aria-live="polite">
      <e.icono className={cx('size-4 shrink-0', e.girar && 'animate-spin')} aria-hidden="true" />{e.texto}
    </p>
  )
}

/**
 * Editor de la lista. Se guarda solo poco después de cada cambio y con «Guardar cambios» (o Ctrl+S); lo pendiente
 * también se guarda al salir de la página, al ocultar la pestaña y antes de cerrar la sesión.
 */
function Editor({ auditoria, inicial, existe, guardadaEn }) {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const navigate = useNavigate()
  const soloLectura = auditoria.estado === 'cerrada'
  const [lista, setLista] = useState(inicial)
  // Una lista nueva se crea apenas se abre: desde ese momento la auditoría «tiene lista»
  const [estado, setEstado] = useState(existe ? 'guardado' : 'pendiente')
  const [guardadoEn, setGuardadoEn] = useState(guardadaEn ?? null)
  const [descargando, setDescargando] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const ultima = useRef(inicial) // lo último que escribió el auditor
  const version = useRef(existe ? 0 : 1) // cambios hechos…
  const guardada = useRef(0) // …y el último que llegó a la base de datos
  const enVuelo = useRef(null)
  const temporizador = useRef(null)

  /** Guarda lo pendiente (uno a la vez); devuelve false si falló. */
  const guardar = useCallback(async () => {
    clearTimeout(temporizador.current)
    if (soloLectura) return true
    while (enVuelo.current) await enVuelo.current
    if (guardada.current === version.current) return true
    const v = version.current
    const { encabezado, secciones } = ultima.current
    setEstado('guardando')
    enVuelo.current = supabase
      .from('listas_verificacion')
      .upsert({ auditoria_id: auditoria.id, user_id: usuario.id, encabezado, secciones }, { onConflict: 'auditoria_id' })
      .then((r) => r, (error) => ({ error }))
    const { error } = await enVuelo.current
    enVuelo.current = null
    if (error) {
      setEstado('error')
      notificar(mensajeError(error), 'error')
      return false
    }
    guardada.current = v
    setGuardadoEn(new Date())
    setEstado(v === version.current ? 'guardado' : 'pendiente')
    return true
  }, [auditoria.id, usuario.id, soloLectura, notificar])

  const cambiar = (nueva) => {
    ultima.current = nueva
    version.current += 1
    setLista(nueva)
    setEstado('pendiente')
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(guardar, ESPERA_GUARDADO)
  }

  const guardarAhora = useCallback(async () => {
    if (guardada.current === version.current && !enVuelo.current) return notificar('La lista ya está guardada.', 'exito')
    if (await guardar()) notificar('Lista guardada', 'exito')
  }, [guardar, notificar])

  const continuar = async () => {
    setSaliendo(true)
    const listo = await guardar()
    setSaliendo(false)
    if (listo) navigate(`/app/auditorias/${auditoria.id}`)
  }

  // Crea la lista nueva; guarda lo pendiente al ocultar la pestaña, al salir de la página y antes de cerrar sesión
  useEffect(() => {
    if (guardada.current !== version.current) guardar()
    const quitar = registrarGuardado(guardar)
    const alOcultar = () => document.visibilityState === 'hidden' && guardar()
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      quitar()
      document.removeEventListener('visibilitychange', alOcultar)
      guardar()
    }
  }, [guardar])

  // Ctrl+S (⌘+S) guarda la lista en lugar de abrir el «Guardar como» del navegador
  useEffect(() => {
    if (soloLectura) return undefined
    const alTeclear = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        guardarAhora()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [soloLectura, guardarAhora])

  // Si quedan cambios sin guardar, el navegador avisa antes de cerrar la pestaña
  useEffect(() => {
    if (estado === 'guardado') return undefined
    const avisar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [estado])

  const encabezado = lista.encabezado
  const ponerEncabezado = (clave, valor) => cambiar({ ...lista, encabezado: { ...encabezado, [clave]: valor } })
  const ponerSeccion = (i, seccion) => cambiar({ ...lista, secciones: lista.secciones.map((s, j) => (j === i ? seccion : s)) })

  const descargar = async () => {
    setDescargando(true)
    try {
      await (await import('../lib/exportar-lista')).exportarLista(auditoria, lista)
    } catch (e) {
      console.error(e)
      notificar('No se pudo generar el PDF de la lista. Inténtalo de nuevo.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      <Encabezado
        antetitulo={`${auditoria.codigo} · ${objetoAuditado(auditoria)}`}
        titulo="Lista de verificación"
        descripcion="Organiza lo que vas a verificar antes de ir al lugar de la auditoría y anota durante la visita. Es tu hoja de trabajo: no pasa por la IA ni cambia los hallazgos. Puedes volver a ella cuando quieras."
        volver={{ a: `/app/auditorias/${auditoria.id}`, etiqueta: auditoria.titulo }}
        acciones={<Boton variante="secundario" icono={FileDown} onClick={descargar} cargando={descargando}>Descargar PDF</Boton>}
      />
      {soloLectura && (
        <p className="mb-4 rounded-md border border-obs-borde bg-obs-bg px-4 py-3 text-sm text-obs-texto">La auditoría está cerrada: la lista queda en solo lectura.</p>
      )}

      <div className="space-y-5 rounded-lg border border-tinta-100 bg-white p-4 shadow-sm sm:p-6">
        {/* Auditoría No y Fecha */}
        <div className="flex justify-end">
          <table className="w-full max-w-sm border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={cx(BARRA, 'border border-black normal-case')}>{TEXTOS_LISTA.auditoriaNo}</th>
                <th scope="col" className={cx(BARRA, 'border border-black normal-case')}>{TEXTOS_LISTA.fecha}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1.5 text-center font-medium">{auditoria.codigo}</td>
                <td className="border border-black p-1">
                  <input type="date" aria-label={TEXTOS_LISTA.fecha} value={encabezado.fecha ?? ''} disabled={soloLectura}
                    onChange={(e) => ponerEncabezado('fecha', e.target.value)} className={cx(claseControl, 'px-2 py-1 text-sm')} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* INFORMACION GENERAL */}
        <section aria-labelledby="informacion-general">
          <h2 id="informacion-general" className={cx(BARRA, 'border border-black')}>{TEXTOS_LISTA.informacionGeneral}</h2>
          <div className="border-x border-b border-black">
            {CAMPOS_INFORMACION.map((c) => (
              <label key={c.clave} className="grid border-b border-black last:border-b-0 sm:grid-cols-[18rem_1fr]">
                <span className="bg-[#c0c0c0] px-3 py-2 text-sm font-bold text-black">{c.etiqueta}</span>
                <input
                  type={c.tipo ?? 'text'}
                  value={encabezado[c.clave] ?? ''}
                  maxLength={300}
                  disabled={soloLectura}
                  onChange={(e) => ponerEncabezado(c.clave, e.target.value)}
                  className="border-0 px-3 py-2 text-sm focus:ring-2 focus:ring-inset focus:ring-halla-500 disabled:bg-tinta-50"
                />
              </label>
            ))}
          </div>
        </section>

        <p className="text-center text-sm font-bold text-black">{TEXTOS_LISTA.leyenda}</p>

        {/* LISTA DE VERIFICACIÓN */}
        <section aria-labelledby="lista-verificacion">
          <h2 id="lista-verificacion" className={cx(BARRA, 'border border-black')}>{TEXTOS_LISTA.listaVerificacion}</h2>
          <div aria-hidden="true" className={cx('hidden border-x border-b border-black bg-[#c0c0c0] text-center text-xs font-bold text-black lg:grid', COLUMNAS)}>
            {[COLUMNAS_LISTA.requisito, COLUMNAS_LISTA.pregunta, COLUMNAS_LISTA.documentos, ...MARCAS_VERIFICACION.map((m) => m.valor), COLUMNAS_LISTA.anotaciones, '']
              .map((t, i) => <span key={i} className="flex items-center justify-center border-r border-black px-1 py-2 [overflow-wrap:anywhere] last:border-r-0">{t}</span>)}
          </div>

          {lista.secciones.map((s, i) => (
            <div key={i} className="mt-4 lg:mt-0 lg:border-x lg:border-b lg:border-black">
              <div className="flex items-center gap-2 border-b border-tinta-100 py-2 lg:border-black lg:px-2">
                <input
                  aria-label={`Título de la sección ${i + 1}`}
                  value={s.titulo}
                  maxLength={300}
                  disabled={soloLectura}
                  placeholder="Nombre de la sección (por ejemplo, GESTION DE RECURSOS FISICOS)"
                  onChange={(e) => ponerSeccion(i, { ...s, titulo: e.target.value })}
                  className={cx(claseControl, 'flex-1 text-center text-sm font-bold uppercase')}
                />
                {!soloLectura && lista.secciones.length > 1 && (
                  <Boton variante="fantasma" tamano="sm" icono={Trash2} aria-label={`Quitar la sección ${i + 1}`}
                    onClick={() => cambiar({ ...lista, secciones: lista.secciones.filter((_, j) => j !== i) })}>
                    Quitar
                  </Boton>
                )}
              </div>
              <ol className="space-y-3 lg:space-y-0" aria-label={`Filas de la sección ${s.titulo || i + 1}`}>
                {s.filas.map((f, j) => (
                  <Fila
                    key={j}
                    fila={f}
                    numero={j + 1}
                    deshabilitado={soloLectura}
                    alCambiar={(nueva) => ponerSeccion(i, { ...s, filas: s.filas.map((x, k) => (k === j ? nueva : x)) })}
                    alQuitar={() => ponerSeccion(i, { ...s, filas: s.filas.filter((_, k) => k !== j) })}
                  />
                ))}
              </ol>
              {!soloLectura && (
                <div className="py-2 lg:px-2">
                  <Boton variante="secundario" tamano="sm" icono={Plus} disabled={s.filas.length >= MAX_FILAS}
                    onClick={() => ponerSeccion(i, { ...s, filas: [...s.filas, filaVacia()] })}>
                    Agregar fila{lista.secciones.length > 1 ? ` a la sección ${i + 1}` : ''}
                  </Boton>
                </div>
              )}
            </div>
          ))}
          {!soloLectura && (
            <Boton variante="secundario" icono={Plus} className="mt-4" disabled={lista.secciones.length >= MAX_SECCIONES}
              onClick={() => cambiar({ ...lista, secciones: [...lista.secciones, seccionVacia()] })}>
              Agregar sección
            </Boton>
          )}
        </section>
      </div>

      {/* Barra de guardado: siempre a la vista mientras se recorre la lista */}
      <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-tinta-100 bg-white p-3 shadow-lg">
        {soloLectura
          ? <p className="text-sm text-tinta-500">Solo lectura: la auditoría está cerrada.</p>
          : <EstadoGuardado estado={estado} guardadoEn={guardadoEn} />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" icono={ArrowRight} onClick={continuar} cargando={saliendo}>Continuar con la auditoría</Boton>
          {!soloLectura && (
            <Boton icono={Save} onClick={guardarAhora} cargando={estado === 'guardando'} aria-keyshortcuts="Control+S">Guardar cambios</Boton>
          )}
        </div>
      </div>
    </>
  )
}

/** Lista de verificación de una auditoría (formato del hospital). */
export default function ListaVerificacion() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const auditoria = useAuditoria(id)
  const guardada = useConsulta(
    () => supabase.from('listas_verificacion').select('encabezado, secciones, actualizado_en').eq('auditoria_id', id).maybeSingle(),
    [id],
  )

  if (auditoria.cargando || guardada.cargando) return <PantallaCarga />
  if (auditoria.error) return <EstadoError mensaje={auditoria.error} alReintentar={auditoria.recargar} />
  if (guardada.error) return <EstadoError mensaje={guardada.error} alReintentar={guardada.recargar} />
  if (!auditoria.datos) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." />
  const g = guardada.datos
  if (!g && auditoria.datos.estado === 'cerrada') {
    return (
      <EstadoVacio
        titulo="Esta auditoría se cerró sin lista de verificación"
        descripcion="Una auditoría cerrada no admite cambios. Si necesitas la lista, reabre la auditoría."
        accion={<BotonEnlace a={`/app/auditorias/${id}`} variante="secundario">Volver a la auditoría</BotonEnlace>}
      />
    )
  }
  const inicial = g
    ? { encabezado: g.encabezado ?? {}, secciones: g.secciones?.length ? g.secciones : [seccionVacia()] }
    : listaInicial(auditoria.datos, perfil)
  return <Editor key={id} auditoria={auditoria.datos} inicial={inicial} existe={Boolean(g)} guardadaEn={g?.actualizado_en} />
}
