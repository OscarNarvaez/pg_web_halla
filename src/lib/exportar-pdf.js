// Exportación del informe a PDF (jspdf + jspdf-autotable). Se importa bajo demanda.
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { fechaHora, fechaLarga, formatearCedula } from './formato'
import { LINEA, MARCA, TINTA, TINTA_SUAVE, fondoDe, hexARgb, nombreArchivo, periodoDe, solidoDe } from './exportar-comun'

// ═════════════════════════════════════════════════════════════════════════════
// PDF
// ═════════════════════════════════════════════════════════════════════════════

const FUENTES = [
  { archivo: 'SourceSerif4-Regular.ttf', familia: 'SourceSerif4', estilo: 'normal' },
  { archivo: 'SourceSerif4-SemiBold.ttf', familia: 'SourceSerif4', estilo: 'bold' },
  { archivo: 'Inter-Regular.ttf', familia: 'Inter', estilo: 'normal' },
  { archivo: 'Inter-SemiBold.ttf', familia: 'Inter', estilo: 'bold' },
]
let fuentesCache = null

function aBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

/** Descarga (una sola vez) las fuentes Unicode: la Helvetica de jsPDF rompe tildes en algunos visores. */
async function cargarFuentes() {
  if (!fuentesCache) {
    fuentesCache = Promise.all(
      FUENTES.map(async (f) => {
        const r = await fetch(`/fonts/${f.archivo}`)
        if (!r.ok) throw new Error(`No se pudo cargar la fuente ${f.archivo}`)
        return { ...f, base64: aBase64(await r.arrayBuffer()) }
      }),
    ).catch((e) => {
      fuentesCache = null
      throw e
    })
  }
  return fuentesCache
}

