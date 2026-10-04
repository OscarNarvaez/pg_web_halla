// Informe de auditoría (§9.5): estadísticas en código, estructura ISO 19011 y narrativa.
// Los números del informe NUNCA los produce la IA: se calculan aquí.

import { ETIQUETAS, INSTITUCION, ORDEN_INFORME, type Clasificacion } from './catalogos.ts'

export interface HallazgoInforme {
  id: string
  consecutivo: number
  clasificacion: Clasificacion
  hallazgo_corregido: string
  criterio_requisito: string
  evidencia: string
  severidad: 'alta' | 'media' | 'baja' | null
  estado: string
  editado_por_usuario?: boolean
  criterios_citados: Array<{ criterio_id: string; numeral: string | null; documento: string; titulo?: string }>
}

export interface AuditoriaInforme {
  id: string
  codigo: string
  titulo: string
  alcance: 'PROCESOS' | 'SISTEMAS'
  proceso: string | null
  sistema: string | null
  objetivo: string | null
  criterios: string[] | null
  area_auditada: string | null
  auditado_nombre: string | null
  auditado_cargo: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

export interface PerfilInforme {
  nombre_completo: string
  cedula: string
  cargos: string[]
  equipo_auditor: Array<{ nombre: string; cargos: string[] }>
}

/** «Coordinadora, Líder equipo»: varios cargos de una persona en una sola línea. */
export const unirCargos = (cargos?: string[] | null) => (cargos ?? []).join(', ')

/** Un perfil sin cargos o sin equipo auditor completo no puede firmar un informe. */
export const perfilIncompletoInforme = (p: PerfilInforme) =>
  !p.cargos?.length || !p.equipo_auditor?.length || p.equipo_auditor.some((m) => !m.nombre || !m.cargos?.length)

export interface Narrativa {
  resumen_ejecutivo: string
  conclusiones: string
  recomendaciones: string[]
}

const vacioPorClasificacion = (): Record<Clasificacion, number> => ({
  NO_CONFORMIDAD: 0, OBSERVACION: 0, OPORTUNIDAD_DE_MEJORA: 0, FORTALEZA: 0,
})

function compararNumerales(a: string | null, b: string | null): number {
  const x = String(a ?? '').replace(/^[A-Z]\./, '').split('.').map(Number)
  const y = String(b ?? '').replace(/^[A-Z]\./, '').split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return String(a ?? '').localeCompare(String(b ?? ''))
}

export function calcularEstadisticas(hallazgos: HallazgoInforme[]) {
  const porClasificacion = vacioPorClasificacion()
  const porSeveridad = { alta: 0, media: 0, baja: 0, sin_definir: 0 }
  const porCriterio = new Map<string, { documento: string; numeral: string | null; titulo: string; total: number; por_clasificacion: Record<Clasificacion, number> }>()
  const porDocumento = new Map<string, number>()
  let confirmados = 0
  let editados = 0
  let sinRequisito = 0

  for (const h of hallazgos) {
    porClasificacion[h.clasificacion]++
    porSeveridad[h.severidad ?? 'sin_definir']++
    if (h.estado === 'confirmado') confirmados++
    if (h.editado_por_usuario) editados++
    if (!h.criterios_citados?.length) sinRequisito++
    const documentosDelHallazgo = new Set<string>()
    for (const c of h.criterios_citados ?? []) {
      const clave = `${c.documento}|${c.numeral ?? ''}`
      const fila = porCriterio.get(clave) ?? { documento: c.documento, numeral: c.numeral, titulo: c.titulo ?? '', total: 0, por_clasificacion: vacioPorClasificacion() }
      fila.total++
      fila.por_clasificacion[h.clasificacion]++
      porCriterio.set(clave, fila)
      documentosDelHallazgo.add(c.documento)
    }
    for (const d of documentosDelHallazgo) porDocumento.set(d, (porDocumento.get(d) ?? 0) + 1)
  }

  return {
    total: hallazgos.length,
    por_clasificacion: porClasificacion,
    por_severidad: porSeveridad,
    por_criterio: [...porCriterio.values()].sort((a, b) => a.documento.localeCompare(b.documento) || compararNumerales(a.numeral, b.numeral)),
    por_documento: [...porDocumento.entries()].map(([documento, total]) => ({ documento, total })).sort((a, b) => b.total - a.total),
    confirmados,
    sin_confirmar: hallazgos.length - confirmados,
    editados_por_auditor: editados,
    sin_requisito_verificado: sinRequisito,
  }
}

export type Estadisticas = ReturnType<typeof calcularEstadisticas>

/** Criterios de auditoría del informe: solo las normas y numerales realmente citados. */
export function criteriosAplicados(hallazgos: HallazgoInforme[]): Array<{ documento: string; numerales: string[] }> {
  const mapa = new Map<string, Set<string>>()
  for (const h of hallazgos) {
    for (const c of h.criterios_citados ?? []) {
      if (!mapa.has(c.documento)) mapa.set(c.documento, new Set())
      if (c.numeral) mapa.get(c.documento)!.add(c.numeral)
    }
  }
  return [...mapa.entries()]
    .map(([documento, numerales]) => ({ documento, numerales: [...numerales].sort(compararNumerales) }))
    .sort((a, b) => a.documento.localeCompare(b.documento))
}

export const SISTEMA_INFORME = `Actúas como auditor interno líder del ${INSTITUCION.nombre} (${INSTITUCION.ciudad}).
Redacta ÚNICAMENTE las partes narrativas del informe de auditoría interna:
- "resumen_ejecutivo": un párrafo de 80 a 160 palabras con el propósito, el alcance y los resultados principales.
- "conclusiones": uno o dos párrafos que valoren la adecuación, la conveniencia y la eficacia del proceso o sistema auditado frente a los criterios aplicados, apoyados en los hallazgos.
- "recomendaciones": de 3 a 6 recomendaciones, una acción concreta por elemento, derivadas de las no conformidades, observaciones y oportunidades de mejora. Las fortalezas no generan recomendaciones.

No inventes hallazgos, cifras ni requisitos. Usa exclusivamente los hallazgos y estadísticas entregados.
Cita normas o numerales solo si aparecen en los hallazgos entregados.
Redacta en español técnico de auditoría, en tercera persona, sin adjetivos valorativos.
Responde únicamente con el JSON del esquema.`

export function construirMensajeInforme(a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas): string {
  const objeto = a.alcance === 'SISTEMAS' ? `Sistema: ${a.sistema}` : `Proceso: ${a.proceso}`
  const lineas = [
    '## AUDITORÍA',
    `Código: ${a.codigo}`,
    `Título: ${a.titulo}`,
    `Alcance: ${a.alcance} · ${objeto}${a.area_auditada ? ` · Área: ${a.area_auditada}` : ''}`,
    `Objetivo: ${a.objetivo ?? 'No informado'}`,
    `Periodo: ${a.fecha_inicio ?? 'no informado'} a ${a.fecha_fin ?? 'no informado'}`,
    '',
    '## ESTADÍSTICAS (calculadas por el sistema; no las modifiques)',
    `Total de hallazgos: ${e.total}`,
    ...ORDEN_INFORME.map((c) => `${ETIQUETAS[c].plural}: ${e.por_clasificacion[c]}`),
    `Severidad alta: ${e.por_severidad.alta} · media: ${e.por_severidad.media} · baja: ${e.por_severidad.baja}`,
    '',
    '## HALLAZGOS',
  ]
  for (const c of ORDEN_INFORME) {
    for (const h of hallazgos.filter((x) => x.clasificacion === c)) {
      lineas.push(`[H${h.consecutivo}] ${ETIQUETAS[c].singular}${h.severidad ? ` (severidad ${h.severidad})` : ''}: ${h.hallazgo_corregido}`, `    Criterio: ${h.criterio_requisito}`)
    }
  }
  lineas.push('', 'Responde ÚNICAMENTE con el JSON definido en el esquema.')
  return lineas.join('\n')
}

const PALABRAS = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
const cuantas = (n: number, singular: string, plural: string) => `${n <= 10 ? PALABRAS[n] : n} ${n === 1 ? singular : plural}`

/** Narrativa determinista, usada cuando la IA no está disponible. Retoma la conclusión del prototipo. */
export function narrativaRespaldo(a: AuditoriaInforme, e: Estadisticas): Narrativa {
  const objeto = a.alcance === 'SISTEMAS' ? `el ${a.sistema}` : `el proceso de ${a.proceso}`
  const c = e.por_clasificacion
  const partes = [
    c.NO_CONFORMIDAD ? cuantas(c.NO_CONFORMIDAD, 'no conformidad', 'no conformidades') : '',
    c.OBSERVACION ? cuantas(c.OBSERVACION, 'observación', 'observaciones') : '',
    c.OPORTUNIDAD_DE_MEJORA ? cuantas(c.OPORTUNIDAD_DE_MEJORA, 'oportunidad de mejora', 'oportunidades de mejora') : '',
    c.FORTALEZA ? cuantas(c.FORTALEZA, 'fortaleza', 'fortalezas') : '',
  ].filter(Boolean)
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0] ?? 'ningún hallazgo'

