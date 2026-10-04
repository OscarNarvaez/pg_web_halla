// Exportación del informe a Word (docx + file-saver). Se importa bajo demanda.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx'
import { saveAs } from 'file-saver'
import { fechaHora, fechaLarga, formatearCedula } from './formato'
import { LINEA, MARCA, TINTA, TINTA_SUAVE, cargarLogo, fondoDe, integrantesEquipo, nombreArchivo, periodoDe, sinNumeral, solidoDe } from './exportar-comun'

// ═════════════════════════════════════════════════════════════════════════════
// WORD
// ═════════════════════════════════════════════════════════════════════════════

const CUERPO = 'Cambria' // tipografías presentes en cualquier Word: el documento se ve igual en el hospital
const TITULOS = 'Calibri'
const TWIPS_2CM = 1134
const borde = { style: BorderStyle.SINGLE, size: 4, color: sinNumeral(LINEA) }
const bordes = { top: borde, bottom: borde, left: borde, right: borde }

const texto = (t, opciones = {}) => new TextRun({ text: String(t ?? ''), font: CUERPO, size: 22, ...opciones })
const p = (contenido, opciones = {}) =>
  new Paragraph({ children: Array.isArray(contenido) ? contenido : [texto(contenido)], spacing: { after: 120, line: 300 }, ...opciones })
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: TITULOS })], spacing: { before: 360, after: 120 } })
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: TITULOS })], spacing: { before: 240, after: 80 } })

function celda(contenido, { ancho, fondo, negrita = false, color, alinear } = {}) {
  const parrafos = String(contenido ?? '').split('\n').map((linea) =>
    new Paragraph({ alignment: alinear, children: [new TextRun({ text: linea, font: negrita ? TITULOS : CUERPO, bold: negrita, size: 19, color })] }))
  return new TableCell({
    children: parrafos,
    width: ancho ? { size: ancho, type: WidthType.DXA } : undefined,
    shading: fondo ? { type: ShadingType.CLEAR, color: 'auto', fill: sinNumeral(fondo) } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    borders: bordes,
  })
}

const fila = (pares) => new TableRow({ children: pares })
const dato = (etiqueta, valor) =>
  p([new TextRun({ text: `${etiqueta}: `, font: TITULOS, bold: true, size: 21, color: sinNumeral(TINTA_SUAVE) }), texto(valor || 'No informado')])

