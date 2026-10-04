// Validación anti-alucinación de la salida de Gemini (§9.3 del prompt maestro).
// Este módulo es la diferencia entre una herramienta de auditoría y un generador de texto bonito.
// Funciones puras: se prueban sin red ni base de datos (scripts/probar-validacion.mjs).

import { MARCADOR_PENDIENTE, CLASIFICACIONES, type Clasificacion } from './catalogos.ts'
import { quitarTildes, type Criterio } from './recuperar-criterios.ts'

export interface CitaIA {
  criterio_id: string
  numeral: string
  documento: string
}

export interface HallazgoIA {
  clasificacion: Clasificacion
  justificacion: string
  hallazgo_corregido: string
  criterio_requisito: string
  evidencia: string
  severidad?: 'alta' | 'media' | 'baja' | null
  criterios_citados: CitaIA[]
}

export interface CitaVerificada {
  criterio_id: string
  numeral: string | null
  documento: string
  titulo: string
  verificado: true
}

export const AVISO_ESTRUCTURA = 'Revisa la redacción: no se pudo verificar automáticamente la estructura de la categoría.'
export const AVISO_PENDIENTE = 'La IA no encontró un requisito verificable; identifícalo manualmente.'

const normal = (s: string) => quitarTildes(String(s ?? '').toLowerCase()).replace(/\s+/g, ' ').trim()
const normalNumeral = (s: string | null | undefined) =>
  String(s ?? '').replace(/^numeral(es)?\s+/i, '').replace(/[.\s]+$/, '').trim()

// ─── V5 · Limpieza ──────────────────────────────────────────────────────────

