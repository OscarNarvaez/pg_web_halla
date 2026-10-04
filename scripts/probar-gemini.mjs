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
    return siguiente ? siguiente() : error(500, 'sin guion')
  }
  return { fetchImpl, llamadas }
}
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

console.log('\n▸ Todos sin cuota')
s = simular({ i1: [cuotaDiaria], i2: [cuotaDiaria] })
e = await llamarGemini(base(['i1', 'i2'], s.fetchImpl), pet).catch((x) => x)
ok(e.codigo === 'cuota_diaria' && e.estado === 429, 'error de cuota diaria cuando todos los modelos la agotaron')
ok(/cuota diaria/.test(mensajeErrorGemini(e).mensaje) && /no se perdió/.test(mensajeErrorGemini(e).mensaje), 'mensaje claro en español para el auditor', mensajeErrorGemini(e).mensaje)

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Cascada y reintentos verificados\n')
process.exit(fallos ? 1 : 0)
