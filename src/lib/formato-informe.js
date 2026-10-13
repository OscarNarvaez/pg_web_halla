// Formato oficial del informe final (src/formato_de_informe_final/Auditoria_interna.docx, entregado por el dueño).
// Los textos fijos se copian TAL CUAL de la plantilla (incluida la ortografía de la plantilla: «Auditoria», «ANGELES»).
// El Word se llena sobre la plantilla misma (exportar-docx.js); la vista en pantalla y el PDF reproducen este orden.
import { textosAuditoria } from './catalogos.js'

export const TEXTOS_FORMATO = {
  institucion: 'HOSPITAL INFANTIL LOS ANGELES',
  // Portada y título de las listas (plantilla del 12/10/2026): después de «de» va lo auditado, con programaDe(c)
  programa: 'Auditoria interna de',
  fichaTecnica: 'Ficha Técnica',
  fechaInicioPlaneada: 'Fecha inicio (planeada)',
  fechaFinPlaneada: 'Fecha terminación (planeada)',
  fechaInicioReal: 'Fecha inicio (real)',
  fechaFinReal: 'Fecha terminación (real)',
  sistemaReferencia: 'Sistema de referencia',
  evaluador: 'Evaluador',
  equipoAuditor: 'Equipo auditor',
  liderEquipo: 'Líder equipo',
  archivosAdjuntos: 'Archivos adjuntos',
  principalesAspectos: 'Principales aspectos que se tienen en cuenta:',
  // Renglón de la plantilla bajo «Indicadores» (versión del dueño del 13/10/2026). Justo después de «de» van SOLO los
  // indicadores que escribió el auditor: «…en el proceso de oportunidad en triage, reingresos y satisfacción»
  revisionIndicadores: 'Revisión de indicadores priorizados en el proceso de',
}

export const SIN_INDICADORES = 'No se registraron indicadores priorizados del proceso para esta auditoría.'

/**
 * «a, b y c»: comas entre los elementos y «y» antes del último. Ante una palabra que suena /i/ (i-, hi-, sin diptongo)
 * la conjunción es «e», como manda la ortografía: «oportunidad e infecciones», pero «agua y hielo».
 */
export function unirLista(items) {
  const lista = items.map((t) => String(t ?? '').trim()).filter(Boolean)
  if (lista.length < 2) return lista[0] ?? ''
  const ultimo = lista.at(-1)
  const inicio = ultimo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return `${lista.slice(0, -1).join(', ')} ${/^h?i(?![aeiou])/.test(inicio) ? 'e' : 'y'} ${ultimo}`
}

/**
 * «Revisión de indicadores priorizados en el proceso de oportunidad en triage, reingresos y satisfacción»: los
 * indicadores van justo después de «de», en el lugar del campo de la plantilla, y nada más.
 */
export const lineaIndicadores = (c) => `${TEXTOS_FORMATO.revisionIndicadores} ${unirLista(c.indicadores.revisados)}`.trimEnd()

// Listas de hallazgos, en el orden de la plantilla
export const LISTAS_HALLAZGOS = [
  { clasificacion: 'FORTALEZA', titulo: 'FORTALEZAS IDENTIFICADAS', vacio: 'No se identificaron fortalezas en esta auditoría.' },
  { clasificacion: 'OPORTUNIDAD_DE_MEJORA', titulo: 'OPORTUNIDADES DE MEJORA', vacio: 'No se identificaron oportunidades de mejora en esta auditoría.' },
  { clasificacion: 'OBSERVACION', titulo: 'OBSERVACIONES', vacio: 'No se registraron observaciones en esta auditoría.' },
  { clasificacion: 'NO_CONFORMIDAD', titulo: 'NO CONFORMIDADES', vacio: 'No se identificaron no conformidades en esta auditoría.' },
]

/**
 * Secciones del formato después de las listas de hallazgos, en su orden. `tipo`: párrafo o viñetas. `antes` es el
 * texto fijo que la plantilla trae entre el título y el contenido (ya completo); si se completa en la misma línea,
 * `antesPlantilla` es el texto tal como está en la plantilla y `agregar` lo que se escribe a continuación. `completa`:
 * la línea ya lleva el contenido. `titulo` sigue el estilo de la
 * plantilla: negrita subrayada (los títulos de sección) o negrita centrada (Conclusiones).
 * @param {object} c contenido del informe (version_estructura 5)
 */