/** Quita comillas envolventes, viñetas, encabezados Markdown, negritas y rótulos que la IA haya metido. */
export function limpiarTexto(texto: string): string {
  let t = String(texto ?? '').replace(/\r/g, '')
  t = t
    .split('\n')
    .map((l) => l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, ''))
    .join(' ')
  t = t.replace(/\*\*|__/g, '').replace(/`/g, '')
  t = t.replace(/^\s*(?:hallazgo corregido|justificaci[oó]n|evidencia|criterio\s*\/?\s*requisito)\s*:\s*/i, '')
  t = t.replace(/\s+/g, ' ').trim()
  // comillas envolventes (pueden venir anidadas)
  for (let i = 0; i < 2; i++) t = t.replace(/^["“”«'‘]+\s*/, '').replace(/\s*["“”»'’]+$/, '').trim()
  return t
}

/** Recorta un texto largo en el último final de oración antes del máximo. */
export function recortarEnOracion(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max)
  const fin = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('; '))
  return fin > max * 0.5 ? corte.slice(0, fin + 1) : `${corte.replace(/\s+\S*$/, '')}…`
}

export const LIMITES = {
  hallazgo_corregido: { min: 120, max: 900 },
  justificacion: { min: 60, max: 500 },
}

// ─── V1 · Criterios citados reales ──────────────────────────────────────────

/**
 * Conserva solo las citas cuyo criterio_id está entre los criterios ENTREGADOS en el prompt y cuyo
 * numeral coincide con el de la base de datos. Nunca acepta un numeral «recordado» por la IA.
 */
export function verificarCitas(citas: CitaIA[], entregados: Criterio[]) {
  const porId = new Map(entregados.map((c) => [c.id, c]))
  const verificadas: CitaVerificada[] = []
  const descartadas: Array<CitaIA & { motivo: string }> = []
  const vistos = new Set<string>()

  for (const cita of citas ?? []) {
    const criterio = porId.get(String(cita?.criterio_id ?? '').trim())
    if (!criterio) {
      descartadas.push({ ...cita, motivo: 'criterio_id no está entre los criterios entregados' })
      continue
    }
    const numeralBd = normalNumeral(criterio.numeral)
    const numeralIa = normalNumeral(cita.numeral)
    // Un sub-numeral (4.4.2) del fragmento citado (4.4) se acepta solo si aparece literalmente en su texto
    const esSubnumeral =
      Boolean(numeralBd) &&
      numeralIa.startsWith(`${numeralBd}.`) &&
      new RegExp(`(^|[^\\d.])${numeralIa.replace(/\./g, '\\.')}(?![\\d])`).test(criterio.contenido)
    if (numeralBd && numeralIa !== numeralBd && !esSubnumeral) {
      descartadas.push({ ...cita, motivo: `el numeral ${numeralIa || '(vacío)'} no coincide con ${numeralBd}` })
      continue
    }
    if (vistos.has(criterio.id)) continue
    vistos.add(criterio.id)
    // El documento y el título se toman de la base de datos, no de la IA
    verificadas.push({
      criterio_id: criterio.id,
      numeral: esSubnumeral ? numeralIa : criterio.numeral,
      documento: criterio.documento_codigo,
      titulo: criterio.titulo,
      verificado: true,
    })
  }
  return { verificadas, descartadas }
}

// ─── V2 · Referencias normativas no verificadas ─────────────────────────────

const RE_DOC = /\b(?:NTC[-\s]?ISO|ISO(?:\/FDIS)?|NTC|GTC)\s*[-]?\s*(\d{3,5})(?::\d{4})?/gi
const RE_PR13 = /\bPR\s?-?\s?13(?:\s?[_-]?\s?GQ)?(?:\s*V\d+)?\b/gi
const RE_NUMERAL = /\bnumeral(?:es)?\s+((?:[A-Z]\.)?\d+(?:\.\d+)*(?:\s*(?:,|y|e)\s*(?:[A-Z]\.)?\d+(?:\.\d+)*)*)(?:\s*,?\s*(?:literal\s+)?[a-z]\))?/gi
const RE_NUMERAL_SUELTO = /\(\s*((?:[A-Z]\.)?\d{1,2}(?:\.\d{1,2}){1,4})(?:\s*[a-z]\))?\s*\)|\b(\d{1,2}(?:\.\d{1,2}){2,4})\b/g
const RE_LEGAL = /\b(?:art[íi]culos?|decretos?|resoluci[óo]n(?:es)?|leyes|ley|circular(?:es)?(?:\s+externas?)?)\s+(?:No\.?\s*|n[.º°o]\s*)?\d[\d.]*(?:\s+de\s+\d{4})?/gi

/**
 * Sustituye por el marcador toda referencia normativa que no corresponda a un criterio verificado
 * ni aparezca textualmente en la entrada del auditor.
 */
export function depurarReferencias(texto: string, verificadas: CitaVerificada[], entrada: string, entregados: Criterio[] = []) {
  const entradaN = normal(entrada)
  const numerosDoc = new Set(verificadas.map((v) => (v.documento.match(/\d{3,5}/) ?? [''])[0]).filter(Boolean))
  const hayPr13 = verificadas.some((v) => v.documento === 'PR13-GQ')
  const numerales = verificadas.map((v) => normalNumeral(v.numeral)).filter(Boolean)
  const idsVerificados = new Set(verificadas.map((v) => v.criterio_id))
  const textoVerificado = entregados.filter((c) => idsVerificados.has(c.id)).map((c) => c.contenido).join('\n')
  const numeralValido = (n: string) => {
    const x = normalNumeral(n)
    if (!x) return false
    // exacto, o el padre de un numeral verificado (citar 9.3 cuando se verificó 9.3.3 no inventa nada)
    if (numerales.some((v) => v === x || v.startsWith(`${x}.`))) return true
    // un sub-numeral (4.4.2) de un numeral verificado (4.4) que aparece literalmente en su texto
    const escapado = x.replace(/\./g, '\\.')
    if (numerales.some((v) => x.startsWith(`${v}.`)) && new RegExp(`(^|[^\\d.])${escapado}(?![\\d])`).test(textoVerificado)) return true
    return entradaN.includes(normal(x))
  }
  const eliminadas: string[] = []
  const sustituir = (coincidencia: string) => {
    eliminadas.push(coincidencia.trim())
    return MARCADOR_PENDIENTE
  }

  let t = texto
  t = t.replace(RE_DOC, (m, numero) => (numerosDoc.has(numero) || entradaN.includes(normal(m)) ? m : sustituir(m)))
  t = t.replace(RE_PR13, (m) => (hayPr13 || /pr\s?-?\s?13/.test(entradaN) ? m : sustituir(m)))
  t = t.replace(RE_NUMERAL, (m, lista) => {
    const nums = String(lista).split(/\s*(?:,|\by\b|\be\b)\s*/).filter(Boolean)
    const validos = nums.filter(numeralValido)
    if (validos.length === nums.length) return m
    if (!validos.length) return sustituir(m)
    // conserva los numerales verificados de la lista y retira los demás
    nums.filter((n) => !validos.includes(n)).forEach((n) => eliminadas.push(`numeral ${n}`))
    const unidos = validos.length === 1 ? validos[0] : `${validos.slice(0, -1).join(', ')} y ${validos.at(-1)}`
    return `${validos.length === 1 ? 'numeral' : 'numerales'} ${unidos}`
  })
  t = t.replace(RE_NUMERAL_SUELTO, (m, enParentesis, suelto) => (numeralValido(enParentesis ?? suelto) ? m : sustituir(m)))
  t = t.replace(RE_LEGAL, (m) => (entradaN.includes(normal(m)) ? m : sustituir(m)))

  // «…establecido en la [marcador], numeral [marcador]» → un solo marcador
  const marcadorRe = MARCADOR_PENDIENTE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  const conector = '(?:y|e|de|del|la|el|en|numeral(?:es)?|literal|art[íi]culos?)'
  t = t.replace(new RegExp(`(${marcadorRe})(?:[\\s,;()]*(?:${conector}[\\s,;()]+)*${marcadorRe})+`, 'g'), '$1')
  t = t.replace(/\(\s*(\[Requisito[^\]]*\])\s*\)/g, '$1')
  return { texto: t, eliminadas }
}

// ─── V6 · Datos que no aparecen en la entrada ──────────────────────────────

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
const RE_FECHA_LARGA = new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MESES})(?:\\s+(?:de|del)\\s+\\d{4})?\\b`, 'gi')
const RE_FECHA_CORTA = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g
const UNIDADES =
  '%|por\\s*ciento|historias?\\s+cl[íi]nicas?|registros?|pacientes?|usuarios?|trabajadores?|funcionarios?|colaboradores?|personas?|d[íi]as?|semanas?|meses|mes|horas?|minutos?|años?|kg|mg|ml|litros?|metros?|m2|unidades?|camas?|extintores?|formatos?|expedientes?|carpetas?|muestras?|casos?|eventos?|equipos?|actas?|historias?'
