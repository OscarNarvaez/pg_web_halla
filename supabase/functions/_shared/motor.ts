// Motor de clasificación: arma el mensaje, llama a la IA, valida y repara una sola vez (V4).
// No conoce Deno ni Supabase: recibe la función que llama al modelo, así se prueba en local.

import { DIMENSIONES_IMPACTO, ESCALA_PROBABILIDAD, ETIQUETAS, MARCADOR_PENDIENTE, NIVELES_IMPACTO, type Clasificacion } from './catalogos.ts'
import type { Criterio } from './recuperar-criterios.ts'
import type { RespuestaGemini } from './gemini.ts'
import {
  AVISO_ESTRUCTURA,
  esHallazgoValido,
  validarHallazgo,
  limpiarTexto,
  depurarReferencias,
  quitarDatosInventados,
  verificarEstructura,
  type HallazgoIA,
  type HallazgoValidado,
} from './validar-salida.ts'

export interface ContextoAuditoria {
  alcance: string
  proceso?: string | null
  sistema?: string | null
  area_auditada?: string | null
  codigo: string
  titulo: string
  fecha?: string | null
}

export const MAX_HALLAZGOS = 5

/** Mensaje de usuario con el formato exacto del §9.1 paso 5 del prompt maestro. */
export function construirMensaje(ctx: ContextoAuditoria, criterios: Criterio[], entrada: string, notas?: string | null): string {
  const objeto = ctx.alcance === 'SISTEMAS' ? `Sistema auditado: ${ctx.sistema}` : `Proceso auditado: ${ctx.proceso}`
  const lineas = [
    '## CONTEXTO DE LA AUDITORÍA',
    `Alcance: ${ctx.alcance}`,
    objeto,
    `Proceso/área: ${ctx.area_auditada?.trim() || (ctx.alcance === 'SISTEMAS' ? ctx.sistema : ctx.proceso)}`,
    `Auditoría: ${ctx.codigo} — ${ctx.titulo}`,
    `Fecha: ${ctx.fecha ?? new Date().toISOString().slice(0, 10)}`,
    '',
    '## CRITERIOS NORMATIVOS DISPONIBLES',
    'Son los ÚNICOS requisitos que puedes citar. Cada uno tiene un identificador.',
    'Si ninguno sustenta el hallazgo, usa el marcador de requisito pendiente.',
    '',
  ]
  if (!criterios.length) {
    lineas.push(`No se encontraron criterios aplicables en los documentos cargados. Usa exactamente: ${MARCADOR_PENDIENTE}`, '')
  }
  criterios.forEach((c, i) => {
    const numeral = c.numeral ? `numeral ${c.numeral}` : 'sin numeral'
    const idioma = c.idioma === 'en' ? ' | texto en inglés: cita el numeral tal cual y redacta en español' : ''
    lineas.push(`[C${i + 1}] id=${c.id} | ${c.documento_codigo} | ${numeral} | ${c.titulo}${idioma}`, c.contenido.trim(), '')
  })
  lineas.push(...bloqueRedaccion())
  lineas.push(...bloqueRiesgo())
  lineas.push('## HALLAZGO REPORTADO POR EL AUDITOR', '"""', entrada, '"""', '')
  if (notas?.trim()) lineas.push('## NOTAS O CONTEXTO ADICIONAL DEL AUDITOR', notas.trim(), '')
  lineas.push('Responde ÚNICAMENTE con el JSON definido en el esquema.')
  return lineas.join('\n')
}

/**
 * Guía de redacción del dueño (5/10/2026): cuándo corresponde cada categoría, su fórmula y sus ejemplos. Coincide con
 * el ANEXO A y precisa los conectores («porque», «para lo cual»). La pantalla muestra las mismas fórmulas
 * (`ESTRUCTURAS` en src/lib/catalogos.js) y V3 las verifica (`verificarEstructura`).
 */
export const GUIA_REDACCION: Record<Clasificacion, { cuando: string; formula: string; ejemplos: string[] }> = {
  NO_CONFORMIDAD: {
    cuando: 'cuando se evidencia el incumplimiento de un requisito, norma o procedimiento',
    formula: 'Evidencia + incumplimiento + requisito incumplido.',
    ejemplos: [
      'En la Revisión por la dirección del 14 de julio de 2021 no se incluyó la información relacionada con las decisiones y acciones relacionadas con las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3.',
    ],
  },
  FORTALEZA: {
    cuando: 'cuando se identifica una práctica positiva y destacable que genera beneficios al proceso o al sistema',
    formula: 'Qué es relevante + porque + beneficio obtenido en el presente.',
    ejemplos: [
      'El liderazgo de la alta dirección del sistema de gestión, porque permite la mejora de los procesos y la competencia de su personal.',
      'El equipo biométrico para control de asistencia, porque permite el control en tiempo real de la asistencia, la generación de certificados y el control de costos.',
    ],
  },
  OBSERVACION: {
    cuando: 'cuando existe una situación que requiere atención o seguimiento, pero no constituye un incumplimiento comprobado',
    formula: 'Aspecto a mejorar o debilidad + impacto que se generaría en el proceso, sistema o estrategia.',
    ejemplos: [
      'Se evidencia falta de planificación de los cambios relacionados con la reposición e incursión de tecnología biomédica, que podría impactar en la ocurrencia de posibles eventos adversos.',
    ],
  },
  OPORTUNIDAD_DE_MEJORA: {
    cuando: 'cuando el proceso cumple con los requisitos, pero existe la posibilidad de optimizarlo para obtener mejores resultados',
    formula: 'Qué es susceptible de mejorar + para lo cual + beneficio en el futuro.',
    ejemplos: [
      'La infraestructura para la prestación de los servicios es susceptible de mejorar, lo cual permitirá contar con espacios agradables y de confort para el cliente.',
      'El método utilizado para el registro de asistencia es susceptible de mejorar, para lo cual se puede fortalecer, lo que permitirá la conservación adecuada de los registros y la generación oportuna de los certificados.',
    ],
  },
}

