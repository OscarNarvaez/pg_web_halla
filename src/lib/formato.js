import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function aFecha(valor) {
  if (!valor) return null
  const fecha = typeof valor === 'string' ? parseISO(valor) : valor
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** 2026-10-03 → «3 de octubre de 2026» */
export function fechaLarga(valor) {
  const fecha = aFecha(valor)
  return fecha ? format(fecha, "d 'de' MMMM 'de' yyyy", { locale: es }) : ''
}

/** 2026-10-03 → «03/10/2026» */
export function fechaCorta(valor) {
  const fecha = aFecha(valor)
  return fecha ? format(fecha, 'dd/MM/yyyy', { locale: es }) : ''
}

/** Fecha y hora: «03/10/2026 14:05» */
export function fechaHora(valor) {
  const fecha = aFecha(valor)
  return fecha ? format(fecha, 'dd/MM/yyyy HH:mm', { locale: es }) : ''
}

/** «hace 3 horas» */
export function haceCuanto(valor) {
  const fecha = aFecha(valor)
  return fecha ? formatDistanceToNow(fecha, { addSuffix: true, locale: es }) : ''
}

/** AAAAMMDD para nombres de archivo. */
export function fechaArchivo(valor = new Date()) {
  return format(aFecha(valor) ?? new Date(), 'yyyyMMdd')
}

/** Quita puntos, espacios y guiones: «1.085.123.456» → «1085123456». */
export function normalizarCedula(valor) {
  return String(valor ?? '').replace(/[.\s-]/g, '')
}

/** Quita espacios, guiones, paréntesis y el prefijo +57: «+57 300 123 4567» → «3001234567». */
export function normalizarCelular(valor) {
  return String(valor ?? '')
    .replace(/[\s\-()]/g, '')
    .replace(/^\+?57(?=\d{10}$)/, '')
}

/** «1085123456» → «1.085.123.456» */
export function formatearCedula(valor) {
  const limpio = normalizarCedula(valor)
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** «3001234567» → «300 123 4567» */
export function formatearCelular(valor) {
  const limpio = normalizarCelular(valor)
  return limpio.length === 10 ? `${limpio.slice(0, 3)} ${limpio.slice(3, 6)} ${limpio.slice(6)}` : limpio
}

/** Recorta un texto largo sin cortar palabras. */
export function extracto(texto, max = 180) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const corte = limpio.slice(0, max)
  return `${corte.slice(0, corte.lastIndexOf(' ') > 0 ? corte.lastIndexOf(' ') : max)}…`
}

/** Número en palabras para cifras pequeñas del informe: 3 → «tres». */
export function enPalabras(n) {
  const palabras = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
  return n >= 0 && n <= 10 ? palabras[n] : String(n)
}
