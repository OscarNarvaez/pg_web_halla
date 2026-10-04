// Anonimización del texto que se envía a la IA (hallazgo S1 de docs/SEGURIDAD.md).
//
// El texto original del auditor se guarda completo en la base de datos propia (trazabilidad), pero
// a Gemini solo llega esta versión: sin correos, teléfonos, números de documento o de historia
// clínica, ni nombres de personas que sigan a palabras como «paciente», «señora» o «Dr.».
// Los términos del nivel gratuito de Gemini piden expresamente no enviar datos personales.
//
// Es una defensa en profundidad, no una garantía: un nombre propio sin palabra que lo anteceda no se
// detecta. Por eso la interfaz también pide no escribir datos de pacientes.

export interface ResultadoAnonimizacion {
  texto: string
  retirados: { correos: number; telefonos: number; identificaciones: number; numeros: number; nombres: number }
}

const NOMBRE_RETIRADO = '[nombre retirado]'

// Palabras tras las cuales lo que sigue en mayúscula inicial es el nombre de una persona
const ROLES = new Set([
  'paciente', 'pacientes', 'usuario', 'usuaria', 'usuarios', 'usuarias', 'señor', 'señora', 'señorita', 'sr', 'sr.', 'sra', 'sra.', 'srta', 'srta.',
  'don', 'doña', 'niño', 'niña', 'menor', 'lactante', 'neonato', 'neonata', 'madre', 'padre', 'acudiente', 'familiar', 'cuidador', 'cuidadora',
  'doctor', 'doctora', 'dr', 'dr.', 'dra', 'dra.', 'enfermero', 'enfermera', 'enfermería', 'enfermeria', 'jefe', 'médico', 'médica', 'medico', 'medica',
  'auxiliar', 'funcionario', 'funcionaria', 'trabajador', 'trabajadora', 'colaborador', 'colaboradora', 'terapeuta', 'nutricionista', 'bacteriólogo',
  'bacterióloga', 'regente', 'coordinador', 'coordinadora', 'llamado', 'llamada', 'nombre', 'nombrado', 'nombrada', 'identificado', 'identificada',
])

// Palabras en mayúscula que NO son nombres de personas (servicios, procesos, normas, la institución)
const NO_NOMBRES = new Set([
  'urgencias', 'hospitalización', 'hospitalizacion', 'enfermería', 'enfermeria', 'cirugía', 'cirugia', 'consulta', 'externa', 'calidad', 'gestión',
  'gestion', 'nutrición', 'nutricion', 'terapias', 'terapia', 'pediatría', 'pediatria', 'uci', 'ucin', 'laboratorio', 'farmacia', 'imágenes',
  'imagenes', 'sistema', 'sistemas', 'hospital', 'infantil', 'los', 'ángeles', 'angeles', 'proceso', 'servicio', 'área', 'area', 'comité', 'comite',
  'ntc', 'iso', 'pr13', 'sst', 'sgc', 'hila', 'almera', 'código', 'codigo', 'azul', 'rojo', 'humana', 'financiera', 'información', 'informacion',
  'infecciones', 'esterilización', 'esterilizacion', 'admisiones', 'facturación', 'facturacion', 'archivo', 'central', 'triage', 'salud', 'trabajo',
  'pasto', 'nariño', 'colombia', 'resolución', 'resolucion', 'decreto', 'ley', 'manual', 'protocolo', 'guía', 'guia', 'procedimiento', 'formato',
])

