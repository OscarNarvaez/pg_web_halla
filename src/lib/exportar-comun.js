// Utilidades compartidas por la exportación a PDF y a Word.
import { CLASIFICACIONES, TONOS } from './catalogos'
import { fechaArchivo, fechaLarga } from './formato'
import logoPng from '../assets/logo-hila.png'

// Colores de la marca y de las clasificaciones (tailwind.config.js)
export const TINTA = '#16222c'
export const TINTA_SUAVE = '#4a6072'
export const LINEA = '#e6eaee'
export const MARCA = '#1b5f5a'
const FONDO_CLASE = { nc: '#fef2f2', obs: '#fffbeb', fort: '#f0fdf4', om: '#eff6ff' }

export const hexARgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
export const sinNumeral = (hex) => hex.replace('#', '').toUpperCase()
export const solidoDe = (clase) => TONOS[CLASIFICACIONES[clase].tono].solido
export const fondoDe = (clase) => FONDO_CLASE[CLASIFICACIONES[clase].tono]

/** Informe_<codigo>_<AAAAMMDD>.<ext>, sin caracteres problemáticos para el sistema de archivos. */
export function nombreArchivo(informe, extension) {
  const codigo = String(informe.contenido.identificacion.codigo).replace(/[^\w-]+/g, '-')
  return `Informe_${codigo}_${fechaArchivo()}.${extension}`
}

export function periodoDe(c) {
  const { inicio, fin } = c.alcance.periodo
  if (!inicio) return 'No informado'
  return `${fechaLarga(inicio)}${fin ? ` a ${fechaLarga(fin)}` : ''}`
}

let logoCache = null

/**
 * Bytes del logo del hospital para el PDF y el Word (en PNG: ni jsPDF ni docx leen WebP).
 * Si no se puede descargar, devuelve null y el informe sale sin logo en lugar de fallar.
 */
export function cargarLogo() {
  if (!logoCache) {
    logoCache = fetch(logoPng)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`logo: HTTP ${r.status}`))))
      .then((buffer) => new Uint8Array(buffer))
      .catch((e) => {
        console.warn('No se pudo cargar el logo del informe:', e)
        logoCache = null
        return null
      })
  }
  return logoCache
}
