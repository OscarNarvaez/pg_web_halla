// Copia de los catálogos del frontend (src/lib/catalogos.js) que necesitan las Edge Functions.
// Si cambias uno, cambia el otro (y los enum de PostgreSQL).

export const MARCADOR_PENDIENTE = '[Requisito específico pendiente de identificación/validación]'

export const INSTITUCION = {
  nombre: 'Hospital Infantil Los Ángeles',
  sigla: 'HILA',
  ciudad: 'Pasto, Nariño',
}

// Para validar la entrada de las funciones (deben coincidir con los enum de PostgreSQL)
export const PROCESOS = [
  'Nutrición', 'Imágenes diagnósticas', 'Gestión hospitalaria universitaria', 'Control interno', 'Gestión cliente',
  'Terapias', 'Hospital seguro', 'Gestión de calidad', 'Comercial y mercadeo', 'Gestión humana',
  'Gestión de recursos físicos', 'Gestión de la información', 'Gestión gerencial', 'Gestión del ambiente físico',
  'Gestión financiera', 'Hospitalización', 'Cirugía', 'Urgencias', 'Consulta externa',
]
export const SISTEMAS = [
  'Sistema Ambiental', 'Sistema de Seguridad y Salud en el Trabajo', 'Sistema de calidad', 'SARLAFT Y SICOF',
  'UACAI', 'Empresa familiar',
]

export const CLASIFICACIONES = ['FORTALEZA', 'NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA'] as const
export type Clasificacion = (typeof CLASIFICACIONES)[number]

export const ETIQUETAS: Record<Clasificacion, { singular: string; plural: string }> = {
  FORTALEZA: { singular: 'Fortaleza', plural: 'Fortalezas' },
  NO_CONFORMIDAD: { singular: 'No conformidad', plural: 'No conformidades' },
  OBSERVACION: { singular: 'Observación', plural: 'Observaciones' },
  OPORTUNIDAD_DE_MEJORA: { singular: 'Oportunidad de mejora', plural: 'Oportunidades de mejora' },
}

// Orden del informe: No conformidades → Observaciones → Oportunidades de mejora → Fortalezas
export const ORDEN_INFORME: Clasificacion[] = ['NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA', 'FORTALEZA']

export const DOCUMENTOS_POR_ALCANCE: Record<string, string[]> = {
  'Sistema Ambiental': ['NTC-ISO 14001:2015', 'ISO 19011', 'PR13-GQ'],
  'Sistema de Seguridad y Salud en el Trabajo': ['ISO 45001:2018', 'ISO 19011', 'PR13-GQ'],
  'Sistema de calidad': ['NTC-ISO 9001:2015', 'ISO 19011', 'PR13-GQ'],
  'SARLAFT Y SICOF': ['PR13-GQ', 'ISO 19011'],
  UACAI: ['ISO 19011', 'PR13-GQ'],
  'Empresa familiar': ['ISO 19011', 'PR13-GQ'],
  __PROCESOS__: ['NTC-ISO 9001:2015', 'PR13-GQ', 'ISO 19011'],
}

export function documentosParaAlcance(alcance: string, sistema?: string | null): string[] {
  if (alcance === 'SISTEMAS' && sistema) return DOCUMENTOS_POR_ALCANCE[sistema] ?? []
  return DOCUMENTOS_POR_ALCANCE.__PROCESOS__
}

// ─── Riesgo (PR13_GQ V4 · Gestión de riesgos, numeral 5) ───────────────────
// Transcripción limpia de las escalas del documento (el original es OCR de tablas). Duplicado en
// src/lib/catalogos.js; las claves de DIMENSIONES_IMPACTO = check riesgo_dimension_valida (0007).

export const FUENTE_RIESGO = 'PR13_GQ V4 · Gestión de riesgos (análisis y valoración, evaluación del riesgo inherente y tratamiento)'

export const ESCALA_PROBABILIDAD = [
  { valor: 1, categoria: 'Raro', descripcion: 'El evento ocurre únicamente en circunstancias excepcionales. Se ha presentado una vez en los últimos tres años.' },
  { valor: 2, categoria: 'Improbable', descripcion: 'El evento es poco frecuente, pero podría presentarse. Se ha presentado una vez en el último año.' },
  { valor: 3, categoria: 'Posible', descripcion: 'El evento podría presentarse en algún momento. Se ha presentado una vez en los últimos seis meses.' },
  { valor: 4, categoria: 'Probable', descripcion: 'El evento es esperado en muchas circunstancias. Se ha presentado una vez en el último mes.' },
  { valor: 5, categoria: 'Casi seguro', descripcion: 'El evento ocurre en la mayoría de las circunstancias. Se ha presentado más de una vez en el último mes.' },
]