// Orden en que se presentan: el de la pregunta de clasificación del ANEXO A
const ORDEN_GUIA: Clasificacion[] = ['NO_CONFORMIDAD', 'OBSERVACION', 'FORTALEZA', 'OPORTUNIDAD_DE_MEJORA']

/**
 * Guía de redacción en el mensaje de usuario: el prompt del sistema es el ANEXO A literal y no se toca.
 */
export function bloqueRedaccion(): string[] {
  return [
    '## GUÍA DE REDACCIÓN DEL HOSPITAL',
    'Una vez clasificado, "hallazgo_corregido" sigue OBLIGATORIAMENTE la fórmula de su categoría. Los ejemplos muestran la forma:',
    'cita solo criterios de la lista (o el marcador de requisito pendiente) y solo hechos que dio el auditor.',
    ...ORDEN_GUIA.flatMap((c) => [
      `- ${ETIQUETAS[c].singular.toUpperCase()}, ${GUIA_REDACCION[c].cuando}. Fórmula: ${GUIA_REDACCION[c].formula}`,
      ...GUIA_REDACCION[c].ejemplos.map((e) => `  Ejemplo: «${e}»`),
    ]),
    'Se establece una NO CONFORMIDAD cuando: el hallazgo incumple requisitos del cliente, legales, de la organización o de ISO 9001;',
    'se repite durante la recolección de la información; genera un alto impacto para la entidad; la documentación es diferente a lo',
    'que sucede en la realidad; el auditado no conoce las disposiciones documentadas aplicables; hay contradicciones en',
    'procedimientos, formatos o guías; faltan las evidencias objetivas (registros); o falta consignar información en los registros.',
    'Los hallazgos de no conformidad evidencian fallas e impactos en los objetivos definidos.',
    '',
  ]
}

/**
 * Metodología de riesgo del hospital (PR13_GQ V4) para los campos `riesgo` y `controles`. Va en el mensaje
 * de usuario: el prompt del sistema es el ANEXO A literal y no se toca.
 */
export function bloqueRiesgo(): string[] {
  return [
    '## METODOLOGÍA DE RIESGO DEL HOSPITAL (PR13_GQ V4, Gestión de riesgos)',
    'Para cada hallazgo que NO sea FORTALEZA completa "riesgo" y "controles". En una FORTALEZA: riesgo = null y controles = [].',
    '- riesgo.descripcion: el riesgo al que expone la situación, como evento potencial: «Posibilidad de <evento> debido a <causa observada>, lo que podría <consecuencia>». Solo con hechos del hallazgo: sin nombres, fechas ni cifras que el auditor no haya dado.',
    '- riesgo.dimension: la dimensión de impacto más afectada (clave exacta de la lista de abajo).',
    '- riesgo.probabilidad: entero de 1 a 5 según la escala de probabilidad. Si el auditor no informa la frecuencia histórica, estímala con la evidencia y dilo en la justificación.',
    '- riesgo.impacto: entero de 1 a 5 según la escala de la dimensión elegida.',
    '- riesgo.justificacion: por qué esa probabilidad y ese impacto, en una a tres oraciones.',
    '- No calcules el nivel ni la zona del riesgo: los calcula la aplicación (riesgo inherente = probabilidad × impacto).',
    '- controles: de 1 a 3 medidas concretas y verificables que reduzcan la probabilidad o el impacto. tipo PREVENTIVO si evita que la causa se repita; CORRECTIVO si corrige lo ya ocurrido. Indica qué se hace, quién lo hace (cargo o área, nunca un nombre) y con qué frecuencia o evidencia. Si un control se apoya en un criterio de la lista, pon su id en criterio_id; si no, déjalo vacío. No cites normas que no estén en la lista.',
    '',
    'Escala de probabilidad:',
    ...ESCALA_PROBABILIDAD.map((p) => `${p.valor} ${p.categoria}: ${p.descripcion}`),
    '',
    `Escala de impacto por dimensión (1 = ${NIVELES_IMPACTO[0]} … 5 = ${NIVELES_IMPACTO[4]}):`,
    ...Object.entries(DIMENSIONES_IMPACTO).flatMap(([clave, d]) => [
      `${clave} (${d.etiqueta}):`,
      ...d.niveles.map((texto, i) => `  ${i + 1} ${NIVELES_IMPACTO[i]}: ${texto}`),
    ]),
    '',
  ]
}

