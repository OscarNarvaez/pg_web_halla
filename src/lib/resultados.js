// Consolidado de resultados de la auditoría, debajo de la matriz (diseño del prototipo del dueño): hallazgos por
// clasificación y distribución por norma o documento. Cuenta los hallazgos vigentes (los mismos de la matriz).

// Orden y siglas del consolidado, como en el prototipo: NC, F, O, OM
export const ORDEN_RESULTADOS = ['NO_CONFORMIDAD', 'FORTALEZA', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA']
export const SIGLAS = { NO_CONFORMIDAD: 'NC', FORTALEZA: 'F', OBSERVACION: 'O', OPORTUNIDAD_DE_MEJORA: 'OM' }
export const SIN_NORMA = 'Requisito pendiente de identificación'

const porcentaje = (parte, total) => (total ? Math.round((100 * parte) / total) : 0)
const conteoVacio = () => Object.fromEntries(ORDEN_RESULTADOS.map((c) => [c, 0]))

/**
 * @param {object[]} hallazgos los de la auditoría (los descartados no cuentan)
 * @returns {{ total: number, porClasificacion: { clasificacion: string, n: number, porcentaje: number }[],
 *   normas: { norma: string, total: number, conteo: Record<string, number> }[], maximo: number }}
 * Un hallazgo cuenta una vez en cada norma o documento que cita (puede citar varios); sin criterio verificado,
 * va en «Requisito pendiente de identificación», al final.
 */
export function resultadosAuditoria(hallazgos) {
  const vigentes = (hallazgos ?? []).filter((h) => h.estado !== 'descartado' && ORDEN_RESULTADOS.includes(h.clasificacion))
  const total = vigentes.length
  const conteo = conteoVacio()
  const porNorma = new Map()
  for (const h of vigentes) {
    conteo[h.clasificacion]++
    const documentos = [...new Set((h.criterios_citados ?? []).map((c) => c.documento).filter(Boolean))]
    for (const norma of documentos.length ? documentos : [SIN_NORMA]) {
      if (!porNorma.has(norma)) porNorma.set(norma, { norma, total: 0, conteo: conteoVacio() })
      const fila = porNorma.get(norma)
      fila.total++
      fila.conteo[h.clasificacion]++
    }
  }
  const normas = [...porNorma.values()].sort((a, b) =>
    Number(a.norma === SIN_NORMA) - Number(b.norma === SIN_NORMA) || b.total - a.total || a.norma.localeCompare(b.norma, 'es'))
  return {
    total,
    porClasificacion: ORDEN_RESULTADOS.map((c) => ({ clasificacion: c, n: conteo[c], porcentaje: porcentaje(conteo[c], total) })),
    normas,
    maximo: Math.max(0, ...normas.map((n) => n.total)),
  }
}

const TINTA = '#16222c'

/** Luminancia relativa (WCAG) de un color «#rrggbb». */
function luminancia(color) {
  const hex = color.replace('#', '')
  const canal = (v) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(hex.slice(0, 2)) + 0.7152 * canal(hex.slice(2, 4)) + 0.0722 * canal(hex.slice(4, 6))
}

/** Color de un número dentro de un relleno: blanco o tinta oscura, el de mayor contraste (WCAG). */
export function tintaSobre(fondo) {
  const l = luminancia(fondo)
  const contraste = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return contraste(l, 1) >= contraste(l, luminancia(TINTA)) ? '#ffffff' : TINTA
}
