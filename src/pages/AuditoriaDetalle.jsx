import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClipboardCheck, FilePlus2, FileText, Lock, LockOpen, Search, Table2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAuditoria } from '../hooks/useAuditorias'
import { actualizarHallazgo, duplicarHallazgo, useHallazgos } from '../hooks/useHallazgos'
import { CLASIFICACIONES, ESTADOS_AUDITORIA, ESTADOS_HALLAZGO, ORDEN_INFORME, TONOS, objetoAuditado } from '../lib/catalogos'
import { fechaLarga } from '../lib/formato'
import { conteoPorCasilla, faltantesParaValidar } from '../lib/riesgo'
import { mensajeError, supabase } from '../lib/supabase'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { TarjetaHallazgo } from '../components/hallazgos/TarjetaHallazgo'
import { ModalHallazgo } from '../components/hallazgos/ModalHallazgo'
import { Badge, Boton, BotonEnlace, EstadoError, EstadoVacio, Skeleton, claseControl } from '../components/ui'

export default function AuditoriaDetalle() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { notificar } = useToast()
  const auditoria = useAuditoria(id)
  const { datos: hallazgos, setDatos: setHallazgos, cargando, error, recargar } = useHallazgos(id)
  const [filtroClase, setFiltroClase] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('vigentes')
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const vigentes = useMemo(() => hallazgos.filter((h) => h.estado !== 'descartado'), [hallazgos])
  const conteo = useMemo(
    () => ORDEN_INFORME.reduce((acc, c) => ({ ...acc, [c]: vigentes.filter((h) => h.clasificacion === c).length }), {}),
    [vigentes],
  )
  const confirmados = vigentes.filter((h) => h.estado === 'confirmado').length
  const conteoMapa = useMemo(() => conteoPorCasilla(hallazgos), [hallazgos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return hallazgos.filter((h) => {
      if (filtroClase && h.clasificacion !== filtroClase) return false
      if (filtroEstado === 'vigentes' && h.estado === 'descartado') return false
      if (filtroEstado !== 'vigentes' && filtroEstado !== 'todos' && h.estado !== filtroEstado) return false
      if (!q) return true
      const texto = `${h.hallazgo_corregido} ${h.entrada_auditor} ${h.criterio_requisito} ${h.evidencia}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return texto.includes(q)
    })
  }, [hallazgos, filtroClase, filtroEstado, busqueda])

  if (auditoria.cargando) return <PantallaCarga />
  if (auditoria.error) return <EstadoError mensaje={auditoria.error} alReintentar={auditoria.recargar} />
  if (!auditoria.datos) return <EstadoVacio titulo="Auditoría no encontrada" descripcion="No existe o no tienes acceso a ella." accion={<BotonEnlace a="/app/auditorias" variante="secundario">Ver mis auditorías</BotonEnlace>} />
  const a = auditoria.datos
  const cerrada = a.estado === 'cerrada'

  const reemplazar = (nuevo) => {
    setHallazgos((lista) => lista.map((h) => (h.id === nuevo.id ? nuevo : h)))
    setAbierto((actual) => (actual?.id === nuevo.id ? nuevo : actual))
  }

  const actualizar = async (h, cambios, mensaje) => {
    setGuardando(true)
    const { data, error: err } = await actualizarHallazgo(h.id, cambios)
    setGuardando(false)
    if (err) return notificar(err, 'error')
    reemplazar(data)
    if (mensaje) notificar(mensaje, 'exito')
  }

  const editar = (cambios) => {
    if (!abierto) return
    // Editar un hallazgo pendiente lo deja en «editado»; si estaba validado, el servidor lo devuelve a pendiente
    actualizar(abierto, { ...cambios, ...(abierto.estado === 'generado' ? { estado: 'editado' } : {}) })
  }

  // Un hallazgo con riesgo incompleto o sin controles adoptados no se puede validar (la matriz quedaría coja)
  const validar = (h) => {
    const faltan = faltantesParaValidar(h)
    if (faltan.length) return notificar(`Para validar H-${String(h.consecutivo).padStart(2, '0')} falta ${faltan.join(', ')}.`, 'error')
    actualizar(h, { estado: 'confirmado', nota_validacion: null }, 'Hallazgo validado')
  }

  const duplicar = async (h) => {
    const { data, error: err } = await duplicarHallazgo(h, usuario.id)
    if (err) return notificar(err, 'error')
    setHallazgos((lista) => [...lista, data])
    notificar(`Hallazgo duplicado como H-${String(data.consecutivo).padStart(2, '0')}`, 'exito')
  }

  const cambiarEstadoAuditoria = async (estado) => {
    const { data, error: err } = await supabase.from('auditorias').update({ estado }).eq('id', id).select().single()
    if (err) return notificar(mensajeError(err), 'error')
    auditoria.setDatos(data)
    notificar(estado === 'cerrada' ? 'Auditoría cerrada' : 'Auditoría reabierta', 'exito')
  }

  return (
    <>
      <Encabezado
        antetitulo={`${a.codigo} · ${a.alcance === 'SISTEMAS' ? 'Sistema' : 'Proceso'}: ${objetoAuditado(a)}`}
        titulo={a.titulo}
        volver={{ a: '/app/auditorias', etiqueta: 'Auditorías' }}
        acciones={
          <>
            <BotonEnlace a={`/app/auditorias/${id}/hallazgos/nuevo`} icono={FilePlus2} deshabilitado={cerrada}>Nuevo hallazgo</BotonEnlace>
            <BotonEnlace a={`/app/auditorias/${id}/lista`} icono={ClipboardCheck} variante="secundario">Lista de verificación</BotonEnlace>
            <BotonEnlace a={`/app/auditorias/${id}/matriz`} icono={Table2} variante="secundario">Matriz consolidada</BotonEnlace>
            <BotonEnlace a={`/app/auditorias/${id}/informe`} icono={FileText} variante="secundario" deshabilitado={confirmados === 0}
              title={confirmados === 0 ? 'Valida al menos un hallazgo para generar el informe' : undefined}>
              Generar informe
            </BotonEnlace>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-tinta-500">
        <Badge tono={a.estado === 'en_curso' ? 'marca' : 'neutro'}>{ESTADOS_AUDITORIA[a.estado]}</Badge>
        {a.fecha_inicio && <span>{fechaLarga(a.fecha_inicio)}{a.fecha_fin ? ` a ${fechaLarga(a.fecha_fin)}` : ''}</span>}
        {a.area_auditada && <span>Área: {a.area_auditada}</span>}
        <button type="button" onClick={() => cambiarEstadoAuditoria(cerrada ? 'en_curso' : 'cerrada')}
          className="inline-flex items-center gap-1 font-medium text-halla-700 hover:underline">
          {cerrada ? <LockOpen className="size-4" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
          {cerrada ? 'Reabrir auditoría' : 'Cerrar auditoría'}
        </button>
      </div>
      {a.objetivo && <p className="mb-6 max-w-3xl text-sm text-tinta-700"><span className="font-semibold">Objetivo:</span> {a.objetivo}</p>}

      {/* Contadores por clasificación, con los colores semánticos */}
      <ul className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Hallazgos por clasificación">
        {ORDEN_INFORME.map((c) => {
          const cl = CLASIFICACIONES[c]
          const activo = filtroClase === c
          return (
            <li key={c}>
              <button
                type="button"
                onClick={() => setFiltroClase(activo ? '' : c)}
                aria-pressed={activo}
                className={cx('w-full rounded-lg border bg-white p-4 text-left shadow-sm transition-colors', activo ? 'border-tinta-900' : 'border-tinta-100 hover:border-tinta-300')}
                style={{ borderTop: `4px solid ${TONOS[cl.tono].solido}` }}
              >
                <span className="block text-3xl font-semibold tabular-nums text-tinta-900">{conteo[c]}</span>
                <span className="block text-sm text-tinta-500">{conteo[c] === 1 ? cl.etiqueta : cl.plural}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <section aria-labelledby="titulo-hallazgos">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <h2 id="titulo-hallazgos" className="mr-auto text-lg font-semibold text-tinta-900">Hallazgos</h2>
          <div className="relative w-full sm:w-64">
            <label htmlFor="buscar-hallazgos" className="sr-only">Buscar en los hallazgos</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-300" aria-hidden="true" />
            <input id="buscar-hallazgos" type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className={cx(claseControl, 'pl-9')} />
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-48">
            <label htmlFor="filtro-clase" className="sr-only">Clasificación</label>
            <select id="filtro-clase" value={filtroClase} onChange={(e) => setFiltroClase(e.target.value)} className={claseControl}>
              <option value="">Todas las clasificaciones</option>
              {ORDEN_INFORME.map((c) => <option key={c} value={c}>{CLASIFICACIONES[c].etiqueta}</option>)}
            </select>
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-44">
            <label htmlFor="filtro-estado" className="sr-only">Estado</label>
            <select id="filtro-estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={claseControl}>
              <option value="vigentes">Vigentes</option>
              <option value="todos">Todos</option>
              {Object.entries(ESTADOS_HALLAZGO).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
            </select>
          </div>
        </div>

        {error && <EstadoError mensaje={error} alReintentar={recargar} />}
        {cargando && <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>}
        {!cargando && !error && hallazgos.length === 0 && (
          <EstadoVacio
            icono={FilePlus2}
            titulo="Esta auditoría aún no tiene hallazgos"
            descripcion="Registra lo que observaste: la IA lo clasificará y redactará con la estructura de su categoría."
            accion={!cerrada && <BotonEnlace a={`/app/auditorias/${id}/hallazgos/nuevo`} icono={FilePlus2}>Registrar el primer hallazgo</BotonEnlace>}
          />
        )}
        {!cargando && hallazgos.length > 0 && filtrados.length === 0 && (
          <EstadoVacio titulo="Ningún hallazgo coincide con los filtros" accion={<Boton variante="secundario" onClick={() => { setFiltroClase(''); setFiltroEstado('vigentes'); setBusqueda('') }}>Quitar filtros</Boton>} />
        )}
        <div className="space-y-3">
          {filtrados.map((h) => (
            <TarjetaHallazgo
              key={h.id}
              hallazgo={h}
              alVer={setAbierto}
              alValidar={validar}
              alDescartar={(x) => actualizar(x, { estado: 'descartado' }, 'Hallazgo descartado')}
              alRestaurar={(x) => actualizar(x, { estado: 'editado' }, 'Hallazgo restaurado')}
              alDuplicar={duplicar}
            />
          ))}
        </div>
      </section>

      <ModalHallazgo
        hallazgo={abierto}
        alCerrar={() => setAbierto(null)}
        alCambiar={editar}
        alValidar={validar}
        guardando={guardando}
        conteo={conteoMapa}
      />
    </>
  )
}
