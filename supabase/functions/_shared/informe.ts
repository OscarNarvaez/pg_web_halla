// Informe final de auditoría con el formato oficial del hospital (src/formato_de_informe_final/Auditoria_interna.docx).
// Los números del informe NUNCA los produce la IA: se calculan aquí. La IA solo redacta las secciones narrativas.

import {
  ETIQUETAS, INSTITUCION, NIVELES_RIESGO, TIPOS_EVALUADOR, documentosParaAlcance, textosAuditoria, zonaRiesgo, type Clasificacion,
} from './catalogos.ts'

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
  riesgo_descripcion?: string | null
  riesgo_dimension?: string | null
  riesgo_probabilidad?: number | null
  riesgo_impacto?: number | null
  controles?: Array<{ descripcion: string; tipo: string; origen: string; adoptado: boolean }> | null
  evidencia_archivo?: { nombre: string; paginas: number; sha256: string } | null
  /** PDF cargados al editar la evidencia (migración 0012) */
  evidencia_anexos?: Array<{ nombre: string; paginas: number; sha256: string }> | null
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
  /** «Fecha Auditoría» y «Fecha Creación del Informe» de la Ficha Técnica (0018) */
  fecha_auditoria?: string | null
  fecha_informe?: string | null
  /** Indicadores priorizados del proceso que registró el auditor: solo su nombre corto (0013, 0015) */
  indicadores_revisados?: IndicadorRevisado[] | null
  /** Equipo auditor de esta auditoría (0016); vacío → el del perfil */
  equipo_auditor?: IntegranteEquipo[] | null
  /** Líder del equipo auditor de esta auditoría, escrito a mano (0017); sin registrar → null, nunca el del perfil */
  lider_auditor?: IntegranteEquipo | null
}

export interface IntegranteEquipo {
  nombre: string
  cargos: string[]
}

export interface IndicadorRevisado {
  nombre: string
}

export interface PerfilInforme {
  nombre_completo: string
  cedula: string
  cargos: string[]
  equipo_auditor: IntegranteEquipo[]
  tipo_evaluador: string | null
}

/** «Coordinadora, Líder equipo»: varios cargos de una persona en una sola línea. */
export const unirCargos = (cargos?: string[] | null) => (cargos ?? []).join(', ')

/**
 * Equipo auditor del informe: el de la auditoría (0016, decisión del dueño, 12/10/2026) y, si no tiene, el del perfil
 * (el equipo habitual del auditor).
 */
export const equipoDe = (a: AuditoriaInforme, p: PerfilInforme): IntegranteEquipo[] =>
  (a.equipo_auditor?.length ? a.equipo_auditor : p.equipo_auditor) ?? []

const equipoIncompleto = (equipo: IntegranteEquipo[]) => !equipo.length || equipo.some((m) => !m?.nombre || !m?.cargos?.length)

/** Sin grupo de evaluador no se puede llenar la Ficha Técnica («Evaluador»); el equipo y el líder se revisan aparte. */
export const perfilIncompletoInforme = (p: PerfilInforme) => !p.tipo_evaluador

/** El equipo auditor de la Ficha Técnica: al menos una persona, cada una con nombre y cargos. */
export const equipoIncompletoInforme = (a: AuditoriaInforme, p: PerfilInforme) => equipoIncompleto(equipoDe(a, p))

/**
 * Líder del equipo auditor (0017, decisión del dueño, 12/10/2026): el que se registró a mano en la auditoría. No se
 * toma del perfil, porque el líder no siempre es el dueño de la cuenta.
 */
export const liderDe = (a: AuditoriaInforme): IntegranteEquipo | null => a.lider_auditor ?? null

/** El «Líder equipo» de la Ficha Técnica: registrado, con nombre y cargos. */
export const liderIncompletoInforme = (a: AuditoriaInforme) => equipoIncompleto(liderDe(a) ? [liderDe(a) as IntegranteEquipo] : [])

