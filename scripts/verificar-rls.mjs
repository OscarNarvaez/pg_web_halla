// Verificación de RLS contra el proyecto Supabase REAL, con dos usuarios de prueba.
// Confirma que el usuario A no puede leer ni modificar lo del usuario B, y que nadie se asciende a admin.
//
// Uso (las claves solo en la terminal, nunca en el repo):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_ANON_KEY=eyJ... \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   pnpm verificar-rls
//
// La prueba equivalente sin proyecto en la nube es `pnpm probar:bd` (PGlite).
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(2)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const sello = Date.now().toString().slice(-6)
const clave = `Prueba-RLS-${sello}!`
let fallos = 0
const creados = []

function ok(condicion, descripcion, detalle = '') {
  console.log(`  ${condicion ? '✓' : '✗'} ${descripcion}${!condicion && detalle ? `\n      → ${detalle}` : ''}`)
  if (!condicion) fallos++
}

async function crearUsuario(letra, cedula) {
  const email = `rls-${letra}-${sello}@prueba.halla.ink`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true,
    user_metadata: {
      nombre_completo: `Usuario ${letra.toUpperCase()} de prueba`,
      cedula,
      celular: '3001234567',
      cargo: 'Auditor de prueba',
      equipo_auditor_nombre: 'Acompañante de prueba',
      equipo_auditor_cargo: 'Profesional',
      alcance: 'PROCESOS',
      proceso: 'Urgencias',
      sistema: '',
    },
  })
  if (error) throw new Error(`No se pudo crear el usuario ${letra}: ${error.message}`)
  creados.push(data.user.id)
  const cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error: errLogin } = await cliente.auth.signInWithPassword({ email, password: clave })
  if (errLogin) throw new Error(`No se pudo iniciar sesión como ${letra}: ${errLogin.message}`)
  return { id: data.user.id, cliente }
}

try {
  console.log('\n▸ Preparando dos usuarios de prueba')
  const A = await crearUsuario('a', `9${sello}01`)
  const B = await crearUsuario('b', `9${sello}02`)

  const { data: perfilA } = await A.cliente.from('profiles').select('*').eq('id', A.id).single()
  ok(perfilA?.nombre_completo && perfilA?.rol === 'auditor', 'el trigger creó el perfil con rol auditor')

  const { data: audB, error: errAud } = await B.cliente
    .from('auditorias')
    .insert({ user_id: B.id, codigo: `RLS-${sello}`, titulo: 'Auditoría de prueba RLS', alcance: 'PROCESOS', proceso: 'Urgencias' })
    .select()
    .single()
  ok(!errAud, 'B crea su auditoría', errAud?.message)

  // Hallazgo de B, insertado como lo haría la Edge Function
  const { data: hallB, error: errHall } = await admin
    .from('hallazgos')
    .insert({
      auditoria_id: audB.id, user_id: B.id, entrada_auditor: 'Prueba RLS', clasificacion: 'OBSERVACION',
      justificacion: 'j', hallazgo_corregido: 'h', criterio_requisito: 'c', evidencia: 'e',
      modelo_ia: 'prueba', prompt_version: '0', respuesta_cruda: {},
    })
    .select()
    .single()
  ok(!errHall, 'service_role inserta un hallazgo para B', errHall?.message)

  console.log('\n▸ A intenta acceder a lo de B')
  const { data: leeAud } = await A.cliente.from('auditorias').select('id').eq('id', audB.id)
  ok(leeAud?.length === 0, 'A no lee la auditoría de B')
  const { data: leeHall } = await A.cliente.from('hallazgos').select('id').eq('id', hallB.id)
  ok(leeHall?.length === 0, 'A no lee los hallazgos de B')
  const { data: leePerfil } = await A.cliente.from('profiles').select('id').eq('id', B.id)
  ok(leePerfil?.length === 0, 'A no lee el perfil de B')

  const { data: modHall } = await A.cliente.from('hallazgos').update({ justificacion: 'manipulado' }).eq('id', hallB.id).select()
  ok(!modHall?.length, 'A no modifica los hallazgos de B')
  const { data: modAud } = await A.cliente.from('auditorias').update({ titulo: 'manipulado' }).eq('id', audB.id).select()
  ok(!modAud?.length, 'A no modifica la auditoría de B')
  const { data: borra } = await A.cliente.from('hallazgos').delete().eq('id', hallB.id).select()
  ok(!borra?.length, 'A no borra los hallazgos de B')
  const { error: errIns } = await A.cliente.from('hallazgos').insert({
    auditoria_id: audB.id, user_id: A.id, entrada_auditor: 'x', clasificacion: 'FORTALEZA',
    justificacion: 'j', hallazgo_corregido: 'h', criterio_requisito: 'c', evidencia: 'e',
  })
  ok(Boolean(errIns), 'A no inserta hallazgos en la auditoría de B')
  const { error: errInf } = await A.cliente.from('informes').insert({ auditoria_id: audB.id, user_id: A.id })
  ok(Boolean(errInf), 'A no crea informes de la auditoría de B')

  console.log('\n▸ Escalada de privilegios y trazabilidad')
  const { error: errRol } = await A.cliente.from('profiles').update({ rol: 'admin' }).eq('id', A.id)
  const { data: rolA } = await admin.from('profiles').select('rol').eq('id', A.id).single()
  ok(Boolean(errRol) && rolA.rol === 'auditor', 'A no puede cambiar su propio rol a admin', errRol ? '' : 'el UPDATE no devolvió error')
  const { error: errEntrada } = await B.cliente.from('hallazgos').update({ entrada_auditor: 'reescrita' }).eq('id', hallB.id)
  ok(Boolean(errEntrada), 'ni el propio dueño sobrescribe la entrada original del auditor')
  const { error: errEv } = await A.cliente.from('ia_eventos').insert({ funcion: 'x', exito: true })
  ok(Boolean(errEv), 'un auditor no escribe en ia_eventos')

  console.log('\n▸ Criterios normativos')
  const { data: crit, error: errCrit } = await A.cliente.rpc('resumen_documentos')
  ok(!errCrit, 'un autenticado consulta el resumen de documentos', errCrit?.message)
  if (crit) console.log(`      documentos cargados: ${crit.map((d) => `${d.documento_codigo} (${d.fragmentos})`).join(', ') || 'ninguno'}`)
  const { error: errCritIns } = await A.cliente.from('criterios_normativos').insert({
    documento_codigo: 'X', documento_titulo: 'X', archivo: 'x', titulo: 'X', contenido: 'X', orden: 999999,
  })
  ok(Boolean(errCritIns), 'un auditor no escribe criterios normativos')
} catch (e) {
  console.error(`\n✗ ${e.message}`)
  fallos++
} finally {
  for (const id of creados) await admin.auth.admin.deleteUser(id)
  if (creados.length) console.log(`\n  (usuarios de prueba eliminados: ${creados.length})`)
}

console.log(fallos ? `\n✗ ${fallos} verificación(es) fallaron\n` : '\n✓ RLS verificada contra el proyecto real\n')
process.exit(fallos ? 1 : 0)
