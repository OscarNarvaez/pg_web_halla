// Informe final en ODT, llenando la plantilla oficial (src/formato_de_informe_final/Auditoria_interna.odt) sin
// cambiar su formato: se escriben los textos en los renglones vacíos que la plantilla trae para ello y se conservan
// sus estilos, tablas, encabezado, pie y logo. Se importa bajo demanda.
//
// Las anclas se buscan por el TEXTO de la plantilla (no por nombres de estilos, que cambian cada vez que alguien
// la guarda con otro programa). Si el dueño cambia un título de la plantilla, hay que cambiarlo en formato-informe.js.
import { strFromU8, strToU8, zipSync } from 'fflate'
import { saveAs } from 'file-saver'
import { cargarPlantilla } from './plantilla-informe'
import { LISTAS_HALLAZGOS, TEXTOS_FORMATO, lineaGenerado, parrafos, personaFicha, seccionesFormato, tituloAuditoria } from './formato-informe'
import { nombreArchivo } from './exportar-comun'

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  meta: 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0',
  dc: 'http://purl.org/dc/elements/1.1/',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
}

export class ErrorPlantilla extends Error {
  name = 'ErrorPlantilla'
}

const normal = (t) => t.replace(/\s+/g, ' ').trim()
const es = (n, ns, nombre) => n?.nodeType === 1 && n.namespaceURI === ns && n.localName === nombre

/** Texto visible de un nodo ODF (los dibujos anclados al párrafo no cuentan). */
function textoDe(nodo) {
  let t = ''
  for (const h of nodo.childNodes) {
    if (h.nodeType === 3) t += h.nodeValue
    else if (es(h, NS.text, 's')) t += ' '.repeat(Number(h.getAttributeNS(NS.text, 'c') || 1))
    else if (es(h, NS.text, 'tab')) t += '\t'
    else if (es(h, NS.text, 'line-break')) t += '\n'
    else if (h.nodeType === 1 && h.namespaceURI !== NS.draw) t += textoDe(h)
  }
  return t
}

const vacio = (n) => es(n, NS.text, 'p') && !normal(textoDe(n)) && !n.getElementsByTagNameNS(NS.draw, '*').length

function nuevoParrafo(doc, estilo, texto) {
  const p = doc.createElementNS(NS.text, 'text:p')
  if (estilo) p.setAttributeNS(NS.text, 'text:style-name', estilo)
  p.appendChild(doc.createTextNode(texto))
  return p
}

/**
 * Reemplaza el texto de un párrafo conservando el estilo del tramo que contiene su primer texto. La plantilla anida
 * tramos («Default Paragraph Font» › negrita…): el estilo que se ve es el del tramo más interno.
 */
function reemplazarTexto(p, texto) {
  const doc = p.ownerDocument
  const tramos = [...p.getElementsByTagNameNS(NS.text, 'span')]
  const tramo = tramos.find((t) => !t.getElementsByTagNameNS(NS.text, 'span').length && normal(textoDe(t))) ?? tramos[0]
  const estilo = tramo?.getAttributeNS(NS.text, 'style-name')
  while (p.firstChild) p.removeChild(p.firstChild)
  if (estilo) {
    const span = doc.createElementNS(NS.text, 'text:span')
    span.setAttributeNS(NS.text, 'text:style-name', estilo)
    span.appendChild(doc.createTextNode(texto))
    p.appendChild(span)
    return span
  }
  p.appendChild(doc.createTextNode(texto))
  return p
}

/**
 * Reemplaza un fragmento del texto de un párrafo (un campo de la plantilla, como «(area auditada)») sin tocar el
 * resto ni sus estilos. Devuelve false si el fragmento no está entero en un mismo tramo de texto.
 */
function reemplazarFragmento(p, buscado, nuevo) {
  const caminante = p.ownerDocument.createTreeWalker(p, 4 /* NodeFilter.SHOW_TEXT */)
  for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
    if (n.nodeValue.includes(buscado)) {
      n.nodeValue = n.nodeValue.replace(buscado, nuevo)
      return true
    }
  }
  return false
}

