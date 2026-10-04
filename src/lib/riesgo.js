// Evaluación del riesgo según el PR13_GQ: riesgo inherente = probabilidad × impacto, ubicado en una zona.
// El nivel lo calcula siempre el código (nunca la IA) con la escala fija UMBRALES_RIESGO.
import { ESCALA_PROBABILIDAD, NIVELES_IMPACTO, UMBRALES_RIESGO, ZONAS_RIESGO } from './catalogos'

export const ORDEN_ZONAS = ['BAJA', 'MODERADA', 'ALTA', 'EXTREMA']

// Colores de zona del PR13 (verde, amarillo, naranja y rojo), con claridad decreciente de Bajo a Extremo para
// que el orden se lea también con deuteranopía. Validados con el script del skill dataviz: ΔE ≥ 14,8 entre
// vecinos con deuteranopía y ≥ 16,5 con visión normal. Nunca van solos: cada casilla lleva puntaje y nivel en texto.
export const COLORES_ZONA = {
  BAJA: { fondo: '#c6ead0', borde: '#7fbf93', texto: '#16222c' },
  MODERADA: { fondo: '#efbe2f', borde: '#b88d0f', texto: '#16222c' },
  ALTA: { fondo: '#e4733a', borde: '#b4521f', texto: '#16222c' },
  EXTREMA: { fondo: '#bb2424', borde: '#8a1515', texto: '#ffffff' },
}

/** Rango de puntajes de cada zona según la escala fija: Bajo 1–4, Moderado 5–9, Alto 10–16, Extremo 17–25. */
export const RANGOS_ZONA = {
  BAJA: `1–${UMBRALES_RIESGO.bajo}`,
  MODERADA: `${UMBRALES_RIESGO.bajo + 1}–${UMBRALES_RIESGO.moderado}`,
  ALTA: `${UMBRALES_RIESGO.moderado + 1}–${UMBRALES_RIESGO.alto}`,
  EXTREMA: `${UMBRALES_RIESGO.alto + 1}–25`,
}

/** Zona del PR13 para un puntaje de 1 a 25. */
export function zonaDe(puntaje) {
  if (!puntaje) return null
  if (puntaje <= UMBRALES_RIESGO.bajo) return 'BAJA'
  if (puntaje <= UMBRALES_RIESGO.moderado) return 'MODERADA'
  if (puntaje <= UMBRALES_RIESGO.alto) return 'ALTA'
  return 'EXTREMA'
}

/**
 * Tratamiento según la zona. Nota del PR13_GQ: no puede haber aceptación de riesgos sobre situaciones que
 * conlleven incumplimientos normativos, así que una no conformidad nunca se «asume».
 */
export function tratamientoPara(zona, clasificacion) {
  if (!zona) return ''
  if (clasificacion === 'NO_CONFORMIDAD' && (zona === 'BAJA' || zona === 'MODERADA')) {
    return 'Reducir el riesgo: el PR13_GQ no admite asumir riesgos que conllevan un incumplimiento normativo'
  }
  return ZONAS_RIESGO[zona].tratamiento
}

/** Puntaje, zona, etiqueta y tratamiento de un hallazgo, o null si falta la probabilidad o el impacto. */
export function evaluarRiesgo(h) {
  const p = h?.riesgo_probabilidad
  const i = h?.riesgo_impacto
  if (!p || !i) return null
  const puntaje = p * i
  const zona = zonaDe(puntaje)
  return { probabilidad: p, impacto: i, puntaje, zona, etiqueta: ZONAS_RIESGO[zona].etiqueta, tratamiento: tratamientoPara(zona, h.clasificacion) }
}

/** «P4 (Probable) × I3 (Moderado) = 12 · Alto». */
export function describirEvaluacion(h) {
  const e = evaluarRiesgo(h)
  if (!e) return ''
  return `P${e.probabilidad} (${ESCALA_PROBABILIDAD[e.probabilidad - 1].categoria}) × I${e.impacto} (${NIVELES_IMPACTO[e.impacto - 1]}) = ${e.puntaje} · ${e.etiqueta}`
}

/** Hallazgos vigentes por casilla del mapa de calor: { 'p-i': n }. */
export function conteoPorCasilla(hallazgos) {
  const conteo = {}
  for (const h of hallazgos) {
    if (h.estado === 'descartado' || !h.riesgo_probabilidad || !h.riesgo_impacto) continue
    const clave = `${h.riesgo_probabilidad}-${h.riesgo_impacto}`
    conteo[clave] = (conteo[clave] ?? 0) + 1
  }
  return conteo
}

/** Una FORTALEZA no lleva riesgo ni controles; las demás categorías sí. */
export const requiereRiesgo = (h) => h?.clasificacion !== 'FORTALEZA'

export const controlesAdoptados = (h) => (h?.controles ?? []).filter((c) => c.adoptado)

/** Qué le falta a un hallazgo para poder validarse en la matriz (vacío si nada). */
export function faltantesParaValidar(h) {
  if (!requiereRiesgo(h)) return []
  const faltan = []
  if (!h.riesgo_descripcion?.trim()) faltan.push('la descripción del riesgo')
  if (!h.riesgo_dimension) faltan.push('la dimensión de impacto')
  if (!h.riesgo_probabilidad || !h.riesgo_impacto) faltan.push('la probabilidad y el impacto')
  if (!controlesAdoptados(h).length) faltan.push('al menos un control adoptado')
  return faltan
}