export async function exportarPdf(informe) {
  const c = informe.contenido
  // putOnlyUsedFonts: el PDF declara solo las fuentes Unicode incrustadas, no las 14 estándar de jsPDF
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true, putOnlyUsedFonts: true })
  for (const f of await cargarFuentes()) {
    doc.addFileToVFS(f.archivo, f.base64)
    doc.addFont(f.archivo, f.familia, f.estilo)
  }
  doc.setProperties({ title: `Informe de auditoría ${c.identificacion.codigo}`, subject: c.identificacion.titulo, creator: 'halla.ink' })

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56.7 // 2 cm
  const ANCHO = W - 2 * M
  const SUPERIOR = M + 6
  let y = SUPERIOR

  const color = (hex) => doc.setTextColor(...hexARgb(hex))
  const asegurar = (alto) => {
    if (y + alto > H - M) {
      doc.addPage()
      y = SUPERIOR
    }
  }
  const parrafo = (texto, { familia = 'SourceSerif4', estilo = 'normal', tamano = 10.5, tinta = TINTA, sangria = 0, despues = 8, interlineado = 1.45 } = {}) => {
    doc.setFont(familia, estilo)
    doc.setFontSize(tamano)
    color(tinta)
    const alto = tamano * interlineado
    for (const linea of doc.splitTextToSize(String(texto ?? ''), ANCHO - sangria)) {
      asegurar(alto)
      doc.text(linea, M + sangria, y + tamano)
      y += alto
    }
    y += despues
  }
  const dato = (etiqueta, valor) => {
    doc.setFont('Inter', 'bold')
    doc.setFontSize(9)
    color(TINTA_SUAVE)
    asegurar(16)
    doc.text(etiqueta, M, y + 10)
    const lineas = doc.splitTextToSize(String(valor || 'No informado'), ANCHO - 150)
    doc.setFont('SourceSerif4', 'normal')
    doc.setFontSize(10.5)
    color(TINTA)
    lineas.forEach((l, i) => {
      if (i) asegurar(15)
      doc.text(l, M + 150, y + 10)
      y += 15
    })
    y += 3
  }
  const seccion = (n, titulo) => {
    asegurar(48)
    y += 14
    doc.setFont('Inter', 'bold')
    doc.setFontSize(10)
    color(MARCA)
    doc.text(`${n}. ${titulo.toUpperCase()}`, M, y + 10)
    y += 16
    doc.setDrawColor(...hexARgb(LINEA))
    doc.setLineWidth(0.75)
    doc.line(M, y, W - M, y)
    y += 10
  }
  const vineta = (texto, marca = '•') => {
    doc.setFont('SourceSerif4', 'normal')
    doc.setFontSize(10.5)
    color(TINTA)
    const lineas = doc.splitTextToSize(texto, ANCHO - 16)
    lineas.forEach((l, i) => {
      asegurar(15)
      if (i === 0) doc.text(marca, M + 2, y + 10.5)
      doc.text(l, M + 16, y + 10.5)
      y += 15
    })
    y += 3
  }
  const tabla = (opciones) => {
    autoTable(doc, {
      startY: y,
      margin: { top: SUPERIOR, left: M, right: M, bottom: M },
      styles: { font: 'SourceSerif4', fontSize: 9, cellPadding: 5, textColor: hexARgb(TINTA), lineColor: hexARgb(LINEA), lineWidth: 0.5, valign: 'top' },
      headStyles: { font: 'Inter', fontStyle: 'bold', fontSize: 8.5 },
      ...opciones,
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Portada breve
  doc.setFont('Inter', 'normal')
  doc.setFontSize(8.5)
  color(TINTA_SUAVE)
  doc.text(`${c.identificacion.institucion.toUpperCase()} · ${c.identificacion.ciudad.toUpperCase()}`, W / 2, y + 8, { align: 'center' })
  y += 22
  parrafo('Informe de auditoría interna', { familia: 'SourceSerif4', estilo: 'bold', tamano: 22, despues: 2, interlineado: 1.2 })
  parrafo(c.identificacion.titulo, { tamano: 12, tinta: TINTA_SUAVE, despues: 14 })

  // Resumen ejecutivo en un recuadro
  doc.setFont('SourceSerif4', 'normal')
  doc.setFontSize(10.5)
  const lineasResumen = doc.splitTextToSize(c.resumen_ejecutivo, ANCHO - 24)
  const altoResumen = 26 + lineasResumen.length * 15
  asegurar(Math.min(altoResumen, 300))
  if (altoResumen < H - 2 * M) {
    doc.setFillColor(...hexARgb('#f4f6f8'))
    doc.roundedRect(M, y, ANCHO, altoResumen, 4, 4, 'F')
  }
  doc.setFont('Inter', 'bold')
  doc.setFontSize(8.5)
  color(TINTA_SUAVE)
  doc.text('RESUMEN EJECUTIVO', M + 12, y + 16)
  y += 22
  doc.setFont('SourceSerif4', 'normal')
  doc.setFontSize(10.5)
  color(TINTA)
  for (const l of lineasResumen) {
    asegurar(15)
    doc.text(l, M + 12, y + 10.5)
    y += 15
  }
  y += 12

  seccion(1, 'Identificación')
  dato('Código', c.identificacion.codigo)
  dato('Institución', c.identificacion.institucion)
  dato('Fecha de emisión', fechaLarga(c.identificacion.fecha_emision))
  dato('Versión del informe', String(c.identificacion.version))

  seccion(2, 'Objetivo de la auditoría')
  parrafo(c.objetivo || 'No informado')

  seccion(3, 'Alcance')
  dato(c.alcance.tipo === 'SISTEMAS' ? 'Sistema auditado' : 'Proceso auditado', c.alcance.objeto)
  dato('Área auditada', c.alcance.area_auditada)
  dato('Periodo', periodoDe(c))
  dato('Auditado', [c.alcance.auditado.nombre, c.alcance.auditado.cargo].filter(Boolean).join(', '))

  seccion(4, 'Criterios de auditoría')
  if (c.criterios.length) {
    c.criterios.forEach((cr) => vineta(`${cr.documento}${cr.numerales.length ? `: ${cr.numerales.length === 1 ? 'numeral' : 'numerales'} ${cr.numerales.join(', ')}` : ''}`))
  } else {
    parrafo('Ningún hallazgo cita un requisito verificado de los documentos cargados.', { tinta: TINTA_SUAVE })
  }

  seccion(5, 'Equipo auditor')
  dato('Auditor líder', `${c.equipo_auditor.lider.nombre}, ${c.equipo_auditor.lider.cargo}`)
  dato('Equipo auditor', `${c.equipo_auditor.acompanante.nombre}, ${c.equipo_auditor.acompanante.cargo}`)

  seccion(6, 'Metodología')
  c.metodologia.forEach((m) => vineta(m))

  seccion(7, 'Resumen de resultados')
  const total = c.resumen_resultados.total
  tabla({
    head: [['Clasificación', 'Hallazgos', '%']],
    body: [
      ...c.resumen_resultados.por_clasificacion.map((x) => [x.etiqueta, String(x.total), total ? `${Math.round((x.total / total) * 100)} %` : '0 %']),
      [{ content: 'Total', styles: { font: 'Inter', fontStyle: 'bold' } }, { content: String(total), styles: { font: 'Inter', fontStyle: 'bold' } }, ''],
    ],
    headStyles: { font: 'Inter', fontStyle: 'bold', fontSize: 8.5, fillColor: hexARgb('#f4f6f8'), textColor: hexARgb(TINTA) },
    columnStyles: { 0: { cellPadding: { top: 5, bottom: 5, left: 11, right: 5 } }, 1: { halign: 'right', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 50 } },
    tableWidth: 300,
    didDrawCell: (d) => {
      // marca de color de la clasificación junto a su nombre
      const x = c.resumen_resultados.por_clasificacion[d.row.index]
      if (d.section === 'body' && d.column.index === 0 && x) {
        doc.setFillColor(...hexARgb(solidoDe(x.clasificacion)))
        doc.rect(d.cell.x + 1.5, d.cell.y + 5, 2.5, d.cell.height - 10, 'F')
      }
    },
  })
  // Barras horizontales proporcionales: extremo redondeado de 4 pt, valor al final de la barra
  const maximo = Math.max(1, ...c.resumen_resultados.por_clasificacion.map((x) => x.total))
  asegurar(c.resumen_resultados.por_clasificacion.length * 18 + 8)
  for (const x of c.resumen_resultados.por_clasificacion) {
    const largo = (x.total / maximo) * (ANCHO - 170)
    doc.setFont('Inter', 'normal')
    doc.setFontSize(8.5)
    color(TINTA_SUAVE)
    doc.text(x.etiqueta, M, y + 9)
    if (largo > 0) {
      doc.setFillColor(...hexARgb(solidoDe(x.clasificacion)))
      doc.roundedRect(M + 130, y + 1, Math.max(largo, 4), 10, 2, 2, 'F')
    }
    color(TINTA)
    doc.text(String(x.total), M + 136 + largo, y + 9)
    y += 18
  }
  y += 6

  seccion(8, 'Hallazgos en detalle')
  for (const grupo of c.hallazgos) {
    asegurar(40)
    doc.setFillColor(...hexARgb(solidoDe(grupo.clasificacion)))
    doc.rect(M, y + 2, 8, 8, 'F')
    doc.setFont('Inter', 'bold')
    doc.setFontSize(10)
    color(TINTA)
    doc.text(`${grupo.etiqueta} (${grupo.items.length})`, M + 14, y + 10)
    y += 18
    if (!grupo.items.length) {
      parrafo(`No se registraron ${grupo.etiqueta.toLowerCase()}.`, { tinta: TINTA_SUAVE, tamano: 9.5 })
      continue
    }
    tabla({
      head: [['N.º', 'Hallazgo', 'Criterio / requisito', 'Evidencia']],
      body: grupo.items.map((h) => [
        `H-${String(h.consecutivo).padStart(2, '0')}${h.severidad ? `\n${h.severidad}` : ''}`,
        h.hallazgo_corregido,
        h.criterio_requisito,
        h.evidencia,
      ]),
      headStyles: { font: 'Inter', fontStyle: 'bold', fontSize: 8.5, fillColor: hexARgb(solidoDe(grupo.clasificacion)), textColor: [255, 255, 255] },
      bodyStyles: { fillColor: hexARgb(fondoDe(grupo.clasificacion)) },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: { 0: { cellWidth: 38, font: 'Inter', fontSize: 8 }, 1: { cellWidth: 220 }, 2: { cellWidth: 120 } },
    })
  }

  seccion(9, 'Conclusiones')
  c.conclusiones.split(/\n\s*\n/).forEach((p) => parrafo(p))

  seccion(10, 'Recomendaciones')
  c.recomendaciones.forEach((r, i) => vineta(r, `${i + 1}.`))

  // El título y las firmas van juntos: nunca un «11. Firmas» huérfano al pie de una página
  asegurar(48 + 120)
  seccion(11, 'Firmas')
  y += 50
  const anchoFirma = (ANCHO - 40) / 2
  c.firmas.forEach((f, i) => {
    const x = M + i * (anchoFirma + 40)
    doc.setDrawColor(...hexARgb(TINTA))
    doc.setLineWidth(0.75)
    doc.line(x, y, x + anchoFirma, y)
    doc.setFont('Inter', 'bold')
    doc.setFontSize(9.5)
    color(TINTA)
    doc.text(f.nombre, x, y + 14)
    doc.setFont('Inter', 'normal')
    doc.setFontSize(9)
    color(TINTA_SUAVE)
    doc.text(f.cargo, x, y + 27)
    doc.text(`C.C. ${f.cedula ? formatearCedula(f.cedula) : '______________________'}`, x, y + 40)
    doc.setFontSize(7.5)
    doc.text(f.rol.toUpperCase(), x, y + 53)
  })

  // Encabezado y pie en todas las páginas (se dibujan al final para conocer el total)
  const paginas = doc.internal.getNumberOfPages()
  const generado = fechaHora(new Date())
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(...hexARgb(LINEA))
    doc.setLineWidth(0.5)
    doc.setFont('Inter', 'normal')
    doc.setFontSize(8)
    color(TINTA_SUAVE)
    doc.text(`${c.identificacion.codigo} · Informe de auditoría interna`, M, 34)
    doc.text(`${c.identificacion.institucion} · v${c.identificacion.version}`, W - M, 34, { align: 'right' })
    doc.line(M, 40, W - M, 40)
    doc.line(M, H - 40, W - M, H - 40)
    doc.text(`Generado el ${generado} · halla.ink`, M, H - 28)
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 28, { align: 'right' })
  }

  doc.save(nombreArchivo(informe, 'pdf'))
}