/**
 * Inserta líneas después de un ancla: en el primer renglón vacío que la plantilla trae ahí, con su estilo. Si ese
 * renglón usa el estilo genérico (sin el espacio superior de los demás), se usa el estilo de cuerpo de la plantilla.
 * Si es el único renglón antes del siguiente título, se conserva como separación (como en las demás secciones).
 */
function rellenar(ancla, lineas, estiloCuerpo, automaticos) {
  const doc = ancla.ownerDocument
  const hueco = vacio(ancla.nextElementSibling) ? ancla.nextElementSibling : null
  const estiloHueco = hueco?.getAttributeNS(NS.text, 'style-name')
  const estilo = estiloHueco && automaticos.has(estiloHueco) ? estiloHueco : estiloCuerpo
  const referencia = hueco ?? ancla.nextElementSibling
  for (const linea of lineas) ancla.parentNode.insertBefore(nuevoParrafo(doc, estilo, linea), referencia)
  const antesDeTitulo = es(hueco?.nextElementSibling, NS.text, 'h') && normal(textoDe(hueco.nextElementSibling))
  if (hueco && !antesDeTitulo) hueco.parentNode.removeChild(hueco)
}

const conVinetas = (items) => items.map((t) => `• ${t}`)

function llenarCuerpo(doc, c) {
  const cuerpo = doc.getElementsByTagNameNS(NS.office, 'text')[0]
  const elementos = () => [...cuerpo.children]
  const buscar = (texto, { titulo } = {}) => {
    const n = elementos().find((x) => (es(x, NS.text, 'p') || es(x, NS.text, 'h')) && (titulo === undefined || es(x, NS.text, titulo ? 'h' : 'p'))
      && normal(textoDe(x)) === texto)
    if (!n) throw new ErrorPlantilla(`La plantilla del informe no tiene «${texto}». Revisa src/formato_de_informe_final/Auditoria_interna.odt.`)
    return n
  }

  // Portada: «Auditoria Interna - <año> - <proceso> <evaluador>» y el año
  const titulo = elementos().find((x) => es(x, NS.text, 'p') && /^Auditoria Interna - /.test(normal(textoDe(x))))
  if (!titulo) throw new ErrorPlantilla('La plantilla del informe no tiene el título de la portada («Auditoria Interna - …»).')
  reemplazarTexto(titulo, `${tituloAuditoria(c)} ${c.encabezado.evaluador}`.trim())
  const anio = elementos().find((x) => es(x, NS.text, 'p') && /^\d{4}$/.test(normal(textoDe(x))))
  if (anio) reemplazarTexto(anio, c.encabezado.anio)

  // Estilos propios de este documento (los renglones de la plantilla con su espaciado)
  const automaticos = new Set([...doc.getElementsByTagNameNS(NS.office, 'automatic-styles')[0]?.getElementsByTagNameNS(NS.style, 'style') ?? []]
    .map((e) => e.getAttributeNS(NS.style, 'name')))
  // Estilo de los párrafos de texto que se agregan donde la plantilla no trae renglón vacío
  const alcance = buscar('Alcance', { titulo: true })
  const estiloCuerpo = (vacio(alcance.nextElementSibling) && alcance.nextElementSibling.getAttributeNS(NS.text, 'style-name'))
    || buscar(TEXTOS_FORMATO.revisionIndicadores).getAttributeNS(NS.text, 'style-name')

  llenarFicha(cuerpo, c)

  for (const lista of LISTAS_HALLAZGOS) {
    const items = c.hallazgos.find((g) => g.clasificacion === lista.clasificacion)?.items ?? []
    rellenar(buscar(lista.titulo, { titulo: false }), items.length ? conVinetas(items.map((h) => h.texto)) : [lista.vacio], estiloCuerpo, automaticos)
  }

  for (const s of seccionesFormato(c)) {
    const ancla = s.antes ? buscar(s.antesPlantilla ?? s.antes) : buscar(s.titulo, { titulo: true })
    // Campos de la plantilla («(area auditada)»): se llenan en su sitio, con el estilo que traen
    for (const [campo, valor] of Object.entries(s.campos ?? {})) {
      if (!reemplazarFragmento(ancla, campo, valor)) reemplazarTexto(ancla, s.antes)
    }
    const contenido = Array.isArray(s.contenido) ? s.contenido : parrafos(s.contenido)
    const lineas = [...conVinetas(s.vinetas ?? []), ...(s.tipo === 'vinetas' ? conVinetas(contenido) : contenido)]
    rellenar(ancla, lineas.length ? lineas : ['No informado.'], estiloCuerpo, automaticos)
  }
}

