// Lista de verificación en PDF con el formato del hospital (carta horizontal), para llevarla impresa al lugar de la
// auditoría. Se importa bajo demanda.
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { MARCAS_VERIFICACION } from './catalogos'
import { CAMPOS_INFORMACION, COLUMNAS_LISTA, TEXTOS_LISTA, nombreArchivoLista, partesFecha } from './lista-verificacion'
import { registrarFuentes } from './fuentes-pdf'

const GRIS = [192, 192, 192] // gris de las barras y encabezados del formato
const NEGRO = [0, 0, 0]
const M = 28

/** @param {{ codigo: string }} auditoria @param {{ encabezado: object, secciones: object[] }} lista */
export async function exportarLista(auditoria, lista) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape', compress: true, putOnlyUsedFonts: true })
  await registrarFuentes(doc)
  doc.setProperties({ title: `${TEXTOS_LISTA.listaVerificacion} · ${auditoria.codigo}`, creator: 'halla.ink' })
  const W = doc.internal.pageSize.getWidth()
  const ANCHO = W - 2 * M
  const e = lista.encabezado ?? {}
  const estilos = { font: 'LiberationSans', fontSize: 8, textColor: NEGRO, lineColor: NEGRO, lineWidth: 0.6, cellPadding: 3, valign: 'middle' }
  const gris = { fillColor: GRIS, fontStyle: 'bold', halign: 'center' }

  // Recuadro «Auditoría No / Fecha» (arriba a la derecha; la fecha en tres casillas: día, mes y año)
  const { dia, mes, anio } = partesFecha(e.fecha)
  autoTable(doc, {
    startY: M,
    margin: { left: W - M - 260 },
    tableWidth: 260,
    theme: 'grid',
    styles: { ...estilos, halign: 'center' },
    head: [[{ content: TEXTOS_LISTA.auditoriaNo, styles: gris }, { content: TEXTOS_LISTA.fecha, colSpan: 3, styles: gris }]],
    body: [[auditoria.codigo, dia, mes, anio]],
    columnStyles: { 0: { cellWidth: 125 } },
  })

  // INFORMACION GENERAL
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: estilos,
    head: [[{ content: TEXTOS_LISTA.informacionGeneral, colSpan: 2, styles: gris }]],
    body: CAMPOS_INFORMACION.map((c) => [{ content: c.etiqueta, styles: { fillColor: GRIS, fontStyle: 'bold' } }, e[c.clave] ?? '']),
    columnStyles: { 0: { cellWidth: 220 } },
  })

  // Leyenda y lista
  const y = doc.lastAutoTable.finalY + 12
  doc.setFont('LiberationSans', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...NEGRO)
  doc.text(TEXTOS_LISTA.leyenda, W / 2, y, { align: 'center' })

  const ANCHO_MARCA = 24
  const anchoTexto = ANCHO - 4 * ANCHO_MARCA
  const cuerpo = []
  for (const s of lista.secciones ?? []) {
    cuerpo.push([{ content: s.titulo, colSpan: 8, styles: { fontStyle: 'bold', halign: 'center', fontSize: 8.5 } }])
    for (const f of s.filas ?? []) {
      cuerpo.push([
        f.requisito, f.pregunta, f.documentos,
        ...MARCAS_VERIFICACION.map((m) => ({ content: f.marca === m.valor ? 'X' : '', styles: { halign: 'center', fontStyle: 'bold' } })),
        f.anotaciones,
      ])
    }
  }
  autoTable(doc, {
    startY: y + 6,
    margin: { left: M, right: M, top: M, bottom: M },
    theme: 'grid',
    styles: { ...estilos, minCellHeight: 20, valign: 'top' },
    head: [
      [{ content: TEXTOS_LISTA.listaVerificacion, colSpan: 8, styles: gris }],
      [COLUMNAS_LISTA.requisito, COLUMNAS_LISTA.pregunta, COLUMNAS_LISTA.documentos, ...MARCAS_VERIFICACION.map((m) => m.valor), COLUMNAS_LISTA.anotaciones]
        .map((t) => ({ content: t, styles: { ...gris, valign: 'middle' } })),
    ],
    body: cuerpo,
    showHead: 'everyPage',
    columnStyles: {
      0: { cellWidth: anchoTexto * 0.17 }, 1: { cellWidth: anchoTexto * 0.2 }, 2: { cellWidth: anchoTexto * 0.17 },
      3: { cellWidth: ANCHO_MARCA }, 4: { cellWidth: ANCHO_MARCA }, 5: { cellWidth: ANCHO_MARCA }, 6: { cellWidth: ANCHO_MARCA },
    },
  })

  doc.save(nombreArchivoLista(auditoria.codigo))
}
