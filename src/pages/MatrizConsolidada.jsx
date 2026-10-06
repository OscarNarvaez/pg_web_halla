import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Eye, FilePlus2, FileSpreadsheet } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { actualizarHallazgo, useHallazgos } from '../hooks/useHallazgos'
import { useToast } from '../contexts/ToastContext'
import { ESTADOS_MATRIZ, estadoMatriz, objetoAuditado } from '../lib/catalogos'
import { COLORES_ZONA, controlesAdoptados, conteoPorCasilla, evaluarRiesgo, faltantesParaValidar, requiereRiesgo } from '../lib/riesgo'
import { COLUMNAS_MATRIZ, idHallazgo, normaYNumeral, textoRiesgo } from '../lib/matriz'
import { extracto } from '../lib/formato'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { BadgeClasificacion } from '../components/hallazgos/BadgeClasificacion'
import { ModalHallazgo } from '../components/hallazgos/ModalHallazgo'
import { MapaCalor } from '../components/riesgo/MapaCalor'
import { ResultadosAuditoria } from '../components/matriz/ResultadosAuditoria'
import { AreaTexto, Boton, BotonEnlace, EstadoError, EstadoVacio, Modal, Skeleton } from '../components/ui'

const TONO_ESTADO = {
  pendiente: 'border-tinta-300 bg-tinta-50 text-tinta-900',
  confirmado: 'border-fort-borde bg-fort-bg text-fort-texto',
  cambios_sugeridos: 'border-obs-borde bg-obs-bg text-obs-texto',
}

function Evaluacion({ h }) {
  if (!requiereRiesgo(h)) return <span className="text-tinta-500">No aplica</span>
  const e = evaluarRiesgo(h)
  if (!e) return <span className="italic text-obs-texto">Sin evaluar</span>
  const c = COLORES_ZONA[e.zona]
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: c.fondo, borderColor: c.borde, color: c.texto }}>
        {e.etiqueta} ({e.puntaje})
      </span>
      <span className="text-xs tabular-nums text-tinta-500">P{e.probabilidad} × I{e.impacto}</span>
    </span>
  )
}

function Controles({ h }) {
  if (!requiereRiesgo(h)) return <span className="text-tinta-500">No aplica</span>
  const lista = controlesAdoptados(h)
  if (!lista.length) return <span className="italic text-obs-texto">Sin controles adoptados</span>
  return (
    <ul className="list-disc space-y-1 pl-4">
      {lista.map((c) => <li key={c.descripcion}>{extracto(c.descripcion, 140)}</li>)}
    </ul>
  )
}

