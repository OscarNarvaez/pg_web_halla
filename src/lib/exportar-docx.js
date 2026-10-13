// Informe final en Word (.docx), llenando la plantilla oficial (src/formato_de_informe_final/Auditoria_interna.docx)
// sin cambiar su formato: se escriben los textos en los renglones vacíos que la plantilla trae para ello y se conservan
// sus estilos, tablas, encabezado, pie, fuentes y logo. Se importa bajo demanda.
//
// Las anclas se buscan por el TEXTO de la plantilla (no por nombres de estilos, que cambian cada vez que alguien
// la guarda con otro programa). Si el dueño cambia un título de la plantilla, hay que cambiarlo en formato-informe.js.
import { strFromU8, strToU8, zipSync } from 'fflate'
import { saveAs } from 'file-saver'
import { cargarPlantilla } from './plantilla-informe'
import { LISTAS_HALLAZGOS, TEXTOS_FORMATO, lineaGenerado, parrafos, personaFicha, programaDe, seccionesFormato, tituloAuditoria } from './formato-informe'
import { nombreArchivo } from './exportar-comun'

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
  dc: 'http://purl.org/dc/elements/1.1/',
  cp: 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  dcterms: 'http://purl.org/dc/terms/',
  xml: 'http://www.w3.org/XML/1998/namespace',
}
const DOCUMENTO = 'word/document.xml'
// Unidades de Word: las posiciones de los dibujos van en EMU y los márgenes en veinteavos de punto
const EMU_POR_TWIP = 635
const EMU_POR_PULGADA = 914400
// Ancho mínimo de los cuadros del encabezado y del pie que en la plantilla no alcanzan para su texto en una línea:
// «HOSPITAL INFANTIL LOS ANGELES» y «Generado por <nombre> - <fecha>» (el mismo ancho que usa el PDF)
const ANCHO_CUADRO = { institucion: 2.6 * EMU_POR_PULGADA, generado: 6.2 * EMU_POR_PULGADA }

export class ErrorPlantilla extends Error {
  name = 'ErrorPlantilla'
}

