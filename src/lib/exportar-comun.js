// Utilidades compartidas por las exportaciones del informe (ODT y PDF).
import { fechaArchivo } from './formato'

export const hexARgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Informe_<codigo>_<AAAAMMDD>.<ext>, sin caracteres problemáticos para el sistema de archivos. */
export function nombreArchivo(informe, extension) {
  const codigo = String(informe.contenido.identificacion.codigo).replace(/[^\w-]+/g, '-')
  return `Informe_${codigo}_${fechaArchivo()}.${extension}`
}