const RE_CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Etiqueta de documento o historia clínica seguida del número
const RE_IDENTIFICACION =
  /\b(historias?\s+cl[ií]nicas?|h\.\s?c\.?|hc|c[ée]dula(?:\s+de\s+ciudadan[ií]a)?|c\.\s?c\.?|cc|tarjeta\s+de\s+identidad|t\.\s?i\.?|registro\s+civil|nuip|documento(?:\s+de\s+identidad)?|identificaci[oó]n|pasaporte|carn[ée]t?)(\s*(?:n[°ºo.]\s*|no\.?\s*|n[uú]mero\s*|#\s*|:\s*)?)([A-Z]{0,3}[-\s]?\d[\d.\s-]{3,}\d)/giu
const RE_CELULAR = /(?<![\d$])(?:\+?57[\s-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g
const RE_FIJO = /(?<![\d$])\(?60\d\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g
// Números de 6 o más cifras (con o sin puntos de miles) que no sean dinero
const RE_NUMERO_LARGO = /(?<![\d.,$])(?<!\$\s)(\d{1,3}(?:\.\d{3}){2,}|\d{6,12})(?![\d.,]*\d)(?!\s*(?:pesos|cop|millones|\$))/gi
// Rol seguido de un nombre en mayúscula inicial. El nombre va en un lookahead para no consumirlo:
// así en «La Auxiliar Ana Gómez» también se evalúa el par «Auxiliar → Ana Gómez».
const RE_ROL_NOMBRE =
  /(?<![\p{L}])([\p{L}]+\.?)(\s+(?:de\s+nombre\s+)?)(?=(\p{Lu}\p{Ll}+(?:\s+(?:de\s+(?:la\s+|los\s+)?)?\p{Lu}\p{Ll}+){0,3}))/gu

function retirarNombres(texto: string): { texto: string; cantidad: number } {
  const tramos: Array<[number, number]> = []
  for (const m of texto.matchAll(RE_ROL_NOMBRE)) {
    if (!ROLES.has(m[1].toLowerCase())) continue
    // El nombre termina antes de la primera palabra que es un servicio o proceso («Ana Gómez Urgencias»)
    let nombre = ''
    for (const parte of m[3].split(/(\s+)/)) {
      if (/^\p{Lu}/u.test(parte) && NO_NOMBRES.has(parte.toLowerCase())) break
      nombre += parte
    }
    nombre = nombre.replace(/\s+(?:de|la|los)?\s*$/i, '').trim()
    if (!nombre) continue
    const inicio = (m.index ?? 0) + m[1].length + m[2].length
    tramos.push([inicio, inicio + nombre.length])
  }
  // Se aplican de atrás hacia adelante, sin solapes
  let resultado = texto
  let limite = Infinity
  let cantidad = 0
  for (const [inicio, fin] of tramos.sort((a, b) => b[0] - a[0])) {
    if (fin > limite) continue
    resultado = resultado.slice(0, inicio) + NOMBRE_RETIRADO + resultado.slice(fin)
    limite = inicio
    cantidad++
  }
  return { texto: resultado, cantidad }
}

export function anonimizar(entrada: string | null | undefined): ResultadoAnonimizacion {
  const retirados = { correos: 0, telefonos: 0, identificaciones: 0, numeros: 0, nombres: 0 }
  let t = String(entrada ?? '')

  t = t.replace(RE_CORREO, () => {
    retirados.correos++
    return '[correo retirado]'
  })
  t = t.replace(RE_IDENTIFICACION, (_m, etiqueta: string, separador: string) => {
    retirados.identificaciones++
    return `${etiqueta}${separador || ' '}[número retirado]`
  })
  t = t.replace(RE_CELULAR, () => {
    retirados.telefonos++
    return '[teléfono retirado]'
  })
  t = t.replace(RE_FIJO, () => {
    retirados.telefonos++
    return '[teléfono retirado]'
  })
  t = t.replace(RE_NUMERO_LARGO, () => {
    retirados.numeros++
    return '[número retirado]'
  })
  const nombres = retirarNombres(t)
  t = nombres.texto
  retirados.nombres = nombres.cantidad
  return { texto: t, retirados }
}

export function totalRetirados(r: ResultadoAnonimizacion['retirados']): number {
  return r.correos + r.telefonos + r.identificaciones + r.numeros + r.nombres
}
