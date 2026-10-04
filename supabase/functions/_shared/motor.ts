// Motor de clasificación: arma el mensaje, llama a la IA, valida y repara una sola vez (V4).
// No conoce Deno ni Supabase: recibe la función que llama al modelo, así se prueba en local.

import { ETIQUETAS, MARCADOR_PENDIENTE } from './catalogos.ts'
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
  lineas.push('## HALLAZGO REPORTADO POR EL AUDITOR', '"""', entrada, '"""', '')
  if (notas?.trim()) lineas.push('## NOTAS O CONTEXTO ADICIONAL DEL AUDITOR', notas.trim(), '')
  lineas.push('Responde ÚNICAMENTE con el JSON definido en el esquema.')
  return lineas.join('\n')
}

/** Texto de reparación del §9.3 V4, uno por cada hallazgo que no cumplió la estructura. */
export function construirReparacion(mensaje: string, respuestaAnterior: string, fallidos: Array<{ indice: number; h: HallazgoValidado }>): string {
  const bloques = fallidos.map(({ indice, h }) => [
    fallidos.length > 1 ? `Hallazgo ${indice + 1} del arreglo:` : '',
    `La respuesta anterior no cumplió la estructura obligatoria de la categoría ${ETIQUETAS[h.clasificacion].singular.toUpperCase()}.`,
    `Problema detectado: ${h.problemas.join('; ')}.`,
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