const normal = (t) => t.replace(/\s+/g, ' ').trim()
/** Para comparar textos de la plantilla sin importar tildes ni mayúsculas («Auditoria» o «Auditoría»). */
const comparable = (t) => normal(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const TITULO_AUDITORIA = /^Auditor[ií]a (Interna|Externa) - /
const es = (n, nombre, ns = NS.w) => n?.nodeType === 1 && n.namespaceURI === ns && n.localName === nombre
const hijos = (n, nombre) => (n ? [...n.children].filter((h) => es(h, nombre)) : [])
const hijo = (n, nombre) => hijos(n, nombre)[0]

/** Texto visible de un párrafo o una celda (los cuadros de texto anclados al párrafo no cuentan). */
function textoDe(nodo) {
  let t = ''
  for (const h of nodo.children) {
    if (es(h, 't')) t += h.textContent
    else if (es(h, 'tab')) t += '\t'
    else if (h.namespaceURI === NS.w && !['pPr', 'rPr', 'drawing', 'pict', 'instrText'].includes(h.localName)) t += textoDe(h)
  }
  return t
}

const estiloDe = (p) => hijo(hijo(p, 'pPr'), 'pStyle')?.getAttributeNS(NS.w, 'val') ?? ''
/** Los títulos de sección de la plantilla usan los estilos de título de Word (Heading 2). */
const esTitulo = (p) => es(p, 'p') && /^heading/i.test(estiloDe(p))
const vacio = (n) => es(n, 'p') && !esTitulo(n) && !normal(textoDe(n))
  && !['drawing', 'pict', 'sectPr', 'br'].some((x) => n.getElementsByTagNameNS(NS.w, x).length)

function nuevoTexto(doc, texto) {
  const t = doc.createElementNS(NS.w, 'w:t')
  t.setAttributeNS(NS.xml, 'xml:space', 'preserve')
  t.textContent = texto
  return t
}

/**
 * Formato de un renglón vacío: el de su marca de párrafo. Google Docs y Word guardan ahí la fuente y el tamaño de un
 * renglón sin texto (su tramo vacío puede no traer ninguno y el texto saldría con la fuente por defecto, Calibri 11).
 */
function formatoDeMarca(p) {
  const marca = hijo(hijo(p, 'pPr'), 'rPr')
  if (!marca?.children.length) return null
  const formato = marca.cloneNode(true)
  // Las marcas de cambios de la marca de párrafo no valen para un tramo
  for (const n of [...formato.children]) if (['ins', 'del', 'moveFrom', 'moveTo'].includes(n.localName)) formato.removeChild(n)
  return formato
}

/** Tramo nuevo con el formato del primer tramo con texto del párrafo o, si no tiene texto, el de su marca de párrafo. */
function nuevoTramo(p) {
  const doc = p.ownerDocument
  const r = doc.createElementNS(NS.w, 'w:r')
  const conTexto = hijos(p, 'r').find((x) => hijo(x, 't'))
  const formato = conTexto ? hijo(conTexto, 'rPr')?.cloneNode(true) : formatoDeMarca(p) ?? hijo(hijos(p, 'r')[0], 'rPr')?.cloneNode(true)
  if (formato) r.appendChild(formato)
  return r
}

/** Párrafo nuevo con el formato de `modelo` (un renglón vacío de la plantilla) y el texto dado. */
function parrafoCon(modelo, texto) {
  const p = modelo.cloneNode(false)
  const propiedades = hijo(modelo, 'pPr')
  if (propiedades) p.appendChild(propiedades.cloneNode(true))
  const r = nuevoTramo(modelo)
  r.appendChild(nuevoTexto(p.ownerDocument, texto))
  p.appendChild(r)
  return p
}

/**
 * Reemplaza el texto de un párrafo conservando el formato del tramo que lo tenía. Los demás tramos (un salto de
 * página, un dibujo) se quedan donde están.
 */
function reemplazarTexto(p, texto) {
  const tramos = hijos(p, 'r')
  let tramo = tramos.find((r) => hijo(r, 't')) ?? tramos.find((r) => !hijo(r, 'br') && !hijo(r, 'drawing'))
  if (!tramo) tramo = p.insertBefore(nuevoTramo(p), tramos[0] ?? null)
  else if (!hijo(tramo, 't')) {
    // Un tramo vacío toma el formato del renglón (su marca de párrafo), como lo vería quien escribe en él
    const formato = formatoDeMarca(p)
    if (formato) {
      const anterior = hijo(tramo, 'rPr')
      if (anterior) tramo.replaceChild(formato, anterior)
      else tramo.insertBefore(formato, tramo.firstChild)
    }
  }
  for (const r of tramos) for (const t of hijos(r, 't')) r.removeChild(t)
  tramo.appendChild(nuevoTexto(p.ownerDocument, texto))
  return tramo
}

/** Completa la misma línea de la plantilla (los indicadores, después de «…en el proceso de»). */
function agregarTexto(p, texto) {
  const t = [...p.getElementsByTagNameNS(NS.w, 't')].at(-1)
  if (!t) return reemplazarTexto(p, texto.trim())
  t.setAttributeNS(NS.xml, 'xml:space', 'preserve')
  t.textContent += texto
  return t
}

/**
 * Inserta líneas después de un ancla: en el primer renglón vacío que la plantilla trae ahí, con su formato; si no
 * hay renglón vacío (antes de otro título), con el formato de cuerpo de la plantilla. Si el renglón vacío es el único
 * antes del siguiente título, se conserva como separación (como en las demás secciones).
 */
function rellenar(ancla, lineas, modeloCuerpo) {
  const siguiente = ancla.nextElementSibling
  const hueco = vacio(siguiente) ? siguiente : null
  for (const linea of lineas) ancla.parentNode.insertBefore(parrafoCon(hueco ?? modeloCuerpo, linea), hueco ?? siguiente)
  const antesDeTitulo = esTitulo(hueco?.nextElementSibling) && normal(textoDe(hueco.nextElementSibling))
  if (hueco && !antesDeTitulo) hueco.parentNode.removeChild(hueco)
}

const conVinetas = (items) => items.map((t) => `• ${t}`)

function llenarCuerpo(doc, c) {
  const cuerpo = doc.getElementsByTagNameNS(NS.w, 'body')[0]
  if (!cuerpo) throw new ErrorPlantilla('La plantilla del informe está dañada.')
  const parrafosCuerpo = () => [...cuerpo.children].filter((x) => es(x, 'p'))
  const buscar = (texto, { titulo } = {}) => {
    const n = parrafosCuerpo().find((x) => (titulo === undefined || esTitulo(x) === titulo) && normal(textoDe(x)) === texto)
    if (!n) throw new ErrorPlantilla(`La plantilla del informe no tiene «${texto}». Revisa src/formato_de_informe_final/Auditoria_interna.docx.`)
    return n
  }

  // Portada: «Auditoría Interna - <año> - <proceso> <evaluador>» (o «Externa») y el año
  const titulo = parrafosCuerpo().find((x) => TITULO_AUDITORIA.test(normal(textoDe(x))))
  if (!titulo) throw new ErrorPlantilla('La plantilla del informe no tiene el título de la portada («Auditoría Interna - …»).')
  reemplazarTexto(titulo, `${tituloAuditoria(c)} ${c.encabezado.evaluador}`.trim())
  const anio = parrafosCuerpo().find((x) => /^\d{4}$/.test(normal(textoDe(x))))
  if (anio) reemplazarTexto(anio, c.encabezado.anio)
  // «Auditoría interna de» (portada) y «Auditoría interna de:» (título de las listas): «interna» o «externa» y, después
  // de «de», lo auditado, aunque la plantilla traiga ahí «SIG» (decisión del dueño, 12/10/2026)
  const programa = comparable(TEXTOS_FORMATO.programa)
  const programas = parrafosCuerpo().filter((x) => comparable(textoDe(x)).startsWith(programa))
  if (!programas.length) throw new ErrorPlantilla(`La plantilla del informe no tiene «${TEXTOS_FORMATO.programa}».`)
  for (const x of programas) {
    const conDosPuntos = comparable(textoDe(x)).startsWith(`${programa}:`)
    reemplazarTexto(x, programaDe(c, conDosPuntos ? TEXTOS_FORMATO.programaListas : TEXTOS_FORMATO.programa))
  }

  // Formato de los párrafos de texto que se agregan donde la plantilla no trae renglón vacío
  const alcance = buscar('Alcance', { titulo: true })
  const modeloCuerpo = vacio(alcance.nextElementSibling) ? alcance.nextElementSibling : buscar(TEXTOS_FORMATO.revisionIndicadores)

  llenarFicha(cuerpo, c)

  for (const lista of LISTAS_HALLAZGOS) {
    const items = c.hallazgos.find((g) => g.clasificacion === lista.clasificacion)?.items ?? []
    rellenar(buscar(lista.titulo, { titulo: false }), items.length ? conVinetas(items.map((h) => h.texto)) : [lista.vacio], modeloCuerpo)
  }

  for (const s of seccionesFormato(c)) {
    const ancla = s.antes ? buscar(s.antesPlantilla ?? s.antes) : buscar(s.titulo, { titulo: true })
    if (s.agregar) agregarTexto(ancla, s.agregar)
    const contenido = Array.isArray(s.contenido) ? s.contenido : parrafos(s.contenido)
    const lineas = s.tipo === 'vinetas' ? conVinetas(contenido) : contenido
    if (lineas.length || !s.completa) rellenar(ancla, lineas.length ? lineas : ['No informado.'], modeloCuerpo)
  }
}

/** Ficha Técnica: la primera tabla de la plantilla. Las filas se reconocen por la etiqueta de su primera celda. */
function llenarFicha(cuerpo, c) {
  const tabla = cuerpo.getElementsByTagNameNS(NS.w, 'tbl')[0]
  if (!tabla) throw new ErrorPlantilla('La plantilla del informe no tiene la tabla «Ficha Técnica».')
  const filas = () => hijos(tabla, 'tr')
  const celdas = (fila) => hijos(fila, 'tc')
  const etiqueta = (fila) => normal(textoDe(celdas(fila)[0] ?? fila))
  const escribir = (celda, texto) => {
    if (!celda || !texto) return
    const p = hijo(celda, 'p') ?? celda.appendChild(celda.ownerDocument.createElementNS(NS.w, 'w:p'))
    reemplazarTexto(p, texto)
  }
  const f = c.ficha
  for (const fila of filas()) {
    const [, valor, , valor2] = celdas(fila)
    switch (etiqueta(fila)) {
      case TEXTOS_FORMATO.fechaAuditoria: escribir(valor, f.fecha_auditoria); escribir(valor2, f.fecha_informe); break
      case TEXTOS_FORMATO.sistemaReferencia: escribir(valor, f.sistema_referencia); break
      case TEXTOS_FORMATO.evaluador: escribir(valor, f.evaluador); break
      case TEXTOS_FORMATO.liderEquipo: escribir(valor, personaFicha(f.lider)); break
      case TEXTOS_FORMATO.equipoAuditor:
        // La fila de cabecera «Equipo auditor» ocupa las cuatro columnas; la de la persona tiene celda de valor
        if (valor) {
          const equipo = f.equipo.length ? f.equipo : [{}]
          let anterior = fila
          equipo.slice(1).forEach((persona) => {
            const copia = fila.cloneNode(true)
            escribir(celdas(copia)[1], personaFicha(persona))
            anterior.parentNode.insertBefore(copia, anterior.nextSibling)
            anterior = copia
          })
          escribir(valor, personaFicha(equipo[0]))
        }
        break
      default:
    }
  }
  // Archivos adjuntos: los renglones vacíos que siguen a la cabecera; si hay más archivos, se agregan renglones
  const todas = filas()
  const desde = todas.findIndex((fila) => etiqueta(fila) === TEXTOS_FORMATO.archivosAdjuntos)
  if (desde < 0) throw new ErrorPlantilla('La plantilla del informe no tiene la fila «Archivos adjuntos».')
  const vacias = todas.slice(desde + 1).filter((fila) => !normal(textoDe(fila)))
  f.adjuntos.forEach((archivo, i) => {
    let fila = vacias[i]
    if (!fila) {
      fila = (vacias.at(-1) ?? todas.at(-1)).cloneNode(true)
      const ultima = filas().at(-1)
      ultima.parentNode.insertBefore(fila, ultima.nextSibling)
      vacias.push(fila)
    }
    escribir(celdas(fila)[0], archivo)
  })
}

/** Qué cuadro del encabezado o del pie es, por su texto. */
const tipoCuadro = (texto) => (/^HOSPITAL /.test(texto) ? 'institucion'
  : TITULO_AUDITORIA.test(texto) ? 'titulo'
    : /^Generado por /.test(texto) ? 'generado'
      : /^Página/.test(texto) ? 'pagina' : null)

/** Cuadros de texto de una parte (encabezado o pie), por tipo: { titulo: { ancla, parrafo } … }. */
function cuadros(doc) {
  const porTipo = {}
  for (const ancla of doc.getElementsByTagNameNS(NS.wp, 'anchor')) {
    const parrafo = ancla.getElementsByTagNameNS(NS.w, 'txbxContent')[0]?.getElementsByTagNameNS(NS.w, 'p')[0]
    const tipo = parrafo && tipoCuadro(normal(textoDe(parrafo)))
    if (tipo) porTipo[tipo] = { ancla, parrafo }
  }
  return porTipo
}

/** «Página 1/3»: la plantilla trae «Página /» sin los campos (se perdieron al convertirla); se agregan. */
function numeroDePagina(p) {
  const doc = p.ownerDocument
  const tramo = reemplazarTexto(p, 'Página ')
  const campo = (instruccion) => {
    const f = doc.createElementNS(NS.w, 'w:fldSimple')
    f.setAttributeNS(NS.w, 'w:instr', ` ${instruccion} `)
    const r = tramo.cloneNode(true)
    hijo(r, 't').textContent = '1'
    f.appendChild(r)
    return f
  }
  const barra = tramo.cloneNode(true)
  hijo(barra, 't').textContent = '/'
  p.append(campo('PAGE'), barra, campo('NUMPAGES'))
}

/**
 * El cuadro crece con su texto en lugar de esconder lo que no cabe (un título largo pasa a dos líneas, como en el
 * PDF) y, si la plantilla lo trae más angosto que `ancho`, se ensancha hacia la derecha.
 */
function ajustarCuadro(ancla, ancho) {
  const cuerpo = ancla.getElementsByTagNameNS('http://schemas.microsoft.com/office/word/2010/wordprocessingShape', 'bodyPr')[0]
  if (cuerpo) {
    for (const n of [...cuerpo.children]) if (['noAutofit', 'normAutofit', 'spAutoFit'].includes(n.localName)) cuerpo.removeChild(n)
    cuerpo.appendChild(ancla.ownerDocument.createElementNS(NS.a, 'a:spAutoFit'))
  }
  if (!ancho) return
  const extension = ancla.getElementsByTagNameNS(NS.wp, 'extent')[0]
  if (!extension || Number(extension.getAttribute('cx')) >= ancho) return
  extension.setAttribute('cx', String(Math.round(ancho)))
  const forma = ancla.getElementsByTagNameNS(NS.a, 'xfrm')[0]?.getElementsByTagNameNS(NS.a, 'ext')[0]
  if (forma) forma.setAttribute('cx', String(Math.round(ancho)))
}

/** Encabezado y pie: título de la auditoría, «Generado por…» y el número de página. */
function llenarEncabezadoYPie(doc, c) {
  for (const [tipo, { ancla, parrafo }] of Object.entries(cuadros(doc))) {
    if (tipo === 'titulo') reemplazarTexto(parrafo, tituloAuditoria(c))
    if (tipo === 'generado') reemplazarTexto(parrafo, lineaGenerado(c))
    if (tipo === 'pagina') numeroDePagina(parrafo)
    ajustarCuadro(ancla, ANCHO_CUADRO[tipo])
  }
}

/**
 * Desde la página 2 la plantilla usa una sección con coordenadas de hoja horizontal (quedó así al convertirla desde
 * PDF): el pie caía a mitad de página, el título del encabezado se salía de la hoja y el margen superior era tan
 * pequeño que el texto se montaba sobre el encabezado. Cada cuadro toma la posición del mismo cuadro en la portada y
 * el margen superior es el de la portada, para que el encabezado y el pie queden en el mismo lugar en todas las páginas.
 */
function alinearSecciones(documento, relaciones, partes) {
  const destinos = Object.fromEntries([...relaciones.getElementsByTagNameNS(NS.rels, 'Relationship')]
    .map((r) => [r.getAttribute('Id'), `word/${r.getAttribute('Target').replace(/^\/?word\//, '')}`]))
  const secciones = [...documento.getElementsByTagNameNS(NS.w, 'sectPr')].map((s) => ({
    margenes: hijo(s, 'pgMar'),
    margen: Number(hijo(s, 'pgMar')?.getAttributeNS(NS.w, 'left') ?? 0) * EMU_POR_TWIP,
    partes: Object.fromEntries([...hijos(s, 'headerReference'), ...hijos(s, 'footerReference')]
      .map((ref) => [`${ref.localName}:${ref.getAttributeNS(NS.w, 'type')}`, partes[destinos[ref.getAttributeNS(NS.r, 'id')]]])),
  }))
  const [primera, ...resto] = secciones
  if (!primera) return
  const posicion = (ancla, eje) => {
    const nodo = ancla.getElementsByTagNameNS(NS.wp, eje === 'x' ? 'positionH' : 'positionV')[0]
    return nodo && { nodo, desde: nodo.getAttribute('relativeFrom'), valor: nodo.getElementsByTagNameNS(NS.wp, 'posOffset')[0] }
  }
  const arriba = Number(primera.margenes?.getAttributeNS(NS.w, 'top') ?? 0)
  for (const seccion of resto) {
    if (seccion.margenes && Number(seccion.margenes.getAttributeNS(NS.w, 'top')) < arriba) seccion.margenes.setAttributeNS(NS.w, 'w:top', String(arriba))
    for (const [clave, destino] of Object.entries(seccion.partes)) {
      const modelo = primera.partes[clave]
      if (!modelo || !destino || modelo === destino) continue
      const formasModelo = cuadros(modelo)
      for (const [tipo, { ancla }] of Object.entries(cuadros(destino))) {
        const otra = formasModelo[tipo]?.ancla
        if (!otra) continue
        // Horizontal: respecto de la hoja, sumando el margen izquierdo de la portada si venía respecto de la columna
        const [hm, hd] = [posicion(otra, 'x'), posicion(ancla, 'x')]
        if (hm?.valor && hd?.valor && ['page', 'column', 'margin'].includes(hm.desde)) {
          hd.nodo.setAttribute('relativeFrom', 'page')
          hd.valor.textContent = String(Number(hm.valor.textContent) + (hm.desde === 'page' ? 0 : primera.margen))
        }
        // Vertical: el pie va respecto de su párrafo (al pie de la hoja) y el encabezado respecto de la hoja
        const [vm, vd] = [posicion(otra, 'y'), posicion(ancla, 'y')]
        if (vm?.valor && vd?.valor) {
          vd.nodo.setAttribute('relativeFrom', vm.desde)
          vd.valor.textContent = vm.valor.textContent
        }
      }
    }
  }
}

// Propiedades del documento (título y autor). Si la plantilla no las trae (Google Docs no las guarda), se agregan.
const CORE = 'docProps/core.xml'
const CORE_VACIO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
  + ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  + '<dc:title></dc:title><dc:creator></dc:creator><cp:lastModifiedBy></cp:lastModifiedBy>'
  + '<dcterms:created xsi:type="dcterms:W3CDTF"></dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF"></dcterms:modified></cp:coreProperties>'

/** Registra docProps/core.xml en [Content_Types].xml y en _rels/.rels, para una plantilla que no lo traía. */
function registrarPropiedades(tipos, relaciones) {
  const CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
  const raizTipos = tipos.documentElement
  if (![...raizTipos.getElementsByTagNameNS(CT, 'Override')].some((o) => o.getAttribute('PartName') === `/${CORE}`)) {
    const o = tipos.createElementNS(CT, 'Override')
    o.setAttribute('PartName', `/${CORE}`)
    o.setAttribute('ContentType', 'application/vnd.openxmlformats-package.core-properties+xml')
    raizTipos.appendChild(o)
  }
  const raiz = relaciones.documentElement
  const existentes = [...raiz.getElementsByTagNameNS(NS.rels, 'Relationship')]
  if (!existentes.some((r) => r.getAttribute('Target').replace(/^\//, '') === CORE)) {
    const r = relaciones.createElementNS(NS.rels, 'Relationship')
    let n = existentes.length + 1
    while (existentes.some((x) => x.getAttribute('Id') === `rId${n}`)) n++
    r.setAttribute('Id', `rId${n}`)
    r.setAttribute('Type', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties')
    r.setAttribute('Target', CORE)
    raiz.appendChild(r)
  }
}

function llenarMetadatos(doc, c) {
  const poner = (ns, nombre, valor) => {
    const n = doc.getElementsByTagNameNS(ns, nombre.split(':')[1])[0]
    if (n) n.textContent = valor
  }
  const fecha = new Date(c.generado.en).toISOString().replace(/\.\d+Z$/, 'Z')
  poner(NS.dc, 'dc:title', tituloAuditoria(c))
  // El autor es quien genera el informe (la plantilla traía datos de quien la elaboró)
  poner(NS.dc, 'dc:creator', c.generado.por)
  poner(NS.cp, 'cp:lastModifiedBy', c.generado.por)
  poner(NS.dcterms, 'dcterms:created', fecha)
  poner(NS.dcterms, 'dcterms:modified', fecha)
}

const leerXml = (bytes) => {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new ErrorPlantilla('La plantilla del informe está dañada.')
  return doc
}
// El navegador ya escribe la declaración <?xml …?> si el documento la traía: se agrega solo si falta
const escribirXml = (doc) => {
  const xml = new XMLSerializer().serializeToString(doc)
  return strToU8(xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`)
}

/** Devuelve el .docx del informe (bytes). */
export async function construirDocx(informe) {
  const c = informe.contenido
  const archivos = await cargarPlantilla()
  if (!archivos[DOCUMENTO]) throw new ErrorPlantilla('La plantilla del informe no es un documento de Word (.docx).')
  const documento = leerXml(archivos[DOCUMENTO])
  // Encabezados y pies de todas las secciones (word/header1.xml, word/footer2.xml…)
  const partes = Object.fromEntries(Object.keys(archivos).filter((ruta) => /^word\/(header|footer)\d*\.xml$/.test(ruta))
    .map((ruta) => [ruta, leerXml(archivos[ruta])]))
  llenarCuerpo(documento, c)
  for (const parte of Object.values(partes)) llenarEncabezadoYPie(parte, c)
  if (archivos['word/_rels/document.xml.rels']) alinearSecciones(documento, leerXml(archivos['word/_rels/document.xml.rels']), partes)

  // Una plantilla sin propiedades (Google Docs no las guarda) recibe docProps/core.xml con el título y el autor
  const sinPropiedades = !archivos[CORE] && archivos['[Content_Types].xml'] && archivos['_rels/.rels']
  const tipos = sinPropiedades && leerXml(archivos['[Content_Types].xml'])
  const relaciones = sinPropiedades && leerXml(archivos['_rels/.rels'])
  if (sinPropiedades) registrarPropiedades(tipos, relaciones)
  const salida = {}
  for (const [ruta, datos] of Object.entries(archivos)) {
    if (ruta === DOCUMENTO) salida[ruta] = escribirXml(documento)
    else if (partes[ruta]) salida[ruta] = escribirXml(partes[ruta])
    else if (ruta === CORE) {
      const core = leerXml(datos)
      llenarMetadatos(core, c)
      salida[ruta] = escribirXml(core)
    } else if (sinPropiedades && ruta === '[Content_Types].xml') salida[ruta] = escribirXml(tipos)
    else if (sinPropiedades && ruta === '_rels/.rels') salida[ruta] = escribirXml(relaciones)
    else salida[ruta] = datos
  }
  if (sinPropiedades) {
    const core = leerXml(strToU8(CORE_VACIO))
    llenarMetadatos(core, c)
    salida[CORE] = escribirXml(core)
  }
  return zipSync(salida, { level: 6 })
}

export async function exportarDocx(informe) {
  const bytes = await construirDocx(informe)
  saveAs(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), nombreArchivo(informe, 'docx'))
}
