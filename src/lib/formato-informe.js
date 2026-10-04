// Formato oficial del informe final (src/formato_de_informe_final/Auditoria_interna.odt, entregado por el dueño).
// Los textos fijos se copian TAL CUAL de la plantilla (incluida la ortografía de la plantilla: «Auditoria», «ANGELES»).
// El ODT se llena sobre la plantilla misma (exportar-odt.js); la vista en pantalla y el PDF reproducen este orden.

export const TEXTOS_FORMATO = {
  institucion: 'HOSPITAL INFANTIL LOS ANGELES',
  programa: 'Auditoria interna de SIG',
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
  recomendaciones: 'RECOMENDACIONES:',
}

// Listas de hallazgos, en el orden de la plantilla
export const LISTAS_HALLAZGOS = [
  { clasificacion: 'FORTALEZA', titulo: 'FORTALEZAS IDENTIFICADAS', vacio: 'No se identificaron fortalezas en esta auditoría.' },
  { clasificacion: 'OPORTUNIDAD_DE_MEJORA', titulo: 'OPORTUNIDADES DE MEJORA', vacio: 'No se identificaron oportunidades de mejora en esta auditoría.' },
  { clasificacion: 'OBSERVACION', titulo: 'OBSERVACIONES', vacio: 'No se registraron observaciones en esta auditoría.' },
  { clasificacion: 'NO_CONFORMIDAD', titulo: 'NO CONFORMIDADES', vacio: 'No se identificaron no conformidades en esta auditoría.' },
]

/**
 * Secciones del formato después de las listas de hallazgos, en su orden. `tipo`: párrafo, viñetas o lista
 * numerada. `antes` es el texto fijo que la plantilla trae entre el título y el contenido. `titulo` sigue el
 * estilo de la plantilla: negrita subrayada (los títulos de sección), negrita centrada (Conclusiones) o texto
 * normal (RECOMENDACIONES:).
 * @param {object} c contenido del informe (version_estructura 3)
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
    { titulo: 'Indicadores', tipo: 'vinetas', contenido: c.indicadores },
    { titulo: 'Oportunidades', tipo: 'parrafo', contenido: c.oportunidades },
    { titulo: 'Observaciones', tipo: 'parrafo', contenido: c.observaciones },
    { titulo: 'Conclusiones', tipo: 'parrafo', contenido: c.conclusiones, estiloTitulo: 'centrado' },
    { titulo: TEXTOS_FORMATO.recomendaciones, tipo: 'numerada', contenido: c.recomendaciones, estiloTitulo: 'cuerpo' },
  ]
}

/** «Auditoria Interna - 2026 - Hospitalización», como en el encabezado de la plantilla. */
export const tituloAuditoria = (c) => `Auditoria Interna - ${c.encabezado.anio} - ${c.encabezado.objeto}`

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

/** ¿El informe tiene la estructura del formato oficial? Las versiones anteriores se deben regenerar. */
export const esFormatoOficial = (c) => (c?.version_estructura ?? 0) >= 3
