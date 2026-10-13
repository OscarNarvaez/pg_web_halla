// Carga la plantilla oficial del informe (el Word que entregó el dueño) y la descomprime. Se usa al exportar:
// el Word se llena sobre ella y el PDF toma de ella el logo, para que ambos salgan del mismo archivo.
import { unzipSync } from 'fflate'
import urlPlantilla from '../formato_de_informe_final/Auditoria_interna.docx?url'

let enCache = null

/** @returns {Promise<Record<string, Uint8Array>>} archivos de la plantilla por ruta interna (word/document.xml…) */
export function cargarPlantilla() {
  if (!enCache) {
    enCache = fetch(urlPlantilla)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`plantilla del informe: HTTP ${r.status}`))))
      .then((buffer) => unzipSync(new Uint8Array(buffer)))
      .catch((e) => {
        enCache = null
        throw e
      })
  }
  return enCache
}

/** Primera imagen de la plantilla (el logo de la portada), con su formato para jsPDF. */
export async function logoDePlantilla() {
  const archivos = await cargarPlantilla()
  // Word guarda las imágenes en word/media/ y LibreOffice (ODT) en Pictures/; la miniatura (Thumbnails/) no cuenta
  const ruta = Object.keys(archivos).find((r) => /^(word\/media|media|Pictures)\/.+\.(jpe?g|png)$/i.test(r))
  if (!ruta) return null
  return { datos: archivos[ruta], formato: /\.png$/i.test(ruta) ? 'PNG' : 'JPEG' }
}
