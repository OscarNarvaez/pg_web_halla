// Trocea los documentos de normas/ y los sube a public.criterios_normativos.
//
// Uso:
//   pnpm ingest:dry                         # solo trocea e imprime el resumen
//   pnpm ingest:dry -- --json salida.json   # además guarda los fragmentos para revisarlos
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... pnpm ingest
//
// La service role key se lee del entorno y NUNCA se guarda en el repositorio.
// La subida es idempotente: upsert por (archivo, orden), así los id se conservan entre re-ingestas
// y los hallazgos que ya citan un criterio siguen apuntando al mismo registro.
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { DOCUMENTOS, trocearArchivo } from './lib/trocear-normas.mjs'

const DIR_NORMAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'normas')
const LOTE = 100
const args = process.argv.slice(2)
const seco = args.includes('--dry-run')
const rutaJson = args.includes('--json') ? args[args.indexOf('--json') + 1] : null

const resultados = Object.keys(DOCUMENTOS).map((archivo) => ({ archivo, ...trocearArchivo(DIR_NORMAS, archivo) }))

console.log('\nResumen del troceado')
console.log('─'.repeat(86))
console.log('Documento'.padEnd(22), 'Idioma', 'Filas'.padStart(6), 'Numerales'.padStart(10), 'Partidos'.padStart(9), 'Descartados'.padStart(12), 'Máx. car.'.padStart(10))
for (const r of resultados) {
  const meta = DOCUMENTOS[r.archivo]
  const numerales = new Set(r.filas.map((f) => f.numeral)).size
  const partidos = new Set(r.filas.filter((f) => f.parte > 1).map((f) => f.numeral)).size
  const max = Math.max(...r.filas.map((f) => f.contenido.length))
  console.log(meta.codigo.padEnd(22), meta.idioma.padEnd(6), String(r.filas.length).padStart(6), String(numerales).padStart(10),
    String(partidos).padStart(9), String(r.descartados).padStart(12), String(max).padStart(10))
}
const total = resultados.reduce((s, r) => s + r.filas.length, 0)
console.log('─'.repeat(86))
console.log(`Total: ${total} fragmentos. «Descartados» = encabezados de capítulo sin texto propio.\n`)

if (rutaJson) {
  writeFileSync(rutaJson, JSON.stringify(resultados.flatMap((r) => r.filas), null, 2))
  console.log(`Fragmentos guardados en ${rutaJson}\n`)
}
if (seco) process.exit(0)

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (usa --dry-run para solo trocear).')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

for (const { archivo, filas } of resultados) {
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await supabase
      .from('criterios_normativos')
      .upsert(filas.slice(i, i + LOTE), { onConflict: 'archivo,orden' })
    if (error) {
      console.error(`✗ ${archivo}, lote ${i / LOTE + 1}: ${error.message}`)
      process.exit(1)
    }
  }
  // Si el troceador cambió y ahora hay menos fragmentos, se borran los sobrantes
  const { error: errBorrado, count } = await supabase
    .from('criterios_normativos')
    .delete({ count: 'exact' })
    .eq('archivo', archivo)
    .gte('orden', filas.length)
  if (errBorrado) console.error(`  aviso: no se pudieron borrar fragmentos sobrantes de ${archivo}: ${errBorrado.message}`)
  console.log(`✓ ${DOCUMENTOS[archivo].codigo}: ${filas.length} fragmentos subidos${count ? `, ${count} sobrantes borrados` : ''}`)
}

// Criterio de aceptación de la fase
const { data, error } = await supabase.rpc('buscar_criterios', { consulta: 'revisión por la dirección salidas', limite: 5 })
if (error) {
  console.error(`\n✗ La consulta de prueba falló: ${error.message}`)
  process.exit(1)
}
console.log('\nConsulta de prueba: «revisión por la dirección salidas»')
data.forEach((c, i) => console.log(`  ${i + 1}. ${c.documento_codigo} · ${c.numeral} · ${c.titulo} (${c.puntaje.toFixed(3)})`))
const ok = data.slice(0, 3).some((c) => c.documento_codigo === 'NTC-ISO 9001:2015' && c.numeral === '9.3.3')
console.log(ok ? '\n✓ 9.3.3 de ISO 9001 aparece entre los primeros resultados\n' : '\n✗ 9.3.3 de ISO 9001 NO aparece entre los tres primeros\n')
process.exit(ok ? 0 : 1)
