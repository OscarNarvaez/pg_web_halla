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
