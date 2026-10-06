// Informe final de auditoría con el formato oficial del hospital (src/formato_de_informe_final/Auditoria_interna.odt).
// Los números del informe NUNCA los produce la IA: se calculan aquí. La IA solo redacta las secciones narrativas.

import {
  ETIQUETAS, INSTITUCION, NIVELES_RIESGO, TIPOS_EVALUADOR, documentosParaAlcance, zonaRiesgo, type Clasificacion,
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
  fecha_inicio_real?: string | null
  fecha_fin_real?: string | null
  /** Indicadores priorizados del proceso que registró el auditor (migración 0013) */
  indicadores_revisados?: IndicadorRevisado[] | null
}

export interface IndicadorRevisado {
  nombre: string
  meta: string
  resultado: string
  observacion: string
}

export interface PerfilInforme {
  nombre_completo: string
  cedula: string
  cargos: string[]
  equipo_auditor: Array<{ nombre: string; cargos: string[] }>
  tipo_evaluador: string | null
}

/** «Coordinadora, Líder equipo»: varios cargos de una persona en una sola línea. */
export const unirCargos = (cargos?: string[] | null) => (cargos ?? []).join(', ')

/** Sin grupo de evaluador, cargos o equipo auditor completo no se puede llenar la Ficha Técnica. */
export const perfilIncompletoInforme = (p: PerfilInforme) =>
  !p.tipo_evaluador || !p.cargos?.length || !p.equipo_auditor?.length || p.equipo_auditor.some((m) => !m.nombre || !m.cargos?.length)

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
  /** Revisión de los indicadores priorizados del proceso (vacía si el auditor no registró ninguno) */
  indicadores: string
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

export const SISTEMA_INFORME = `Actúas como auditor interno líder del ${INSTITUCION.nombre} (${INSTITUCION.ciudad}).
Redacta ÚNICAMENTE las secciones narrativas del informe final de auditoría interna, con el formato oficial del hospital:
- "objetivo": solo si la auditoría no trae objetivo; una oración que empiece con un verbo en infinitivo. Si ya trae objetivo, devuelve una cadena vacía.
- "alcance": un párrafo con el proceso o sistema auditado, el área y el periodo entregados.
- "criterios_seleccion_equipo": de 3 a 5 aspectos que se tienen en cuenta para seleccionar al equipo auditor (competencia, independencia frente al proceso auditado, conocimiento de las normas, formación como auditor según la ISO 19011, cargos del equipo entregados). Sin nombres de personas.
- "priorizacion_procesos": un párrafo que explique por qué se priorizó el proceso o sistema auditado, apoyado en los niveles de riesgo y los hallazgos entregados.
- "riesgos_oportunidades": un párrafo con los riesgos y las oportunidades del programa de auditoría que se derivan de los riesgos evaluados y de las oportunidades de mejora entregadas.
- "oportunidades": un párrafo que resuma las oportunidades de mejora identificadas y su beneficio esperado.
- "observaciones": un párrafo de resumen general de la auditoría (propósito, alcance y resultados principales).
- "conclusiones": uno o dos párrafos que valoren la adecuación, la conveniencia y la eficacia del proceso o sistema frente a los criterios aplicados.
- "indicadores": uno o dos párrafos con la revisión de los indicadores priorizados del proceso que registró el auditor: para cada uno, compara el resultado con la meta (si la cumple o no) y relaciónalo con los hallazgos cuando corresponda. Usa solo los nombres, metas, resultados y observaciones entregados. Si no se registraron indicadores, devuelve una cadena vacía.

No inventes hallazgos, cifras, fechas, nombres ni requisitos: usa exclusivamente los datos entregados. Si un dato no está, no lo supongas.
Cita normas o numerales solo si aparecen en los datos entregados.
Redacta en español técnico de auditoría, en tercera persona, sin adjetivos valorativos.
Responde únicamente con el JSON del esquema.`

