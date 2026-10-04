import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, CloudOff, FileDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { MARCAS_VERIFICACION, objetoAuditado } from '../lib/catalogos'
import {
  CAMPOS_INFORMACION, COLUMNAS_LISTA, MAX_FILAS, MAX_SECCIONES, TEXTOS_LISTA, filaVacia, listaInicial, seccionVacia,
} from '../lib/lista-verificacion'
import { mensajeError, supabase } from '../lib/supabase'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { Boton, EstadoError, EstadoVacio, claseControl } from '../components/ui'

const ESPERA_GUARDADO = 1200
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

function EstadoGuardado({ estado }) {
  const estados = {
    guardado: { icono: Check, texto: 'Guardado', clase: 'text-fort-texto' },
    pendiente: { icono: Loader2, texto: 'Cambios sin guardar…', clase: 'text-tinta-500' },
    guardando: { icono: Loader2, texto: 'Guardando…', clase: 'text-tinta-500', girar: true },
    error: { icono: CloudOff, texto: 'No se pudo guardar', clase: 'text-nc-texto' },
  }
  const e = estados[estado]
  if (!e) return null
  return (
    <p className={cx('inline-flex items-center gap-1.5 text-sm', e.clase)} role="status" aria-live="polite">
      <e.icono className={cx('size-4', e.girar && 'animate-spin')} aria-hidden="true" />{e.texto}
    </p>
  )
}

/** Editor de la lista: se guarda solo, poco después de cada cambio. */
function Editor({ auditoria, inicial, existe }) {
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const [lista, setLista] = useState(inicial)
  const [estado, setEstado] = useState(existe ? 'guardado' : null)
  const [cambios, setCambios] = useState(0)
  const [descargando, setDescargando] = useState(false)
  const ultimo = useRef(null)
  const soloLectura = auditoria.estado === 'cerrada'

  const cambiar = (nueva) => {
    setLista(nueva)
    setEstado('pendiente')
    setCambios((n) => n + 1)
  }
  const guardar = async (datos) => {
    setEstado('guardando')
    const { error } = await supabase
      .from('listas_verificacion')
      .upsert({ auditoria_id: auditoria.id, user_id: usuario.id, encabezado: datos.encabezado, secciones: datos.secciones }, { onConflict: 'auditoria_id' })
    if (ultimo.current !== datos) return // llegó otro cambio mientras se guardaba: lo guarda el siguiente intento
    if (error) {
      setEstado('error')
      notificar(mensajeError(error), 'error')
    } else setEstado('guardado')
  }

  // Guardado automático poco después del último cambio
  useEffect(() => {
    if (!cambios) return undefined
    ultimo.current = lista
    const t = setTimeout(() => guardar(lista), ESPERA_GUARDADO)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cambios])

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
        descripcion="Organiza lo que vas a verificar antes de ir al lugar de la auditoría y anota durante la visita. Es tu hoja de trabajo: no pasa por la IA ni cambia los hallazgos."
        volver={{ a: `/app/auditorias/${auditoria.id}`, etiqueta: auditoria.titulo }}
        acciones={
          <>
            <EstadoGuardado estado={estado} />
            <Boton variante="secundario" icono={FileDown} onClick={descargar} cargando={descargando}>Descargar PDF</Boton>
          </>
        }
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
    </>
  )
}

/** Lista de verificación de una auditoría (formato del hospital). */
export default function ListaVerificacion() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const auditoria = useAuditoria(id)
  const guardada = useConsulta(() => supabase.from('listas_verificacion').select('encabezado, secciones').eq('auditoria_id', id).maybeSingle(), [id])

  if (auditoria.cargando || guardada.cargando) return <PantallaCarga />
  if (auditoria.error) return <EstadoError mensaje={auditoria.error} alReintentar={auditoria.recargar} />
  if (guardada.error) return <EstadoError mensaje={guardada.error} alReintentar={guardada.recargar} />
  if (!auditoria.datos) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." />
  const inicial = guardada.datos?.secciones?.length ? guardada.datos : listaInicial(auditoria.datos, perfil)
  return <Editor key={id} auditoria={auditoria.datos} inicial={inicial} existe={Boolean(guardada.datos)} />
}
