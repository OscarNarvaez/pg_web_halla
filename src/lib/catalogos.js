// Fuente única de verdad de los catálogos del frontend.
// Los valores deben coincidir EXACTAMENTE con los enum de PostgreSQL
// (supabase/migrations/0001_tipos_y_perfiles.sql) y con supabase/functions/_shared/catalogos.ts.

export const INSTITUCION = {
  nombre: 'Hospital Infantil Los Ángeles',
  sigla: 'HILA',
  ciudad: 'Pasto, Nariño',
}

export const MARCADOR_PENDIENTE = '[Requisito específico pendiente de identificación/validación]'

export const ALCANCES = [
  { valor: 'PROCESOS', etiqueta: 'Procesos' },
  { valor: 'SISTEMAS', etiqueta: 'Sistemas' },
]

export const PROCESOS = [
  'Nutrición',
  'Imágenes diagnósticas',
  'Gestión hospitalaria universitaria',
  'Control interno',
  'Gestión cliente',
  'Terapias',
  'Hospital seguro',
  'Gestión de calidad',
  'Comercial y mercadeo',
  'Gestión humana',
  'Gestión de recursos físicos',
  'Gestión de la información',
  'Gestión gerencial',
  'Gestión del ambiente físico',
  'Gestión financiera',
  'Hospitalización',
  'Cirugía',
  'Urgencias',
  'Consulta externa',
]

export const SISTEMAS = [
  'Sistema Ambiental',
  'Sistema de Seguridad y Salud en el Trabajo',
  'Sistema de calidad',
  'SARLAFT Y SICOF',
  'UACAI',
  'Empresa familiar',
]

// En base de datos y en el JSON de la IA: claves con guion bajo y sin tilde.
// En pantalla y en el informe: siempre la etiqueta.
export const CLASIFICACIONES = {
  FORTALEZA: { etiqueta: 'Fortaleza', plural: 'Fortalezas', tono: 'fort' },
  NO_CONFORMIDAD: { etiqueta: 'No conformidad', plural: 'No conformidades', tono: 'nc' },
  OBSERVACION: { etiqueta: 'Observación', plural: 'Observaciones', tono: 'obs' },
  OPORTUNIDAD_DE_MEJORA: {
    etiqueta: 'Oportunidad de mejora',
    plural: 'Oportunidades de mejora',
    tono: 'om',
  },
}

// Orden del informe (§9.5): NC → OBS → OM → FORT
export const ORDEN_INFORME = ['NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA', 'FORTALEZA']

// Clases de Tailwind por tono. Se escriben completas para que el purgado de Tailwind las detecte.
// Los «solido» (barras de gráficas, bordes de tarjetas) están validados para daltonismo: el ámbar
// del prototipo (#94620a) quedaba a ΔE 3 del rojo para deuteranopía; #b7791f pasa todos los controles.
export const TONOS = {
  nc: { badge: 'bg-nc-bg text-nc-texto border-nc-borde', solido: '#b42318', barra: 'bg-nc-solido' },
  obs: { badge: 'bg-obs-bg text-obs-texto border-obs-borde', solido: '#b7791f', barra: 'bg-obs-solido' },
  fort: { badge: 'bg-fort-bg text-fort-texto border-fort-borde', solido: '#1b7a4b', barra: 'bg-fort-solido' },
  om: { badge: 'bg-om-bg text-om-texto border-om-borde', solido: '#1f5fa8', barra: 'bg-om-solido' },
}

// Estructura obligatoria de redacción por categoría (ANEXO A del prompt maestro).
export const ESTRUCTURAS = {
  NO_CONFORMIDAD: {
    formula: 'Evidencia + incumplimiento + requisito incumplido.',
    ejemplo:
      'En la Revisión por la Dirección del 14 de julio de 2021 no se incluyó la información relacionada con las decisiones y acciones frente a las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3.',
  },
  OBSERVACION: {
    formula: 'Aspecto a mejorar o debilidad + impacto potencial.',
    ejemplo:
      'Se evidencia falta de planificación de los cambios relacionados con la reposición e incorporación de tecnología biomédica, situación que podría incrementar el riesgo de ocurrencia de eventos adversos.',
  },
  FORTALEZA: {
    formula: 'Aspecto relevante o fortaleza + beneficio obtenido, en tiempo presente.',
    ejemplo:
      'Se evidencia liderazgo de la alta dirección en el sistema de gestión, favoreciendo la mejora de los procesos y el fortalecimiento de las competencias del personal.',
  },
  OPORTUNIDAD_DE_MEJORA: {
    formula: 'Aspecto susceptible de mejorar + para lo cual + beneficio futuro.',
    ejemplo:
      'La infraestructura para la prestación de los servicios es susceptible de mejorar, para lo cual se podrían fortalecer los espacios destinados a la atención, lo que permitirá contar con ambientes más agradables y confortables para el cliente.',
  },
}

export const SEVERIDADES = [
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'baja', etiqueta: 'Baja' },
]

export const ESTADOS_AUDITORIA = {
  borrador: 'Borrador',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
}

// En la matriz consolidada: generado/editado = Pendiente · confirmado = Validado (enum de PostgreSQL)
export const ESTADOS_HALLAZGO = {
  generado: 'Pendiente',
  editado: 'Pendiente (editado)',
  confirmado: 'Validado',
  cambios_sugeridos: 'Se sugiere hacer cambios',
  descartado: 'Descartado',
}

