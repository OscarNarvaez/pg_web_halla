// Ejecuta los 7 casos obligatorios del §14 contra el motor REAL: recuperación sobre las normas
// cargadas en PGlite + llamada real a Gemini + validación. Usa los mismos módulos que la Edge Function.
//
// Uso: pnpm probar:motor [-- --md salida.json] [-- --casos 1,5,7]
// Lee GEMINI_API_KEY del entorno o de supabase/functions/.env (gitignored).
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { baseConNormas } from './probar-busqueda.mjs'
import { comoUsuario } from './lib/supabase-local.mjs'
import { leerConfig } from '../supabase/functions/_shared/config.ts'
import { llamarGemini } from '../supabase/functions/_shared/gemini.ts'
import { PROMPT_SISTEMA_EXPERTO } from '../supabase/functions/_shared/prompt-sistema-experto.ts'
import { ESQUEMA_SALIDA } from '../supabase/functions/_shared/esquema-salida.ts'
import { recuperarCriterios } from '../supabase/functions/_shared/recuperar-criterios.ts'
import { clasificarHallazgo } from '../supabase/functions/_shared/motor.ts'
import { MARCADOR_PENDIENTE } from '../supabase/functions/_shared/catalogos.ts'

const archivoEnv = new URL('../supabase/functions/.env', import.meta.url)
const envLocal = existsSync(archivoEnv)
  ? Object.fromEntries(readFileSync(archivoEnv, 'utf8').split('\n').filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
  : {}
const config = leerConfig((k) => process.env[k] ?? envLocal[k])
if (!config.geminiApiKey) {
  console.error('Falta GEMINI_API_KEY (en el entorno o en supabase/functions/.env).')
  process.exit(2)
}

export const CASOS = [
  { n: 1, entrada: 'Se revisaron 20 historias clínicas y en 5 de ellas no se encontró registrada la valoración de enfermería requerida.', espera: ['NO_CONFORMIDAD'], proceso: 'Hospitalización' },
  { n: 2, entrada: 'El equipo realiza seguimiento mensual a los indicadores y utiliza los resultados para definir acciones.', espera: ['FORTALEZA'], proceso: 'Gestión de calidad' },
  { n: 3, entrada: 'Los registros están completos, pero algunas firmas son poco legibles.', espera: ['OBSERVACION'], proceso: 'Consulta externa' },
  { n: 4, entrada: 'El registro de asistencia actualmente se realiza correctamente en formato físico.', espera: ['OPORTUNIDAD_DE_MEJORA'], proceso: 'Gestión humana' },
  { n: 5, entrada: 'En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora.', espera: ['NO_CONFORMIDAD'], proceso: 'Gestión gerencial', citaEsperada: ['NTC-ISO 9001:2015', '9.3.3'] },
  { n: 6, entrada: 'El parqueadero de visitantes es pequeño y se llena los viernes.', espera: ['*'], proceso: 'Gestión de recursos físicos', sinNumeral: true },
  { n: 7, entrada: 'Se evidenció extintor vencido en el área de urgencias y además el personal muestra un excelente dominio del protocolo de código azul.', espera: ['NO_CONFORMIDAD', 'FORTALEZA'], proceso: 'Urgencias' },
]

const args = process.argv.slice(2)
const soloCasos = args.includes('--casos') ? args[args.indexOf('--casos') + 1].split(',').map(Number) : null
const rutaMd = args.includes('--md') ? args[args.indexOf('--md') + 1] : null
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const { db, usuario } = await baseConNormas()
const buscar = async (consulta, documentos, limite) => {
  const { rows } = await comoUsuario(db, usuario, (tx) => tx.query('select * from public.buscar_criterios($1, $2, $3)', [consulta, documentos, limite]))
  return rows.map((r) => ({ ...r, puntaje: Number(r.puntaje) }))
}

console.log(`\nModelos: ${config.geminiModelos.join(' → ')}\nRazonamiento: ${config.geminiNivelRazonamiento ?? 'por defecto'} · máx. tokens: ${config.geminiMaxTokens}\n`)
const resultados = []
let fallos = 0

for (const caso of CASOS.filter((c) => !soloCasos || soloCasos.includes(c.n))) {
  const t0 = Date.now()
  const { criterios, consulta, filtrado } = await recuperarCriterios(buscar, { entrada: caso.entrada, alcance: 'PROCESOS', proceso: caso.proceso })
  const llamar = (mensaje) => llamarGemini(
    { apiKey: config.geminiApiKey, modelos: config.geminiModelos, maxTokens: config.geminiMaxTokens, nivelRazonamiento: config.geminiNivelRazonamiento },
    { sistema: PROMPT_SISTEMA_EXPERTO, mensaje, esquema: ESQUEMA_SALIDA },
  )
  let r
  try {
    r = await clasificarHallazgo({
      entrada: caso.entrada,
      contexto: { alcance: 'PROCESOS', proceso: caso.proceso, codigo: 'AI-2026-001', titulo: 'Auditoría interna de prueba', fecha: '2026-10-03' },
      criterios,
      llamar,
    })
  } catch (e) {
    console.log(`✗ Caso ${caso.n}: error — ${e.message}`)
    resultados.push({ caso, error: e.message })
    fallos++
    continue
  }
  const clases = r.hallazgos.map((h) => h.clasificacion)
  const verificaciones = []
  const okClase = caso.espera[0] === '*' || (clases.length === caso.espera.length && caso.espera.every((c) => clases.includes(c)))
  verificaciones.push([okClase, `clasificación esperada ${caso.espera.join(' + ')} → obtenida ${clases.join(' + ')}`])
  if (caso.citaEsperada) {
    const [doc, num] = caso.citaEsperada
    verificaciones.push([r.hallazgos.some((h) => h.criterios_citados.some((c) => c.documento === doc && c.numeral === num)), `cita verificada ${doc} ${num}`])
  }
  if (caso.sinNumeral) {
    verificaciones.push([r.hallazgos.every((h) => h.criterio_requisito === MARCADOR_PENDIENTE || h.criterios_citados.length > 0), 'sin numeral inventado: marcador pendiente o cita verificada'])
    verificaciones.push([r.hallazgos.every((h) => !/\b\d+\.\d+/.test(h.hallazgo_corregido) || h.criterios_citados.length > 0), 'el hallazgo corregido no menciona numerales sin verificar'])
  }
  verificaciones.push([r.hallazgos.every((h) => h.problemas.length === 0), 'estructura de redacción verificada (V3) en todos los hallazgos'])
  const riesgoCompleto = (x) => x && x.descripcion && x.dimension && x.probabilidad && x.impacto
  verificaciones.push([r.hallazgos.every((h) => (h.clasificacion === 'FORTALEZA'
    ? h.riesgo === null && h.controles.length === 0
    : riesgoCompleto(h.riesgo) && h.controles.length >= 1)), 'riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)'])
  const okCaso = verificaciones.every(([v]) => v)
  if (!okCaso) fallos++

  console.log(`${okCaso ? '✓' : '✗'} Caso ${caso.n} · ${((Date.now() - t0) / 1000).toFixed(1)} s · ${criterios.length} criterios recuperados${filtrado ? '' : ' (sin filtro de alcance)'} · ${r.llamadas.length} llamada(s)${r.reparado ? ' (con reparación V4)' : ''} · modelo ${r.llamadas.map((l) => l.modelo).join(' + ')}${r.llamadas[0].descartados.length ? ` (descartados: ${r.llamadas[0].descartados.map((d) => `${d.modelo}: ${d.motivo}`).join(', ')})` : ''}`)
  for (const [v, d] of verificaciones) console.log(`    ${v ? '✓' : '✗'} ${d}`)
  for (const h of r.hallazgos) {
    console.log(`    ─ ${h.clasificacion} · severidad ${h.severidad ?? '—'}`)
    console.log(`      Hallazgo: ${h.hallazgo_corregido}`)
    console.log(`      Criterio: ${h.criterio_requisito}`)
    if (h.criterios_citados.length) console.log(`      Citas verificadas: ${h.criterios_citados.map((c) => `${c.documento} ${c.numeral ?? 's/n'}`).join(', ')}`)
    if (h.registro.citas_descartadas.length) console.log(`      Citas descartadas por V1: ${h.registro.citas_descartadas.map((c) => `${c.documento} ${c.numeral} (${c.motivo})`).join('; ')}`)
    if (h.registro.referencias_eliminadas.length) console.log(`      Referencias retiradas por V2: ${h.registro.referencias_eliminadas.join('; ')}`)
    if (h.registro.datos_reemplazados.length) console.log(`      Datos reemplazados por V6: ${h.registro.datos_reemplazados.join('; ')}`)
    if (h.riesgo) console.log(`      Riesgo: ${h.riesgo.descripcion} · ${h.riesgo.dimension} · P${h.riesgo.probabilidad} × I${h.riesgo.impacto}\n        ${h.riesgo.justificacion}`)
    for (const c of h.controles) console.log(`      Control ${c.tipo.toLowerCase()}: ${c.descripcion}${c.criterio_id ? ' (con criterio)' : ''}`)
    if (h.avisos.length) console.log(`      Avisos: ${h.avisos.join(' | ')}`)
  }
  console.log()
  resultados.push({ caso, consulta, criterios: criterios.map((c) => `${c.documento_codigo} ${c.numeral ?? 's/n'}`), resultado: r, verificaciones, ok: okCaso, segundos: (Date.now() - t0) / 1000 })
  await dormir(4000) // margen para el límite de solicitudes por minuto del nivel gratuito
}

if (rutaMd) {
  writeFileSync(rutaMd, JSON.stringify({ modelos: config.geminiModelos, fecha: new Date().toISOString(), resultados }, null, 2))
  console.log(`Resultados guardados en ${rutaMd}`)
}
console.log(fallos ? `✗ ${fallos} caso(s) con fallas\n` : '✓ Los casos pasaron\n')
process.exit(fallos ? 1 : 0)
