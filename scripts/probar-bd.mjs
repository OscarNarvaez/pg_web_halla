// Prueba local de las migraciones, las políticas RLS y los controles de seguridad, sin Docker ni
// proyecto Supabase. Incluye como regresión cada ataque de la auditoría de seguridad (docs/SEGURIDAD.md).
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
  acepto_tratamiento_datos: 'true',
  ...extra,
})
const columnas = `(id, nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso`

console.log('\n▸ Migraciones')
const db = await crearBaseLocal()

const como = (id) => ({ id, rol: 'authenticated' })
const servicio = { rol: 'service_role' }

console.log('\n▸ Registro y perfiles')
const A = await registrarUsuario(db, 'a@hila.test', perfil('Ana Auditora', '1085123456'))
const B = await registrarUsuario(db, 'b@hila.test', perfil('Bruno Auditor', '1085999888', { alcance: 'SISTEMAS', proceso: '', sistema: 'Sistema de calidad' }))
const { rows: perfiles } = await db.query('select id, rol, aprobado, alcance, proceso, sistema, acepto_tratamiento_datos_en from public.profiles order by nombre_completo')
ok(perfiles.length === 2, 'el trigger crea el perfil a partir de options.data de signUp')
ok(perfiles.every((p) => p.rol === 'auditor' && p.aprobado === false), 'todo perfil nace como auditor y SIN aprobar')
ok(perfiles.every((p) => p.acepto_tratamiento_datos_en !== null), 'queda registrada la fecha de la autorización de datos (Ley 1581)')
ok(perfiles.find((p) => p.id === B)?.sistema === 'Sistema de calidad' && perfiles.find((p) => p.id === B)?.proceso === null,
  'alcance SISTEMAS guarda el sistema y deja proceso en null')

const SinConsentimiento = await registrarUsuario(db, 'sc@hila.test', perfil('Sin Consentimiento', '52000111', { acepto_tratamiento_datos: 'false' }))
const { rows: sinPerfilSc } = await db.query('select 1 from public.profiles where id = $1', [SinConsentimiento])
ok(sinPerfilSc.length === 0, 'sin autorización de tratamiento de datos no se crea el perfil')

const C = await registrarUsuario(db, 'c@hila.test', perfil('Carla', '12.34'))
const { rows: sinPerfil } = await db.query('select 1 from public.profiles where id = $1', [C])
ok(sinPerfil.length === 0, 'una cédula inválida no hace fallar el registro: el usuario existe sin perfil (fallback del cliente)')

const errCruzado = await falla(db.query(
  `insert into public.profiles ${columnas}, sistema, acepto_tratamiento_datos_en)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS','Urgencias','Sistema de calidad', now())`, [C]))
ok(errCruzado?.includes('alcance_coherente'), 'el alcance obliga a elegir proceso O sistema, nunca ambos', errCruzado)
const errCelular = await falla(db.query(
  `insert into public.profiles ${columnas}, acepto_tratamiento_datos_en)
   values ($1,'Carla Pérez','52123456','300123','Auditora','Otro','Cargo','PROCESOS','Urgencias', now())`, [C]))
ok(errCelular?.includes('celular_valido'), 'el celular debe tener 10 dígitos', errCelular)

console.log('\n▸ Fallback de perfil desde el cliente')
const errOtroId = await falla(comoUsuario(db, como(C), (tx) => tx.query(
  `insert into public.profiles ${columnas}, acepto_tratamiento_datos_en)
   values ($1,'Intruso','52000000','3001234567','X','Otro','Cargo','PROCESOS','Urgencias', now())`, [B])))
ok(Boolean(errOtroId), 'un usuario no puede crear el perfil de otro')
const errEscalada = await falla(comoUsuario(db, como(C), (tx) => tx.query(
  `insert into public.profiles ${columnas}, rol, aprobado, acepto_tratamiento_datos_en)
   values ($1,'Carla Pérez','52123456','3001234567','Auditora','Otro','Cargo','PROCESOS','Urgencias','admin', true, '2001-01-01')`, [C])))
const { rows: [carla] } = await db.query('select rol, aprobado, extract(year from acepto_tratamiento_datos_en) anio from public.profiles where id = $1', [C])
ok(errEscalada === null && carla.rol === 'auditor' && carla.aprobado === false,
  'crearse el perfil como admin y ya aprobado: el servidor lo deja como auditor sin aprobar', errEscalada ?? JSON.stringify(carla))