const RE_CANTIDAD = new RegExp(`(?<![\\d.,])(\\d+(?:[.,]\\d+)?)\\s*(?:${UNIDADES})(?![a-zñ])`, 'gi')

const NUMEROS_EN_PALABRAS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100,
}

function numerosDe(texto: string): Set<number> {
  const n = normal(texto)
  const salida = new Set<number>()
  for (const m of n.matchAll(/\d+(?:[.,]\d+)?/g)) salida.add(Number(m[0].replace(',', '.')))
  for (const palabra of n.split(/[^a-z]+/)) if (palabra in NUMEROS_EN_PALABRAS) salida.add(NUMEROS_EN_PALABRAS[palabra])
  return salida
}

/**
 * Reemplaza fechas y cifras con unidad que no aparecen en la entrada del auditor ni en los criterios.
 * Los porcentajes que se pueden calcular con dos cifras de la entrada (5 de 20 → 25 %) se permiten.
 */
export function quitarDatosInventados(texto: string, entrada: string, criterios: Criterio[]) {
  const fuente = normal(`${entrada} ${criterios.map((c) => c.contenido).join(' ')}`)
  const numerosEntrada = numerosDe(entrada)
  const numerosFuente = new Set([...numerosEntrada, ...numerosDe(criterios.map((c) => c.contenido).join(' '))])
  const porcentajes = new Set<number>()
  const lista = [...numerosEntrada].filter((x) => x > 0)
  for (const a of lista) for (const b of lista) if (a <= b) {
    const p = (100 * a) / b
    porcentajes.add(Math.round(p))
    porcentajes.add(Math.round(p * 10) / 10)
    porcentajes.add(Math.round(100 - p))
  }

  const reemplazos: string[] = []
  let t = texto.replace(RE_FECHA_LARGA, (m) => {
    if (fuente.includes(normal(m))) return m
    reemplazos.push(m)
    return '[fecha por confirmar]'
  })
  t = t.replace(RE_FECHA_CORTA, (m) => {
    if (fuente.includes(normal(m))) return m
    reemplazos.push(m)
    return '[fecha por confirmar]'
  })
  t = t.replace(RE_CANTIDAD, (m, numero) => {
    const valor = Number(String(numero).replace(',', '.'))
    const esPorcentaje = /%|por\s*ciento/i.test(m)
    if (numerosFuente.has(valor) || (esPorcentaje && porcentajes.has(valor))) return m
    reemplazos.push(m)
    return m.replace(numero, '[cantidad por confirmar]')
  })
  return { texto: t, reemplazos }
}

