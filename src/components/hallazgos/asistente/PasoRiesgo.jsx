import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { DIMENSIONES_IMPACTO, ESCALA_PROBABILIDAD, FUENTE_RIESGO, NIVELES_IMPACTO } from '../../../lib/catalogos'
import { requiereRiesgo } from '../../../lib/riesgo'
import { CampoEditable } from '../CampoEditable'
import { AvisosHallazgo } from '../AvisosHallazgo'
import { AVISOS_DEL_PASO } from './pasos'
import { MapaCalor } from '../../riesgo/MapaCalor'
import { NivelRiesgo } from '../../riesgo/NivelRiesgo'
import { SelectorEscala } from '../../riesgo/SelectorEscala'
import { UmbralesRiesgo } from '../../riesgo/UmbralesRiesgo'

const OPCIONES_PROBABILIDAD = ESCALA_PROBABILIDAD.map((p) => ({ valor: p.valor, etiqueta: p.categoria, descripcion: p.descripcion }))

/**
 * Paso 5: identificación, evaluación y mapa de calor del riesgo según el PR13_GQ. La IA propone; el auditor
 * confirma o ajusta. El nivel lo calcula la aplicación (probabilidad × impacto con los umbrales).
 * @param {object} props
 * @param {object} props.hallazgo
 * @param {(cambios: object) => void} props.alCambiar
 * @param {{ bajo: number, moderado: number, alto: number }} props.umbrales
 * @param {Record<string, number>} [props.conteo] Hallazgos de la auditoría por casilla.
 * @param {object} [props.propuesta] Riesgo original de la IA, para señalar sus valores.
 * @param {(u: object) => Promise<string>} [props.alGuardarUmbrales] Si se pasa, la escala se puede editar.
 */
export function PasoRiesgo({ hallazgo, alCambiar, umbrales, conteo = {}, propuesta, alGuardarUmbrales, deshabilitado = false }) {
  const idDimension = useId()
  if (!requiereRiesgo(hallazgo)) {
    return (
      <p className="rounded-lg border border-fort-borde bg-fort-bg p-4 text-sm text-fort-texto">
        No aplica: una fortaleza describe una práctica que ya funciona, no una situación que exponga a un riesgo.
      </p>
    )
  }
  const dimension = DIMENSIONES_IMPACTO[hallazgo.riesgo_dimension]
  const opcionesImpacto = NIVELES_IMPACTO.map((nivel, i) => ({
    valor: i + 1,
    etiqueta: nivel,
    descripcion: dimension ? dimension.niveles[i] : 'Elige primero la dimensión de impacto para ver la descripción del PR13.',
  }))
  const actual = hallazgo.riesgo_probabilidad && hallazgo.riesgo_impacto ? { probabilidad: hallazgo.riesgo_probabilidad, impacto: hallazgo.riesgo_impacto } : null

  return (
    <div className="space-y-5">
      <AvisosHallazgo avisos={hallazgo.avisos} filtro={AVISOS_DEL_PASO.riesgo} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-5">
          <CampoEditable
            etiqueta="Riesgo identificado"
            valor={hallazgo.riesgo_descripcion ?? ''}
            marcador="Describe el riesgo asociado al hallazgo"
            deshabilitado={deshabilitado}
            minimo={15}
            maximo={1000}
            alGuardar={(v) => alCambiar({ riesgo_descripcion: v })}
          />
          <div>
            <label htmlFor={idDimension} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tinta-500">Dimensión de impacto</label>
            <select
              id={idDimension}
              value={hallazgo.riesgo_dimension ?? ''}
              disabled={deshabilitado}
              onChange={(e) => alCambiar({ riesgo_dimension: e.target.value || null })}
              className="block w-full rounded-md border-tinta-300 text-sm focus:border-halla-500 focus:ring-halla-500"
            >
              <option value="">Sin definir</option>
              {Object.entries(DIMENSIONES_IMPACTO).map(([clave, d]) => (
                <option key={clave} value={clave}>{d.etiqueta}</option>
              ))}
            </select>
          </div>
          <SelectorEscala
            etiqueta="Probabilidad (1 a 5, según el PR13_GQ)"
            valor={hallazgo.riesgo_probabilidad}
            opciones={OPCIONES_PROBABILIDAD}
            propuesto={propuesta?.riesgo_probabilidad ?? null}
            deshabilitado={deshabilitado}
            alCambiar={(v) => alCambiar({ riesgo_probabilidad: v })}
          />
          <SelectorEscala
            etiqueta="Impacto (1 a 5, según el PR13_GQ)"
            valor={hallazgo.riesgo_impacto}
            opciones={opcionesImpacto}
            propuesto={propuesta?.riesgo_impacto ?? null}
            deshabilitado={deshabilitado}
            alCambiar={(v) => alCambiar({ riesgo_impacto: v })}
          />
          <CampoEditable
            etiqueta="Justificación de la probabilidad y el impacto"
            valor={hallazgo.riesgo_justificacion ?? ''}
            marcador="Por qué esa probabilidad y ese impacto"
            deshabilitado={deshabilitado}
            maximo={1500}
            alGuardar={(v) => alCambiar({ riesgo_justificacion: v })}
          />
        </div>
        <div className="space-y-5">
          <NivelRiesgo hallazgo={hallazgo} umbrales={umbrales} />
          <MapaCalor
            umbrales={umbrales}
            conteo={conteo}
            actual={actual}
            deshabilitado={deshabilitado}
            alElegir={(p, i) => alCambiar({ riesgo_probabilidad: p, riesgo_impacto: i })}
          />
          {alGuardarUmbrales && (
            <details className="group rounded-md border border-tinta-100 px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-tinta-700">
                Escala de niveles de la auditoría
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3">
                <UmbralesRiesgo umbrales={umbrales} alGuardar={alGuardarUmbrales} deshabilitado={deshabilitado} />
              </div>
            </details>
          )}
        </div>
      </div>
      <p className="text-xs text-tinta-500">Fuente de las escalas: {FUENTE_RIESGO}. Puedes elegir la casilla directamente en el mapa.</p>
    </div>
  )
}