export function construirMensajeInforme(a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas, equipo: { lider: string[]; integrantes: string[][]; evaluador: string }): string {
  const objeto = a.alcance === 'SISTEMAS' ? `Sistema: ${a.sistema}` : `Proceso: ${a.proceso}`
  const lineas = [
    '## AUDITORÍA',
    `Código: ${a.codigo}`,
    `Título: ${a.titulo}`,
    `Alcance: ${a.alcance} · ${objeto}${a.area_auditada ? ` · Área: ${a.area_auditada}` : ''}`,
    `Objetivo: ${a.objetivo?.trim() || 'NO INFORMADO (redáctalo)'}`,
    `Periodo planeado: ${a.fecha_inicio ?? 'no informado'} a ${a.fecha_fin ?? 'no informado'}`,
    `Periodo real: ${a.fecha_inicio_real ?? 'no informado'} a ${a.fecha_fin_real ?? 'no informado'}`,
    `Normas aplicables: ${normasDe(a).join(', ')}`,
    '',
    '## EQUIPO AUDITOR (solo cargos)',
    `Evaluador: ${equipo.evaluador}`,
    `Líder del equipo: ${equipo.lider.join(', ')}`,
    ...equipo.integrantes.map((c, i) => `Integrante ${i + 1}: ${c.join(', ')}`),
    '',
    '## ESTADÍSTICAS (calculadas por el sistema; no las modifiques)',
    ...cifrasAuditoria(e),
    '',
    `## INDICADORES PRIORIZADOS DEL PROCESO (registrados por el auditor; proceso: ${areaIndicadores(a)})`,
    ...(revisados(a).length
      ? revisados(a).map((i, n) => `[I${n + 1}] ${i.nombre} · meta: ${i.meta || 'no definida'} · resultado: ${i.resultado || 'no informado'}${i.observacion ? ` · observación del auditor: ${i.observacion}` : ''}`)
      : ['No se registraron indicadores: devuelve "indicadores" como cadena vacía.']),
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

/** Indicadores registrados por el auditor (lista vacía si no hay). */
export const revisados = (a: AuditoriaInforme): IndicadorRevisado[] => (Array.isArray(a.indicadores_revisados) ? a.indicadores_revisados : [])

/** «(area auditada)» de la plantilla: el área auditada o, si no se informó, el proceso o sistema. */
export const areaIndicadores = (a: AuditoriaInforme) => a.area_auditada?.trim() || objetoDe(a)

export const SIN_INDICADORES = 'No se registraron indicadores priorizados del proceso para esta auditoría.'

/** Narrativa determinista, usada cuando la IA no está disponible. */
export function narrativaRespaldo(a: AuditoriaInforme, e: Estadisticas): Narrativa {
  const objeto = a.alcance === 'SISTEMAS' ? `el ${a.sistema}` : `el proceso de ${a.proceso}`
  const c = e.por_clasificacion
  const r = e.por_nivel_riesgo
  const lista = enLista([
    c.NO_CONFORMIDAD ? cuantas(c.NO_CONFORMIDAD, 'no conformidad', 'no conformidades') : '',
    c.OBSERVACION ? cuantas(c.OBSERVACION, 'observación', 'observaciones') : '',
    c.OPORTUNIDAD_DE_MEJORA ? cuantas(c.OPORTUNIDAD_DE_MEJORA, 'oportunidad de mejora', 'oportunidades de mejora') : '',
    c.FORTALEZA ? cuantas(c.FORTALEZA, 'fortaleza', 'fortalezas') : '',
  ].filter(Boolean)) || 'ningún hallazgo'

  const objetivo = `Evaluar la conformidad de ${objeto} del ${INSTITUCION.nombre} frente a los requisitos aplicables.`
  const periodo = a.fecha_inicio_real || a.fecha_inicio
  const periodoFin = a.fecha_fin_real || a.fecha_fin
  const alcance = `La auditoría comprende ${objeto}${a.area_auditada ? `, en el área ${a.area_auditada}` : ''}` +
    `${periodo ? `, en el periodo del ${periodo}${periodoFin ? ` al ${periodoFin}` : ''}` : ''}, frente a ${enLista(normasDe(a))}.`
  const altos = r.ALTA + r.EXTREMA
  const priorizacion = altos
    ? `Se priorizó ${objeto} por la presencia de riesgos de nivel alto o extremo según la escala del PR13_GQ, que requieren tratamiento.`
    : `Se priorizó ${objeto} dentro del programa de auditoría interna para verificar el cumplimiento de los requisitos aplicables y la gestión de sus riesgos.`
  const riesgos = altos
    ? `Los riesgos de nivel alto o extremo identificados en los hallazgos requieren reducirse, evitarse, compartirse o transferirse según el PR13_GQ; el programa de auditoría debe hacer seguimiento a sus controles.`
    : `Los riesgos evaluados en los hallazgos se ubican en niveles que permiten asumirlos o reducirlos con los controles adoptados; el programa de auditoría debe verificar su eficacia.`
  const oportunidades = c.OPORTUNIDAD_DE_MEJORA
    ? `Se identificaron ${cuantas(c.OPORTUNIDAD_DE_MEJORA, 'oportunidad de mejora', 'oportunidades de mejora')} cuya implementación contribuirá a la eficacia de ${objeto}.`
    : `No se identificaron oportunidades de mejora en esta auditoría.`
  const observaciones = `La auditoría interna ${a.codigo} evaluó ${objeto} del ${INSTITUCION.nombre}. Como resultado se registraron ${cuantas(e.total, 'hallazgo', 'hallazgos')}: ${lista}.`

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

  const registrados = revisados(a)
  const indicadores = registrados.length
    ? `Se revisaron ${cuantas(registrados.length, 'indicador priorizado', 'indicadores priorizados')} del proceso de ${areaIndicadores(a)}, con la meta y el resultado que se relacionan arriba.`
    : ''

  return {
    objetivo: a.objetivo?.trim() ? '' : objetivo,
    alcance,
    criterios_seleccion_equipo: [
      'Competencia del equipo auditor en las normas aplicables a la auditoría.',
      'Independencia de los auditores frente al proceso o sistema auditado.',
      'Formación como auditor interno según las directrices de la ISO 19011.',
      'Conocimiento del proceso o sistema auditado y de sus riesgos.',
    ],
    priorizacion_procesos: priorizacion,
    riesgos_oportunidades: riesgos,
    oportunidades,
    observaciones,
    conclusiones,
    indicadores,
  }
}

/** Todos los textos de la narrativa, para revisar cifras y referencias. */
export const textosNarrativa = (n: Narrativa) => [
  n.objetivo, n.alcance, ...n.criterios_seleccion_equipo, n.priorizacion_procesos, n.riesgos_oportunidades, n.oportunidades,
  n.observaciones, n.conclusiones, n.indicadores,
]

/** Cifras de la narrativa que no se pueden rastrear a las estadísticas, los hallazgos o la auditoría. */
export function cifrasNoRastreables(n: Narrativa, a: AuditoriaInforme, hallazgos: HallazgoInforme[], e: Estadisticas): string[] {
  const permitidas = new Set<string>(['9001', '14001', '45001', '19011', '31000', '2015', '2018', '13'])
  const agregar = (x: unknown) => String(x ?? '').match(/\d+(?:[.,]\d+)*/g)?.forEach((m) => permitidas.add(m))
  ;[...cifrasAuditoria(e), e.total, e.confirmados, a.codigo, a.titulo, a.fecha_inicio, a.fecha_fin, a.fecha_inicio_real, a.fecha_fin_real,
    a.objetivo, a.area_auditada, ...(a.criterios ?? []), revisados(a).length,
    ...revisados(a).flatMap((i) => [i.nombre, i.meta, i.resultado, i.observacion])].forEach(agregar)
  hallazgos.forEach((h) => [h.consecutivo, h.hallazgo_corregido, h.criterio_requisito, h.evidencia, h.riesgo_descripcion,
    h.riesgo_probabilidad, h.riesgo_impacto, (h.riesgo_probabilidad ?? 0) * (h.riesgo_impacto ?? 0)].forEach(agregar))
  const texto = textosNarrativa(n).join(' ')
  return [...new Set((texto.match(/\d+(?:[.,]\d+)*/g) ?? []).filter((m) => !permitidas.has(m)))]
}

/**
 * Contenido del informe con la estructura del formato oficial (version_estructura 4): portada, Ficha Técnica,
 * listas de hallazgos en el orden del formato y las secciones de Objetivo a Conclusiones. La 4 (plantilla del
 * 5/10/2026): «Indicadores» es la revisión de los indicadores priorizados del proceso y ya no hay recomendaciones.
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
    version_estructura: 4,
    formato: 'Auditoria_interna.odt',
    identificacion: {
      codigo: a.codigo,
      titulo: a.titulo,
      institucion: INSTITUCION.nombre,
      ciudad: INSTITUCION.ciudad,
      fecha_emision: opciones.generadoEn.slice(0, 10),
      version: opciones.version,
    },
    // «Auditoria Interna - <año> - <proceso o sistema>», como en el encabezado y la portada del formato
    encabezado: { anio: (a.fecha_inicio ?? opciones.generadoEn).slice(0, 4), objeto, evaluador },
    generado: { por: p.nombre_completo, en: opciones.generadoEn },
    ficha: {
      inicio_planeada: a.fecha_inicio ?? '',
      fin_planeada: a.fecha_fin ?? '',
      inicio_real: a.fecha_inicio_real ?? '',
      fin_real: a.fecha_fin_real ?? '',
      sistema_referencia: a.alcance === 'SISTEMAS' ? `${a.sistema} · ${normasDe(a).join(', ')}` : normasDe(a).join(', '),
      evaluador,
      equipo: (p.equipo_auditor ?? []).map((m) => ({ nombre: m.nombre, cargo: unirCargos(m.cargos) })),
      lider: { nombre: p.nombre_completo, cargo: unirCargos(p.cargos) },
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
    // «Revisión de indicadores priorizados en el proceso de <area>»: la lista exacta del auditor y la revisión de la IA
    indicadores: {
      area: areaIndicadores(a),
      revisados: revisados(a).map(({ nombre, meta, resultado, observacion }) => ({ nombre, meta, resultado, observacion })),
      revision: revisados(a).length ? n.indicadores : SIN_INDICADORES,
    },
    oportunidades: n.oportunidades,
    observaciones: n.observaciones,
    conclusiones: n.conclusiones,
    avisos: opciones.avisos,
  }
}

export type ContenidoInforme = ReturnType<typeof construirContenido>