// ─── V3 · Estructura según la categoría ────────────────────────────────────

const REGLAS: Record<Clasificacion, { requiere: Array<[RegExp, string]>; prohibe: Array<[RegExp, string]> }> = {
  NO_CONFORMIDAD: {
    requiere: [[/incumpl/, 'no expresa el incumplimiento (por ejemplo, «incumpliendo lo establecido en…»)']],
    prohibe: [[/susceptible(s)? de mejora|podria(n)? mejorar/, 'usa lenguaje de oportunidad de mejora («susceptible de mejorar», «podría mejorar»)']],
  },
  OBSERVACION: {
    requiere: [[/\bpodria(n)?\b|\bpuede(n)?\b|representa(n)? un riesgo/, 'no expresa el impacto potencial con «podría», «puede» o «representa un riesgo»']],
    prohibe: [[/\bincumpliendo\b|\bincumple(n)?\b/, 'afirma un incumplimiento («incumple», «incumpliendo»), propio de una no conformidad']],
  },
  FORTALEZA: {
    requiere: [[
      /\b(permite|permiten|favorece|favorecen|contribuye|contribuyen|fortalece|fortalecen|facilita|facilitan|garantiza|asegura|promueve|aporta|genera|optimiza|permitiendo|favoreciendo|contribuyendo|fortaleciendo|facilitando|garantizando|asegurando|promoviendo)\b/,
      'no expresa el beneficio actual con un verbo en presente («permite», «favorece», «contribuye», «fortalece»)',
    ]],
    prohibe: [
      [/excelente|muy buen[oa]s?|maravillos/, 'usa expresiones subjetivas («excelente», «muy bueno», «maravilloso»)'],
      [/\b(permitira|favorecera|contribuira|facilitara|fortalecera|mejorara)n?\b/, 'expresa un beneficio futuro («permitirá»…); la fortaleza debe expresar un beneficio actual'],
    ],
  },
  OPORTUNIDAD_DE_MEJORA: {
    requiere: [
      [/susceptible(s)? de mejora|es posible/, 'no usa la fórmula «es susceptible de mejorar» (o «es posible»)'],
      [
        /\b(permitira|facilitara|contribuira|favorecera|fortalecera|mejorara|optimizara|agilizara|permitiria|facilitaria|contribuiria|favoreceria|fortaleceria)n?\b/,
        'no proyecta el beneficio futuro («permitirá», «facilitará», «contribuirá», «favorecerá»)',
      ],
    ],
    prohibe: [[/\bincumpliendo\b|\bno cumple(n)?\b|\bincumple(n)?\b/, 'afirma un incumplimiento, propio de una no conformidad']],
  },
}

/** Devuelve la lista de problemas de estructura (vacía si la redacción cumple). */
export function verificarEstructura(clasificacion: Clasificacion, texto: string, verificadas: CitaVerificada[]): string[] {
  const t = normal(texto)
  const problemas: string[] = []
  const reglas = REGLAS[clasificacion]
  if (!reglas) return [`clasificación desconocida: ${clasificacion}`]
  for (const [re, descripcion] of reglas.requiere) if (!re.test(t)) problemas.push(descripcion)
  for (const [re, descripcion] of reglas.prohibe) if (re.test(t)) problemas.push(descripcion)

  if (clasificacion === 'NO_CONFORMIDAD') {
    const citaRequisito =
      texto.includes(MARCADOR_PENDIENTE) ||
      verificadas.some((v) => (v.numeral && t.includes(normal(v.numeral))) || t.includes(normal(v.documento)))
    if (!citaRequisito) {
      problemas.push(`no identifica el requisito incumplido (un criterio verificado o, si no lo hay, exactamente «${MARCADOR_PENDIENTE}»)`)
    }
  }

  const { min, max } = LIMITES.hallazgo_corregido
  if (texto.length < min) problemas.push(`es demasiado breve (${texto.length} caracteres; mínimo ${min})`)
  if (texto.length > max) problemas.push(`es demasiado extenso (${texto.length} caracteres; máximo ${max})`)
  return problemas
}

/** «NTC-ISO 9001:2015, numeral 9.3.3 (Salidas de la revisión por la dirección)», a partir de citas verificadas. */
export function describirCitas(verificadas: CitaVerificada[]): string {
  return verificadas
    .map((v) => `${v.documento}${v.numeral ? `, numeral ${v.numeral}` : ''} (${v.titulo})`)
    .join('; ')
}