/** Ficha Técnica: la primera tabla de la plantilla. Las filas se reconocen por la etiqueta de su primera celda. */
function llenarFicha(cuerpo, c) {
  const tabla = cuerpo.getElementsByTagNameNS(NS.table, 'table')[0]
  if (!tabla) throw new ErrorPlantilla('La plantilla del informe no tiene la tabla «Ficha Técnica».')
  const filas = () => [...tabla.getElementsByTagNameNS(NS.table, 'table-row')]
  const celdas = (fila) => [...fila.children].filter((x) => es(x, NS.table, 'table-cell') || es(x, NS.table, 'covered-table-cell'))
  const etiqueta = (fila) => normal(textoDe(celdas(fila)[0] ?? fila))
  const escribir = (celda, texto) => {
    if (!celda || !texto) return
    let p = celda.getElementsByTagNameNS(NS.text, 'p')[0]
    if (!p) p = celda.appendChild(nuevoParrafo(celda.ownerDocument, null, ''))
    while (p.firstChild) p.removeChild(p.firstChild)
    p.appendChild(celda.ownerDocument.createTextNode(texto))
  }
  const f = c.ficha
  for (const fila of filas()) {
    const [, valor, , valor2] = celdas(fila)
    const conValor = es(valor, NS.table, 'table-cell')
    switch (etiqueta(fila)) {
      case TEXTOS_FORMATO.fechaInicioPlaneada: escribir(valor, f.inicio_planeada); escribir(valor2, f.fin_planeada); break
      case TEXTOS_FORMATO.fechaInicioReal: escribir(valor, f.inicio_real); escribir(valor2, f.fin_real); break
      case TEXTOS_FORMATO.sistemaReferencia: escribir(valor, f.sistema_referencia); break
      case TEXTOS_FORMATO.evaluador: escribir(valor, f.evaluador); break
      case TEXTOS_FORMATO.liderEquipo: escribir(valor, personaFicha(f.lider)); break
      case TEXTOS_FORMATO.equipoAuditor:
        // La fila de cabecera «Equipo auditor» ocupa las cuatro columnas; la de la persona tiene celda de valor
        if (conValor) {
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
      const modelo = vacias.at(-1) ?? todas.at(-1)
      fila = modelo.cloneNode(true)
      const ultima = filas().at(-1)
      ultima.parentNode.insertBefore(fila, ultima.nextSibling)
      vacias.push(fila)
    }
    escribir(celdas(fila)[0], archivo)
  })
}

const ESTILO_MARCO = 'MarcoPaginaHalla'

/**
 * Estilo del marco del número de página: un marco de Writer (padre «Frame») sin borde ni relleno, ubicado respecto
 * de la página como los demás cuadros del encabezado y el pie.
 */
