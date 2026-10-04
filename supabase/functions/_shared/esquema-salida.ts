// Esquema de salida estructurada para Gemini (responseSchema, subconjunto OpenAPI).

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
        },
        required: ['clasificacion', 'justificacion', 'hallazgo_corregido', 'criterio_requisito', 'evidencia', 'criterios_citados'],
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
