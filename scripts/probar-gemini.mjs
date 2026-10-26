// Pruebas de la cascada de modelos y los reintentos de gemini.ts con un fetch simulado (sin red).
// Uso: pnpm probar:gemini
import { llamarGemini, mensajeErrorGemini } from '../supabase/functions/_shared/gemini.ts'

let fallos = 0
const ok = (c, d, det = '') => {
  console.log(`  ${c ? '✓' : '✗'} ${d}${!c && det ? `\n      → ${det}` : ''}`)
  if (!c) fallos++
}

const respuestaOk = (json, modelo) => new Response(JSON.stringify({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(json), thoughtSignature: 'xyz' }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }, modelVersion: modelo,
}), { status: 200 })
const error = (estado, mensaje, detalles = []) => new Response(JSON.stringify({ error: { code: estado, message: mensaje, details: detalles } }), { status: estado })
const cuotaDiaria = () => error(429, 'You exceeded your current quota', [
  { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] },
  { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '70001s' },
])

/** fetch simulado: cada modelo responde según su guion (una respuesta por intento). */
function simular(guiones) {
  const llamadas = []
  const fetchImpl = async (url, init) => {
    const modelo = decodeURIComponent(url.match(/models\/([^:]+):/)[1])
    llamadas.push({ modelo, cuerpo: JSON.parse(init.body) })
    const guion = guiones[modelo] ?? []
    const siguiente = guion.shift()
    return siguiente ? siguiente(init) : error(500, 'sin guion')
  }
  return { fetchImpl, llamadas }
}
// Un modelo que no responde: la petición solo termina cuando se cancela (como fetch con AbortSignal)
const colgado = (init) => new Promise((_, rechazar) => init.signal?.addEventListener('abort', () => rechazar(new DOMException('cancelada', 'AbortError'))))
// Un modelo que responde tras `ms` (o se cancela antes, si otro modelo ya respondió)
const demorado = (ms, respuesta) => (init) => new Promise((listo, rechazar) => {
  const t = setTimeout(() => listo(respuesta()), ms)
  init.signal?.addEventListener('abort', () => {
    clearTimeout(t)
    rechazar(new DOMException('cancelada', 'AbortError'))
  })
})
const base = (modelos, fetchImpl) => ({ apiKey: 'k', modelos, maxTokens: 100, nivelRazonamiento: 'low', esperas: [0, 0, 0], fetchImpl })
const pet = { sistema: 's', mensaje: 'm', esquema: {} }

console.log('\n▸ Respuesta normal')
let s = simular({ a1: [() => respuestaOk({ hallazgos: [] }, 'a1-v')] })
let r = await llamarGemini(base(['a1'], s.fetchImpl), pet)
ok(r.modelo === 'a1' && r.modeloVersion === 'a1-v' && Array.isArray(r.json.hallazgos), 'toma la parte con texto aunque traiga thoughtSignature')
ok(s.llamadas[0].cuerpo.generationConfig.thinkingConfig?.thinkingLevel === 'low', 'envía thinkingLevel low')
ok(s.llamadas[0].cuerpo.generationConfig.responseMimeType === 'application/json', 'pide salida JSON con esquema')

console.log('\n▸ Cascada')
s = simular({ b1: [cuotaDiaria], b2: [() => respuestaOk({ x: 1 }, 'b2')] })
r = await llamarGemini(base(['b1', 'b2'], s.fetchImpl), pet)
ok(r.modelo === 'b2' && s.llamadas.filter((l) => l.modelo === 'b1').length === 1, 'cuota diaria agotada: no reintenta ese modelo y pasa al respaldo')
ok(r.descartados[0]?.motivo === 'cuota diaria agotada', 'registra por qué descartó el modelo')
s = simular({ b1: [() => respuestaOk({ x: 2 }, 'b1')], b2: [() => respuestaOk({ x: 3 }, 'b2')] })
r = await llamarGemini(base(['b1', 'b2'], s.fetchImpl), pet)
ok(r.modelo === 'b2' && s.llamadas.length === 1, 'recuerda el modelo sin cuota y lo deja al final en la siguiente llamada')
s = simular({ c1: [() => error(404, 'no longer available')], c2: [() => respuestaOk({ x: 1 }, 'c2')] })
r = await llamarGemini(base(['c1', 'c2'], s.fetchImpl), pet)
ok(r.modelo === 'c2', 'modelo retirado (404): pasa al respaldo')
s = simular({ d1: [() => error(503, 'high demand'), () => error(503, 'high demand')], d2: [() => respuestaOk({ x: 1 }, 'd2')] })
r = await llamarGemini(base(['d1', 'd2'], s.fetchImpl), pet)
ok(r.modelo === 'd2' && s.llamadas.filter((l) => l.modelo === 'd1').length === 2, '503 con respaldo: un reintento y luego el siguiente modelo')

console.log('\n▸ Reintentos sin respaldo (1 s, 4 s, 10 s según el prompt maestro)')
s = simular({ e1: [() => error(503, 'x'), () => error(429, 'per minute'), () => error(500, 'x'), () => respuestaOk({ x: 1 }, 'e1')] })
r = await llamarGemini(base(['e1'], s.fetchImpl), pet)
ok(r.modelo === 'e1' && r.intentos === 4, 'hasta 3 reintentos ante 429 por minuto y 5xx')
s = simular({ f1: [() => error(400, 'Invalid JSON schema')] })
let e = await llamarGemini(base(['f1', 'f2'], s.fetchImpl), pet).catch((x) => x)
ok(e.estado === 400 && s.llamadas.length === 1, '400: no reintenta ni usa respaldo (el mismo error se repetiría)')
s = simular({ g1: [() => error(400, 'thinking_level is not supported'), () => respuestaOk({ x: 1 }, 'g1')] })
r = await llamarGemini(base(['g1'], s.fetchImpl), pet)
ok(r.modelo === 'g1' && !s.llamadas[1].cuerpo.generationConfig.thinkingConfig, 'si el modelo no acepta thinkingConfig, repite sin él')
s = simular({ h1: [() => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }), { status: 200 }), () => respuestaOk({ x: 1 }, 'h1')] })
r = await llamarGemini(base(['h1'], s.fetchImpl), pet)
ok(r.modelo === 'h1' && r.intentos === 2, 'respuesta cortada por MAX_TOKENS: reintenta')

