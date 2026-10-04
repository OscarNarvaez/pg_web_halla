import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, FilePlus2, Plus } from 'lucide-react'
import { startOfMonth } from 'date-fns'
import { usePerfil } from '../hooks/usePerfil'
import { useAuditorias } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { ORDEN_INFORME } from '../lib/catalogos'
import { extracto, haceCuanto } from '../lib/formato'
import { Encabezado } from '../components/layout/Encabezado'
import { BadgeClasificacion } from '../components/hallazgos/BadgeClasificacion'
import { GraficaClasificaciones } from '../components/informe/GraficaClasificaciones'
import { BotonEnlace, EstadoError, EstadoVacio, Skeleton, Tarjeta } from '../components/ui'

function Cifra({ etiqueta, valor, detalle }) {
  return (
    <div className="rounded-lg border border-tinta-100 bg-white p-5 shadow-sm">
      <p className="text-sm text-tinta-500">{etiqueta}</p>
      <p className="mt-1 text-3xl font-semibold text-tinta-900">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta-500">{detalle}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { perfil, primerNombre, objeto } = usePerfil()
  const auditorias = useAuditorias()
  const recientes = useConsulta(
    () =>
      supabase
        .from('hallazgos')
        .select('id, auditoria_id, consecutivo, clasificacion, hallazgo_corregido, estado, creado_en, auditorias(codigo)')
        .neq('estado', 'descartado')
        .order('creado_en', { ascending: false })
        .limit(500),
    [],
    { inicial: [] },
  )

  const resumen = useMemo(() => {
    const inicioMes = startOfMonth(new Date())
    const hallazgos = recientes.datos ?? []
    const conteo = ORDEN_INFORME.reduce((acc, c) => ({ ...acc, [c]: hallazgos.filter((h) => h.clasificacion === c).length }), {})
    return {
      conteo,
      total: hallazgos.length,
      delMes: hallazgos.filter((h) => new Date(h.creado_en) >= inicioMes).length,
      porRevisar: hallazgos.filter((h) => h.estado === 'generado' || h.estado === 'editado' || h.estado === 'cambios_sugeridos').length,
      ultimos: hallazgos.slice(0, 5),
    }
  }, [recientes.datos])

  const lista = auditorias.datos ?? []
  const enCurso = lista.filter((a) => a.estado !== 'cerrada')
  const destinoNuevo = enCurso[0] ? `/app/auditorias/${enCurso[0].id}/hallazgos/nuevo` : null
  const cargando = auditorias.cargando || recientes.cargando

  return (
    <>
      <Encabezado
        titulo={`Hola, ${primerNombre}`}
        descripcion={`${perfil.alcance === 'SISTEMAS' ? 'Sistema' : 'Proceso'}: ${objeto}`}
        acciones={
          destinoNuevo ? (
            <BotonEnlace a={destinoNuevo} icono={FilePlus2}>Nuevo hallazgo</BotonEnlace>
          ) : (
            <BotonEnlace a="/app/auditorias/nueva" icono={Plus}>Nueva auditoría</BotonEnlace>
          )
        }
      />

      {(auditorias.error || recientes.error) && (
        <EstadoError mensaje={auditorias.error || recientes.error} alReintentar={() => { auditorias.recargar(); recientes.recargar() }} className="mb-6" />
      )}

      {cargando && (
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Cargando el panel">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}

      {!cargando && lista.length === 0 && (
        <EstadoVacio
          icono={ClipboardList}
          titulo="Empieza por crear una auditoría"
          descripcion="Una auditoría define el proceso o sistema que revisas. Dentro de ella describes lo que observaste y la IA clasifica y redacta cada hallazgo. Al final generas el informe."
          accion={<BotonEnlace a="/app/auditorias/nueva" icono={Plus}>Crear mi primera auditoría</BotonEnlace>}
        />
      )}

      {!cargando && lista.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Cifra etiqueta="Auditorías abiertas" valor={enCurso.length} detalle={`${lista.length} en total`} />
            <Cifra etiqueta="Hallazgos este mes" valor={resumen.delMes} detalle={`${resumen.total} vigentes en total`} />
            <Cifra etiqueta="Hallazgos por revisar" valor={resumen.porRevisar} detalle="Pendientes o con cambios sugeridos, sin validar" />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Tarjeta titulo="Distribución por clasificación" descripcion="Hallazgos vigentes de todas tus auditorías." className="xl:col-span-3">
              {resumen.total > 0 ? (
                <GraficaClasificaciones conteo={resumen.conteo} />
              ) : (
                <p className="text-sm text-tinta-500">Cuando registres hallazgos, aquí verás cuántos hay de cada categoría.</p>
              )}
            </Tarjeta>

            <Tarjeta titulo="Últimos hallazgos" className="xl:col-span-2">
              {resumen.ultimos.length === 0 ? (
                <div className="text-sm text-tinta-500">
                  <p>Aún no hay hallazgos.</p>
                  {destinoNuevo && <Link to={destinoNuevo} className="enlace mt-2 inline-block">Registrar el primero</Link>}
                </div>
              ) : (
                <ul className="divide-y divide-tinta-100">
                  {resumen.ultimos.map((h) => (
                    <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                      <Link to={`/app/auditorias/${h.auditoria_id}`} className="group block">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeClasificacion clasificacion={h.clasificacion} />
                          <span className="text-xs text-tinta-500">{h.auditorias?.codigo} · H-{String(h.consecutivo).padStart(2, '0')} · {haceCuanto(h.creado_en)}</span>
                        </div>
                        <p className="mt-1 text-sm text-tinta-700 group-hover:text-halla-700">{extracto(h.hallazgo_corregido, 120)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  )
}
