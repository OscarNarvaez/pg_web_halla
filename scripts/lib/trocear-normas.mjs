// Troceador de los documentos normativos de normas/ en fragmentos por numeral.
// Lo usan scripts/ingest-normas.mjs (sube a Supabase) y scripts/probar-busqueda.mjs (prueba local).
// Decisiones y defectos de los archivos que corrige: docs/RECONOCIMIENTO.md §C.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Encabezado con numeral y título: «#### **9.3.3 Salidas de la revisión por la dirección**»
const RE_NUMERAL = /^(#{1,6})\s*\*{0,2}\s*(\d+(?:\.\d+)*)\.?\s+(.*?)\s*\*{0,2}\s*$/
// Encabezado que es SOLO numeral; el título viene en el siguiente encabezado (definiciones de 45001 y 19011)
const RE_SOLO_NUMERAL = /^(#{1,6})\s*\*{0,2}\s*(\d+(?:\.\d+)*)\.?\s*\*{0,2}\s*$/
// Numeral de anexo: «A.18.3 Recording nonconformities»
const RE_ANEXO_NUMERAL = /^(#{1,6})\s*\*{0,2}\s*([A-Z]\.\d+(?:\.\d+)*)\.?\s+(.*?)\s*\*{0,2}\s*$/
// Inicio de anexos o material final: a partir de aquí no hay requisitos
const RE_INICIO_ANEXOS = /^\s*(?:#{1,6}\s*)?\**\s*(?:anexo|annex)\s+[A-Z]\b/i
const RE_FINAL = /^(bibliograf[ií]a|bibliography|[ií]ndice alfab[eé]tico|listado alfab[eé]tico|correspondencia entre|control de versi[oó]n|anexos?\b|ics\s)/i
// Encabezados que son cabeceras de página repetidas, no estructura
const RE_CABECERA_PAGINA =
  /^(norma t[eé]cnica|ntc-iso \d+.*|iso 45001:2018 \(traducci[oó]n oficial\)|iso\/fdis 19011.*|p[aá]gina|©.*)$/i

const TITULOS_GENERICOS = /^(generalidades|general|generalities)$/i
const SIGLAS = new Set(['SST', 'SGC', 'SGA', 'ISO', 'NTC', 'PHVA', 'II', 'III', 'IV'])

export const MAX_CARACTERES = 2400

/** Metadatos de cada archivo y qué capítulos contienen requisitos citables. */
export const DOCUMENTOS = {
  '1_NTC_ISO_9001_2015.md': {
    codigo: 'NTC-ISO 9001:2015',
    titulo: 'Sistemas de gestión de la calidad. Requisitos',
    idioma: 'es',
    capitulos: [4, 5, 6, 7, 8, 9, 10],
  },
  '2_iso-45001-norma-Internacional.md': {
    codigo: 'ISO 45001:2018',
    titulo: 'Sistemas de gestión de la seguridad y salud en el trabajo. Requisitos con orientación para su uso',
    idioma: 'es',
    capitulos: [4, 5, 6, 7, 8, 9, 10],
  },
  '3_NTC-ISO_14001-2015.md': {
    codigo: 'NTC-ISO 14001:2015',
    titulo: 'Sistemas de gestión ambiental. Requisitos con orientación para su uso',
    idioma: 'es',
    capitulos: [4, 5, 6, 7, 8, 9, 10],
  },
  '4_ISO_FDIS_19011__E__1.md': {
    codigo: 'ISO 19011',
    titulo: 'Guidelines for auditing management systems',
    idioma: 'en',
    capitulos: [4, 5, 6, 7],
    incluirAnexoA: true, // A.18 «Audit findings»: guía para registrar hallazgos
  },
  '5_PR13_GQ_Gestion_de_riesgos__2_.md': {
    codigo: 'PR13-GQ',
    titulo: 'Procedimiento institucional de gestión de riesgos (V4)',
    idioma: 'es',
    capitulos: [1, 2, 3, 4, 5],
    ocr: true, // OCR de tablas: troceado propio
  },
}

/** Pasa a tipo oración los títulos escritos todo en mayúsculas, conservando siglas. */
export function tipoOracion(titulo) {
  const t = titulo.trim()
  if (t !== t.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(t)) return t
  const palabras = t.toLowerCase().split(/\s+/)
  return palabras
    .map((p, i) => {
      const original = p.toUpperCase()
      if (SIGLAS.has(original.replace(/[^A-ZÁÉÍÓÚÑ]/g, ''))) return original
      return i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p
    })
    .join(' ')
}

/** Limpia una línea de contenido Markdown proveniente de PDF. */
function limpiarLinea(linea, { conservarSaltos = false } = {}) {
  let l = linea
    .replace(/<!--.*?-->/g, '')
    .replace(/<br\s*\/?>/gi, conservarSaltos ? '\n' : ' ')
    .replace(/<\/?(mark|u|sup|sub|span|b|i|strong|em)[^>]*>/gi, '')
    .replace(/\*{2,}/g, '')
    .replace(/(^|[\s(])_([^_\n]+?)_(?=[\s.,;:)]|$)/g, '$1$2')
    .replace(/`/g, '')
  // Filas de tablas Markdown → celdas separadas por « · »
  if (/^\s*\|/.test(l)) {
    if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) return ''
    l = l.split('|').map((c) => c.trim()).filter(Boolean).join(' · ')
  }
  return l.replace(/[ \t]+/g, ' ').trimEnd()
}

function esRuido(linea) {
  const t = linea.trim()
  return (
    /^\d{1,3}$/.test(t) || // número de página
    /^[ivxlc]{1,5}$/i.test(t) || // página en romanos
    /\.{6,}\s*\d*\s*$/.test(t) || // renglón de índice con puntos guía
    /^(norma t[eé]cnica|ntc-iso \d+ \(cuarta actualizaci[oó]n\)|iso 45001:2018 \(traducci[oó]n oficial\)|iso\/fdis 19011:\d+\(en\))$/i.test(t) ||
    /^©\s*iso/i.test(t) ||
    /^copia autorizada a /i.test(t) || // marca de agua de la copia licenciada de 14001
    /^norma t[eé]cnica colombiana ntc-iso \d+/i.test(t)
  )
}

function normalizarContenido(lineas) {
  return lineas
    .filter((l) => !esRuido(l))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Parte un contenido largo por párrafos (y, si hace falta, por oraciones) sin pasar del máximo. */
export function partirContenido(texto, max = MAX_CARACTERES) {
  if (texto.length <= max) return [texto]
  const bloques = texto.split(/\n\s*\n/).flatMap((p) => {
    if (p.length <= max) return [p]
    const oraciones = p.split(/(?<=[.;:])\s+/)
    const salida = []
    let actual = ''
    for (const o of oraciones) {
      if ((actual + ' ' + o).length > max && actual) {
        salida.push(actual)
        actual = o
      } else actual = actual ? `${actual} ${o}` : o
    }
    if (actual) salida.push(actual)
    return salida.flatMap((s) => (s.length <= max ? [s] : s.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g'))))
  })
  const partes = []
  let actual = ''
  for (const b of bloques) {
    if (actual && actual.length + b.length + 2 > max) {
      partes.push(actual)
      actual = b
    } else actual = actual ? `${actual}\n\n${b}` : b
  }
  if (actual) partes.push(actual)
  return partes
}

function separarTitulo(tituloCrudo) {
  // 14001: «Objetivo.** Resultado a lograr.» → título «Objetivo», el resto es contenido
  const limpio = tituloCrudo.replace(/`/g, '')
  const corte = limpio.match(/^(.*?)\.\*\*\s*(.+)$/)
  const titulo = (corte ? corte[1] : limpio).replace(/\*+/g, '').replace(/[:\s]+$/, '').trim()
  const resto = corte ? corte[2].replace(/\*+/g, '').trim() : ''
  if (titulo.length > 200) return { titulo: `${titulo.slice(0, 120).replace(/\s+\S*$/, '')}…`, resto: titulo }
  return { titulo, resto }
}

function capitulo(numeral) {
  return Number(String(numeral).split('.')[0])
}

/** Trocea un documento ISO (Markdown con encabezados numerados). */
function trocearIso(texto, meta) {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const crudos = []
  let actual = null
  let enAnexos = false
  let fin = false

  const abrir = (numeral, tituloCrudo) => {
    if (actual) crudos.push(actual)
    const { titulo, resto } = separarTitulo(tituloCrudo)
    actual = { numeral, titulo: tipoOracion(titulo), lineas: resto ? [resto] : [] }
  }

  for (let i = 0; i < lineas.length && !fin; i++) {
    const linea = lineas[i]
    const esEncabezado = /^#{1,6}\s/.test(linea)
    const textoEncabezado = esEncabezado ? linea.replace(/^#{1,6}\s*/, '').replace(/\*+/g, '').trim() : ''

    // ¿Empiezan los anexos o el material final?
    if (RE_INICIO_ANEXOS.test(linea) || (esEncabezado && RE_FINAL.test(textoEncabezado))) {
      if (actual) crudos.push(actual)
      actual = null
      if (esEncabezado && RE_FINAL.test(textoEncabezado) && !RE_INICIO_ANEXOS.test(linea)) {
        // bibliografía, índices, correspondencias: nada más que procesar
        if (!enAnexos || !meta.incluirAnexoA) fin = true
        else fin = true
        continue
      }
      enAnexos = true
      continue
    }

    if (enAnexos) {
      if (!meta.incluirAnexoA) continue
      const a = linea.match(RE_ANEXO_NUMERAL)
      if (a && a[2].startsWith('A.')) {
        abrir(a[2], a[3])
        continue
      }
      if (actual && !(esEncabezado && RE_CABECERA_PAGINA.test(textoEncabezado))) actual.lineas.push(linea)
      continue
    }

    const m = linea.match(RE_NUMERAL)
    if (m) {
      abrir(m[2], m[3])
      continue
    }
    const solo = linea.match(RE_SOLO_NUMERAL)
    if (solo) {
      // el título es el siguiente encabezado no vacío
      let titulo = ''
      for (let j = i + 1; j < Math.min(i + 5, lineas.length); j++) {
        const t = lineas[j].trim()
        if (!t) continue
        if (/^#{1,6}\s/.test(t) && !RE_SOLO_NUMERAL.test(t) && !RE_NUMERAL.test(t)) {
          titulo = t.replace(/^#{1,6}\s*/, '')
          i = j
        }
        break
      }
      abrir(solo[2], titulo || `Numeral ${solo[2]}`)
      continue
    }
    if (esEncabezado && RE_CABECERA_PAGINA.test(textoEncabezado)) continue
    if (actual) actual.lineas.push(esEncabezado ? textoEncabezado : linea)
  }
  if (actual && !fin) crudos.push(actual)

  // Títulos de los padres, para desambiguar «Generalidades»
  const tituloPorNumeral = new Map(crudos.map((c) => [c.numeral, c.titulo]))

  return crudos
    .filter((c) => (c.numeral.startsWith('A.') ? meta.incluirAnexoA : meta.capitulos.includes(capitulo(c.numeral))))
    .map((c) => {
      let titulo = c.titulo
      if (TITULOS_GENERICOS.test(titulo)) {
        const padre = tituloPorNumeral.get(c.numeral.split('.').slice(0, -1).join('.'))
        if (padre) titulo = `${padre} — ${titulo}`
      }
      return { numeral: c.numeral, titulo, contenido: normalizarContenido(c.lineas.map((l) => limpiarLinea(l))) }
    })
}

/** Trocea el PR13-GQ: OCR de tablas con <br>, cabeceras y firmas repetidas en cada página. */
function trocearPr13(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const ruidoPr13 =
    /(HOSPITAL INFANTIL LOS [AÁ]NGELES|C[oó]digo:|PR13_GQ|Fecha:|Responsable:|GESTION DE RIESGOS|P[aá]gina:|Elabor[oó]:|Revis[oó]:|Aprob[oó]:|Actualiz[oó]:|Vigencia:|ROBERTO JURADO|CARLINA DOMINGUEZ|DORIS SARASTY|YENIFER NARVAEZ|Start of picture text|End of picture text)/i
  // Las firmas del pie de página nunca son contenido, sin importar la longitud de la línea
  const firmasPr13 = /(Elabor[oó]:|Revis[oó]:|Aprob[oó]:|Actualiz[oó]:)\s*[A-ZÁÉÍÓÚÑ]{3,}/
  const crudos = []
  let actual = null
  let seccion4 = false

  for (const linea of lineas) {
    if (/^#\s/.test(linea)) {
      const t = linea.replace(/^#\s*/, '').replace(/\*+/g, '').trim()
      const m = t.match(/^(\d+)\.\s*(.*)$/)
      if (m) {
        if (actual) crudos.push(actual)
        const numeral = m[1]
        seccion4 = numeral === '4'
        actual = { numeral, titulo: tipoOracion(m[2].replace(/:\s*$/, '')), lineas: [] }
        continue
      }
      if (seccion4) {
        // subtítulos del marco conceptual: fragmentos propios dentro del numeral 4
        if (actual) crudos.push(actual)
        actual = { numeral: '4', titulo: `Marco conceptual — ${t}`, lineas: [] }
        continue
      }
    }
    if (!actual) continue
    // Las tablas de actividades vienen como OCR con <br>: cada celda pasa a ser una línea
    for (const sub of limpiarLinea(linea, { conservarSaltos: true }).split('\n')) {
      // Solo las líneas cortas son cabeceras o firmas; un párrafo que menciona al hospital es contenido
      const esCabecera = (sub.trim().length < 120 && ruidoPr13.test(sub)) || firmasPr13.test(sub)
      if (sub.trim() && !esCabecera) actual.lineas.push(sub.trim())
      else if (!sub.trim()) actual.lineas.push('')
    }
  }
  if (actual) crudos.push(actual)

  return crudos
    .filter((c) => DOCUMENTOS['5_PR13_GQ_Gestion_de_riesgos__2_.md'].capitulos.includes(capitulo(c.numeral)))
    .map((c) => {
      // En el OCR las celdas quedan en líneas cortas: se unen en párrafos
      const contenido = normalizarContenido(c.lineas)
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
        .filter((p) => p && !/^(\d+|[A-Z]|[-·•])$/.test(p))
        .join('\n\n')
      const titulo = c.numeral === '5' ? 'Contenido: actividades del procedimiento de gestión de riesgos' : c.titulo
      return { numeral: c.numeral, titulo, contenido }
    })
}

/**
 * Trocea un archivo de normas/ y devuelve las filas listas para criterios_normativos.
 * @returns {{ filas: object[], descartados: number, detectados: number }}
 */
export function trocearArchivo(dirNormas, archivo) {
  const meta = DOCUMENTOS[archivo]
  if (!meta) throw new Error(`No hay metadatos para ${archivo}`)
  const texto = readFileSync(join(dirNormas, archivo), 'utf8')
  const fragmentos = meta.ocr ? trocearPr13(texto) : trocearIso(texto, meta)

  const filas = []
  let descartados = 0
  for (const f of fragmentos) {
    if (f.contenido.length < 40) {
      descartados++ // encabezados de capítulo sin texto propio
      continue
    }
    const partes = partirContenido(f.contenido)
    partes.forEach((contenido, i) => {
      filas.push({
        documento_codigo: meta.codigo,
        documento_titulo: meta.titulo,
        archivo,
        idioma: meta.idioma,
        numeral: f.numeral,
        titulo: f.titulo,
        contenido,
        nivel: f.numeral.replace(/^[A-Z]\./, '').split('.').length,
        orden: filas.length,
        parte: i + 1,
      })
    })
  }
  return { filas, descartados, detectados: fragmentos.length }
}
