import { CheckCircle2, Copy, Eye, RotateCcw, Trash2 } from 'lucide-react'
import { CLASIFICACIONES, ESTADOS_HALLAZGO, MARCADOR_PENDIENTE, TONOS } from '../../lib/catalogos'
import { COLORES_ZONA, evaluarRiesgo } from '../../lib/riesgo'
import { extracto } from '../../lib/formato'
import { cx } from '../../lib/cx'
import { Badge } from '../ui/Badge'
import { BadgeClasificacion } from './BadgeClasificacion'

const TONO_ESTADO = { generado: 'neutro', editado: 'neutro', confirmado: 'fort', cambios_sugeridos: 'obs', descartado: 'neutro' }

function Accion({ icono: Icono, children, ...resto }) {
  return (
    <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-tinta-700 hover:bg-tinta-50 hover:text-halla-700" {...resto}>
      <Icono className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

/** Fila de la lista de hallazgos de una auditoría. */
export function TarjetaHallazgo({ hallazgo: h, umbrales, alVer, alValidar, alDescartar, alRestaurar, alDuplicar }) {
  const tono = CLASIFICACIONES[h.clasificacion]?.tono
  const descartado = h.estado === 'descartado'
  const riesgo = evaluarRiesgo(h, umbrales)
  return (
    <article
      className={cx('rounded-lg border border-tinta-100 bg-white p-4 shadow-sm sm:p-5', descartado && 'opacity-60')}
      style={{ borderLeft: `4px solid ${TONOS[tono]?.solido ?? '#9fb0bf'}` }}
      aria-label={`Hallazgo ${h.consecutivo}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-tinta-500">H-{String(h.consecutivo).padStart(2, '0')}</span>
        <BadgeClasificacion clasificacion={h.clasificacion} />
        <Badge tono={TONO_ESTADO[h.estado]}>{ESTADOS_HALLAZGO[h.estado]}</Badge>
        {riesgo && (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: COLORES_ZONA[riesgo.zona].fondo, borderColor: COLORES_ZONA[riesgo.zona].borde, color: COLORES_ZONA[riesgo.zona].texto }}>
            Riesgo {riesgo.etiqueta} ({riesgo.puntaje})
          </span>
        )}
        {h.editado_por_usuario && <span className="text-xs text-tinta-500">editado por el auditor</span>}
        {h.avisos?.some((a) => a.startsWith('Revisa la redacción')) && <Badge tono="obs">Revisar redacción</Badge>}
      </div>
      <p className="mt-3 font-serif text-[15px] leading-relaxed text-tinta-900">{extracto(h.hallazgo_corregido, 280)}</p>
      <p className="mt-2 text-xs text-tinta-500">
        <span className="font-semibold">Criterio:</span>{' '}
        {h.criterio_requisito === MARCADOR_PENDIENTE ? <span className="italic">requisito pendiente de identificación</span> : extracto(h.criterio_requisito, 140)}
      </p>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-tinta-100 pt-2">
        <Accion icono={Eye} onClick={() => alVer(h)}>Ver y editar</Accion>
        {!descartado && h.estado !== 'confirmado' && <Accion icono={CheckCircle2} onClick={() => alValidar(h)}>Validar</Accion>}
        {!descartado && <Accion icono={Copy} onClick={() => alDuplicar(h)}>Duplicar</Accion>}
        {descartado ? (
          <Accion icono={RotateCcw} onClick={() => alRestaurar(h)}>Restaurar</Accion>
        ) : (
          <Accion icono={Trash2} onClick={() => alDescartar(h)}>Descartar</Accion>
        )}
      </div>
    </article>
  )
}