export async function exportarDocx(informe) {
  const c = informe.contenido
  const total = c.resumen_resultados.total
  const ANCHO = 12240 - 2 * TWIPS_2CM // carta menos márgenes, en twips
  const logo = await cargarLogo()
  // transformation va en píxeles (96 por pulgada): 90 px ≈ 2,4 cm en la portada y 22 px en el encabezado
  const imagenLogo = (lado) =>
    new ImageRun({
      type: 'png',
      data: logo,
      transformation: { width: lado, height: lado },
      altText: { name: 'logo-hila', title: 'Logo', description: `Logo del ${c.identificacion.institucion}` },
    })

  const cuerpo = [
    ...(logo ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [imagenLogo(90)] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${c.identificacion.institucion} · ${c.identificacion.ciudad}`.toUpperCase(), font: TITULOS, size: 18, color: sinNumeral(TINTA_SUAVE) })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Informe de auditoría interna', font: CUERPO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [texto(c.identificacion.titulo, { color: sinNumeral(TINTA_SUAVE) })] }),
    new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-1' }),
    h1('Resumen ejecutivo'),
    p(c.resumen_ejecutivo),

    h1('1. Identificación'),
    dato('Código', c.identificacion.codigo),
    dato('Institución', c.identificacion.institucion),
    dato('Fecha de emisión', fechaLarga(c.identificacion.fecha_emision)),
    dato('Versión del informe', String(c.identificacion.version)),

    h1('2. Objetivo de la auditoría'),
    p(c.objetivo || 'No informado'),

    h1('3. Alcance'),
    dato(c.alcance.tipo === 'SISTEMAS' ? 'Sistema auditado' : 'Proceso auditado', c.alcance.objeto),
    dato('Área auditada', c.alcance.area_auditada),
    dato('Periodo', periodoDe(c)),
    dato('Auditado', [c.alcance.auditado.nombre, c.alcance.auditado.cargo].filter(Boolean).join(', ')),

    h1('4. Criterios de auditoría'),
    ...(c.criterios.length
      ? c.criterios.map((cr) => p(`${cr.documento}${cr.numerales.length ? `: ${cr.numerales.length === 1 ? 'numeral' : 'numerales'} ${cr.numerales.join(', ')}` : ''}`, { bullet: { level: 0 } }))
      : [p('Ningún hallazgo cita un requisito verificado de los documentos cargados.')]),

    h1('5. Equipo auditor'),
    dato('Auditor líder', `${c.equipo_auditor.lider.nombre}, ${c.equipo_auditor.lider.cargo}`),
    ...(integrantesEquipo(c).length === 1
      ? [dato('Equipo auditor', `${integrantesEquipo(c)[0].nombre}, ${integrantesEquipo(c)[0].cargo}`)]
      : [
          p([new TextRun({ text: 'Equipo auditor:', font: TITULOS, bold: true, size: 21, color: sinNumeral(TINTA_SUAVE) })]),
          ...integrantesEquipo(c).map((m) => p(`${m.nombre}, ${m.cargo}`, { bullet: { level: 0 } })),
        ]),

    h1('6. Metodología'),
    ...c.metodologia.map((m) => p(m, { bullet: { level: 0 } })),

    h1('7. Resumen de resultados'),
    new Table({
      width: { size: 5200, type: WidthType.DXA },
      rows: [
        fila([celda('Clasificación', { negrita: true, fondo: '#f4f6f8', ancho: 3000 }), celda('Hallazgos', { negrita: true, fondo: '#f4f6f8', ancho: 1100, alinear: AlignmentType.RIGHT }), celda('%', { negrita: true, fondo: '#f4f6f8', ancho: 1100, alinear: AlignmentType.RIGHT })]),
        ...c.resumen_resultados.por_clasificacion.map((x) =>
          fila([
            celda(x.etiqueta, { ancho: 3000, fondo: fondoDe(x.clasificacion) }),
            celda(String(x.total), { ancho: 1100, alinear: AlignmentType.RIGHT }),
            celda(total ? `${Math.round((x.total / total) * 100)} %` : '0 %', { ancho: 1100, alinear: AlignmentType.RIGHT }),
          ])),
        fila([celda('Total', { negrita: true, ancho: 3000 }), celda(String(total), { negrita: true, ancho: 1100, alinear: AlignmentType.RIGHT }), celda('', { ancho: 1100 })]),
      ],
    }),

    h1('8. Hallazgos en detalle'),
  ]

  for (const grupo of c.hallazgos) {
    cuerpo.push(h2(`${grupo.etiqueta} (${grupo.items.length})`))
    if (!grupo.items.length) {
      cuerpo.push(p(`No se registraron ${grupo.etiqueta.toLowerCase()}.`))
      continue
    }
    const anchos = [900, Math.round(ANCHO * 0.45), Math.round(ANCHO * 0.25)]
    anchos.push(ANCHO - anchos.reduce((s, x) => s + x, 0))
    cuerpo.push(
      new Table({
        width: { size: ANCHO, type: WidthType.DXA },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ['N.º', 'Hallazgo', 'Criterio / requisito', 'Evidencia'].map((t, i) =>
              celda(t, { negrita: true, fondo: solidoDe(grupo.clasificacion), color: 'FFFFFF', ancho: anchos[i] })),
          }),
          ...grupo.items.map((h, k) => {
            const fondo = k % 2 === 0 ? fondoDe(grupo.clasificacion) : undefined
            return fila([
              celda(`H-${String(h.consecutivo).padStart(2, '0')}${h.severidad ? `\n${h.severidad}` : ''}`, { ancho: anchos[0], fondo }),
              celda(h.hallazgo_corregido, { ancho: anchos[1], fondo }),
              celda(h.criterio_requisito, { ancho: anchos[2], fondo }),
              celda(h.evidencia, { ancho: anchos[3], fondo }),
            ])
          }),
        ],
      }),
    )
  }

  cuerpo.push(
    h1('9. Conclusiones'),
    ...c.conclusiones.split(/\n\s*\n/).map((t) => p(t)),
    h1('10. Recomendaciones'),
    ...c.recomendaciones.map((r) => p(r, { numbering: { reference: 'recomendaciones', level: 0 } })),
    h1('11. Firmas'),
    new Table({
      width: { size: ANCHO, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      // Dos firmas por fila (el equipo auditor puede tener varias personas)
      rows: Array.from({ length: Math.ceil(c.firmas.length / 2) }, (_, n) => c.firmas.slice(2 * n, 2 * n + 2)).map((par) =>
        new TableRow({
          cantSplit: true,
          children: [...par, null].slice(0, 2).map((f) => !f
            ? new TableCell({ width: { size: Math.round(ANCHO / 2), type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph('')] })
            : new TableCell({
              width: { size: Math.round(ANCHO / 2), type: WidthType.DXA },
              margins: { top: 900, right: 300 },
              borders: { top: { style: BorderStyle.SINGLE, size: 6, color: sinNumeral(TINTA) }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({ children: [new TextRun({ text: f.nombre, font: TITULOS, bold: true, size: 21 })] }),
                new Paragraph({ children: [new TextRun({ text: f.cargo, font: TITULOS, size: 20 })] }),
                new Paragraph({ children: [new TextRun({ text: `C.C. ${f.cedula ? formatearCedula(f.cedula) : '______________________'}`, font: TITULOS, size: 20 })] }),
                new Paragraph({ children: [new TextRun({ text: f.rol.toUpperCase(), font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) })] }),
              ],
            })),
        })),
    }),
  )

  const doc = new Document({
    creator: 'halla.ink',
    title: `Informe de auditoría ${c.identificacion.codigo}`,
    description: c.identificacion.titulo,
    features: { updateFields: true }, // Word actualiza la tabla de contenido al abrir
    numbering: {
      config: [{ reference: 'recomendaciones', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }] }],
    },
    styles: {
      default: { document: { run: { font: CUERPO, size: 22, color: sinNumeral(TINTA) } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: CUERPO, size: 44, bold: true, color: sinNumeral(TINTA) }, paragraph: { spacing: { after: 60 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: TITULOS, size: 24, bold: true, color: sinNumeral(MARCA) }, paragraph: { spacing: { before: 360, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: TITULOS, size: 22, bold: true, color: sinNumeral(TINTA) }, paragraph: { spacing: { before: 240, after: 80 } } },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: TWIPS_2CM, bottom: TWIPS_2CM, left: TWIPS_2CM, right: TWIPS_2CM } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  ...(logo ? [imagenLogo(22), new TextRun({ text: '  ', size: 16 })] : []),
                  new TextRun({ text: `${c.identificacion.codigo} · Informe de auditoría interna · ${c.identificacion.institucion}`, font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Generado el ${fechaHora(new Date())} · Página `, font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) }),
                  new TextRun({ children: [PageNumber.CURRENT], font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) }),
                  new TextRun({ text: ' de ', font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: TITULOS, size: 16, color: sinNumeral(TINTA_SUAVE) }),
                ],
              }),
            ],
          }),
        },
        children: cuerpo,
      },
    ],
  })

  saveAs(await Packer.toBlob(doc), nombreArchivo(informe, 'docx'))
}