  const resumen = `La auditoría interna ${a.codigo} evaluó ${objeto} del ${INSTITUCION.nombre}` +
    `${a.objetivo ? ` con el objetivo de ${a.objetivo.replace(/^\s*(?:el objetivo es|objetivo:)\s*/i, '').replace(/\.$/, '').replace(/^./, (m) => m.toLowerCase())}` : ''}. ` +
    `Como resultado se registraron ${cuantas(e.total, 'hallazgo', 'hallazgos')}: ${lista}.`

  const adecuacion = c.NO_CONFORMIDAD
    ? `presenta una adecuación parcial frente a los criterios aplicados, toda vez que se ${c.NO_CONFORMIDAD === 1 ? 'identificó' : 'identificaron'} ${cuantas(c.NO_CONFORMIDAD, 'no conformidad', 'no conformidades')}`
    : 'es adecuado frente a los criterios aplicados, al no evidenciarse incumplimientos de los requisitos evaluados'
  const conveniencia = c.FORTALEZA
    ? `su conveniencia se sustenta en ${cuantas(c.FORTALEZA, 'fortaleza identificada', 'fortalezas identificadas')}`
    : 'su conveniencia requiere fortalecerse, al no identificarse fortalezas'
  const pendientes = c.OBSERVACION + c.OPORTUNIDAD_DE_MEJORA
  const eficacia = pendientes
    ? `su eficacia puede mejorarse atendiendo ${cuantas(pendientes, 'observación u oportunidad de mejora', 'observaciones y oportunidades de mejora')}`
    : c.NO_CONFORMIDAD ? 'su eficacia depende del cierre oportuno de las acciones correctivas' : 'no se identificaron aspectos que comprometan su eficacia'
  const conclusiones = `Con base en la evidencia objetiva recopilada, se concluye que ${objeto} ${adecuacion}; ${conveniencia}; y ${eficacia}.`