// ─── Orquestación de V1, V2, V5, V6 y V3 sobre un hallazgo ─────────────────

export interface HallazgoValidado {
  clasificacion: Clasificacion
  justificacion: string
  hallazgo_corregido: string
  criterio_requisito: string
  evidencia: string
  severidad: 'alta' | 'media' | 'baja' | null
  criterios_citados: CitaVerificada[]
  avisos: string[]
  problemas: string[]
  registro: {
    citas_descartadas: Array<CitaIA & { motivo: string }>
    referencias_eliminadas: string[]
    datos_reemplazados: string[]
    justificacion_recortada: boolean
  }
}

export function esHallazgoValido(h: unknown): h is HallazgoIA {
  const x = h as HallazgoIA
  return Boolean(x) && CLASIFICACIONES.includes(x.clasificacion) && typeof x.hallazgo_corregido === 'string'
}

/** Aplica la validación completa a un hallazgo devuelto por la IA. */
export function validarHallazgo(h: HallazgoIA, entrada: string, entregados: Criterio[]): HallazgoValidado {
  // V1
  const { verificadas, descartadas } = verificarCitas(h.criterios_citados, entregados)

  // V5 · limpieza
  let hallazgo = limpiarTexto(h.hallazgo_corregido)
  let justificacion = limpiarTexto(h.justificacion)
  let criterio = limpiarTexto(h.criterio_requisito)
  let evidencia = limpiarTexto(h.evidencia)

  // V2 · sin criterio verificado → marcador exacto; y fuera toda referencia no verificada
  const referencias: string[] = []
  if (verificadas.length === 0) {
    criterio = MARCADOR_PENDIENTE
  } else {
    const r = depurarReferencias(criterio, verificadas, entrada, entregados)
    criterio = r.texto
    referencias.push(...r.eliminadas)
    // Si tras depurar solo quedó el marcador pero hay citas verificadas, el criterio se arma con ellas
    if (criterio.includes(MARCADOR_PENDIENTE) || !criterio.trim()) criterio = describirCitas(verificadas)
  }
  for (const campo of ['hallazgo', 'justificacion', 'evidencia'] as const) {
    const valor = campo === 'hallazgo' ? hallazgo : campo === 'justificacion' ? justificacion : evidencia
    const r = depurarReferencias(valor, verificadas, entrada, entregados)
    referencias.push(...r.eliminadas)
    if (campo === 'hallazgo') hallazgo = r.texto
    else if (campo === 'justificacion') justificacion = r.texto
    else evidencia = r.texto
  }

  // V6 · fechas y cifras que no están en la entrada
  const datos: string[] = []
  for (const campo of ['hallazgo', 'evidencia'] as const) {
    const r = quitarDatosInventados(campo === 'hallazgo' ? hallazgo : evidencia, entrada, entregados)
    datos.push(...r.reemplazos)
    if (campo === 'hallazgo') hallazgo = r.texto
    else evidencia = r.texto
  }

  // V5 · longitud de la justificación
  const recortada = justificacion.length > LIMITES.justificacion.max
  if (recortada) justificacion = recortarEnOracion(justificacion, LIMITES.justificacion.max)

  const avisos: string[] = []
  // El requisito es imprescindible en una no conformidad; en las demás categorías es opcional
  if (h.clasificacion === 'NO_CONFORMIDAD' && verificadas.length === 0) avisos.push(AVISO_PENDIENTE)
  if (descartadas.length || referencias.length) {
    avisos.push('Se retiraron referencias normativas que no corresponden a los criterios cargados.')
  }
  if (datos.length) avisos.push('Se marcaron fechas o cifras que no aparecen en tu texto: complétalas o confírmalas.')

  return {
    clasificacion: h.clasificacion,
    justificacion,
    hallazgo_corregido: hallazgo,
    criterio_requisito: criterio,
    evidencia,
    severidad: h.severidad && ['alta', 'media', 'baja'].includes(h.severidad) ? h.severidad : null,
    criterios_citados: verificadas,
    avisos,
    problemas: verificarEstructura(h.clasificacion, hallazgo, verificadas), // V3
    registro: {
      citas_descartadas: descartadas,
      referencias_eliminadas: referencias,
      datos_reemplazados: datos,
      justificacion_recortada: recortada,
    },
  }
}