ok(Number(carla.anio) >= 2026, 'la fecha de autorización la fija el servidor (no se puede antedatar)', JSON.stringify(carla))
const D = await registrarUsuario(db, 'd@hila.test', perfil('Dario', '99'))
const errSinDatos = await falla(comoUsuario(db, como(D), (tx) => tx.query(
  `insert into public.profiles ${columnas}) values ($1,'Dario Díaz','52123457','3001234567','Auditor','Otro','Cargo','PROCESOS','Urgencias')`, [D])))
ok(errSinDatos?.includes('Ley 1581'), 'el perfil exige la autorización de tratamiento de datos', errSinDatos)

console.log('\n▸ Cuenta sin aprobar (registro abierto)')
const errAudSinAprobar = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso) values ($1,'AI-2026-000','Intento','PROCESOS','Urgencias')`, [A])))
ok(Boolean(errAudSinAprobar), 'una cuenta sin aprobar no puede crear auditorías')
await db.query(`insert into public.criterios_normativos (documento_codigo, documento_titulo, archivo, numeral, titulo, contenido, nivel, orden)
  values ('NTC-ISO 9001:2015','SGC','1.md','9.3.3','Salidas de la revisión por la dirección','Las salidas de la revisión por la dirección deben incluir las decisiones y acciones relacionadas con las oportunidades de mejora',3,1),
         ('NTC-ISO 9001:2015','SGC','1.md','4.4','Sistema de gestión de la calidad','4.4.1 La organización debe establecer… 4.4.2 En la medida en que sea necesario, la organización debe conservar información documentada',2,2)`)
const { rows: critSinAprobar } = await comoUsuario(db, como(A), (tx) => tx.query('select id from public.criterios_normativos'))
ok(critSinAprobar.length === 0, 'una cuenta sin aprobar no lee las normas')
const errAutoAprobar = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set aprobado = true where id = $1`, [A])))
ok(Boolean(errAutoAprobar), 'un usuario no puede aprobarse a sí mismo con UPDATE')
const errRpcNoAdmin = await falla(comoUsuario(db, como(A), (tx) => tx.query(`select public.aprobar_auditor($1, true)`, [A])))
ok(errRpcNoAdmin?.includes('administrador'), 'un usuario no puede aprobarse con la función de aprobación', errRpcNoAdmin)

// Arranque: el dueño nombra al primer administrador por SQL (docs/DESPLIEGUE.md)
await db.query(`update public.profiles set rol = 'admin', aprobado = true where id = $1`, [B])
const errAutoDesactivar = await falla(comoUsuario(db, como(B), (tx) => tx.query(`select public.aprobar_auditor($1, false)`, [B])))
ok(errAutoDesactivar?.includes('propia cuenta'), 'un administrador no puede desactivarse a sí mismo', errAutoDesactivar)
const errAprobar = await falla(comoUsuario(db, como(B), (tx) => tx.query(`select public.aprobar_auditor($1, true)`, [A])))
const { rows: [ana] } = await db.query('select aprobado, aprobado_por from public.profiles where id = $1', [A])
ok(errAprobar === null && ana.aprobado === true && ana.aprobado_por === B, 'un administrador aprueba la cuenta y queda registrado quién lo hizo', errAprobar ?? JSON.stringify(ana))
// B vuelve a ser auditor normal para las pruebas de aislamiento
await db.query(`update public.profiles set rol = 'auditor' where id = $1`, [B])

console.log('\n▸ Escalada de privilegios')
const errRol = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set rol = 'admin' where id = $1`, [A])))
ok(Boolean(errRol), 'un usuario autenticado NO puede cambiar su propio rol a admin')
const errNombre = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set cargo = 'Auditora líder' where id = $1`, [A])))
ok(errNombre === null, 'sí puede editar los demás campos de su perfil', errNombre)
const errConsent = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set acepto_tratamiento_datos_en = '2001-01-01' where id = $1`, [A])))
ok(Boolean(errConsent), 'no puede alterar la fecha de su autorización de datos')

console.log('\n▸ Auditorías y hallazgos')
const { rows: [audA] } = await comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso, creado_en) values ($1,'AI-2026-001','Auditoría de urgencias','PROCESOS','Urgencias','2020-01-01') returning id, creado_en`, [A]))
ok(Boolean(audA?.id), 'el auditor aprobado crea su auditoría')
ok(new Date(audA.creado_en).getFullYear() >= 2026, 'la fecha de creación la fija el servidor (no se puede antedatar)')
const errAudAjena = await falla(comoUsuario(db, como(B), (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso) values ($1,'AI-2026-002','Falsa','PROCESOS','Urgencias')`, [A])))
ok(Boolean(errAudAjena), 'B no puede crear auditorías a nombre de A')

const { rows: [crit933] } = await db.query(`select id from public.criterios_normativos where numeral = '9.3.3'`)
const { rows: [crit44] } = await db.query(`select id from public.criterios_normativos where numeral = '4.4'`)
const insertarIA = (entrada, citas = '[]') => comoUsuario(db, servicio, (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido,
     criterio_requisito, evidencia, severidad, modelo_ia, prompt_version, respuesta_cruda, criterios_citados)
   values ($1,$2,$3,'NO_CONFORMIDAD','J','H','C','E','alta','gemini-3.8-flash','1.0.0','{"hallazgos":[]}',$4) returning id, consecutivo, criterios_citados`,
  [audA.id, A, entrada, citas]))
