// Prueba local de las migraciones y de las políticas RLS, sin Docker ni proyecto Supabase.
// Uso: pnpm probar:bd
import { crearBaseLocal, comoUsuario, registrarUsuario } from './lib/supabase-local.mjs'

let fallos = 0
function ok(condicion, descripcion, detalle = '') {
  console.log(`  ${condicion ? '✓' : '✗'} ${descripcion}${!condicion && detalle ? `\n      → ${detalle}` : ''}`)
  if (!condicion) fallos++
}
async function falla(promesa) {
  try {
    await promesa
    return null
  } catch (e) {
    return e.message
  }
}

const perfil = (nombre, cedula, extra = {}) => ({
  nombre_completo: nombre,
  cedula,
  celular: '3001234567',
  cargo: 'Auditor interno',
  equipo_auditor_nombre: 'Laura Gómez',
  equipo_auditor_cargo: 'Profesional de calidad',
  alcance: 'PROCESOS',
  proceso: 'Urgencias',
  sistema: '',
  ...extra,
})

console.log('\n▸ Migraciones')
const db = await crearBaseLocal()

console.log('\n▸ Registro y perfiles')
const A = await registrarUsuario(db, 'a@hila.test', perfil('Ana Auditora', '1085123456'))
const B = await registrarUsuario(db, 'b@hila.test', perfil('Bruno Auditor', '1085999888', { alcance: 'SISTEMAS', proceso: '', sistema: 'Sistema de calidad' }))
const { rows: perfiles } = await db.query('select id, rol, alcance, proceso, sistema from public.profiles order by nombre_completo')
ok(perfiles.length === 2, 'el trigger crea el perfil a partir de options.data de signUp')
ok(perfiles.every((p) => p.rol === 'auditor'), 'todo perfil nace con rol auditor')
ok(perfiles.find((p) => p.id === B)?.sistema === 'Sistema de calidad' && perfiles.find((p) => p.id === B)?.proceso === null,
  'alcance SISTEMAS guarda el sistema y deja proceso en null')

const C = await registrarUsuario(db, 'c@hila.test', perfil('Carla', '12.34'))
const { rows: sinPerfil } = await db.query('select 1 from public.profiles where id = $1', [C])
ok(sinPerfil.length === 0, 'una cédula inválida no hace fallar el registro: el usuario existe sin perfil (fallback del cliente)')

const errCruzado = await falla(db.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso, sistema)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS','Urgencias','Sistema de calidad')`, [C]))
ok(errCruzado?.includes('alcance_coherente'), 'el alcance obliga a elegir proceso O sistema, nunca ambos', errCruzado)

const errNinguno = await falla(db.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS')`, [C]))
ok(errNinguno?.includes('alcance_coherente'), 'el alcance obliga a elegir proceso O sistema, nunca ninguno', errNinguno)

const errCelular = await falla(db.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso)
   values ($1,'Carla Pérez','52123456','300123','Auditora','Otro','Cargo','PROCESOS','Urgencias')`, [C]))
ok(errCelular?.includes('celular_valido'), 'el celular debe tener 10 dígitos', errCelular)

console.log('\n▸ Fallback de perfil desde el cliente')
const errOtroId = await falla(comoUsuario(db, { id: C, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso)
   values ($1,'Intruso','52000000','3001234567','X','Otro','Cargo','PROCESOS','Urgencias')`, [B])))
