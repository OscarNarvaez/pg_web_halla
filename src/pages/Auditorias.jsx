import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useAuditorias } from '../hooks/useAuditorias'
import { CLASIFICACIONES, ESTADOS_AUDITORIA, ORDEN_INFORME, objetoAuditado } from '../lib/catalogos'
import { fechaCorta } from '../lib/formato'
import { Encabezado } from '../components/layout/Encabezado'
import { Badge, BotonEnlace, EstadoError, EstadoVacio, Skeleton } from '../components/ui'

const TONO_ESTADO = { borrador: 'neutro', en_curso: 'marca', cerrada: 'neutro' }

export default function Auditorias() {
  const { datos: auditorias, cargando, error, recargar } = useAuditorias()

  return (
    <>
      <Encabezado
        titulo="Auditorías"
        descripcion="Cada auditoría agrupa los hallazgos de un proceso o sistema y termina en un informe."
        acciones={<BotonEnlace a="/app/auditorias/nueva" icono={Plus}>Nueva auditoría</BotonEnlace>}
      />
      {error && <EstadoError mensaje={error} alReintentar={recargar} />}
      {cargando && (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando auditorías">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}
      {!cargando && !error && auditorias.length === 0 && (
        <EstadoVacio
          icono={ClipboardList}
          titulo="Aún no tienes auditorías"
          descripcion="Crea tu primera auditoría: defines el proceso o sistema y, dentro de ella, registras los hallazgos."
          accion={<BotonEnlace a="/app/auditorias/nueva" icono={Plus}>Crear auditoría</BotonEnlace>}
        />
      )}
      {!cargando && auditorias.length > 0 && (
        <ul className="space-y-3">
          {auditorias.map((a) => (
            <li key={a.id}>
              <Link
                to={`/app/auditorias/${a.id}`}
                className="block rounded-lg border border-tinta-100 bg-white p-4 shadow-sm transition-colors hover:border-halla-400 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-halla-700">{a.codigo}</p>
                    <h2 className="truncate font-semibold text-tinta-900">{a.titulo}</h2>
                    <p className="text-sm text-tinta-500">
                      {objetoAuditado(a)}
                      {a.fecha_inicio && ` · ${fechaCorta(a.fecha_inicio)}${a.fecha_fin ? ` a ${fechaCorta(a.fecha_fin)}` : ''}`}
                    </p>
                  </div>
                  <Badge tono={TONO_ESTADO[a.estado]}>{ESTADOS_AUDITORIA[a.estado]}</Badge>
                </div>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-500">
                  <span>{a.total_hallazgos} hallazgo{a.total_hallazgos === 1 ? '' : 's'}</span>
                  {ORDEN_INFORME.filter((c) => a.conteo[c]).map((c) => (
                    <span key={c}>{a.conteo[c]} {(a.conteo[c] === 1 ? CLASIFICACIONES[c].etiqueta : CLASIFICACIONES[c].plural).toLowerCase()}</span>
                  ))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