/** Estados que el auditor elige en la matriz. «Pendiente» se guarda como editado si el hallazgo ya se editó. */
export const ESTADOS_MATRIZ = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'confirmado', etiqueta: 'Validado' },
  { valor: 'cambios_sugeridos', etiqueta: 'Se sugiere hacer cambios' },
]
export const estadoMatriz = (estado) => (estado === 'generado' || estado === 'editado' ? 'pendiente' : estado)

export const DOCUMENTOS = [
  { codigo: 'NTC-ISO 9001:2015', titulo: 'Sistemas de gestión de la calidad. Requisitos' },
  { codigo: 'ISO 45001:2018', titulo: 'Sistemas de gestión de la seguridad y salud en el trabajo' },
  { codigo: 'NTC-ISO 14001:2015', titulo: 'Sistemas de gestión ambiental' },
  { codigo: 'ISO 19011', titulo: 'Directrices para la auditoría de sistemas de gestión (en inglés)' },
  { codigo: 'PR13-GQ', titulo: 'Procedimiento institucional de gestión de riesgos' },
]

// Filtra los documentos consultados según el alcance de la auditoría (reduce ruido y tokens).
// Duplicado en supabase/functions/_shared/catalogos.ts: si cambias uno, cambia el otro.
export const DOCUMENTOS_POR_ALCANCE = {
  'Sistema Ambiental': ['NTC-ISO 14001:2015', 'ISO 19011', 'PR13-GQ'],
  'Sistema de Seguridad y Salud en el Trabajo': ['ISO 45001:2018', 'ISO 19011', 'PR13-GQ'],
  'Sistema de calidad': ['NTC-ISO 9001:2015', 'ISO 19011', 'PR13-GQ'],
  'SARLAFT Y SICOF': ['PR13-GQ', 'ISO 19011'],
  UACAI: ['ISO 19011', 'PR13-GQ'],
  'Empresa familiar': ['ISO 19011', 'PR13-GQ'],
  // Todos los PROCESOS: calidad + riesgos + guía de auditoría
  __PROCESOS__: ['NTC-ISO 9001:2015', 'PR13-GQ', 'ISO 19011'],
}

/** Documentos aplicables a una auditoría o perfil según su alcance. */
export function documentosParaAlcance({ alcance, sistema }) {
  if (alcance === 'SISTEMAS' && sistema) return DOCUMENTOS_POR_ALCANCE[sistema] ?? []
  return DOCUMENTOS_POR_ALCANCE.__PROCESOS__
}

/** Nombre del proceso o sistema según el alcance. */
export function objetoAuditado({ alcance, proceso, sistema }) {
  return alcance === 'SISTEMAS' ? sistema : proceso
}

// ─── Riesgo (PR13_GQ V4 · Gestión de riesgos, numeral 5) ───────────────────
// Transcripción limpia de las escalas del documento (el original es OCR de tablas). Duplicado en
// supabase/functions/_shared/catalogos.ts; las claves de DIMENSIONES_IMPACTO = check riesgo_dimension_valida (0007).

export const FUENTE_RIESGO = 'PR13_GQ V4 · Gestión de riesgos (análisis y valoración, evaluación del riesgo inherente y tratamiento)'

export const ESCALA_PROBABILIDAD = [
  { valor: 1, categoria: 'Raro', descripcion: 'El evento ocurre únicamente en circunstancias excepcionales. Se ha presentado una vez en los últimos tres años.' },
  { valor: 2, categoria: 'Improbable', descripcion: 'El evento es poco frecuente, pero podría presentarse. Se ha presentado una vez en el último año.' },
  { valor: 3, categoria: 'Posible', descripcion: 'El evento podría presentarse en algún momento. Se ha presentado una vez en los últimos seis meses.' },
  { valor: 4, categoria: 'Probable', descripcion: 'El evento es esperado en muchas circunstancias. Se ha presentado una vez en el último mes.' },
  { valor: 5, categoria: 'Casi seguro', descripcion: 'El evento ocurre en la mayoría de las circunstancias. Se ha presentado más de una vez en el último mes.' },
]

export const NIVELES_IMPACTO = ['Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico']

export const DIMENSIONES_IMPACTO = {
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

export const TIPOS_CONTROL = ['PREVENTIVO', 'CORRECTIVO']

export const ETIQUETAS_CONTROL = { PREVENTIVO: 'Preventivo', CORRECTIVO: 'Correctivo' }

/** Escala FIJA de niveles (puntaje máximo de Bajo, Moderado y Alto; por encima, Extremo). No es editable: decisión del dueño. */
export const UMBRALES_RIESGO = { bajo: 4, moderado: 9, alto: 16 }

// Zonas del PR13_GQ y la acción a tomar en cada una. La nota del PR13 («no puede haber aceptación de riesgos
// sobre situaciones que conlleven a incumplimientos normativos») la aplica tratamientoPara() en src/lib/riesgo.js.
export const ZONAS_RIESGO = {
  BAJA: { etiqueta: 'Bajo', tratamiento: 'Asumir el riesgo' },
  MODERADA: { etiqueta: 'Moderado', tratamiento: 'Asumir el riesgo o reducirlo' },
  ALTA: { etiqueta: 'Alto', tratamiento: 'Reducir el riesgo, evitarlo, compartirlo o transferirlo' },
  EXTREMA: { etiqueta: 'Extremo', tratamiento: 'Reducir el riesgo, evitarlo, compartirlo o transferirlo' },
}