/** Secciones que redacta la IA (o la plantilla de respaldo si la IA no está disponible). */
export interface Narrativa {
  objetivo: string
  alcance: string
  criterios_seleccion_equipo: string[]
  priorizacion_procesos: string
  riesgos_oportunidades: string
  oportunidades: string
  observaciones: string
  conclusiones: string
}

// Orden de las listas de hallazgos en el formato oficial
export const ORDEN_FORMATO: Clasificacion[] = ['FORTALEZA', 'OPORTUNIDAD_DE_MEJORA', 'OBSERVACION', 'NO_CONFORMIDAD']

// Métodos de la auditoría (el formato tiene cuatro renglones para ellos)
export const METODOS_AUDITORIA = [
  'Revisión documental de registros, procedimientos e información documentada del proceso.',
  'Entrevistas con el personal responsable y los auditados.',
  'Observación directa de las actividades en el lugar de trabajo.',
  'Evaluación de los riesgos con la metodología del PR13_GQ y clasificación de los hallazgos asistida por el sistema experto halla, con verificación del auditor.',
]

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
  const porNivelRiesgo = { BAJA: 0, MODERADA: 0, ALTA: 0, EXTREMA: 0, sin_evaluar: 0 }
  let confirmados = 0
  let editados = 0
  let sinRequisito = 0
  let controlesAdoptados = 0
  let ncConRequisito = 0

  for (const h of hallazgos) {
    porClasificacion[h.clasificacion]++
    porSeveridad[h.severidad ?? 'sin_definir']++
    if (h.estado === 'confirmado') confirmados++
    if (h.editado_por_usuario) editados++
    if (!h.criterios_citados?.length) sinRequisito++
    else if (h.clasificacion === 'NO_CONFORMIDAD') ncConRequisito++
    if (h.clasificacion !== 'FORTALEZA') {
      const zona = zonaRiesgo((h.riesgo_probabilidad ?? 0) * (h.riesgo_impacto ?? 0))
      porNivelRiesgo[zona ?? 'sin_evaluar']++
    }
    controlesAdoptados += (h.controles ?? []).filter((c) => c.adoptado).length
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
    no_conformidades_con_requisito: ncConRequisito,
    por_nivel_riesgo: porNivelRiesgo,
    controles_adoptados: controlesAdoptados,
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


// ─── Datos que no redacta la IA ────────────────────────────────────────────

const objetoDe = (a: AuditoriaInforme) => (a.alcance === 'SISTEMAS' ? a.sistema : a.proceso) ?? ''
const normasDe = (a: AuditoriaInforme) => (a.criterios?.length ? a.criterios : documentosParaAlcance(a.alcance, a.sistema))
const porcentaje = (parte: number, total: number) => (total ? Math.round((100 * parte) / total) : 0)

/** «NTC-ISO 9001:2015 (numerales citados: 7.2, 8.5.1)» por cada norma aplicable o citada. */
export function criteriosDeAuditoria(a: AuditoriaInforme, hallazgos: HallazgoInforme[]): string[] {
  const citados = new Map(criteriosAplicados(hallazgos).map((c) => [c.documento, c.numerales]))
  const documentos = [...new Set([...normasDe(a), ...citados.keys()])]
  return documentos.map((d) => {
    const numerales = citados.get(d) ?? []
    return numerales.length ? `${d} (numerales citados: ${numerales.join(', ')})` : d
  })
}

/**
 * Cifras de la auditoría, calculadas en código. Ya no van en el informe (la sección «Indicadores» es la revisión de los
 * indicadores del proceso); se entregan a la IA como contexto y sirven para rastrear las cifras de la narrativa.
 */
export function cifrasAuditoria(e: Estadisticas): string[] {
  const c = e.por_clasificacion
  const r = e.por_nivel_riesgo
  const evaluados = r.BAJA + r.MODERADA + r.ALTA + r.EXTREMA
  const lineas = [
    `Hallazgos registrados: ${e.total} (validados: ${e.confirmados}, ${porcentaje(e.confirmados, e.total)} %).`,
    `${ETIQUETAS.FORTALEZA.plural}: ${c.FORTALEZA} · ${ETIQUETAS.OPORTUNIDAD_DE_MEJORA.plural}: ${c.OPORTUNIDAD_DE_MEJORA} · ${ETIQUETAS.OBSERVACION.plural}: ${c.OBSERVACION} · ${ETIQUETAS.NO_CONFORMIDAD.plural}: ${c.NO_CONFORMIDAD}.`,
  ]
  if (c.NO_CONFORMIDAD) lineas.push(`No conformidades con requisito verificado en las normas cargadas: ${e.no_conformidades_con_requisito} de ${c.NO_CONFORMIDAD}.`)
  if (evaluados) {
    lineas.push(`Riesgos evaluados con la escala del PR13_GQ: ${evaluados} (${NIVELES_RIESGO.BAJA} ${r.BAJA} · ${NIVELES_RIESGO.MODERADA} ${r.MODERADA} · ${NIVELES_RIESGO.ALTA} ${r.ALTA} · ${NIVELES_RIESGO.EXTREMA} ${r.EXTREMA}).`)
  }
  lineas.push(`Controles adoptados: ${e.controles_adoptados}.`)
  return lineas
}

// ─── Narrativa con la IA ────────────────────────────────────────────────────

/**
 * La conclusión del informe es UN párrafo que valora la adecuación, la conveniencia y la eficacia (decisión del dueño,
 * 12/10/2026). Devuelve los conceptos que el texto no nombra (vacío si están los tres).
 */
export const CONCEPTOS_CONCLUSION = [
  { nombre: 'la adecuación', patron: /adecuaci[oó]n|adecuad[oa]s?\b/i },
  { nombre: 'la conveniencia', patron: /convenien(?:cia|tes?)\b/i },
  { nombre: 'la eficacia', patron: /eficacia|eficaz/i },
]
export const faltanEnConclusion = (texto: string) => CONCEPTOS_CONCLUSION.filter((c) => !c.patron.test(texto ?? '')).map((c) => c.nombre)

/** Instrucciones del informe según el grupo del auditor: auditoría interna o externa (decisión del dueño, 13/10/2026). */
export const sistemaInforme = (tipoEvaluador?: string | null) => {
  const t = textosAuditoria(tipoEvaluador)
  return `Actúas como ${t.auditor} líder de la auditoría al ${INSTITUCION.nombre} (${INSTITUCION.ciudad}).
Redacta ÚNICAMENTE las secciones narrativas del informe final de auditoría ${t.tipo}, con el formato oficial del hospital:
- "objetivo": solo si la auditoría no trae objetivo; una oración que empiece con un verbo en infinitivo. Si ya trae objetivo, devuelve una cadena vacía.
- "alcance": un párrafo con el proceso o sistema auditado, el área y el periodo entregados.
- "criterios_seleccion_equipo": de 3 a 5 aspectos que se tienen en cuenta para seleccionar al equipo auditor (competencia, independencia frente al proceso auditado, conocimiento de las normas, formación como auditor según la ISO 19011, cargos del equipo entregados). Sin nombres de personas.
- "priorizacion_procesos": un párrafo que explique por qué se priorizó el proceso o sistema auditado, apoyado en los niveles de riesgo y los hallazgos entregados.
- "riesgos_oportunidades": un párrafo con los riesgos y las oportunidades del programa de auditoría que se derivan de los riesgos evaluados y de las oportunidades de mejora entregadas.
- "oportunidades": un párrafo que resuma las oportunidades de mejora identificadas y su beneficio esperado.
- "observaciones": un párrafo de resumen general de la auditoría (propósito, alcance y resultados principales).
- "conclusiones": UN SOLO párrafo, sin saltos de línea ni viñetas, que concluya sobre la adecuación, la conveniencia y la eficacia del proceso o sistema auditado frente a los criterios aplicados. Nombra expresamente los tres términos y sustenta cada uno en los hallazgos entregados: la adecuación (si lo establecido cumple los requisitos de los criterios aplicados), la conveniencia (si es apropiado para el propósito y el contexto del proceso o sistema) y la eficacia (si se logran los resultados planificados).

Es una auditoría ${t.tipo}: cuando la nombres, escribe «auditoría ${t.tipo}», nunca la otra.
Si mencionas indicadores del proceso, nómbralos exactamente como los registró el auditor (sección INDICADORES); no inventes otros indicadores, metas ni resultados.
No inventes hallazgos, cifras, fechas, nombres ni requisitos: usa exclusivamente los datos entregados. Si un dato no está, no lo supongas.
Cita normas o numerales solo si aparecen en los datos entregados.
Redacta en español técnico de auditoría, en tercera persona, sin adjetivos valorativos.
Responde únicamente con el JSON del esquema.`
}

export function construirMensajeInforme(
  a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas,
  equipo: { lider: string[]; integrantes: string[][]; evaluador: string; tipoEvaluador?: string | null },
): string {
  const objeto = a.alcance === 'SISTEMAS' ? `Sistema: ${a.sistema}` : `Proceso: ${a.proceso}`
  const indicadores = revisados(a)
  const lineas = [
    '## AUDITORÍA',
    `Tipo: auditoría ${textosAuditoria(equipo.tipoEvaluador).tipo}`,
    `Código: ${a.codigo}`,
    `Título: ${a.titulo}`,
    `Alcance: ${a.alcance} · ${objeto}${a.area_auditada ? ` · Área: ${a.area_auditada}` : ''}`,
    `Objetivo: ${a.objetivo?.trim() || 'NO INFORMADO (redáctalo)'}`,
    `Periodo planeado: ${a.fecha_inicio ?? 'no informado'} a ${a.fecha_fin ?? 'no informado'}`,
    `Fecha de la auditoría: ${a.fecha_auditoria ?? 'no informada'}`,
    `Normas aplicables: ${normasDe(a).join(', ')}`,
    '',
    '## EQUIPO AUDITOR (solo cargos)',
    `Evaluador: ${equipo.evaluador}`,
    `Líder del equipo: ${equipo.lider.join(', ')}`,
    ...equipo.integrantes.map((c, i) => `Integrante ${i + 1}: ${c.join(', ')}`),
    '',
    '## INDICADORES (priorizados del proceso, registrados por el auditor; solo sus nombres)',
    indicadores.length ? enLista(indicadores) : 'Ninguno registrado: no menciones indicadores concretos.',
    '',
    '## ESTADÍSTICAS (calculadas por el sistema; no las modifiques)',
    ...cifrasAuditoria(e),
    '',
    '## HALLAZGOS',
  ]
  for (const c of ORDEN_FORMATO) {
    for (const h of hallazgos.filter((x) => x.clasificacion === c)) {
      const puntaje = (h.riesgo_probabilidad ?? 0) * (h.riesgo_impacto ?? 0)
      const zona = zonaRiesgo(puntaje)
      lineas.push(`[H${h.consecutivo}] ${ETIQUETAS[c].singular}: ${h.hallazgo_corregido}`, `    Criterio: ${h.criterio_requisito}`)
      if (h.riesgo_descripcion && zona) lineas.push(`    Riesgo: ${h.riesgo_descripcion} (nivel ${NIVELES_RIESGO[zona]}, ${puntaje})`)
    }
  }
  lineas.push('', 'Responde ÚNICAMENTE con el JSON definido en el esquema.')
  return lineas.join('\n')
}

const PALABRAS = ['ninguna', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
const cuantas = (n: number, singular: string, plural: string) => `${n <= 10 ? PALABRAS[n] : n} ${n === 1 ? singular : plural}`
const enLista = (partes: string[]) => (partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0] ?? '')

/** Nombres de los indicadores que registró el auditor (lista vacía si no hay). */
export const revisados = (a: AuditoriaInforme): string[] =>
  (Array.isArray(a.indicadores_revisados) ? a.indicadores_revisados : []).map((i) => i?.nombre?.trim()).filter((n): n is string => Boolean(n))


/** Narrativa determinista, usada cuando la IA no está disponible (en auditoría interna o externa). */
export function narrativaRespaldo(a: AuditoriaInforme, e: Estadisticas, tipoEvaluador?: string | null): Narrativa {
  const t = textosAuditoria(tipoEvaluador)
  const objeto = a.alcance === 'SISTEMAS' ? `el ${a.sistema}` : `el proceso de ${a.proceso}`
  const c = e.por_clasificacion
  const r = e.por_nivel_riesgo
  const lista = enLista([
    c.NO_CONFORMIDAD ? cuantas(c.NO_CONFORMIDAD, 'no conformidad', 'no conformidades') : '',
    c.OBSERVACION ? cuantas(c.OBSERVACION, 'observación', 'observaciones') : '',
    c.OPORTUNIDAD_DE_MEJORA ? cuantas(c.OPORTUNIDAD_DE_MEJORA, 'oportunidad de mejora', 'oportunidades de mejora') : '',
    c.FORTALEZA ? cuantas(c.FORTALEZA, 'fortaleza', 'fortalezas') : '',
  ].filter(Boolean)) || 'ningún hallazgo'

  // «de el proceso» → «del proceso»
  const deObjeto = objeto.startsWith('el ') ? `del ${objeto.slice(3)}` : `de ${objeto}`
  const objetivo = `Evaluar la conformidad ${deObjeto} del ${INSTITUCION.nombre} frente a los requisitos aplicables.`
  // La fecha de la auditoría (0018) o, si no se registró, el periodo planeado
  const cuando = a.fecha_auditoria ? `, realizada el ${a.fecha_auditoria}`
    : a.fecha_inicio ? `, en el periodo del ${a.fecha_inicio}${a.fecha_fin ? ` al ${a.fecha_fin}` : ''}` : ''
  const alcance = `La auditoría comprende ${objeto}${a.area_auditada ? `, en el área ${a.area_auditada}` : ''}${cuando}, frente a ${enLista(normasDe(a))}.`
  const altos = r.ALTA + r.EXTREMA
  const priorizacion = altos
    ? `Se priorizó ${objeto} por la presencia de riesgos de nivel alto o extremo según la escala del PR13_GQ, que requieren tratamiento.`
    : `Se priorizó ${objeto} dentro del programa de auditoría ${t.tipo} para verificar el cumplimiento de los requisitos aplicables y la gestión de sus riesgos.`
  const riesgos = altos
    ? `Los riesgos de nivel alto o extremo identificados en los hallazgos requieren reducirse, evitarse, compartirse o transferirse según el PR13_GQ; el programa de auditoría debe hacer seguimiento a sus controles.`
    : `Los riesgos evaluados en los hallazgos se ubican en niveles que permiten asumirlos o reducirlos con los controles adoptados; el programa de auditoría debe verificar su eficacia.`
  const oportunidades = c.OPORTUNIDAD_DE_MEJORA
    ? `Se ${c.OPORTUNIDAD_DE_MEJORA === 1 ? 'identificó' : 'identificaron'} ${cuantas(c.OPORTUNIDAD_DE_MEJORA, 'oportunidad de mejora', 'oportunidades de mejora')} cuya implementación contribuirá a la eficacia ${deObjeto}.`
    : `No se identificaron oportunidades de mejora en esta auditoría.`
  const observaciones = `La auditoría ${t.tipo} ${a.codigo} evaluó ${objeto} del ${INSTITUCION.nombre}. Como resultado se registraron ${cuantas(e.total, 'hallazgo', 'hallazgos')}: ${lista}.`

  const adecuacion = c.NO_CONFORMIDAD
    ? `presenta una adecuación parcial frente a los criterios aplicados, toda vez que se ${c.NO_CONFORMIDAD === 1 ? 'identificó' : 'identificaron'} ${cuantas(c.NO_CONFORMIDAD, 'no conformidad', 'no conformidades')}`
    : 'presenta una adecuación total frente a los criterios aplicados, al no evidenciarse incumplimientos de los requisitos evaluados'
  const conveniencia = c.FORTALEZA
    ? `su conveniencia se sustenta en ${cuantas(c.FORTALEZA, 'fortaleza identificada', 'fortalezas identificadas')}`
    : 'su conveniencia requiere fortalecerse, al no identificarse fortalezas'
  const pendientes = c.OBSERVACION + c.OPORTUNIDAD_DE_MEJORA
  const eficacia = pendientes
    ? `su eficacia puede mejorarse atendiendo ${cuantas(pendientes, 'observación u oportunidad de mejora', 'observaciones y oportunidades de mejora')}`
    : c.NO_CONFORMIDAD ? 'su eficacia depende del cierre oportuno de las acciones correctivas' : 'no se identificaron aspectos que comprometan su eficacia'
  const conclusiones = `Con base en la evidencia objetiva recopilada, se concluye que ${objeto} ${adecuacion}; ${conveniencia}; y ${eficacia}.`


  return {
    objetivo: a.objetivo?.trim() ? '' : objetivo,
    alcance,
    criterios_seleccion_equipo: [
      'Competencia del equipo auditor en las normas aplicables a la auditoría.',
      'Independencia de los auditores frente al proceso o sistema auditado.',
      `Formación como ${t.auditor} según las directrices de la ISO 19011.`,
      'Conocimiento del proceso o sistema auditado y de sus riesgos.',
    ],
    priorizacion_procesos: priorizacion,
    riesgos_oportunidades: riesgos,
    oportunidades,
    observaciones,
    conclusiones,
  }
}

/** Todos los textos de la narrativa, para revisar cifras y referencias. */
export const textosNarrativa = (n: Narrativa) => [
  n.objetivo, n.alcance, ...n.criterios_seleccion_equipo, n.priorizacion_procesos, n.riesgos_oportunidades, n.oportunidades,
  n.observaciones, n.conclusiones,
]

/** Cifras de la narrativa que no se pueden rastrear a las estadísticas, los hallazgos o la auditoría. */
export function cifrasNoRastreables(n: Narrativa, a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas): string[] {
  const permitidas = new Set<string>(['9001', '14001', '45001', '19011', '31000', '2015', '2018', '13'])
  const agregar = (x: unknown) => String(x ?? '').match(/\d+(?:[.,]\d+)*/g)?.forEach((m) => permitidas.add(m))
  ;[...cifrasAuditoria(e), e.total, e.confirmados, a.codigo, a.titulo, a.fecha_inicio, a.fecha_fin, a.fecha_auditoria, a.fecha_informe,
    a.objetivo, a.area_auditada, ...(a.criterios ?? []), ...revisados(a)].forEach(agregar)
  hallazgos.forEach((h) => [h.consecutivo, h.hallazgo_corregido, h.criterio_requisito, h.evidencia, h.riesgo_descripcion,
    h.riesgo_probabilidad, h.riesgo_impacto, (h.riesgo_probabilidad ?? 0) * (h.riesgo_impacto ?? 0)].forEach(agregar))
  const texto = textosNarrativa(n).join(' ')
  return [...new Set((texto.match(/\d+(?:[.,]\d+)*/g) ?? []).filter((m) => !permitidas.has(m)))]
}

/** «2026-10-12»: la fecha de un instante en la hora de Colombia. */
export const fechaColombia = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

/**
 * Contenido del informe con la estructura del formato oficial (version_estructura 6): portada, Ficha Técnica,
 * listas de hallazgos en el orden del formato y las secciones de Objetivo a Conclusiones. Plantilla del 5/10/2026: sin
 * recomendaciones. La 5 (10/10/2026): «Indicadores» = la línea de la plantilla con los nombres de los indicadores que
 * registró el auditor en su campo, después de «…en el proceso de» (la IA no los redacta). La 6 (12/10/2026): la Ficha
 * Técnica trae «Fecha Auditoría» y «Fecha Creación del Informe» en lugar de las fechas planeadas y reales.
 */
export function construirContenido(opciones: {
  auditoria: AuditoriaInforme
  perfil: PerfilInforme
  hallazgos: HallazgoInforme[]
  estadisticas: Estadisticas
  narrativa: Narrativa
  generadoEn: string
  version: number
  avisos: string[]
}) {
  const { auditoria: a, perfil: p, hallazgos, estadisticas: e, narrativa: n } = opciones
  const evaluador = TIPOS_EVALUADOR[p.tipo_evaluador as keyof typeof TIPOS_EVALUADOR] ?? ''
  const objeto = objetoDe(a)
  // PDF analizados y PDF agregados al editar, sin repetir (por su huella)
  const adjuntos = [...new Map(hallazgos
    .flatMap((h) => [h.evidencia_archivo, ...(h.evidencia_anexos ?? [])])
    .filter((pdf): pdf is { nombre: string; paginas: number; sha256: string } => Boolean(pdf?.nombre))
    .map((pdf) => [pdf.sha256, `${pdf.nombre} (${pdf.paginas} ${pdf.paginas === 1 ? 'página' : 'páginas'})`])).values()]
  return {
    version_estructura: 6,
    formato: 'Auditoria_interna.docx',
    identificacion: {
      codigo: a.codigo,
      titulo: a.titulo,
      institucion: INSTITUCION.nombre,
      ciudad: INSTITUCION.ciudad,
      fecha_emision: opciones.generadoEn.slice(0, 10),
      version: opciones.version,
    },
    // «Auditoría Interna - <año> - <proceso o sistema>», como en el encabezado y la portada del formato
    // tipo_evaluador decide «Auditoría Interna» o «Auditoría Externa» en todo el documento (formato-informe.js)
    encabezado: { anio: (a.fecha_auditoria ?? a.fecha_inicio ?? opciones.generadoEn).slice(0, 4), objeto, evaluador, tipo_evaluador: p.tipo_evaluador ?? null },
    generado: { por: p.nombre_completo, en: opciones.generadoEn },
    ficha: {
      // Las registra el auditor antes de generar el informe (0018); sin fecha de creación, la del día en que se genera
      fecha_auditoria: a.fecha_auditoria ?? '',
      fecha_informe: a.fecha_informe ?? fechaColombia(opciones.generadoEn),
      sistema_referencia: a.alcance === 'SISTEMAS' ? `${a.sistema} · ${normasDe(a).join(', ')}` : normasDe(a).join(', '),
      evaluador,
      equipo: equipoDe(a, p).map((m) => ({ nombre: m.nombre, cargo: unirCargos(m.cargos) })),
      lider: { nombre: liderDe(a)?.nombre ?? '', cargo: unirCargos(liderDe(a)?.cargos) },
      adjuntos,
    },
    hallazgos: ORDEN_FORMATO.map((c) => ({
      clasificacion: c,
      items: hallazgos.filter((h) => h.clasificacion === c).map((h) => ({ id: h.id, consecutivo: h.consecutivo, texto: h.hallazgo_corregido })),
    })),
    objetivo: a.objetivo?.trim() || n.objetivo,
    alcance: n.alcance,
    criterios_seleccion_equipo: n.criterios_seleccion_equipo,
    criterios_auditoria: criteriosDeAuditoria(a, hallazgos),
    priorizacion_procesos: n.priorizacion_procesos,
    metodos: METODOS_AUDITORIA,
    riesgos_oportunidades: n.riesgos_oportunidades,
    // «Revisión de indicadores priorizados en el proceso de a, b y c» (la frase la arma formato-informe.js)
    indicadores: { revisados: revisados(a) },
    oportunidades: n.oportunidades,
    observaciones: n.observaciones,
    conclusiones: n.conclusiones,
    avisos: opciones.avisos,
  }
}

export type ContenidoInforme = ReturnType<typeof construirContenido>
