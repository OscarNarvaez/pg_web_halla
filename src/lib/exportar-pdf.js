// Informe final en PDF con el formato oficial (src/formato_de_informe_final/Auditoria_interna.odt): A4, portada
// con el logo de la plantilla, Ficha Técnica y las secciones en el mismo orden, con el encabezado y el pie de la
// plantilla en cada página. Las medidas salen de la plantilla (en pulgadas × 72). Se importa bajo demanda.
//
// Fuentes: la plantilla usa Trebuchet MS y Arial, que no se pueden redistribuir. Se incrusta Liberation Sans
// (licencia OFL, con las mismas medidas de Arial) para que el PDF se vea igual en cualquier equipo.
import { jsPDF } from 'jspdf'
import { logoDePlantilla } from './plantilla-informe'
import { LISTAS_HALLAZGOS, TEXTOS_FORMATO, lineaGenerado, parrafos, personaFicha, seccionesFormato, tituloAuditoria } from './formato-informe'
import { hexARgb, nombreArchivo } from './exportar-comun'
import { registrarFuentes } from './fuentes-pdf'

const PULGADA = 72
const pt = (pulgadas) => pulgadas * PULGADA
const NEGRO = '#000000'
const GRIS_PIE = '#b3b3b3' // encabezado y pie de la plantilla (Arial 8 pt)
const GRIS_CELDA = '#efefef' // celdas de etiqueta de la Ficha Técnica
const BORDE_CELDA = '#cccccc'
const TAMANO = 7.5 // todo el cuerpo de la plantilla va en 7,5 pt
const ESCALA_TITULO = 1.2 // la plantilla ensancha los títulos al 120 %
const ESCALA_ROTULO = 1.15 // y los rótulos de las listas al 115 %
const RENGLON = 9.5
const ESPACIO_PARRAFO = 6.6 // margen superior de los párrafos de la plantilla (≈ 0,092 in)
const RENGLON_VACIO = 10.5

// Renglones vacíos que la plantilla deja después de cada bloque (el primero se usa para el contenido)
const VACIOS_TRAS = {
  'FORTALEZAS IDENTIFICADAS': 3, 'OPORTUNIDADES DE MEJORA': 2, OBSERVACIONES: 2, 'NO CONFORMIDADES': 3,
  Objetivo: 1, Alcance: 1, 'Criterios de selección equipo auditor': 1, 'Criterios de auditoría': 1, 'Priorización de procesos': 1,
  'Métodos a emplear para el desarrollo de la auditoría': 3, 'Riesgos y oportunidades del programa auditoria': 2,
  Indicadores: 1, Oportunidades: 1, Observaciones: 3, Conclusiones: 0,
}

