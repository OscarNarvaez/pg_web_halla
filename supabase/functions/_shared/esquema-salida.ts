// Esquema de salida estructurada para Gemini (responseSchema, subconjunto OpenAPI).

import { DIMENSIONES_IMPACTO, TIPOS_CONTROL } from './catalogos.ts'

export const ESQUEMA_SALIDA = {
  type: 'object',
  properties: {
    hallazgos: {
      type: 'array',
      description: 'Normalmente un elemento. Varios SOLO si la entrada contiene situaciones de categorías distintas.',
      items: {
        type: 'object',
        properties: {
          clasificacion: {
            type: 'string',
            enum: ['FORTALEZA', 'NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA'],
          },
          justificacion: { type: 'string' },
          hallazgo_corregido: { type: 'string' },
          criterio_requisito: { type: 'string' },
          evidencia: { type: 'string' },
          severidad: { type: 'string', enum: ['alta', 'media', 'baja'] },
          criterios_citados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                criterio_id: { type: 'string', description: 'id exacto de la lista de criterios entregada' },
                numeral: { type: 'string' },
                documento: { type: 'string' },
              },
              required: ['criterio_id', 'numeral', 'documento'],
            },
          },
          riesgo: {
            type: 'object',
            nullable: true,
            description: 'null en una FORTALEZA. En las demás categorías, el riesgo según la metodología del PR13_GQ entregada.',
            properties: {
              descripcion: { type: 'string', description: 'Posibilidad de <evento> debido a <causa observada>, lo que podría <consecuencia>.' },
              dimension: { type: 'string', enum: Object.keys(DIMENSIONES_IMPACTO) },
              probabilidad: { type: 'integer', description: 'Entero de 1 a 5 según la escala de probabilidad del PR13_GQ' },
              impacto: { type: 'integer', description: 'Entero de 1 a 5 según la escala de impacto de la dimensión elegida' },
              justificacion: { type: 'string', description: 'Por qué esa probabilidad y ese impacto, en una a tres oraciones' },
            },
            required: ['descripcion', 'dimension', 'probabilidad', 'impacto', 'justificacion'],
          },
          controles: {
            type: 'array',
            description: 'Vacío en una FORTALEZA. En las demás, de 1 a 3 controles concretos y verificables.',
            items: {
              type: 'object',
              properties: {
                descripcion: { type: 'string' },
                tipo: { type: 'string', enum: [...TIPOS_CONTROL] },
                criterio_id: { type: 'string', description: 'id exacto de un criterio de la lista que sustente el control, o vacío' },
              },
              required: ['descripcion', 'tipo'],
            },
          },
        },
        required: ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'criterios_citados', 'riesgo', 'controles'],
      },
    },
  },
  required: ['hallazgos'],
}

export const ESQUEMA_INFORME = {
  type: 'object',
  properties: {
    resumen_ejecutivo: { type: 'string' },
    conclusiones: { type: 'string' },
    recomendaciones: { type: 'array', items: { type: 'string' } },
  },
  required: ['resumen_ejecutivo', 'conclusiones', 'recomendaciones'],
}

/** Esquema de completar-auditoria: las normas solo pueden ser las cargadas (enum dinámico). */
export function esquemaCompletarAuditoria(documentosDisponibles: string[]) {
  return {
    type: 'object',
    properties: {
      objetivo: { type: 'string' },
      area_auditada: { type: 'string' },
      criterios: { type: 'array', items: { type: 'string', enum: documentosDisponibles } },
    },
    required: ['objetivo', 'area_auditada', 'criterios'],
  }
}
