// Textos de la matriz consolidada: los mismos en pantalla y en el Excel descargado.
import { CLASIFICACIONES, DIMENSIONES_IMPACTO, ESTADOS_HALLAZGO, ETIQUETAS_CONTROL } from './catalogos'
import { controlesAdoptados, describirEvaluacion } from './riesgo'

export const COLUMNAS_MATRIZ = ['ID', 'Clasificación', 'Norma y numeral', 'Evidencia', 'Riesgo', 'Hallazgo', 'Evaluación', 'Controles', 'Estado']

export const idHallazgo = (h) => `H-${String(h.consecutivo).padStart(2, '0')}`

/** «NTC-ISO 9001:2015, numeral 9.3.3» por cada cita verificada, o el criterio redactado si no hay citas. */
export function normaYNumeral(h) {
  const citas = h.criterios_citados ?? []
  if (!citas.length) return h.criterio_requisito
  return citas.map((c) => `${c.documento}${c.numeral ? `, numeral ${c.numeral}` : ''}`).join('\n')
}

export function textoRiesgo(h) {
  if (h.clasificacion === 'FORTALEZA') return 'No aplica'
  const dimension = DIMENSIONES_IMPACTO[h.riesgo_dimension]?.etiqueta
  return [h.riesgo_descripcion, dimension && `Dimensión: ${dimension}`].filter(Boolean).join('\n')
}

export function textoControles(h) {
  if (h.clasificacion === 'FORTALEZA') return 'No aplica'
  return controlesAdoptados(h).map((c) => `• ${c.descripcion} (${ETIQUETAS_CONTROL[c.tipo].toLowerCase()})`).join('\n')
}

/** Filas de la matriz en el mismo orden y con los mismos textos que la pantalla. */
export function filasMatriz(hallazgos) {
  return hallazgos.map((h) => [
    idHallazgo(h),
    CLASIFICACIONES[h.clasificacion].etiqueta,
    normaYNumeral(h),
    h.evidencia,
    textoRiesgo(h),
    h.hallazgo_corregido,
    h.clasificacion === 'FORTALEZA' ? 'No aplica' : describirEvaluacion(h),
    textoControles(h),
    ESTADOS_HALLAZGO[h.estado],
  ])
}
