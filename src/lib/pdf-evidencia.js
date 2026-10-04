// Lectura del PDF de evidencia EN EL NAVEGADOR (decisión del dueño, docs/SEGURIDAD.md): el archivo nunca
// se sube. Se extrae su texto (que luego pasa por la anonimización del servidor, como cualquier entrada) y
// se calcula su huella SHA-256 para la trazabilidad. pdf.js se carga solo cuando el auditor elige un PDF.

export const MAX_MB_PDF = 20
export const MAX_PAGINAS_PDF = 100
// Por debajo de esto por página, el PDF es una imagen escaneada: no tiene texto que extraer
const MINIMO_CARACTERES_POR_PAGINA = 30

export class ErrorPdf extends Error {}

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Une los fragmentos de una página respetando los saltos de línea y los guiones de corte. */
export function textoDePagina(items) {
  return items
    .map((it) => `${it.str ?? ''}${it.hasEOL ? '\n' : ''}`)
    .join('')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Texto de un rango de páginas (1-based, inclusivo). */
export function textoDeRango(paginas, desde, hasta) {
  return paginas.slice(desde - 1, hasta).filter(Boolean).join('\n\n').trim()
}

/**
 * Lee un PDF local.
 * @param {File} archivo
 * @returns {Promise<{ nombre: string, paginas: number, sha256: string, textos: string[], escaneado: boolean }>}
 */
export async function leerPdf(archivo) {
  if (!archivo) throw new ErrorPdf('No se eligió ningún archivo.')
  if (archivo.size > MAX_MB_PDF * 1024 * 1024) throw new ErrorPdf(`El PDF supera los ${MAX_MB_PDF} MB.`)
  const buffer = await archivo.arrayBuffer()
  const cabecera = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)))
  if (cabecera !== '%PDF-') throw new ErrorPdf('El archivo no es un PDF.')
  const sha256 = hex(await crypto.subtle.digest('SHA-256', buffer))

  const pdfjs = await import('pdfjs-dist')
  const { default: urlWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = urlWorker

  // isEvalSupported: false → pdf.js no usa eval (la CSP no lo permite). El buffer se copia porque pdf.js lo transfiere.
  // verbosity ERRORS: sin los avisos de fuentes estándar, que no afectan la extracción del texto
  const tarea = pdfjs.getDocument({
    data: new Uint8Array(buffer.slice(0)), isEvalSupported: false, disableFontFace: true, stopAtErrors: false, verbosity: pdfjs.VerbosityLevel.ERRORS,
  })
  let documento
  try {
    documento = await tarea.promise
  } catch (e) {
    await tarea.destroy()
    if (e?.name === 'PasswordException') throw new ErrorPdf('El PDF está protegido con contraseña. Quítale la protección y vuelve a cargarlo.')
    throw new ErrorPdf('No se pudo leer el PDF: puede estar dañado.')
  }
  try {
    if (documento.numPages > MAX_PAGINAS_PDF) throw new ErrorPdf(`El PDF tiene ${documento.numPages} páginas; el máximo es ${MAX_PAGINAS_PDF}.`)
    const textos = []
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n)
      textos.push(textoDePagina((await pagina.getTextContent()).items))
      pagina.cleanup()
    }
    const caracteres = textos.join('').replace(/\s/g, '').length
    return {
      nombre: archivo.name.slice(0, 200),
      paginas: documento.numPages,
      sha256,
      textos,
      escaneado: caracteres < MINIMO_CARACTERES_POR_PAGINA * documento.numPages,
    }
  } finally {
    await tarea.destroy() // libera el documento y el worker
  }
}