ok(Boolean(errOtroId), 'un usuario no puede crear el perfil de otro')
const errAdmin = await falla(comoUsuario(db, { id: C, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso, rol)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS','Urgencias','admin')`, [C])))
ok(Boolean(errAdmin), 'un usuario no puede crearse un perfil con rol admin')
const errPropio = await falla(comoUsuario(db, { id: C, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.profiles (id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS','Urgencias')`, [C])))
ok(errPropio === null, 'el usuario sí puede crear su propio perfil como auditor', errPropio)

console.log('\n▸ Escalada de privilegios')
const errRol = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.profiles set rol = 'admin' where id = $1`, [A])))
ok(Boolean(errRol), 'un usuario autenticado NO puede cambiar su propio rol a admin', 'el UPDATE se aplicó')
const errNombre = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.profiles set cargo = 'Auditora líder' where id = $1`, [A])))
ok(errNombre === null, 'sí puede editar los demás campos de su perfil', errNombre)

console.log('\n▸ Auditorías y hallazgos')
const { rows: [audA] } = await comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso) values ($1,'AI-2026-001','Auditoría de urgencias','PROCESOS','Urgencias') returning id`, [A]))
ok(Boolean(audA?.id), 'el auditor crea su auditoría')

const errAudAjena = await falla(comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso) values ($1,'AI-2026-002','Falsa','PROCESOS','Urgencias')`, [A])))
ok(Boolean(errAudAjena), 'B no puede crear auditorías a nombre de A')

// La Edge Function inserta con service_role (con procedencia de IA)
const insertarIA = (entrada) => comoUsuario(db, { rol: 'service_role' }, (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido,
     criterio_requisito, evidencia, severidad, modelo_ia, prompt_version, respuesta_cruda)
   values ($1,$2,$3,'NO_CONFORMIDAD','J','H','C','E','alta','gemini-3.8-flash','1.0.0','{"hallazgos":[]}') returning id, consecutivo`,
  [audA.id, A, entrada]))
const h1 = (await insertarIA('Entrada uno')).rows[0]
const h2 = (await insertarIA('Entrada dos')).rows[0]
ok(h1.consecutivo === 1 && h2.consecutivo === 2, 'el consecutivo lo asigna el servidor: 1, 2…', `${h1.consecutivo}, ${h2.consecutivo}`)

console.log('\n▸ Aislamiento entre usuarios (RLS)')
const { rows: verB } = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query('select * from public.hallazgos'))
ok(verB.length === 0, 'B no puede leer los hallazgos de A')
const { rows: verAudB } = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query('select * from public.auditorias'))
ok(verAudB.length === 0, 'B no puede leer las auditorías de A')
const { rows: perfilesB } = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query('select id from public.profiles'))
ok(perfilesB.length === 1 && perfilesB[0].id === B, 'B solo ve su propio perfil')
const upd = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.hallazgos set hallazgo_corregido = 'manipulado' where id = $1`, [h1.id]))
ok(upd.affectedRows === 0, 'B no puede modificar los hallazgos de A')
const del = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query(`delete from public.hallazgos where id = $1`, [h1.id]))
ok(del.affectedRows === 0, 'B no puede borrar los hallazgos de A')
const errHallAjeno = await falla(comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia)
   values ($1,$2,'x','FORTALEZA','j','h','c','e')`, [audA.id, B])))
ok(Boolean(errHallAjeno), 'B no puede insertar hallazgos en la auditoría de A')
const errInforme = await falla(comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.informes (auditoria_id, user_id) values ($1,$2)`, [audA.id, B])))
ok(Boolean(errInforme), 'B no puede crear informes de la auditoría de A')

console.log('\n▸ Trazabilidad')
const errEntrada = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.hallazgos set entrada_auditor = 'otra cosa' where id = $1`, [h1.id])))
ok(errEntrada?.includes('no se pueden modificar'), 'la entrada original del auditor no se puede sobrescribir', errEntrada)
const errCruda = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.hallazgos set respuesta_cruda = '{}' where id = $1`, [h1.id])))
ok(Boolean(errCruda), 'la respuesta cruda de la IA no se puede modificar')
await comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.hallazgos set hallazgo_corregido = 'Redacción ajustada por la auditora' where id = $1`, [h1.id]))
const { rows: [editado] } = await db.query('select editado_por_usuario from public.hallazgos where id = $1', [h1.id])
ok(editado.editado_por_usuario === true, 'editar un campo redactado marca editado_por_usuario = true')
const { rows: [noEditado] } = await db.query('select editado_por_usuario from public.hallazgos where id = $1', [h2.id])
ok(noEditado.editado_por_usuario === false, 'los hallazgos no editados conservan editado_por_usuario = false')
const errFalsaIA = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia, modelo_ia)
   values ($1,$2,'x','FORTALEZA','j','h','c','e','gemini-3.8-flash')`, [audA.id, A])))
