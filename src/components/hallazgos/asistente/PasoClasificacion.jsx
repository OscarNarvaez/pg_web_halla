import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CLASIFICACIONES, SEVERIDADES } from '../../../lib/catalogos'
import { cx } from '../../../lib/cx'
import { BadgeClasificacion } from '../BadgeClasificacion'
import { CampoEditable } from '../CampoEditable'

/**
 * Paso 3: la clasificación que decidió la IA y por qué. El auditor solo puede corregirla DESPUÉS del
 * análisis y de forma explícita (regla innegociable 1); el cambio queda marcado como edición.
 */
export function PasoClasificacion({ hallazgo, alCambiar, deshabilitado = false }) {
  const [corrigiendo, setCorrigiendo] = useState(false)
  const idSeveridad = useId()
  const idClasificacion = useId()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BadgeClasificacion clasificacion={hallazgo.clasificacion} tamano="lg" />
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

      <CampoEditable etiqueta="Justificación de la clasificación" valor={hallazgo.justificacion} deshabilitado={deshabilitado} minimo={10}
        alGuardar={(v) => alCambiar({ justificacion: v })} />

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
  )
}