export const NIVELES_IMPACTO = ['Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico']

export const DIMENSIONES_IMPACTO: Record<string, { etiqueta: string; niveles: string[] }> = {
  CALIDAD_SEGURIDAD_PACIENTE: {
    etiqueta: 'Calidad en la atención y seguridad del paciente',
    niveles: [
      'Puede llevar a lesiones transitorias leves. La intervención necesaria es mínima.',
      'El resultado para el paciente es sintomático con síntomas leves. La pérdida funcional o el daño son mínimos y de corta duración.',
      'El resultado sintomático para el paciente es una pérdida o un daño de severidad moderada y de corta duración.',
      'Pudo llevar a la muerte o a un deterioro serio de la salud, pero por azar o por una barrera no generó un daño permanente; requiere intervención médica o quirúrgica.',
      'Causa al paciente un daño o una pérdida funcional importante, permanente o de larga duración. Acorta la esperanza de vida o causa la muerte.',
    ],
  },
  PRESTACION_SERVICIO: {
    etiqueta: 'Prestación del servicio',
    niveles: [
      'No afecta la prestación del servicio.',
      'Se podrían generar reprocesos sin afectar la prestación del servicio.',
      'Se pueden generar reprocesos que afectan la prestación del servicio sin impactar la atención a los pacientes.',
      'La prestación del servicio se afecta de manera considerable, impactando la atención a los pacientes.',
      'La prestación del servicio se afecta de manera total y no se puede atender a los pacientes.',
    ],
  },
  LEGAL: {
    etiqueta: 'Legal',
    niveles: [
      'No se generan sanciones o multas.',
      'Podrían generarse multas o sanciones, pero no afectan la prestación del servicio.',
      'Pueden generarse multas o sanciones que podrían afectar la prestación del servicio.',
      'Se generan multas o sanciones que afectan la prestación del servicio y pueden ocasionar pérdidas financieras.',
      'Se generan multas o sanciones altas que afectan la prestación del servicio y generan pérdidas financieras.',
    ],
  },
  FINANCIERO: {
    etiqueta: 'Financiero',
    niveles: [
      'No se afectan los ingresos ni la rentabilidad del Hospital.',
      'Se afectan levemente los ingresos y la rentabilidad del Hospital.',
      'Se afectan los ingresos y la rentabilidad, sin impactar la prestación del servicio.',
      'Se afectan considerablemente los ingresos y la rentabilidad, pudiendo comprometer la prestación del servicio.',
      'Se afectan gravemente los ingresos y la rentabilidad, con pérdidas financieras que comprometen la prestación del servicio.',
    ],
  },
  REPUTACIONAL: {
    etiqueta: 'Reputacional (imagen)',
    niveles: [
      'No se afecta la imagen del Hospital.',
      'Se afecta levemente la imagen, pero se puede manejar sin generar impacto.',
      'Tendría medianas consecuencias o efectos sobre la entidad o el paciente.',
      'Se genera un impacto mayor en la imagen que trasciende en redes sociales.',
      'La afectación de la imagen es crítica y trasciende en redes sociales y medios de comunicación.',
    ],
  },
  AMBIENTAL: {
    etiqueta: 'Ambiental',
    niveles: [
      'Impacto ambiental mínimo, sin comprometer la operación hospitalaria ni los recursos naturales. No requiere intervención correctiva.',
      'Bajo impacto ambiental, con afectaciones leves y fácilmente controlables que requieren acciones correctivas simples.',
      'Impacto ambiental medio que podría alterar temporalmente algún componente (aire, agua, suelo, residuos). Requiere plan de mitigación y seguimiento.',
      'Impacto ambiental alto, con afectaciones significativas a los recursos naturales, la salud pública o el entorno hospitalario. Requiere medidas urgentes.',
      'Impacto ambiental grave e irreversible, con consecuencias críticas para el ecosistema, la comunidad y la operación hospitalaria.',
    ],
  },
}

export const TIPOS_CONTROL = ['PREVENTIVO', 'CORRECTIVO'] as const