/** Texto de reparación del §9.3 V4, uno por cada hallazgo que no cumplió la estructura. */
export function construirReparacion(mensaje: string, respuestaAnterior: string, fallidos: Array<{ indice: number; h: HallazgoValidado }>): string {
  const bloques = fallidos.map(({ indice, h }) => [
    fallidos.length > 1 ? `Hallazgo ${indice + 1} del arreglo:` : '',
    `La respuesta anterior no cumplió la estructura obligatoria de la categoría ${ETIQUETAS[h.clasificacion].singular.toUpperCase()}.`,
    `Problema detectado: ${h.problemas.join('; ')}.`,
    `Fórmula de la categoría: ${GUIA_REDACCION[h.clasificacion].formula} Ejemplo: «${GUIA_REDACCION[h.clasificacion].ejemplos[0]}»`,
    'Reescribe el campo "hallazgo_corregido" respetando la fórmula obligatoria de esa categoría.',
    'No cambies la clasificación ni inventes requisitos.',
  ].filter(Boolean).join('\n'))
  return [
    mensaje,
    '',
    '## RESPUESTA ANTERIOR',
    respuestaAnterior,
    '',
    ...bloques.flatMap((b) => [b, '']),
    'Devuelve el JSON completo con todos los hallazgos, en el mismo orden.',
  ].join('\n')
}

export interface ResultadoMotor {
  hallazgos: HallazgoValidado[]
  respuestas: { primera: unknown; reparacion: unknown | null }
  llamadas: RespuestaGemini[]
  reparado: boolean
}

/**
 * Ejecuta la clasificación completa.
 * @param llamar función que envía un mensaje de usuario al modelo (con el prompt del sistema ya fijado)
 */
export async function clasificarHallazgo(opciones: {
  entrada: string
  notas?: string | null
  contexto: ContextoAuditoria
  criterios: Criterio[]
  llamar: (mensaje: string) => Promise<RespuestaGemini>
}): Promise<ResultadoMotor> {
  const { entrada, criterios, llamar } = opciones
  const mensaje = construirMensaje(opciones.contexto, criterios, entrada, opciones.notas)
  const primera = await llamar(mensaje)
  const llamadas = [primera]

  const crudos = ((primera.json as { hallazgos?: unknown[] })?.hallazgos ?? []).filter(esHallazgoValido).slice(0, MAX_HALLAZGOS)
  if (!crudos.length) throw new Error('La IA no devolvió ningún hallazgo con una clasificación válida.')

  const hallazgos = crudos.map((h) => validarHallazgo(h as HallazgoIA, entrada, criterios))

  // V4 · una sola llamada de reparación para todos los que fallaron V3
  const fallidos = hallazgos.map((h, indice) => ({ indice, h })).filter(({ h }) => h.problemas.length)
  let reparacion: RespuestaGemini | null = null
  if (fallidos.length) {
    try {
      reparacion = await llamar(construirReparacion(mensaje, primera.texto, fallidos))
      llamadas.push(reparacion)
      const reparados = ((reparacion.json as { hallazgos?: unknown[] })?.hallazgos ?? []) as HallazgoIA[]
      for (const { indice, h } of fallidos) {
        const nuevo = reparados[indice]
        // «No cambies la clasificación»: solo se toma la redacción si la categoría se mantuvo
        if (!nuevo || nuevo.clasificacion !== h.clasificacion || typeof nuevo.hallazgo_corregido !== 'string') continue
        let texto = limpiarTexto(nuevo.hallazgo_corregido)
        const refs = depurarReferencias(texto, h.criterios_citados, entrada, criterios)
        texto = refs.texto
        const datos = quitarDatosInventados(texto, entrada, criterios)
        texto = datos.texto
        const problemas = verificarEstructura(h.clasificacion, texto, h.criterios_citados)
        h.registro.referencias_eliminadas.push(...refs.eliminadas)
        h.registro.datos_reemplazados.push(...datos.reemplazos)
        // Se adopta la reparación si resolvió los problemas o, al menos, dejó menos
        if (problemas.length < h.problemas.length) {
          h.hallazgo_corregido = texto
          h.problemas = problemas
        }
      }
    } catch {
      // Si la reparación falla, se entrega el primer resultado con el aviso: nunca se bloquea al auditor
    }
    for (const { h } of fallidos) if (h.problemas.length && !h.avisos.includes(AVISO_ESTRUCTURA)) h.avisos.push(AVISO_ESTRUCTURA)
  }

  return {
    hallazgos,
    respuestas: { primera: primera.json, reparacion: reparacion?.json ?? null },
    llamadas,
    reparado: Boolean(reparacion),
  }
}
