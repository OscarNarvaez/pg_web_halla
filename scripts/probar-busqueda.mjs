// Prueba local de la ingesta y de la búsqueda: carga los fragmentos en PGlite y ejecuta consultas.
// Uso: pnpm probar:busqueda
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crearBaseLocal, comoUsuario, registrarUsuario } from './lib/supabase-local.mjs'
import { DOCUMENTOS, trocearArchivo } from './lib/trocear-normas.mjs'

const DIR_NORMAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'normas')

/**
 * Base local con las migraciones aplicadas, las normas cargadas y un auditor APROBADO
 * (la RLS solo deja leer las normas a cuentas aprobadas por un administrador).
 */
export async function baseConNormas() {
  const db = await crearBaseLocal({ silencioso: true })
  const auditorId = await registrarUsuario(db, 'auditor@prueba.halla.ink', {
    nombre_completo: 'Auditor de prueba', cedula: '1000000001', celular: '3000000001', cargos: ['Auditor médico'],
    equipo_auditor: [{ nombre: 'Equipo de prueba', cargos: ['Auxiliar'] }], tipo_evaluador: 'AUDITORES_INTERNOS', alcance: 'PROCESOS',
    proceso: 'Urgencias', sistema: '', acepto_tratamiento_datos: 'true',
  })
  await db.query('update public.profiles set aprobado = true where id = $1', [auditorId])
  const filas = Object.keys(DOCUMENTOS).flatMap((a) => trocearArchivo(DIR_NORMAS, a).filas)
  for (const f of filas) {
    await db.query(
      `insert into public.criterios_normativos (documento_codigo, documento_titulo, archivo, idioma, numeral, titulo, contenido, nivel, orden, parte)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [f.documento_codigo, f.documento_titulo, f.archivo, f.idioma, f.numeral, f.titulo, f.contenido, f.nivel, f.orden, f.parte],
    )
  }
  return { db, total: filas.length, usuario: { id: auditorId, rol: 'authenticated' } }
}

// Ejecutado directamente (no importado)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db, total, usuario } = await baseConNormas()
  console.log(`\n${total} fragmentos cargados en la base local\n`)
  let fallos = 0

  const casos = [
    { consulta: 'revisión por la dirección salidas', espera: ['NTC-ISO 9001:2015', '9.3.3'], top: 3, docs: null },
    { consulta: 'revision por la direccion salidas', espera: ['NTC-ISO 9001:2015', '9.3.3'], top: 3, docs: null, nota: 'sin tildes' },
    { consulta: 'control información documentada', espera: ['NTC-ISO 9001:2015', '7.5.3'], top: 5, docs: ['NTC-ISO 9001:2015'] },
    { consulta: 'auditoría interna programa', espera: ['NTC-ISO 9001:2015', '9.2'], top: 5, docs: ['NTC-ISO 9001:2015'], prefijo: true },
    { consulta: 'preparación respuesta emergencias', espera: ['ISO 45001:2018', '8.2'], top: 3, docs: ['ISO 45001:2018'] },
    { consulta: 'aspectos ambientales', espera: ['NTC-ISO 14001:2015', '6.1.2'], top: 3, docs: ['NTC-ISO 14001:2015'] },
    { consulta: 'probabilidad or impacto or riesgo or inherente', espera: ['PR13-GQ', null], top: 5, docs: ['PR13-GQ'] },
    { consulta: 'recording nonconformities', espera: ['ISO 19011', 'A.18.3'], top: 3, docs: ['ISO 19011'] },
  ]

  for (const c of casos) {
    const { rows } = await comoUsuario(db, usuario, (tx) =>
      tx.query('select documento_codigo, numeral, titulo, puntaje from public.buscar_criterios($1, $2, 8)', [c.consulta, c.docs]))
    const [doc, num] = c.espera
    const pos = rows.slice(0, c.top).findIndex((r) => r.documento_codigo === doc && (num === null || (c.prefijo ? r.numeral.startsWith(num) : r.numeral === num)))
    const ok = pos >= 0
    if (!ok) fallos++
    console.log(`${ok ? '✓' : '✗'} «${c.consulta}»${c.nota ? ` (${c.nota})` : ''} → ${doc} ${num ?? '(cualquier numeral)'} ${ok ? `en la posición ${pos + 1}` : `NO está en los ${c.top} primeros`}`)
    rows.slice(0, 3).forEach((r, i) => console.log(`     ${i + 1}. ${r.documento_codigo} · ${r.numeral} · ${r.titulo.slice(0, 60)} (${Number(r.puntaje).toFixed(3)})`))
  }
  console.log(fallos ? `\n✗ ${fallos} consulta(s) fallaron\n` : '\n✓ Búsqueda verificada\n')
  process.exit(fallos ? 1 : 0)
}