  const recomendaciones: string[] = []
  if (c.NO_CONFORMIDAD) recomendaciones.push('Formular e implementar acciones correctivas para cada no conformidad, con análisis de causa, responsable y fecha de cierre.')
  if (c.OBSERVACION) recomendaciones.push('Analizar las observaciones registradas y definir controles preventivos que eviten su materialización como incumplimientos.')
  if (c.OPORTUNIDAD_DE_MEJORA) recomendaciones.push('Evaluar la viabilidad de las oportunidades de mejora e incorporarlas en el plan de mejoramiento del proceso.')
  if (c.NO_CONFORMIDAD || c.OBSERVACION) recomendaciones.push('Verificar la eficacia de las acciones tomadas en la siguiente auditoría interna.')
  return { resumen_ejecutivo: resumen, conclusiones, recomendaciones }
}

/** Cifras de la narrativa que no se pueden rastrear a las estadísticas, los hallazgos o la auditoría. */
export function cifrasNoRastreables(n: Narrativa, a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas): string[] {
  const permitidas = new Set<string>()
  const agregar = (x: unknown) => String(x ?? '').match(/\d+(?:[.,]\d+)*/g)?.forEach((m) => permitidas.add(m))
  ;[e.total, e.confirmados, ...Object.values(e.por_clasificacion), ...Object.values(e.por_severidad), a.codigo, a.titulo,
    a.fecha_inicio, a.fecha_fin, a.objetivo].forEach(agregar)
  hallazgos.forEach((h) => [h.consecutivo, h.hallazgo_corregido, h.criterio_requisito, h.evidencia].forEach(agregar))
  const texto = [n.resumen_ejecutivo, n.conclusiones, ...n.recomendaciones].join(' ')
  return [...new Set((texto.match(/\d+(?:[.,]\d+)*/g) ?? []).filter((m) => !permitidas.has(m)))]
}

