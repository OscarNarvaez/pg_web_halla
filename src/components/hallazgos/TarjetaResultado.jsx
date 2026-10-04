import { useId, useState } from 'react'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { CLASIFICACIONES, ESTRUCTURAS, SEVERIDADES, TONOS } from '../../lib/catalogos'
import { cx } from '../../lib/cx'
import { BadgeClasificacion } from './BadgeClasificacion'
import { CampoEditable } from './CampoEditable'
import { ChipsCriterios } from './ChipsCriterios'

const AVISO_ESTRUCTURA = 'Revisa la redacción'

/**
 * Resultado de la IA para un hallazgo: clasificación, campos editables en el sitio, criterios y avisos.
 * La clasificación la decide la IA; el auditor solo puede corregirla DESPUÉS, de forma explícita.
 */
export function TarjetaResultado({ hallazgo, alCambiar, deshabilitado = false, encabezado }) {
  const [corrigiendo, setCorrigiendo] = useState(false)
  const idSeveridad = useId()
  const idClasificacion = useId()
  const tono = CLASIFICACIONES[hallazgo.clasificacion]?.tono
  const estructura = ESTRUCTURAS[hallazgo.clasificacion]

  return (
    <article
      className="overflow-hidden rounded-lg border border-tinta-100 bg-white shadow-sm"
      style={{ borderTop: `4px solid ${TONOS[tono]?.solido ?? '#9fb0bf'}` }}
    >
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {encabezado && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-500">{encabezado}</p>}
            <BadgeClasificacion clasificacion={hallazgo.clasificacion} tamano="lg" />
          </div>
          {!deshabilitado && (
            <button
              type="button"
              onClick={() => setCorrigiendo((v) => !v)}
              aria-expanded={corrigiendo}
              className="inline-flex items-center gap-1 text-xs font-medium text-tinta-500 hover:text-halla-700"
            >
              Corregir clasificación
              <ChevronDown className={cx('size-3.5 transition-transform', corrigiendo && 'rotate-180')} aria-hidden="true" />
            </button>
          )}
        </div>

        {corrigiendo && (
          <div className="rounded-md border border-obs-borde bg-obs-bg p-3 text-sm text-obs-texto">
            <p>La IA determinó la clasificación a partir de la evidencia. Cámbiala solo si tu criterio profesional lo justifica: quedará registrado que la editaste.</p>
            <label htmlFor={idClasificacion} className="mt-2 block text-xs font-semibold">Clasificación</label>
            <select
              id={idClasificacion}
              value={hallazgo.clasificacion}
              onChange={(e) => {
                alCambiar({ clasificacion: e.target.value })
                setCorrigiendo(false)
              }}
              className="mt-1 block w-full rounded-md border-obs-borde text-sm text-tinta-900 focus:border-halla-500 focus:ring-halla-500 sm:w-72"
            >
              {Object.entries(CLASIFICACIONES).map(([valor, c]) => (
                <option key={valor} value={valor}>{c.etiqueta}</option>
              ))}
            </select>
          </div>
        )}

        {hallazgo.avisos?.length > 0 && (
          <ul className="space-y-2">
            {hallazgo.avisos.map((aviso) => (
              <li
                key={aviso}
                className={cx(
                  'flex gap-2 rounded-md border px-3 py-2 text-sm',
                  aviso.startsWith(AVISO_ESTRUCTURA) ? 'border-obs-borde bg-obs-bg text-obs-texto' : 'border-om-borde bg-om-bg text-om-texto',
                )}
              >
                {aviso.startsWith(AVISO_ESTRUCTURA) ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                {aviso}
              </li>
            ))}
          </ul>
        )}

        <CampoEditable etiqueta="Hallazgo corregido" valor={hallazgo.hallazgo_corregido} destacado deshabilitado={deshabilitado} minimo={20}
          alGuardar={(v) => alCambiar({ hallazgo_corregido: v })} />
        {estructura && (
          <p className="-mt-3 text-xs text-tinta-500">
            Estructura aplicada: <span className="font-medium text-tinta-700">{estructura.formula}</span>
          </p>
        )}
        <CampoEditable etiqueta="Justificación de la clasificación" valor={hallazgo.justificacion} deshabilitado={deshabilitado} minimo={10}
          alGuardar={(v) => alCambiar({ justificacion: v })} />
        <div className="space-y-2">
          <CampoEditable etiqueta="Criterio / requisito" valor={hallazgo.criterio_requisito} deshabilitado={deshabilitado}
            alGuardar={(v) => alCambiar({ criterio_requisito: v })} />
          <ChipsCriterios citados={hallazgo.criterios_citados} criterioRequisito={hallazgo.criterio_requisito} />
        </div>
        <CampoEditable etiqueta="Evidencia" valor={hallazgo.evidencia} deshabilitado={deshabilitado} minimo={5}
          alGuardar={(v) => alCambiar({ evidencia: v })} />

        <div>
          <label htmlFor={idSeveridad} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tinta-500">Severidad</label>
          <select
            id={idSeveridad}
            value={hallazgo.severidad ?? ''}
            disabled={deshabilitado}
            onChange={(e) => alCambiar({ severidad: e.target.value || null })}
            className="block w-full rounded-md border-tinta-300 text-sm focus:border-halla-500 focus:ring-halla-500 sm:w-48"
          >
            <option value="">Sin definir</option>
            {SEVERIDADES.map((s) => (
              <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-tinta-500">Sugerida por la IA; ajústala según tu criterio.</p>
        </div>
      </div>
    </article>
  )
}