export async function exportarPdf(informe) {
  const c = informe.contenido
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true })
  const [, logo] = await Promise.all([registrarFuentes(doc), logoDePlantilla().catch(() => null)])
  doc.setProperties({ title: tituloAuditoria(c), subject: c.identificacion.titulo, author: c.generado.por, creator: 'halla.ink' })

  const W = doc.internal.pageSize.getWidth()
  // Páginas 2 en adelante (página maestra 2 de la plantilla)
  const IZQ = pt(0.5277)
  const ANCHO = W - IZQ - pt(0.3194)
  const ARRIBA = pt(0.52)
  const ABAJO = pt(11.2)
  let y = ARRIBA

  const fuente = (estilo, tamano, tinta = NEGRO) => {
    doc.setFont('LiberationSans', estilo)
    doc.setFontSize(tamano)
    doc.setTextColor(...hexARgb(tinta))
  }
  const ancho = (texto, escala = 1) => doc.getTextWidth(texto) * escala
  const nuevaPagina = () => {
    doc.addPage()
    y = ARRIBA
  }
  const asegurar = (alto) => {
    if (y + alto > ABAJO) nuevaPagina()
  }

  /** Un renglón de texto con el escalado horizontal y el subrayado de la plantilla. */
  const texto = (t, x, base, { escala = 1, subrayado = false, alinear = 'left' } = {}) => {
    const w = ancho(t, escala)
    const x0 = alinear === 'center' ? x - w / 2 : x
    doc.text(t, x0, base, { horizontalScale: escala })
    if (subrayado) {
      doc.setDrawColor(...hexARgb(NEGRO))
      doc.setLineWidth(0.4)
      doc.line(x0, base + 1.2, x0 + w, base + 1.2)
    }
  }

  /** Párrafo con salto de línea y de página. */
  const parrafo = (t, { estilo = 'normal', escala = 1, sangria = 0, subrayado = false, centrado = false } = {}) => {
    fuente(estilo, TAMANO)
    y += ESPACIO_PARRAFO
    const lineas = doc.splitTextToSize(String(t ?? ''), (ANCHO - sangria) / escala)
    for (const linea of lineas) {
      asegurar(RENGLON)
      texto(linea, centrado ? IZQ + ANCHO / 2 : IZQ + sangria, y + TAMANO, { escala, subrayado, alinear: centrado ? 'center' : 'left' })
      y += RENGLON
    }
  }
  const vacios = (clave) => {
    y += (VACIOS_TRAS[clave] ?? 0) * RENGLON_VACIO
  }

  // ─── Portada (página 1): medidas de la página maestra 1 de la plantilla ────
  if (logo) doc.addImage(logo.datos, logo.formato, pt(4.4), pt(1.36), pt(2.3333), pt(2.3229), 'logo-plantilla')
  const centroPortada = pt(0.7868 + 2.0847) + (W - pt(0.7868 + 2.0847) - pt(0.2951 + 2.1611)) / 2
  const anchoPortada = W - pt(0.7868 + 2.0847) - pt(0.2951 + 2.1611)
  fuente('bold', TAMANO)
  let yPortada = pt(4.08)
  const lineaPortada = (t, despues = 11) => {
    for (const l of doc.splitTextToSize(t, anchoPortada / ESCALA_TITULO)) {
      texto(l, centroPortada, yPortada, { escala: ESCALA_TITULO, alinear: 'center' })
      yPortada += despues
    }
  }
  lineaPortada(TEXTOS_FORMATO.institucion, 12)
  lineaPortada(`${tituloAuditoria(c)} ${c.encabezado.evaluador}`.trim(), 12)
  yPortada += 6
  lineaPortada(c.encabezado.anio, 10)
  lineaPortada(TEXTOS_FORMATO.programa)

  // ─── Ficha Técnica (desde la página 2) ─────────────────────────────────────
  nuevaPagina()
  const ANCHO_TABLA = pt(7.0798)
  const COL = ANCHO_TABLA / 4
  const X_TABLA = IZQ + 1
  const celda = (x, w, alto, { fondo, t = '', negrita = false, centrado = true }) => {
    doc.setDrawColor(...hexARgb(BORDE_CELDA))
    doc.setLineWidth(0.75)
    if (fondo) {
      doc.setFillColor(...hexARgb(fondo))
      doc.rect(x, y, w, alto, 'FD')
    } else doc.rect(x, y, w, alto, 'S')
    if (!t) return
    fuente(negrita ? 'bold' : 'normal', TAMANO)
    const lineas = doc.splitTextToSize(t, w - 8)
    const base = y + alto / 2 - ((lineas.length - 1) * RENGLON) / 2 + 2.6
    lineas.forEach((l, i) => texto(l, centrado ? x + w / 2 : x + 4, base + i * RENGLON, { alinear: centrado ? 'center' : 'left' }))
  }
  const altoPara = (t, w) => {
    fuente('normal', TAMANO)
    return Math.max(15.7, doc.splitTextToSize(t || ' ', w - 8).length * RENGLON + 6)
  }
  const cabecera = (t) => {
    asegurar(12)
    celda(X_TABLA, ANCHO_TABLA, 12, { fondo: GRIS_CELDA, t, negrita: true })
    y += 12
  }
  const filaDoble = (e1, v1, e2, v2) => {
    asegurar(15.7)
    celda(X_TABLA, COL, 15.7, { fondo: GRIS_CELDA, t: e1, negrita: true })
    celda(X_TABLA + COL, COL, 15.7, { t: v1 })
    celda(X_TABLA + 2 * COL, COL, 15.7, { fondo: GRIS_CELDA, t: e2, negrita: true })
    celda(X_TABLA + 3 * COL, COL, 15.7, { t: v2 })
    y += 15.7
  }
  const filaSimple = (e, v) => {
    const alto = altoPara(v, 3 * COL)
    asegurar(alto)
    celda(X_TABLA, COL, alto, { fondo: GRIS_CELDA, t: e, negrita: true })
    celda(X_TABLA + COL, 3 * COL, alto, { t: v, centrado: false })
    y += alto
  }
  const filaCompleta = (v) => {
    const alto = altoPara(v, ANCHO_TABLA)
    asegurar(alto)
    celda(X_TABLA, ANCHO_TABLA, alto, { t: v, centrado: false })
    y += alto
  }
  const f = c.ficha
  cabecera(TEXTOS_FORMATO.fichaTecnica)
  filaDoble(TEXTOS_FORMATO.fechaInicioPlaneada, f.inicio_planeada, TEXTOS_FORMATO.fechaFinPlaneada, f.fin_planeada)
  filaDoble(TEXTOS_FORMATO.fechaInicioReal, f.inicio_real, TEXTOS_FORMATO.fechaFinReal, f.fin_real)
  filaSimple(TEXTOS_FORMATO.sistemaReferencia, f.sistema_referencia)
  filaSimple(TEXTOS_FORMATO.evaluador, f.evaluador)
  cabecera(TEXTOS_FORMATO.equipoAuditor)
  for (const persona of f.equipo.length ? f.equipo : [{}]) filaSimple(TEXTOS_FORMATO.equipoAuditor, personaFicha(persona))
  filaSimple(TEXTOS_FORMATO.liderEquipo, personaFicha(f.lider))
  cabecera(TEXTOS_FORMATO.archivosAdjuntos)
  const adjuntos = [...f.adjuntos]
  while (adjuntos.length < 3) adjuntos.push('')
  adjuntos.forEach(filaCompleta)

  // ─── Hallazgos ─────────────────────────────────────────────────────────────
  y += 2
  parrafo(TEXTOS_FORMATO.programa, { estilo: 'bold', escala: ESCALA_TITULO, subrayado: true })
  for (const lista of LISTAS_HALLAZGOS) {
    parrafo(lista.titulo, { escala: ESCALA_ROTULO })
    const items = c.hallazgos.find((g) => g.clasificacion === lista.clasificacion)?.items ?? []
    if (items.length) items.forEach((h) => parrafo(`• ${h.texto}`))
    else parrafo(lista.vacio)
    vacios(lista.titulo)
  }

  // ─── Secciones de Objetivo a Conclusiones ──────────────────────────────────
  for (const s of seccionesFormato(c)) {
    const estilo = s.estiloTitulo ?? 'subrayado'
    parrafo(s.titulo, { estilo: 'bold', escala: ESCALA_TITULO, subrayado: estilo === 'subrayado', centrado: estilo === 'centrado' })
    if (s.antes) parrafo(s.antes, { escala: s.escalaAntes ?? 1.1 })
    const contenido = Array.isArray(s.contenido) ? s.contenido : parrafos(s.contenido)
    const vinetas = s.vinetas ?? []
    if (!contenido.length && !vinetas.length) parrafo('No informado.')
    vinetas.forEach((t) => parrafo(`• ${t}`))
    contenido.forEach((t) => parrafo(s.tipo === 'vinetas' ? `• ${t}` : t))
    vacios(s.titulo)
  }

  // ─── Encabezado y pie de la plantilla en todas las páginas ─────────────────
  const total = doc.internal.getNumberOfPages()
  const pie = lineaGenerado(c)
  const titulo = tituloAuditoria(c)
  for (let n = 1; n <= total; n++) {
    doc.setPage(n)
    fuente('normal', 8, GRIS_PIE)
    doc.text(TEXTOS_FORMATO.institucion, pt(0.7729), pt(0.198) + 8)
    doc.splitTextToSize(titulo, pt(2.0333)).forEach((l, i) => doc.text(l, pt(5.0861), pt(0.198) + 8 + i * 9.2))
    doc.splitTextToSize(pie, pt(3.0333)).forEach((l, i) => doc.text(l, pt(0.7729), pt(11.3543) + 8 + i * 9.2))
    doc.text(`Página ${n}/${total}`, pt(7.2756), pt(11.3543) + 8)
  }
  doc.save(nombreArchivo(informe, 'pdf'))
}