const h1 = (await insertarIA('Entrada uno', JSON.stringify([{ criterio_id: crit933.id, numeral: '9.3.3', documento: 'ISO 9001' }]))).rows[0]
const h2 = (await insertarIA('Entrada dos', JSON.stringify([{ criterio_id: crit44.id, numeral: '4.4.2', documento: 'x' }]))).rows[0]
ok(h1.consecutivo === 1 && h2.consecutivo === 2, 'el consecutivo lo asigna el servidor: 1, 2…', `${h1.consecutivo}, ${h2.consecutivo}`)
ok(h1.criterios_citados[0].documento === 'NTC-ISO 9001:2015' && h1.criterios_citados[0].titulo === 'Salidas de la revisión por la dirección',
  'una cita válida se normaliza con el documento y el título de la base de datos')
ok(h2.criterios_citados[0].numeral === '4.4.2', 'se acepta un sub-numeral que aparece en el texto del criterio')

console.log('\n▸ Ataques a la integridad (deben fallar)')
const errCitaFalsa = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `update public.hallazgos set criterios_citados = '[{"criterio_id":"00000000-0000-4000-8000-000000000000","numeral":"99.9","documento":"ISO 99999","verificado":true}]' where id = $1`, [h1.id])))
ok(errCitaFalsa?.includes('no verificable'), 'falsificar una cita «verificada» en un hallazgo propio', errCitaFalsa)
const errNumeralFalso = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `update public.hallazgos set criterios_citados = $2 where id = $1`, [h1.id, JSON.stringify([{ criterio_id: crit933.id, numeral: '9.3.7', documento: 'x' }])])))
ok(errNumeralFalso?.includes('no verificable'), 'citar un criterio real con un numeral que no le corresponde', errNumeralFalso)
const errSubFalso = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `update public.hallazgos set criterios_citados = $2 where id = $1`, [h1.id, JSON.stringify([{ criterio_id: crit44.id, numeral: '4.4.9', documento: 'x' }])])))
ok(errSubFalso?.includes('no verificable'), 'inventar un sub-numeral que no está en el texto del criterio', errSubFalso)
const errDupFalso = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id,user_id,entrada_auditor,clasificacion,justificacion,hallazgo_corregido,criterio_requisito,evidencia,criterios_citados)
   values ($1,$2,'x','FORTALEZA','j','h','c','e','[{"criterio_id":"inventado","numeral":"1.1","documento":"X","verificado":true}]')`, [audA.id, A])))
ok(errDupFalso?.includes('no verificable'), 'insertar un hallazgo (duplicar) con citas inventadas', errDupFalso)
const { rows: [antedatado] } = await comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id,user_id,entrada_auditor,clasificacion,justificacion,hallazgo_corregido,criterio_requisito,evidencia,creado_en)
   values ($1,$2,'Entrada uno','FORTALEZA','j','h','c','e','2020-01-01') returning id, creado_en`, [audA.id, A]))
ok(new Date(antedatado.creado_en).getFullYear() >= 2026, 'antedatar un hallazgo: el servidor fija la fecha real')
const errCambiarFecha = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.hallazgos set creado_en = '2020-01-01' where id = $1`, [h1.id])))
ok(Boolean(errCambiarFecha), 'cambiar la fecha de creación de un hallazgo')
const borrar = await falla(comoUsuario(db, como(A), (tx) => tx.query(`delete from public.hallazgos where id = $1`, [h1.id])))
const { rows: siguen } = await db.query('select 1 from public.hallazgos where id = $1', [h1.id])
ok(Boolean(borrar) && siguen.length === 1, 'borrar físicamente un hallazgo propio (solo se descarta)', borrar ?? 'se borró')
const borrarAud = await falla(comoUsuario(db, como(A), (tx) => tx.query(`delete from public.auditorias where id = $1`, [audA.id])))
ok(Boolean(borrarAud), 'borrar una auditoría con todos sus hallazgos en cascada')
const errInformeFalso = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.informes (auditoria_id,user_id,resumen_ejecutivo,modelo_ia) values ($1,$2,'Todo perfecto','gemini-3.8-flash')`, [audA.id, A])))
ok(Boolean(errInformeFalso), 'falsificar un informe propio (solo los genera el servidor)')
const errTruncate = await falla(comoUsuario(db, como(A), (tx) => tx.query('truncate public.hallazgos')))
ok(Boolean(errTruncate), 'vaciar una tabla con TRUNCATE')
const inicioBusqueda = Date.now()
const errBusqueda = await falla(comoUsuario(db, como(A), (tx) => tx.query(`select count(*) from public.buscar_criterios($1)`, ['revision or '.repeat(90000)])))
ok(errBusqueda === null && Date.now() - inicioBusqueda < 5000, 'una consulta de 1 MB se recorta y no bloquea la base de datos', errBusqueda ?? `${Date.now() - inicioBusqueda} ms`)

