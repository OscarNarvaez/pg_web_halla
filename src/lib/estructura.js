// Estructura de la redacción según la categoría (guía de redacción del dueño, 5/10/2026). Es la misma verificación V3
// que hace el servidor con lo que redacta la IA (`verificarEstructura` en supabase/functions/_shared/validar-salida.ts);
// aquí se aplica a lo que edita el auditor y cuando corrige la clasificación. Si cambias una, cambia la otra:
// `pnpm probar:validacion` compara las dos.
import { MARCADOR_PENDIENTE } from './catalogos.js'

const normal = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export const LARGO_HALLAZGO = { min: 120, max: 900 }

const REGLAS = {
  NO_CONFORMIDAD: {
    requiere: [[
      /incumpl|\bno (se|fue|fueron|esta|estan|cumple|cumplen|existe|existen|cuenta|cuentan|corresponde|corresponden|tiene|tienen|hay)\b|\bfalta(n)?\b|\bincomplet|\bvencid|\bdiferente|\bausencia\b|\bcontradic/,
      'no expresa el incumplimiento (por ejemplo, «no se incluyó…» o «incumpliendo lo establecido en…»)',
    ]],
    prohibe: [[/susceptible(s)? de mejora|podria(n)? mejorar/, 'usa lenguaje de oportunidad de mejora («susceptible de mejorar», «podría mejorar»)']],
  },
  OBSERVACION: {
    requiere: [[/\bpodria(n)?\b|\bpuede(n)?\b|representa(n)? un riesgo/, 'no expresa el impacto potencial con «podría», «puede» o «representa un riesgo»']],
    prohibe: [[/\bincumpliendo\b|\bincumple(n)?\b/, 'afirma un incumplimiento («incumple», «incumpliendo»), propio de una no conformidad']],
  },
  FORTALEZA: {
    requiere: [[/\bporque\b/, 'no dice por qué es relevante con «porque» (qué es relevante + porque + beneficio en el presente)'], [
      /\b(permite|permiten|favorece|favorecen|contribuye|contribuyen|fortalece|fortalecen|facilita|facilitan|garantiza|asegura|promueve|aporta|genera|optimiza|permitiendo|favoreciendo|contribuyendo|fortaleciendo|facilitando|garantizando|asegurando|promoviendo)\b/,
      'no expresa el beneficio actual con un verbo en presente («permite», «favorece», «contribuye», «fortalece»)',
    ]],
    prohibe: [
      [/excelente|muy buen[oa]s?|maravillos/, 'usa expresiones subjetivas («excelente», «muy bueno», «maravilloso»)'],
      [/\b(permitira|favorecera|contribuira|facilitara|fortalecera|mejorara)n?\b/, 'expresa un beneficio futuro («permitirá»…); la fortaleza debe expresar un beneficio actual'],
    ],
  },
  OPORTUNIDAD_DE_MEJORA: {
    requiere: [
      [/susceptible(s)? de mejora|es posible/, 'no usa la fórmula «es susceptible de mejorar» (o «es posible»)'],
      [/\blo cual\b/, 'no usa el conector «para lo cual» (o «lo cual») antes del beneficio'],
      [
        /\b(permitira|facilitara|contribuira|favorecera|fortalecera|mejorara|optimizara|agilizara|permitiria|facilitaria|contribuiria|favoreceria|fortaleceria)n?\b/,
        'no proyecta el beneficio futuro («permitirá», «facilitará», «contribuirá», «favorecerá»)',
      ],
    ],
    prohibe: [[/\bincumpliendo\b|\bno cumple(n)?\b|\bincumple(n)?\b/, 'afirma un incumplimiento, propio de una no conformidad']],
  },
}

/**
 * Qué le falta a la redacción para seguir la fórmula de su categoría (lista vacía si cumple).
 * @param {string} clasificacion
 * @param {string} texto hallazgo corregido
 * @param {{ numeral?: string|null, documento?: string }[]} [citas] criterios verificados del hallazgo
 */
export function problemasDeEstructura(clasificacion, texto, citas = []) {
  const reglas = REGLAS[clasificacion]
  if (!reglas || !texto) return []
  const t = normal(texto)
  const problemas = []
  for (const [re, descripcion] of reglas.requiere) if (!re.test(t)) problemas.push(descripcion)
  for (const [re, descripcion] of reglas.prohibe) if (re.test(t)) problemas.push(descripcion)
  if (clasificacion === 'NO_CONFORMIDAD') {
    const citaRequisito = texto.includes(MARCADOR_PENDIENTE)
      || citas.some((c) => (c.numeral && t.includes(normal(c.numeral))) || (c.documento && t.includes(normal(c.documento))))
    if (!citaRequisito) problemas.push(`no identifica el requisito incumplido (un criterio verificado o, si no lo hay, exactamente «${MARCADOR_PENDIENTE}»)`)
  }
  if (texto.length < LARGO_HALLAZGO.min) problemas.push(`es demasiado breve (${texto.length} caracteres; mínimo ${LARGO_HALLAZGO.min})`)
  if (texto.length > LARGO_HALLAZGO.max) problemas.push(`es demasiado extenso (${texto.length} caracteres; máximo ${LARGO_HALLAZGO.max})`)
  return problemas
}