console.log('\n▸ Tiempo por intento y presupuesto (la respuesta debe llegar al navegador antes de ~100 s)')
let t0 = Date.now()
s = simular({ j1: [colgado], j2: [() => respuestaOk({ x: 1 }, 'j2')] })
r = await llamarGemini({ ...base(['j1', 'j2'], s.fetchImpl), tiempoPorIntentoMs: 50, presupuestoMs: 2000 }, pet)
ok(r.modelo === 'j2' && r.descartados.some((d) => d.modelo === 'j1' && d.motivo === 'tiempo agotado') && s.llamadas.filter((l) => l.modelo === 'j1').length === 1 && Date.now() - t0 < 1000,
  'un modelo que no responde se corta a su tiempo por intento y pasa al respaldo, sin reintentarlo', `${Date.now() - t0} ms`)
t0 = Date.now()
s = simular({ k1: [colgado] })
e = await llamarGemini({ ...base(['k1'], s.fetchImpl), tiempoPorIntentoMs: 5000, presupuestoMs: 150 }, pet).catch((x) => x)
ok(e.codigo === 'tiempo_agotado' && e.estado === 504 && Date.now() - t0 < 1000,
  'ninguna petición pasa del presupuesto total, aunque su tiempo por intento sea mayor', `${e.codigo} en ${Date.now() - t0} ms`)
t0 = Date.now()
s = simular({ l1: [() => error(503, 'x'), () => error(503, 'x')] })
e = await llamarGemini({ ...base(['l1'], s.fetchImpl), esperas: [5000, 5000, 5000], presupuestoMs: 200 }, pet).catch((x) => x)
ok(e.estado === 503 && Date.now() - t0 < 1000, 'las esperas entre reintentos tampoco pasan del presupuesto', `${e.estado} en ${Date.now() - t0} ms`)

console.log('\n▸ Respaldo en paralelo (25/10/2026: los modelos más nuevos se quedaban colgados y la cascada no llegaba a los que respondían)')
t0 = Date.now()
s = simular({ n1: [colgado], n2: [colgado], n3: [colgado], n4: [demorado(20, () => respuestaOk({ x: 1 }, 'n4'))] })
r = await llamarGemini({ ...base(['n1', 'n2', 'n3', 'n4'], s.fetchImpl), esperaRespaldoMs: 40, tiempoPorIntentoMs: 5000, presupuestoMs: 2000 }, pet)
ok(r.modelo === 'n4' && Date.now() - t0 < 600 && ['n1', 'n2', 'n3'].every((m) => r.descartados.some((d) => d.modelo === m && d.motivo === 'lento')),
  'con tres modelos colgados, el cuarto arranca en paralelo y responde (los colgados se cancelan y quedan para después)', `${r.modelo} en ${Date.now() - t0} ms · ${JSON.stringify(r.descartados)}`)
s = simular({ o1: [demorado(30, () => respuestaOk({ x: 1 }, 'o1'))], o2: [() => respuestaOk({ x: 2 }, 'o2')] })
r = await llamarGemini({ ...base(['o1', 'o2'], s.fetchImpl), esperaRespaldoMs: 1000 }, pet)
ok(r.modelo === 'o1' && !s.llamadas.some((l) => l.modelo === 'o2'), 'si el modelo principal responde a tiempo, el respaldo ni siquiera arranca (no gasta cuota)')
s = simular({ p1: [demorado(200, () => respuestaOk({ x: 1 }, 'p1'))], p2: [colgado] })
r = await llamarGemini({ ...base(['p1', 'p2'], s.fetchImpl), esperaRespaldoMs: 40 }, pet)
ok(r.modelo === 'p1' && r.descartados.some((d) => d.modelo === 'p2' && d.motivo === 'lento'),
  'si el principal termina primero aunque el respaldo ya haya arrancado, gana el principal y el respaldo se cancela')
s = simular({ q1: [colgado], q2: [() => error(400, 'Invalid JSON schema')] })
e = await llamarGemini({ ...base(['q1', 'q2'], s.fetchImpl), esperaRespaldoMs: 30, presupuestoMs: 2000 }, pet).catch((x) => x)
ok(e.estado === 400, 'un 400 (el mismo error se repetiría en cualquier modelo) termina la llamada aunque otro modelo siga en curso')

console.log('\n▸ Todos sin cuota')
s = simular({ i1: [cuotaDiaria], i2: [cuotaDiaria] })
e = await llamarGemini(base(['i1', 'i2'], s.fetchImpl), pet).catch((x) => x)
ok(e.codigo === 'cuota_diaria' && e.estado === 429, 'error de cuota diaria cuando todos los modelos la agotaron')
ok(/cuota diaria/.test(mensajeErrorGemini(e).mensaje) && /no se perdió/.test(mensajeErrorGemini(e).mensaje), 'mensaje claro en español para el auditor', mensajeErrorGemini(e).mensaje)

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Cascada y reintentos verificados\n')
process.exit(fallos ? 1 : 0)