console.log('\n▸ Aislamiento entre usuarios (RLS)')
await db.query(`select public.aprobar_auditor($1, true)`, [B]).catch(() => {})
await db.query(`update public.profiles set aprobado = true where id = $1`, [B])
const { rows: verB } = await comoUsuario(db, como(B), (tx) => tx.query('select * from public.hallazgos'))
ok(verB.length === 0, 'B no puede leer los hallazgos de A')
const { rows: verAudB } = await comoUsuario(db, como(B), (tx) => tx.query('select * from public.auditorias'))
ok(verAudB.length === 0, 'B no puede leer las auditorías de A')
const { rows: perfilesB } = await comoUsuario(db, como(B), (tx) => tx.query('select id from public.profiles'))
ok(perfilesB.length === 1 && perfilesB[0].id === B, 'B solo ve su propio perfil')
const upd = await comoUsuario(db, como(B), (tx) => tx.query(`update public.hallazgos set hallazgo_corregido = 'manipulado' where id = $1`, [h1.id]))
ok(upd.affectedRows === 0, 'B no puede modificar los hallazgos de A')
const errHallAjeno = await falla(comoUsuario(db, como(B), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia)
   values ($1,$2,'x','FORTALEZA','j','h','c','e')`, [audA.id, B])))
ok(Boolean(errHallAjeno), 'B no puede insertar hallazgos en la auditoría de A')
const { rows: histB } = await comoUsuario(db, como(B), (tx) => tx.query('select * from public.hallazgos_historial'))
ok(histB.length === 0, 'B no puede leer el historial de A')

console.log('\n▸ Trazabilidad')
const errEntrada = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.hallazgos set entrada_auditor = 'otra cosa' where id = $1`, [h1.id])))
ok(errEntrada?.includes('no se pueden modificar'), 'la entrada original del auditor no se puede sobrescribir', errEntrada)
const errCruda = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.hallazgos set respuesta_cruda = '{}' where id = $1`, [h1.id])))
ok(Boolean(errCruda), 'la respuesta cruda de la IA no se puede modificar')
await comoUsuario(db, como(A), (tx) => tx.query(`update public.hallazgos set hallazgo_corregido = 'Redacción ajustada por la auditora', estado = 'confirmado' where id = $1`, [h1.id]))
const { rows: [editado] } = await db.query('select editado_por_usuario from public.hallazgos where id = $1', [h1.id])
ok(editado.editado_por_usuario === true, 'editar un campo redactado marca editado_por_usuario = true')
const { rows: historial } = await comoUsuario(db, como(A), (tx) => tx.query('select cambiado_por, antes, despues from public.hallazgos_historial where hallazgo_id = $1', [h1.id]))
ok(historial.length === 1 && historial[0].antes.hallazgo_corregido === 'H' && historial[0].despues.hallazgo_corregido === 'Redacción ajustada por la auditora' && historial[0].cambiado_por === A,
  'cada cambio queda en el historial con quién, cuándo, antes y después')
const errHistorial = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.hallazgos_historial set antes = '{}'`)))
ok(Boolean(errHistorial), 'el historial no se puede alterar')
const errFalsaIA = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia, modelo_ia)
   values ($1,$2,'x','FORTALEZA','j','h','c','e','gemini-3.8-flash')`, [audA.id, A])))
ok(Boolean(errFalsaIA), 'el cliente no puede insertar hallazgos haciéndolos pasar por generados por la IA')
const errDuplicar = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia, editado_por_usuario, estado, criterios_citados)
   values ($1,$2,'Entrada uno','NO_CONFORMIDAD','j','h','c','e', true, 'editado', $3)`, [audA.id, A, JSON.stringify(h1.criterios_citados)])))
