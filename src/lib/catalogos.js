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

export const ESTADOS_HALLAZGO = {
  generado: 'Generado',
  editado: 'Editado',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
}

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