export function seccionesFormato(c) {
  return [
    { titulo: 'Objetivo', tipo: 'parrafo', contenido: c.objetivo },
    { titulo: 'Alcance', tipo: 'parrafo', contenido: c.alcance },
    { titulo: 'Criterios de selección equipo auditor', tipo: 'vinetas', antes: TEXTOS_FORMATO.principalesAspectos, contenido: c.criterios_seleccion_equipo },
    { titulo: 'Criterios de auditoría', tipo: 'vinetas', contenido: c.criterios_auditoria },
    { titulo: 'Priorización de procesos', tipo: 'parrafo', contenido: c.priorizacion_procesos },
    { titulo: 'Métodos a emplear para el desarrollo de la auditoría', tipo: 'vinetas', contenido: c.metodos },
    { titulo: 'Riesgos y oportunidades del programa auditoria', tipo: 'parrafo', contenido: c.riesgos_oportunidades },
    {
      titulo: 'Indicadores',
      tipo: 'parrafo',
      antes: lineaIndicadores(c),
      antesPlantilla: TEXTOS_FORMATO.revisionIndicadores,
      agregar: c.indicadores.revisados.length ? ` ${unirLista(c.indicadores.revisados)}` : '',
      escalaAntes: 1,
      completa: c.indicadores.revisados.length > 0,
      contenido: c.indicadores.revisados.length ? [] : [SIN_INDICADORES],
    },
    { titulo: 'Oportunidades', tipo: 'parrafo', contenido: c.oportunidades },
    { titulo: 'Observaciones', tipo: 'parrafo', contenido: c.observaciones },
    { titulo: 'Conclusiones', tipo: 'parrafo', contenido: c.conclusiones, estiloTitulo: 'centrado' },
  ]
}

/** Textos «interna» o «externa» según el grupo del auditor que generó el informe (decisión del dueño, 13/10/2026). */
const tipoDe = (c) => textosAuditoria(c.encabezado?.tipo_evaluador)

/** «Auditoria Interna - 2026 - Hospitalización» (o «Auditoria Externa…»), como en el encabezado de la plantilla. */
export const tituloAuditoria = (c) => `Auditoria ${tipoDe(c).Tipo} - ${c.encabezado.anio} - ${c.encabezado.objeto}`

/**
 * «Auditoria interna de Urgencias» (o «Auditoria externa de…»): justo después de «de» va lo auditado, el proceso o el
 * sistema (decisión del dueño, 12/10/2026). Va en la portada y como título de las listas de hallazgos.
 */
export const programaDe = (c) => `${TEXTOS_FORMATO.programa.replace('interna', tipoDe(c).tipo)} ${c.encabezado.objeto ?? ''}`.trimEnd()

/** «2026-10-04 12:14 PM» en la hora de Colombia, como el pie de la plantilla. */
export function fechaHoraFormato(iso) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute} ${partes.dayPeriod.toUpperCase()}`
}

/** «Generado por <auditor> - 2026-10-04 12:14 PM», el pie de la plantilla. */
export const lineaGenerado = (c) => `Generado por ${c.generado.por} - ${fechaHoraFormato(c.generado.en)}`

/** «Nombre - Cargo, Cargo», como se escribe cada persona en la Ficha Técnica. */
export const personaFicha = (p) => [p?.nombre, p?.cargo].filter(Boolean).join(' - ')

/** Párrafos de un texto narrativo (separados por líneas en blanco). */
export const parrafos = (texto) => String(texto ?? '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)

/**
 * ¿El informe tiene la estructura de la plantilla oficial vigente? Las versiones anteriores (la 3 traía recomendaciones;
 * la 4, meta y resultado de cada indicador) se deben regenerar.
 */
export const esFormatoOficial = (c) => (c?.version_estructura ?? 0) >= 5