function agregarEstiloMarco(doc) {
  const automaticos = doc.getElementsByTagNameNS(NS.office, 'automatic-styles')[0]
  if (!automaticos) return
  const estilo = doc.createElementNS(NS.style, 'style:style')
  estilo.setAttributeNS(NS.style, 'style:name', ESTILO_MARCO)
  estilo.setAttributeNS(NS.style, 'style:family', 'graphic')
  estilo.setAttributeNS(NS.style, 'style:parent-style-name', 'Frame')
  const propiedades = doc.createElementNS(NS.style, 'style:graphic-properties')
  for (const [ns, nombre, valor] of [
    [NS.fo, 'fo:border', 'none'], [NS.fo, 'fo:padding', '0in'], [NS.style, 'style:wrap', 'run-through'],
    [NS.style, 'style:run-through', 'background'], [NS.style, 'style:vertical-pos', 'from-top'], [NS.style, 'style:vertical-rel', 'page'],
    [NS.style, 'style:horizontal-pos', 'from-left'], [NS.style, 'style:horizontal-rel', 'page'], [NS.draw, 'draw:fill', 'none'],
  ]) propiedades.setAttributeNS(ns, nombre, valor)
  estilo.appendChild(propiedades)
  automaticos.appendChild(estilo)
}

/** Cambia un cuadro de dibujo por un marco de texto con la misma posición y el mismo tamaño. */
function marcoDeTexto(forma, parrafo) {
  const doc = forma.ownerDocument
  const marco = doc.createElementNS(NS.draw, 'draw:frame')
  for (const atributo of [...forma.attributes]) {
    if (atributo.name === 'draw:text-style-name') continue
    marco.setAttributeNS(atributo.namespaceURI, atributo.name, atributo.name === 'draw:style-name' ? ESTILO_MARCO : atributo.value)
  }
  const caja = doc.createElementNS(NS.draw, 'draw:text-box')
  caja.appendChild(parrafo)
  marco.appendChild(caja)
  forma.parentNode.replaceChild(marco, forma)
  return marco
}

/** Encabezado y pie (styles.xml): título de la auditoría, «Generado por…» y el número de página. */
function llenarEncabezadoYPie(doc, c) {
  const tipoDe = (texto) => (/^HOSPITAL /.test(texto) ? 'izquierda_arriba'
    : /^Auditoria Interna - /.test(texto) ? 'derecha_arriba'
      : /^Generado por /.test(texto) ? 'izquierda_abajo'
        : /^Página/.test(texto) ? 'derecha_abajo' : null)
  agregarEstiloMarco(doc)
  const paginas = [...doc.getElementsByTagNameNS(NS.style, 'master-page')]
  const posiciones = paginas.map((pagina) => {
    const porTipo = {}
    for (const forma of pagina.getElementsByTagNameNS(NS.draw, 'custom-shape')) {
      const p = forma.getElementsByTagNameNS(NS.text, 'p')[0]
      const tipo = p && tipoDe(normal(textoDe(p)))
      if (!tipo) continue
      porTipo[tipo] = forma
      if (tipo === 'derecha_arriba') reemplazarTexto(p, tituloAuditoria(c))
      if (tipo === 'izquierda_abajo') reemplazarTexto(p, lineaGenerado(c))
      if (tipo === 'derecha_abajo') {
        // La plantilla trae «Página /» sin los campos (se perdieron al convertirla). Se agregan el número de página y
        // el total, y el cuadro de dibujo pasa a ser un marco de texto en la misma posición: Writer no calcula campos
        // dentro de los cuadros de dibujo.
        porTipo[tipo] = marcoDeTexto(forma, p)
        const tramo = reemplazarTexto(p, 'Página ')
        const numero = doc.createElementNS(NS.text, 'text:page-number')
        numero.setAttributeNS(NS.text, 'text:select-page', 'current')
        numero.appendChild(doc.createTextNode('1'))
        const total = doc.createElementNS(NS.text, 'text:page-count')
        total.appendChild(doc.createTextNode('1'))
        tramo.append(numero, doc.createTextNode('/'), total)
      }
    }
    return porTipo
  })
  // Desde la página 2 la plantilla usa una página maestra con coordenadas de hoja horizontal (quedó así al
  // convertirla desde PDF): el pie caía a mitad de página. Se toman las de la portada (la página maestra cuyo pie
  // está más abajo) para que el encabezado y el pie queden en el mismo lugar en todas las páginas.
  const yPie = (porTipo) => parseFloat(porTipo.izquierda_abajo?.getAttributeNS(NS.svg, 'y') ?? '0')
  const primera = posiciones.filter((p) => p.izquierda_abajo).sort((a, b) => yPie(b) - yPie(a))[0]
  for (const porTipo of posiciones) {
    if (porTipo === primera) continue
    for (const [tipo, forma] of Object.entries(porTipo)) {
      const modelo = primera?.[tipo]
      if (!modelo) continue
      for (const eje of ['x', 'y']) forma.setAttributeNS(NS.svg, `svg:${eje}`, modelo.getAttributeNS(NS.svg, eje))
    }
  }
}