function SelectorEstado({ h, alCambiar, deshabilitado }) {
  const valor = estadoMatriz(h.estado)
  return (
    <select
      aria-label={`Estado de ${idHallazgo(h)}`}
      value={valor}
      disabled={deshabilitado}
      onChange={(e) => alCambiar(h, e.target.value)}
      className={cx('w-full rounded-md text-xs font-semibold focus:border-halla-500 focus:ring-halla-500', TONO_ESTADO[valor])}
    >
      {ESTADOS_MATRIZ.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
    </select>
  )
}

/**
 * Matriz consolidada de la auditoría: ID, clasificación, norma y numeral, evidencia, riesgo, hallazgo,
 * evaluación, controles y estado. Solo se descarga cuando TODOS los hallazgos vigentes están validados.
 */
export default function MatrizConsolidada() {
  const { id } = useParams()
  const { notificar } = useToast()
  const auditoria = useAuditoria(id)
  const { datos: todos, setDatos, cargando, error, recargar } = useHallazgos(id)
  const [abierto, setAbierto] = useState(null)
  const [irAFaltante, setIrAFaltante] = useState(false)
  const abrir = (h, faltante = false) => {
    setIrAFaltante(faltante)
    setAbierto(h)
  }
  const [guardando, setGuardando] = useState(false)
  const [bloqueo, setBloqueo] = useState(null)
  const [nota, setNota] = useState(null)
  const [descargando, setDescargando] = useState(false)

  const vigentes = useMemo(() => todos.filter((h) => h.estado !== 'descartado'), [todos])
  const conteo = useMemo(() => conteoPorCasilla(vigentes), [vigentes])

  if (auditoria.cargando) return <PantallaCarga />
  if (auditoria.error) return <EstadoError mensaje={auditoria.error} alReintentar={auditoria.recargar} />
  if (!auditoria.datos) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." />
  const a = auditoria.datos
  const cuantos = (estado) => vigentes.filter((h) => estadoMatriz(h.estado) === estado).length
  const validados = cuantos('confirmado')

  const reemplazar = (nuevo) => {
    setDatos((lista) => lista.map((h) => (h.id === nuevo.id ? nuevo : h)))
    setAbierto((actual) => (actual?.id === nuevo.id ? nuevo : actual))
  }
  const actualizar = async (h, cambios, mensaje) => {
    setGuardando(true)
    const { data, error: err } = await actualizarHallazgo(h.id, cambios)
    setGuardando(false)
    if (err) {
      notificar(err, 'error')
      return false
    }
    reemplazar(data)
    if (mensaje) notificar(mensaje, 'exito')
    return true
  }

  const validar = (h) => {
    const faltan = faltantesParaValidar(h)
    if (faltan.length) return abrir(h, true) // se abre en la sección por completar, con lo que falta
    return actualizar(h, { estado: 'confirmado', nota_validacion: null }, `${idHallazgo(h)} validado`)
  }

  const cambiarEstado = (h, valor) => {
    if (valor === 'confirmado') return validar(h)
    if (valor === 'cambios_sugeridos') return setNota({ h, texto: h.nota_validacion ?? '' })
    return actualizar(h, { estado: h.editado_por_usuario ? 'editado' : 'generado', nota_validacion: null }, `${idHallazgo(h)} vuelve a Pendiente`)
  }

  const editar = (cambios) => {
    if (!abierto) return
    actualizar(abierto, { ...cambios, ...(abierto.estado === 'generado' ? { estado: 'editado' } : {}) })
  }

  const descargar = async () => {
    if (!vigentes.length) return notificar('La matriz todavía no tiene hallazgos.', 'info')
    const pendientes = vigentes.filter((h) => estadoMatriz(h.estado) === 'pendiente')
    const cambios = vigentes.filter((h) => h.estado === 'cambios_sugeridos')
    if (pendientes.length || cambios.length) return setBloqueo({ pendientes, cambios })
    setDescargando(true)
    try {
      await (await import('../lib/exportar-matriz')).exportarMatriz({ auditoria: a, hallazgos: vigentes })
      notificar('Matriz descargada', 'exito')
    } catch (e) {
      console.error(e)
      notificar('No se pudo generar el archivo de Excel. Inténtalo de nuevo.', 'error')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      <Encabezado
        antetitulo={`${a.codigo} · ${a.alcance === 'SISTEMAS' ? 'Sistema' : 'Proceso'}: ${objetoAuditado(a)}`}
        titulo="Matriz consolidada"
        descripcion="Revisa cada hallazgo y marca su estado. La matriz se descarga en Excel cuando todos están validados."
        volver={{ a: `/app/auditorias/${id}`, etiqueta: a.titulo }}
        acciones={
          <>
            <BotonEnlace a={`/app/auditorias/${id}/hallazgos/nuevo`} icono={FilePlus2} variante="secundario" deshabilitado={a.estado === 'cerrada'}>Nuevo hallazgo</BotonEnlace>
            <Boton icono={FileSpreadsheet} onClick={descargar} cargando={descargando}>Descargar matriz (Excel)</Boton>
          </>
        }
      />

      {error && <EstadoError mensaje={error} alReintentar={recargar} />}
      {cargando && <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>}

      {!cargando && !error && vigentes.length === 0 && (
        <EstadoVacio
          icono={FilePlus2}
          titulo="La matriz está vacía"
          descripcion="Registra un hallazgo: al terminar el paso 7 del asistente llega aquí como Pendiente."
          accion={<BotonEnlace a={`/app/auditorias/${id}/hallazgos/nuevo`} icono={FilePlus2}>Registrar un hallazgo</BotonEnlace>}
        />
      )}

      {!cargando && vigentes.length > 0 && (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,24rem)]">
            <div className="space-y-4">
              <ul className="grid grid-cols-3 gap-3" aria-label="Hallazgos por estado">
                {ESTADOS_MATRIZ.map((e) => (
                  <li key={e.valor} className={cx('rounded-lg border p-4', TONO_ESTADO[e.valor])}>
                    <span className="block text-3xl font-semibold tabular-nums">{cuantos(e.valor)}</span>
                    <span className="block text-sm">{e.etiqueta}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-tinta-700" aria-live="polite">
                {validados === vigentes.length
                  ? 'Todos los hallazgos están validados: ya puedes descargar la matriz.'
                  : `${validados} de ${vigentes.length} hallazgos validados. La descarga se habilita cuando todos estén en «Validado».`}
              </p>
            </div>
            <div className="rounded-lg border border-tinta-100 bg-white p-4 shadow-sm">
              <MapaCalor conteo={conteo} titulo="Mapa de calor de la auditoría" compacto />
            </div>
          </div>

          {/* Escritorio: tabla con desplazamiento horizontal propio (la matriz es ancha por naturaleza); el ID y el
              estado quedan fijos a los lados para no perder la fila ni la acción al desplazar */}
          <div className="hidden overflow-x-auto rounded-lg border border-tinta-100 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <caption className="sr-only">Matriz consolidada de hallazgos de la auditoría {a.codigo}</caption>
              <thead className="bg-tinta-900 text-xs uppercase tracking-wide text-white">
                <tr>
                  {COLUMNAS_MATRIZ.map((c, i) => (
                    <th key={c} scope="col" className={cx('bg-tinta-900 px-3 py-2.5 font-semibold', i === 0 && 'sticky left-0 z-10', i === COLUMNAS_MATRIZ.length - 1 && 'sticky right-0 z-10')}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100 align-top">
                {vigentes.map((h) => (
                  <tr key={h.id}>
                    <th scope="row" className="sticky left-0 bg-white px-3 py-3 shadow-[1px_0_0_#e6eaee]">
                      <button type="button" onClick={() => abrir(h)} className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-sm font-semibold text-halla-700 hover:underline" aria-label={`Ver y editar ${idHallazgo(h)}`}>
                        {idHallazgo(h)} <Eye className="size-3.5" aria-hidden="true" />
                      </button>
                    </th>
                    <td className="px-3 py-3"><BadgeClasificacion clasificacion={h.clasificacion} /></td>
                    <td className="whitespace-pre-line px-3 py-3 text-xs text-tinta-700">{extracto(normaYNumeral(h), 160)}</td>
                    <td className="px-3 py-3 text-xs text-tinta-700">{extracto(h.evidencia, 200)}</td>
                    <td className="whitespace-pre-line px-3 py-3 text-xs text-tinta-700">{extracto(textoRiesgo(h), 220) || <span className="italic text-obs-texto">Sin identificar</span>}</td>
                    <td className="px-3 py-3 font-serif text-[13px] leading-relaxed text-tinta-900">{extracto(h.hallazgo_corregido, 280)}</td>
                    <td className="px-3 py-3"><Evaluacion h={h} /></td>
                    <td className="px-3 py-3 text-xs text-tinta-700"><Controles h={h} /></td>
                    <td className="sticky right-0 w-48 bg-white px-3 py-3 shadow-[-1px_0_0_#e6eaee]">
                      <SelectorEstado h={h} alCambiar={cambiarEstado} deshabilitado={guardando} />
                      {h.estado === 'cambios_sugeridos' && h.nota_validacion && <p className="mt-1 text-xs text-obs-texto">{extracto(h.nota_validacion, 120)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil y tableta: una tarjeta por hallazgo con las mismas columnas */}
          <ul className="space-y-3 lg:hidden" aria-label="Matriz consolidada">
            {vigentes.map((h) => (
              <li key={h.id} className="rounded-lg border border-tinta-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-tinta-500">{idHallazgo(h)}</span>
                  <BadgeClasificacion clasificacion={h.clasificacion} />
                  <Evaluacion h={h} />
                </div>
                <p className="mt-2 font-serif text-[15px] leading-relaxed text-tinta-900">{extracto(h.hallazgo_corregido, 220)}</p>
                <dl className="mt-3 space-y-2 text-xs text-tinta-700">
                  <div><dt className="font-semibold text-tinta-500">Norma y numeral</dt><dd className="whitespace-pre-line">{extracto(normaYNumeral(h), 160)}</dd></div>
                  <div><dt className="font-semibold text-tinta-500">Evidencia</dt><dd>{extracto(h.evidencia, 160)}</dd></div>
                  <div><dt className="font-semibold text-tinta-500">Riesgo</dt><dd className="whitespace-pre-line">{extracto(textoRiesgo(h), 180) || 'Sin identificar'}</dd></div>
                  <div><dt className="font-semibold text-tinta-500">Controles</dt><dd><Controles h={h} /></dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-tinta-100 pt-3">
                  <div className="min-w-0 flex-1">
                    <SelectorEstado h={h} alCambiar={cambiarEstado} deshabilitado={guardando} />
                  </div>
                  <Boton variante="secundario" tamano="sm" icono={Eye} onClick={() => abrir(h)}>Ver y editar</Boton>
                </div>
                {h.estado === 'cambios_sugeridos' && h.nota_validacion && <p className="mt-2 text-xs text-obs-texto">{h.nota_validacion}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Consolidado de resultados, justo debajo de la matriz (también vacío, con su aviso) */}
      {!cargando && !error && <ResultadosAuditoria hallazgos={vigentes} />}

      <ModalHallazgo hallazgo={abierto} irAFaltante={irAFaltante} alCerrar={() => setAbierto(null)} alCambiar={editar} alValidar={validar} guardando={guardando} conteo={conteo} />

      <Modal
        abierto={Boolean(bloqueo)}
        alCerrar={() => setBloqueo(null)}
        ancho="md"
        titulo={bloqueo?.pendientes.length ? 'La matriz aún no se ha validado' : 'Hay hallazgos con cambios sugeridos'}
        pie={<Boton onClick={() => setBloqueo(null)}>Entendido</Boton>}
      >
        {bloqueo && (
          <div className="space-y-3 text-sm text-tinta-700">
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-obs-texto" aria-hidden="true" />
              La matriz solo se puede descargar cuando todos los hallazgos están en «Validado».
            </p>
            {bloqueo.pendientes.length > 0 && (
              <p><span className="font-semibold">Pendientes de validar:</span> {bloqueo.pendientes.map(idHallazgo).join(', ')}.</p>
            )}
            {bloqueo.cambios.length > 0 && (
              <div>
                <p className="font-semibold">Con cambios sugeridos (corrígelos y valídalos):</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {bloqueo.cambios.map((h) => <li key={h.id}>{idHallazgo(h)}{h.nota_validacion ? `: ${h.nota_validacion}` : ''}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        abierto={Boolean(nota)}
        alCerrar={() => setNota(null)}
        ancho="md"
        titulo={nota ? `Se sugiere hacer cambios · ${idHallazgo(nota.h)}` : ''}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setNota(null)}>Cancelar</Boton>
            <Boton
              cargando={guardando}
              onClick={async () => {
                const listo = await actualizar(nota.h, { estado: 'cambios_sugeridos', nota_validacion: nota.texto.trim() || null }, `${idHallazgo(nota.h)}: se sugieren cambios`)
                if (listo) setNota(null)
              }}
            >
              Guardar
            </Boton>
          </>
        }
      >
        {nota && (
          <AreaTexto
            etiqueta="¿Qué cambios se sugieren? (opcional)"
            rows={4}
            maxLength={1000}
            value={nota.texto}
            onChange={(e) => setNota((n) => ({ ...n, texto: e.target.value }))}
            ayuda="Quedará visible en la matriz hasta que el hallazgo se corrija y se valide."
          />
        )}
      </Modal>
    </>
  )
}