ok(Boolean(errFalsaIA), 'el cliente no puede insertar hallazgos haciéndolos pasar por generados por la IA')
const errDuplicar = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia, editado_por_usuario, estado)
   values ($1,$2,'Entrada uno','NO_CONFORMIDAD','j','h','c','e', true, 'editado')`, [audA.id, A])))
ok(errDuplicar === null, 'el cliente sí puede duplicar un hallazgo (sin procedencia de IA)', errDuplicar)

console.log('\n▸ Criterios normativos e ia_eventos')
await db.query(`insert into public.criterios_normativos (documento_codigo, documento_titulo, archivo, numeral, titulo, contenido, nivel, orden)
  values ('NTC-ISO 9001:2015','SGC','1.md','9.3.3','Salidas de la revisión por la dirección','Las salidas de la revisión por la dirección deben incluir las decisiones y acciones relacionadas con las oportunidades de mejora',3,1)`)
const { rows: crit } = await comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query('select id from public.criterios_normativos'))
ok(crit.length === 1, 'cualquier autenticado puede leer los criterios')
const errCrit = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query(
  `insert into public.criterios_normativos (documento_codigo, documento_titulo, archivo, titulo, contenido, orden) values ('X','X','x','X','X',99)`)))
ok(Boolean(errCrit), 'un usuario no puede escribir criterios (solo service_role)')
const { rows: critAnon } = await comoUsuario(db, { rol: 'anon' }, (tx) => tx.query('select id from public.criterios_normativos'))
ok(critAnon.length === 0, 'un visitante anónimo no lee criterios')
const { rows: busq } = await comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`select numeral from public.buscar_criterios('gestion revision direccion or salidas')`))
ok(busq[0]?.numeral === '9.3.3', 'buscar_criterios ignora tildes: «revision direccion» empata con «revisión… dirección»')

await db.query(`insert into public.ia_eventos (user_id, funcion, exito) values ($1,'clasificar-hallazgo',true)`, [A])
const { rows: evA } = await comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) => tx.query('select * from public.ia_eventos'))
ok(evA.length === 0, 'un auditor no lee ia_eventos')
const errEv = await falla(comoUsuario(db, { id: A, rol: 'authenticated' }, (tx) =>
  tx.query(`insert into public.ia_eventos (user_id, funcion, exito) values ($1,'x',true)`, [A])))
ok(Boolean(errEv), 'un auditor no escribe en ia_eventos')

console.log('\n▸ Rol admin')
await db.query(`update public.profiles set rol = 'admin' where id = $1`, [B]) // por SQL directo, como lo haría el dueño
const { rows: verAdmin } = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query('select id from public.hallazgos'))
ok(verAdmin.length === 3, 'un admin lee los hallazgos de todos (sin recursión infinita en la política)', `vio ${verAdmin.length}`)
const { rows: evAdmin } = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) => tx.query('select * from public.ia_eventos'))
ok(evAdmin.length === 1, 'un admin lee ia_eventos')
const updAdmin = await comoUsuario(db, { id: B, rol: 'authenticated' }, (tx) =>
  tx.query(`update public.hallazgos set justificacion = 'x' where id = $1`, [h2.id]))
ok(updAdmin.affectedRows === 0, 'un admin lee pero no modifica hallazgos ajenos')

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Todas las pruebas de base de datos pasaron\n')
process.exit(fallos ? 1 : 0)