function llenarMetadatos(doc, c) {
  const poner = (ns, nombre, valor) => {
    const n = doc.getElementsByTagNameNS(ns, nombre.split(':')[1])[0]
    if (n) n.textContent = valor
  }
  poner(NS.dc, 'dc:title', tituloAuditoria(c))
  // El autor es quien genera el informe (la plantilla traía datos de quien la elaboró)
  poner(NS.dc, 'dc:creator', c.generado.por)
  poner(NS.meta, 'meta:initial-creator', c.generado.por)
  poner(NS.dc, 'dc:date', c.generado.en)
  poner(NS.meta, 'meta:creation-date', c.generado.en)
}

const leerXml = (bytes) => {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new ErrorPlantilla('La plantilla del informe está dañada.')
  return doc
}
// El navegador ya escribe la declaración <?xml …?> si el documento la traía: se agrega solo si falta
const escribirXml = (doc) => {
  const xml = new XMLSerializer().serializeToString(doc)
  return strToU8(xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`)
}

/** Quita la miniatura de la plantilla (mostraría la portada de la plantilla, no la del informe) del manifiesto. */
function sinMiniatura(manifiesto) {
  for (const entrada of [...manifiesto.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:manifest:1.0', 'file-entry')]) {
    if (/^Thumbnails\//.test(entrada.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:manifest:1.0', 'full-path'))) entrada.parentNode.removeChild(entrada)
  }
  return manifiesto
}

/** Devuelve el .odt del informe (bytes). */
export async function construirOdt(informe) {
  const c = informe.contenido
  const archivos = await cargarPlantilla()
  const contenido = leerXml(archivos['content.xml'])
  const estilos = leerXml(archivos['styles.xml'])
  llenarCuerpo(contenido, c)
  llenarEncabezadoYPie(estilos, c)
  const salida = {
    // ODF exige que «mimetype» sea el primer archivo y vaya sin comprimir
    mimetype: [archivos.mimetype ?? strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
  }
  for (const [ruta, datos] of Object.entries(archivos)) {
    if (ruta === 'mimetype' || ruta.startsWith('Thumbnails/')) continue
    if (ruta.endsWith('/')) {
      salida[ruta] = [datos, { level: 0 }] // carpetas vacías (Configurations2/)
      continue
    }
    if (ruta === 'META-INF/manifest.xml') {
      salida[ruta] = escribirXml(sinMiniatura(leerXml(datos)))
      continue
    }
    if (ruta === 'content.xml') salida[ruta] = escribirXml(contenido)
    else if (ruta === 'styles.xml') salida[ruta] = escribirXml(estilos)
    else if (ruta === 'meta.xml') {
      const meta = leerXml(datos)
      llenarMetadatos(meta, c)
      salida[ruta] = escribirXml(meta)
    } else salida[ruta] = datos
  }
  return zipSync(salida, { level: 6 })
}

export async function exportarOdt(informe) {
  const bytes = await construirOdt(informe)
  saveAs(new Blob([bytes], { type: 'application/vnd.oasis.opendocument.text' }), nombreArchivo(informe, 'odt'))
}