/** Estructura completa del informe, en el orden obligatorio de 11 secciones (ISO 19011). */
export function construirContenido(opciones: {
  auditoria: AuditoriaInforme
  perfil: PerfilInforme
  hallazgos: HallazgoInforme[]
  estadisticas: Estadisticas
  narrativa: Narrativa
  fechaEmision: string
  version: number
  avisos: string[]
}) {
  const { auditoria: a, perfil: p, hallazgos, estadisticas: e, narrativa: n } = opciones
  const lider = { nombre: p.nombre_completo, cargo: unirCargos(p.cargos), cedula: p.cedula }
  const integrantes = (p.equipo_auditor ?? []).map((m) => ({ nombre: m.nombre, cargo: unirCargos(m.cargos) }))
  return {
    // 2: el equipo auditor es una lista (integrantes) y cada persona puede tener varios cargos
    version_estructura: 2,
    identificacion: {
      codigo: a.codigo,
      titulo: a.titulo,
      institucion: INSTITUCION.nombre,
      ciudad: INSTITUCION.ciudad,
      fecha_emision: opciones.fechaEmision,
      version: opciones.version,
    },
    objetivo: a.objetivo ?? '',
    alcance: {
      tipo: a.alcance,
      objeto: a.alcance === 'SISTEMAS' ? a.sistema : a.proceso,
      area_auditada: a.area_auditada ?? '',
      periodo: { inicio: a.fecha_inicio, fin: a.fecha_fin },
      auditado: { nombre: a.auditado_nombre ?? '', cargo: a.auditado_cargo ?? '' },
    },
    criterios: criteriosAplicados(hallazgos),
    equipo_auditor: { lider, integrantes },
    metodologia: [
      'Revisión documental de registros, procedimientos e información documentada del proceso.',
      'Entrevistas con el personal responsable y los auditados.',
      'Observación directa de las actividades en el lugar de trabajo.',
      'Clasificación y redacción de hallazgos asistida por el sistema experto halla, con verificación del auditor.',
    ],
    resumen_resultados: {
      total: e.total,
      por_clasificacion: ORDEN_INFORME.map((c) => ({ clasificacion: c, etiqueta: ETIQUETAS[c].plural, total: e.por_clasificacion[c] })),
      por_severidad: e.por_severidad,
    },
    hallazgos: ORDEN_INFORME.map((c) => ({
      clasificacion: c,
      etiqueta: ETIQUETAS[c].plural,
      items: hallazgos
        .filter((h) => h.clasificacion === c)
        .map((h) => ({
          id: h.id,
          consecutivo: h.consecutivo,
          hallazgo_corregido: h.hallazgo_corregido,
          criterio_requisito: h.criterio_requisito,
          evidencia: h.evidencia,
          severidad: h.severidad,
        })),
    })),
    resumen_ejecutivo: n.resumen_ejecutivo,
    conclusiones: n.conclusiones,
    recomendaciones: n.recomendaciones,
    firmas: [
      { rol: 'Auditor líder', ...lider },
      ...integrantes.map((m) => ({ rol: 'Equipo auditor', ...m, cedula: null })),
    ],
    avisos: opciones.avisos,
  }
}