ok(errDuplicar === null, 'el cliente sí puede duplicar un hallazgo con sus citas reales', errDuplicar)
await comoUsuario(db, como(A), (tx) => tx.query(`update public.auditorias set estado = 'cerrada' where id = $1`, [audA.id]))
const errCerrada = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia)
   values ($1,$2,'x','FORTALEZA','j','h','c','e')`, [audA.id, A])))
ok(Boolean(errCerrada), 'una auditoría cerrada no admite hallazgos nuevos')
await comoUsuario(db, como(A), (tx) => tx.query(`update public.auditorias set estado = 'en_curso' where id = $1`, [audA.id]))

console.log('\n▸ Normas, ia_eventos y cuota de IA')
const { rows: crit } = await comoUsuario(db, como(A), (tx) => tx.query('select id from public.criterios_normativos'))
ok(crit.length === 2, 'un usuario aprobado lee los criterios')
const errCrit = await falla(comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.criterios_normativos (documento_codigo, documento_titulo, archivo, titulo, contenido, orden) values ('X','X','x','X','X',99)`)))
ok(Boolean(errCrit), 'un usuario no puede escribir criterios (solo service_role)')
const errAnon = await falla(comoUsuario(db, { rol: 'anon' }, (tx) => tx.query('select id from public.criterios_normativos')))
ok(Boolean(errAnon), 'un visitante anónimo no tiene ningún permiso sobre las tablas')
const errAnonRpc = await falla(comoUsuario(db, { rol: 'anon' }, (tx) => tx.query(`select * from public.buscar_criterios('revision')`)))
ok(Boolean(errAnonRpc), 'un visitante anónimo no puede ejecutar las funciones de búsqueda')
const { rows: busq } = await comoUsuario(db, como(A), (tx) => tx.query(`select numeral from public.buscar_criterios('gestion revision direccion or salidas')`))
ok(busq[0]?.numeral === '9.3.3', 'buscar_criterios ignora tildes: «revision direccion» empata con «revisión… dirección»')

const errReservaCliente = await falla(comoUsuario(db, como(A), (tx) => tx.query(`select public.reservar_uso_ia($1, 'x', 100, 100)`, [A])))
ok(Boolean(errReservaCliente), 'un usuario no puede llamar la reserva de cuota (solo la Edge Function)')
const reservar = () => comoUsuario(db, servicio, (tx) => tx.query(`select public.reservar_uso_ia($1, 'clasificar-hallazgo', 3, 2) as id`, [A]))
const r1 = await falla(reservar())
const r2 = await falla(reservar())
const r3 = await falla(reservar())
ok(r1 === null && r2 === null && r3?.includes('limite_minuto'), 'la cuota corta en el límite por minuto', `${r1} | ${r2} | ${r3}`)
await db.query(`update public.ia_eventos set creado_en = now() - interval '2 hours' where user_id = $1`, [A])
const r4 = await falla(reservar())
const r5 = await falla(reservar())
ok(r4 === null && r5?.includes('limite_diario'), 'la cuota corta en el límite diario', `${r4} | ${r5}`)
const { rows: evA } = await comoUsuario(db, como(A), (tx) => tx.query('select * from public.ia_eventos'))
ok(evA.length === 0, 'un auditor no lee ia_eventos')

console.log('\n▸ Rol admin')
await db.query(`update public.profiles set rol = 'admin' where id = $1`, [B])
const { rows: verAdmin } = await comoUsuario(db, como(B), (tx) => tx.query('select id from public.hallazgos'))
ok(verAdmin.length === 4, 'un admin lee los hallazgos de todos (sin recursión infinita en la política)', `vio ${verAdmin.length}`)
const { rows: evAdmin } = await comoUsuario(db, como(B), (tx) => tx.query('select * from public.ia_eventos'))
ok(evAdmin.length === 3, 'un admin lee ia_eventos', `vio ${evAdmin.length}`)
const updAdmin = await comoUsuario(db, como(B), (tx) => tx.query(`update public.hallazgos set justificacion = 'x' where id = $1`, [h2.id]))
ok(updAdmin.affectedRows === 0, 'un admin lee pero no modifica hallazgos ajenos')
await db.query(`update public.profiles set aprobado = false where id = $1`, [B])
const { rows: adminInactivo } = await comoUsuario(db, como(B), (tx) => tx.query('select id from public.hallazgos'))
ok(adminInactivo.length === 0, 'un admin desactivado pierde el acceso')

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Todas las pruebas de base de datos pasaron\n')
process.exit(fallos ? 1 : 0)
