// Prueba local de las migraciones, las políticas RLS y los controles de seguridad, sin Docker ni
// proyecto Supabase. Incluye como regresión cada ataque de la auditoría de seguridad (docs/SEGURIDAD.md).
// Uso: pnpm probar:bd
import { aplicarMigraciones, crearBaseLocal, comoUsuario, registrarUsuario } from './lib/supabase-local.mjs'

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
  cargos: ['Auditor médico'],
  equipo_auditor: [{ nombre: 'Laura Gómez', cargos: ['Enfermera'] }],
  tipo_evaluador: 'AUDITORES_INTERNOS',
  alcance: 'PROCESOS',
  proceso: 'Urgencias',
  sistema: '',
  acepto_tratamiento_datos: 'true',
  ...extra,
})
const columnas = `(id, nombre_completo, cedula, celular, cargos, equipo_auditor, tipo_evaluador, alcance, proceso`
const EQUIPO = `'[{"nombre":"Otro Auditor","cargos":["Enfermera"]}]'`

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
   values ($1,'Carla Pérez','52123456','3001234567','{Auditor médico}',${EQUIPO},'AUDITORES_INTERNOS','PROCESOS','Urgencias','Sistema de calidad', now())`, [C]))
ok(errCruzado?.includes('alcance_coherente'), 'el alcance obliga a elegir proceso O sistema, nunca ambos', errCruzado)
const errCelular = await falla(db.query(
  `insert into public.profiles ${columnas}, acepto_tratamiento_datos_en)
   values ($1,'Carla Pérez','52123456','300123','{Auditor médico}',${EQUIPO},'AUDITORES_INTERNOS','PROCESOS','Urgencias', now())`, [C]))
ok(errCelular?.includes('celular_valido'), 'el celular debe tener 10 dígitos', errCelular)

console.log('\n▸ Fallback de perfil desde el cliente')
const errOtroId = await falla(comoUsuario(db, como(C), (tx) => tx.query(
  `insert into public.profiles ${columnas}, acepto_tratamiento_datos_en)
   values ($1,'Intruso','52000000','3001234567','{Auditor médico}',${EQUIPO},'AUDITORES_INTERNOS','PROCESOS','Urgencias', now())`, [B])))
ok(Boolean(errOtroId), 'un usuario no puede crear el perfil de otro')
const errEscalada = await falla(comoUsuario(db, como(C), (tx) => tx.query(
  `insert into public.profiles ${columnas}, rol, aprobado, acepto_tratamiento_datos_en)
   values ($1,'Carla Pérez','52123456','3001234567','{Auditor médico}',${EQUIPO},'AUDITORES_INTERNOS','PROCESOS','Urgencias','admin', true, '2001-01-01')`, [C])))
const { rows: [carla] } = await db.query('select rol, aprobado, extract(year from acepto_tratamiento_datos_en) anio from public.profiles where id = $1', [C])
ok(errEscalada === null && carla.rol === 'auditor' && carla.aprobado === false,
  'crearse el perfil como admin y ya aprobado: el servidor lo deja como auditor sin aprobar', errEscalada ?? JSON.stringify(carla))
ok(Number(carla.anio) >= 2026, 'la fecha de autorización la fija el servidor (no se puede antedatar)', JSON.stringify(carla))
const D = await registrarUsuario(db, 'd@hila.test', perfil('Dario', '99'))
const errSinDatos = await falla(comoUsuario(db, como(D), (tx) => tx.query(
  `insert into public.profiles ${columnas}) values ($1,'Dario Díaz','52123457','3001234567','{Auditor médico}',${EQUIPO},'AUDITORES_INTERNOS','PROCESOS','Urgencias')`, [D])))
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

console.log('\n▸ Cargos y equipo auditor (0009)')
const { rows: [perfilA] } = await db.query('select cargos, equipo_auditor from public.profiles where id = $1', [A])
ok(JSON.stringify(perfilA.cargos) === '["Auditor médico"]' && perfilA.equipo_auditor[0]?.nombre === 'Laura Gómez' && perfilA.equipo_auditor[0]?.cargos[0] === 'Enfermera',
  'el registro crea el perfil con los cargos y el equipo auditor de options.data', JSON.stringify(perfilA))
const E = await registrarUsuario(db, 'e@hila.test', perfil('Elena Equipo', '1085777666', {
  cargos: ['Coordinadora', 'Líder equipo', 'Coordinadora'],
  equipo_auditor: [{ nombre: ' Laura Gómez ', cargos: ['Médico', 'Tesorera'], extra: 'x' }, { nombre: 'Pedro Pérez', cargos: ['Auxiliar'] }, { nombre: 'Rosa Ruiz', cargos: ['Doctor'] }],
}))
const { rows: [perfilE] } = await db.query('select cargos, equipo_auditor from public.profiles where id = $1', [E])
ok(JSON.stringify(perfilE?.cargos) === '["Coordinadora","Líder equipo"]', 'el líder puede tener varios cargos (sin repetidos)', JSON.stringify(perfilE?.cargos))
const lauraE = perfilE?.equipo_auditor[0]
ok(perfilE?.equipo_auditor.length === 3 && lauraE.nombre === 'Laura Gómez' && JSON.stringify(lauraE.cargos) === '["Médico","Tesorera"]' && !('extra' in lauraE),
  'el equipo auditor admite varias personas, cada una con varios cargos (y se normaliza)', JSON.stringify(perfilE?.equipo_auditor))
const F = await registrarUsuario(db, 'f@hila.test', perfil('Fabio Falso', '1085444333', { cargos: ['Gerente general'] }))
const { rows: sinPerfilF } = await db.query('select 1 from public.profiles where id = $1', [F])
ok(sinPerfilF.length === 0, 'un cargo que no está en la lista de líderes no se acepta')
const actualizarPerfilA = (cambio) => falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set ${cambio} where id = $1`, [A])))
let errCargo = await actualizarPerfilA(`cargos = '{Tesorera}'`)
ok(errCargo?.includes('Cargo no permitido'), 'un cargo del equipo no sirve como cargo del líder', errCargo)
errCargo = await actualizarPerfilA(`cargos = '{}'`)
ok(errCargo?.includes('al menos un cargo'), 'el líder debe tener al menos un cargo', errCargo)
errCargo = await actualizarPerfilA(`cargos = '{Coordinadora,Enfermera,Nutricionista,Auditor médico,Auditor externo,Líder equipo}'`)
ok(errCargo?.includes('entre 1 y 5'), 'como máximo 5 cargos por persona', errCargo)
errCargo = await actualizarPerfilA(`equipo_auditor = '[{"nombre":"Laura Gómez","cargos":["Asesora PAMEC"]}]'`)
ok(errCargo?.includes('Cargo no permitido para el equipo'), 'un integrante del equipo solo puede tener cargos de la lista del equipo', errCargo)
errCargo = await actualizarPerfilA(`equipo_auditor = '[]'`)
ok(errCargo?.includes('entre 1 y 10'), 'el equipo auditor tiene al menos una persona', errCargo)
errCargo = await actualizarPerfilA(`equipo_auditor = $2`.replace('$2', `'${JSON.stringify(Array.from({ length: 11 }, (_, i) => ({ nombre: `Persona ${i + 1}`, cargos: ['Auxiliar'] })))}'`))
ok(errCargo?.includes('entre 1 y 10'), 'como máximo 10 personas en el equipo auditor', errCargo)
errCargo = await actualizarPerfilA(`equipo_auditor = '[{"nombre":"Laura Gómez","cargos":[]}]'`)
ok(errCargo?.includes('al menos un cargo'), 'cada integrante del equipo tiene al menos un cargo', errCargo)
errCargo = await actualizarPerfilA(`equipo_auditor = '[{"nombre":"Lu","cargos":["Auxiliar"]}]'`)
ok(errCargo?.includes('nombre de 3 a 120'), 'cada integrante del equipo tiene nombre', errCargo)
const G = await registrarUsuario(db, 'g@hila.test', perfil('Gloria Sin Grupo', '1085222111', { tipo_evaluador: '' }))
const { rows: sinPerfilG } = await db.query('select 1 from public.profiles where id = $1', [G])
ok(sinPerfilG.length === 0, 'el registro exige elegir Auditores Internos o Auditores Externos (evaluador, 0010)')
const H = await registrarUsuario(db, 'h@hila.test', perfil('Hugo Externo', '1085333222', { tipo_evaluador: 'AUDITORES_EXTERNOS' }))
const { rows: [perfilH] } = await db.query('select tipo_evaluador from public.profiles where id = $1', [H])
ok(perfilH?.tipo_evaluador === 'AUDITORES_EXTERNOS', 'un auditor externo queda registrado como tal', JSON.stringify(perfilH))
const errEvaluador = await actualizarPerfilA(`tipo_evaluador = null`)
ok(errEvaluador?.includes('Auditores Internos o a los Auditores Externos'), 'no se puede dejar el perfil sin evaluador', errEvaluador)
const errEvaluadorOk = await actualizarPerfilA(`tipo_evaluador = 'AUDITORES_EXTERNOS'`)
ok(errEvaluadorOk === null, 'el auditor puede cambiar su grupo de evaluador', errEvaluadorOk)
await actualizarPerfilA(`tipo_evaluador = 'AUDITORES_INTERNOS'`)
const { rows: columnasViejas } = await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('cargo', 'equipo_auditor_nombre', 'equipo_auditor_cargo')`)
ok(columnasViejas.length === 0, 'ya no existen el cargo escrito a mano ni el equipo de una sola persona')

console.log('\n▸ Escalada de privilegios')
const errRol = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set rol = 'admin' where id = $1`, [A])))
ok(Boolean(errRol), 'un usuario autenticado NO puede cambiar su propio rol a admin')
const errNombre = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set cargos = '{Coordinadora,Auditor médico}' where id = $1`, [A])))
ok(errNombre === null, 'sí puede editar los demás campos de su perfil', errNombre)
const errConsent = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.profiles set acepto_tratamiento_datos_en = '2001-01-01' where id = $1`, [A])))
ok(Boolean(errConsent), 'no puede alterar la fecha de su autorización de datos')

console.log('\n▸ Auditorías y hallazgos')
const { rows: [audA] } = await comoUsuario(db, como(A), (tx) => tx.query(
  `insert into public.auditorias (user_id, codigo, titulo, alcance, proceso, creado_en) values ($1,'AI-2026-001','Auditoría de urgencias','PROCESOS','Urgencias','2020-01-01') returning id, creado_en`, [A]))
ok(Boolean(audA?.id), 'el auditor aprobado crea su auditoría')
ok(new Date(audA.creado_en).getFullYear() >= 2026, 'la fecha de creación la fija el servidor (no se puede antedatar)')
const fijarFechasReales = (inicio, fin) => falla(comoUsuario(db, como(A), (tx) => tx.query(
  `update public.auditorias set fecha_inicio_real = $2, fecha_fin_real = $3 where id = $1`, [audA.id, inicio, fin])))
const errFechasReales = await fijarFechasReales('2026-10-10', '2026-10-01')
ok(errFechasReales?.includes('fechas_reales_coherentes'), 'la terminación real no puede ser anterior al inicio real (0010)', errFechasReales)
const errFechasRealesOk = await fijarFechasReales('2026-10-01', '2026-10-03')
ok(errFechasRealesOk === null, 'el auditor registra las fechas reales de su auditoría', errFechasRealesOk)
// 0013: indicadores priorizados del proceso que revisa el auditor
const ponerIndicadores = (como_, lista) => falla(comoUsuario(db, como(como_), (tx) => tx.query(
  `update public.auditorias set indicadores_revisados = $2 where id = $1`, [audA.id, JSON.stringify(lista)])))
const indicador = (extra = {}) => ({ nombre: '  Oportunidad en triage II ', meta: '≤ 30 minutos', resultado: '42 minutos', observacion: '', ...extra })
const errIndicadores = await ponerIndicadores(A, [indicador({ extra: 'no se guarda' })])
const { rows: [conIndicadores] } = await db.query('select indicadores_revisados from public.auditorias where id = $1', [audA.id])
const [guardado] = conIndicadores.indicadores_revisados
ok(errIndicadores === null && conIndicadores.indicadores_revisados.length === 1 && guardado.nombre === 'Oportunidad en triage II' && guardado.meta === '≤ 30 minutos'
  && guardado.resultado === '42 minutos' && guardado.observacion === '' && Object.keys(guardado).sort().join() === 'meta,nombre,observacion,resultado',
  'el auditor registra los indicadores que revisó: solo nombre, meta, resultado y observación, sin espacios sobrantes (0013)', `${errIndicadores} | ${JSON.stringify(conIndicadores.indicadores_revisados)}`)
const errSinNombre = await ponerIndicadores(A, [indicador({ nombre: '   ' })])
const errMetaLarga = await ponerIndicadores(A, [indicador({ meta: 'x'.repeat(121) })])
const errObsLarga = await ponerIndicadores(A, [indicador({ observacion: 'x'.repeat(501) })])
const errMuchosInd = await ponerIndicadores(A, Array.from({ length: 16 }, (_, i) => indicador({ nombre: `Indicador ${i + 1}` })))
const errNoLista = await falla(comoUsuario(db, como(A), (tx) => tx.query(`update public.auditorias set indicadores_revisados = '{"nombre":"x"}' where id = $1`, [audA.id])))
ok(errSinNombre?.includes('nombre') && errMetaLarga?.includes('120') && errObsLarga?.includes('500') && errMuchosInd?.includes('15') && errNoLista?.includes('lista'),
  'los indicadores se validan: nombre obligatorio, meta y resultado de hasta 120, observación de hasta 500, máximo 15 y siempre una lista',
  [errSinNombre, errMetaLarga, errObsLarga, errMuchosInd, errNoLista].join(' | '))
const errIndAjeno = await comoUsuario(db, como(B), (tx) => tx.query(`update public.auditorias set indicadores_revisados = '[]' where id = $1`, [audA.id]))
const { rows: [trasAjeno] } = await db.query('select jsonb_array_length(indicadores_revisados) as n from public.auditorias where id = $1', [audA.id])
ok(errIndAjeno.affectedRows === 0 && trasAjeno.n === 1, 'B no puede cambiar los indicadores de una auditoría de A')
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

console.log('\n▸ Lista de verificación (0011)')
{
  const guardarLista = (quien, auditoria, encabezado, secciones) => falla(comoUsuario(db, como(quien), (tx) => tx.query(
    `insert into public.listas_verificacion (auditoria_id, user_id, encabezado, secciones) values ($1, $2, $3, $4)
     on conflict (auditoria_id) do update set encabezado = excluded.encabezado, secciones = excluded.secciones`,
    [auditoria, quien, JSON.stringify(encabezado), JSON.stringify(secciones)])))
  const fila = (extra = {}) => ({ requisito: 'NTC-ISO 9001:2015 7.1.3', pregunta: '¿Hay plan de mantenimiento?', documentos: 'Plan 2026', marca: 'NC', anotaciones: 'Sin cronograma', ...extra })
  const errLista = await guardarLista(A, audA.id, { elaborada_por: ' Ana Auditora ', lugar: 'Urgencias', otro: 'x' }, [{ titulo: ' GESTION DE RECURSOS FISICOS ', filas: [fila({ extra: 'x' }), fila({ marca: null })] }])
  const { rows: [lista] } = await db.query('select encabezado, secciones from public.listas_verificacion where auditoria_id = $1', [audA.id])
  ok(errLista === null && lista?.encabezado.elaborada_por === 'Ana Auditora' && !('otro' in lista.encabezado) && lista.secciones[0].titulo === 'GESTION DE RECURSOS FISICOS'
    && !('extra' in lista.secciones[0].filas[0]) && lista.secciones[0].filas[1].marca === null, 'el auditor guarda su lista de verificación (y se normaliza)', errLista ?? JSON.stringify(lista))
  const errActualizar = await guardarLista(A, audA.id, {}, [{ titulo: 'S', filas: [fila({ marca: 'OB' })] }])
  const { rows: [lista2] } = await db.query('select secciones from public.listas_verificacion where auditoria_id = $1', [audA.id])
  ok(errActualizar === null && lista2.secciones[0].filas[0].marca === 'OB', 'la lista se actualiza al volver a guardarla', errActualizar)
  let errValidar = await guardarLista(A, audA.id, {}, [{ titulo: 'S', filas: [fila({ marca: 'X' })] }])
  ok(errValidar?.includes('NC, O, OB o F'), 'la marca solo puede ser NC, O, OB o F', errValidar)
  errValidar = await guardarLista(A, audA.id, {}, [{ titulo: 'S', filas: Array.from({ length: 201 }, () => fila()) }])
  ok(errValidar?.includes('200 filas'), 'una sección admite hasta 200 filas', errValidar)
  errValidar = await guardarLista(A, audA.id, {}, [{ titulo: 'S', filas: [fila({ anotaciones: 'x'.repeat(2001) })] }])
  ok(errValidar?.includes('2000 caracteres'), 'cada texto admite hasta 2000 caracteres', errValidar)
  const { rows: verListaB } = await comoUsuario(db, como(B), (tx) => tx.query('select * from public.listas_verificacion'))
  ok(verListaB.length === 0, 'B no puede leer la lista de verificación de A')
  const errListaAjena = await guardarLista(B, audA.id, {}, [])
  ok(Boolean(errListaAjena), 'B no puede crear ni cambiar la lista de la auditoría de A')
  const borrarLista = await falla(comoUsuario(db, como(A), (tx) => tx.query('delete from public.listas_verificacion where auditoria_id = $1', [audA.id])))
  ok(Boolean(borrarLista), 'la lista no se borra físicamente')
  await comoUsuario(db, como(A), (tx) => tx.query(`update public.auditorias set estado = 'cerrada' where id = $1`, [audA.id]))
  const errCerradaLista = await guardarLista(A, audA.id, {}, [])
  ok(Boolean(errCerradaLista), 'con la auditoría cerrada la lista queda en solo lectura')
  await comoUsuario(db, como(A), (tx) => tx.query(`update public.auditorias set estado = 'en_curso' where id = $1`, [audA.id]))
}

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

console.log('\n▸ Riesgo, controles y matriz (0007)')
const comoA = (sql, params = []) => comoUsuario(db, como(A), (tx) => tx.query(sql, params))
const errP6 = await falla(comoA(`update public.hallazgos set riesgo_probabilidad = 6 where id = $1`, [h2.id]))
ok(errP6?.includes('riesgo_probabilidad_rango'), 'la probabilidad solo admite valores de 1 a 5 (escala del PR13)', errP6)
const errDim = await falla(comoA(`update public.hallazgos set riesgo_dimension = 'INVENTADA' where id = $1`, [h2.id]))
ok(errDim?.includes('riesgo_dimension_valida'), 'la dimensión de impacto debe ser una de las seis del PR13', errDim)
const controlIA = { descripcion: 'Verificar diariamente el registro de la valoración de enfermería al ingreso', tipo: 'PREVENTIVO', origen: 'ia', adoptado: false, criterio_id: crit933.id }
await comoUsuario(db, servicio, (tx) => tx.query(`update public.hallazgos set controles = $2 where id = $1`, [h2.id, JSON.stringify([controlIA])]))
const { rows: [conControl] } = await db.query('select controles from public.hallazgos where id = $1', [h2.id])
ok(conControl.controles[0].documento === 'NTC-ISO 9001:2015' && conControl.controles[0].numeral === '9.3.3',
  'un control que cita un criterio se normaliza con el documento y el numeral de la base de datos', JSON.stringify(conControl.controles))
const errAdoptar = await falla(comoA(`update public.hallazgos set controles = $2 where id = $1`, [h2.id, JSON.stringify([{ ...controlIA, adoptado: true }])]))
ok(errAdoptar === null, 'el auditor adopta un control propuesto por la IA', errAdoptar)
const errReescribir = await falla(comoA(`update public.hallazgos set controles = $2 where id = $1`,
  [h2.id, JSON.stringify([{ ...controlIA, descripcion: 'Control que la IA nunca propuso', adoptado: true }])]))
ok(errReescribir?.includes('no se pueden reescribir'), 'hacer pasar un control propio por uno propuesto por la IA', errReescribir)
const errCtrlCrit = await falla(comoA(`update public.hallazgos set controles = $2 where id = $1`,
  [h2.id, JSON.stringify([{ descripcion: 'Control con cita inventada', tipo: 'CORRECTIVO', origen: 'auditor', adoptado: true, criterio_id: '00000000-0000-4000-8000-000000000000' }])]))
ok(errCtrlCrit?.includes('no verificable'), 'un control no puede citar un criterio inexistente', errCtrlCrit)
const muchos = Array.from({ length: 11 }, (_, i) => ({ descripcion: `Control propio número ${i + 1}`, tipo: 'CORRECTIVO', origen: 'auditor', adoptado: true }))
const errMuchos = await falla(comoA(`update public.hallazgos set controles = $2 where id = $1`, [h2.id, JSON.stringify(muchos)]))
ok(errMuchos?.includes('máximo 10'), 'un hallazgo admite como máximo 10 controles', errMuchos)
const errPropio = await falla(comoA(`update public.hallazgos set controles = $2 where id = $1`,
  [h2.id, JSON.stringify([{ ...controlIA, adoptado: true }, { descripcion: 'Socializar el procedimiento con el personal', tipo: 'CORRECTIVO', origen: 'auditor', adoptado: true }])]))
ok(errPropio === null, 'el auditor agrega un control propio', errPropio)
await comoA(`update public.hallazgos set riesgo_descripcion = 'Riesgo de omitir valoraciones', riesgo_dimension = 'CALIDAD_SEGURIDAD_PACIENTE',
  riesgo_probabilidad = 4, riesgo_impacto = 4, estado = 'confirmado' where id = $1`, [h2.id])
const { rows: [validado] } = await db.query('select estado from public.hallazgos where id = $1', [h2.id])
ok(validado.estado === 'confirmado', 'el auditor valida el hallazgo (Validado)', validado.estado)
await comoA(`update public.hallazgos set riesgo_impacto = 3 where id = $1`, [h2.id])
const { rows: [trasEditar] } = await db.query('select estado, editado_por_usuario from public.hallazgos where id = $1', [h2.id])
ok(trasEditar.estado === 'editado' && trasEditar.editado_por_usuario, 'editar un hallazgo validado lo devuelve a Pendiente: hay que volver a validarlo', JSON.stringify(trasEditar))
const errCambios = await falla(comoA(`update public.hallazgos set estado = 'cambios_sugeridos', nota_validacion = 'Precisar el número de registros revisados' where id = $1`, [h2.id]))
ok(errCambios === null, 'el auditor marca «Se sugiere hacer cambios» con una nota', errCambios)
const { rows: histRiesgo } = await db.query(`select despues from public.hallazgos_historial where hallazgo_id = $1 and antes->>'riesgo_impacto' = '4' and despues->>'riesgo_impacto' = '3'`, [h2.id])
ok(histRiesgo.length === 1, 'el historial registra los cambios del riesgo')
const errPdf = await falla(comoA(`update public.hallazgos set evidencia_archivo = '{"nombre":"x.pdf","paginas":1,"sha256":"${'a'.repeat(64)}"}' where id = $1`, [h2.id]))
ok(errPdf?.includes('no se pueden modificar'), 'la huella del PDF de evidencia no se puede cambiar después', errPdf)
const insertarConPdf = (archivo) => falla(comoUsuario(db, servicio, async (tx) => {
  await tx.query(`insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion, justificacion, hallazgo_corregido,
     criterio_requisito, evidencia, evidencia_archivo) values ($1,$2,'x','FORTALEZA','j','h','c','e',$3)`, [audA.id, A, JSON.stringify(archivo)])
  throw new Error('insertado') // se deshace: solo interesa si el check lo admite
}))
const pdfOk = await insertarConPdf({ nombre: 'evidencia.pdf', paginas: 3, sha256: 'b'.repeat(64) })
const pdfMalo = await insertarConPdf({ nombre: 'evidencia.pdf', paginas: 3, sha256: 'no-es-un-hash' })
ok(pdfOk === 'insertado' && pdfMalo?.includes('evidencia_archivo_valida'), 'el PDF de evidencia solo guarda nombre, páginas y una huella SHA-256 válida', `${pdfOk} | ${pdfMalo}`)

// 0012: PDF cargados al editar la evidencia (evidencia_anexos)
const anexo = (sha, extra = {}) => ({ nombre: 'acta-comite.pdf', paginas: 2, sha256: sha.repeat(64), ...extra })
const ponerAnexos = (anexos, extra = '') => falla(comoA(`update public.hallazgos set evidencia_anexos = $2${extra} where id = $1`, [h2.id, JSON.stringify(anexos)]))
await comoA(`update public.hallazgos set estado = 'confirmado', nota_validacion = null where id = $1`, [h2.id])
const errAnexo = await ponerAnexos([anexo('c', { nombre: '../acta\u0007-comite.pdf', agregado_en: '2001-01-01T00:00:00Z' })], `, evidencia = 'Acta del comité: no se revisaron los indicadores.'`)
const { rows: [conAnexo] } = await db.query('select evidencia_anexos, estado, evidencia_archivo from public.hallazgos where id = $1', [h2.id])
const fechaAnexo = conAnexo.evidencia_anexos[0]?.agregado_en
ok(errAnexo === null && conAnexo.evidencia_anexos.length === 1 && conAnexo.evidencia_anexos[0].nombre === '..acta-comite.pdf' && !fechaAnexo?.startsWith('2001'),
  'al editar, el auditor agrega un PDF de evidencia: se guarda su huella con nombre saneado y fecha del servidor', `${errAnexo} | ${JSON.stringify(conAnexo.evidencia_anexos)}`)
ok(conAnexo.estado === 'editado', 'agregar un PDF a un hallazgo validado lo devuelve a Pendiente', conAnexo.estado)
await ponerAnexos([...conAnexo.evidencia_anexos, anexo('d')])
const { rows: [dosAnexos] } = await db.query('select evidencia_anexos from public.hallazgos where id = $1', [h2.id])
ok(dosAnexos.evidencia_anexos.length === 2 && dosAnexos.evidencia_anexos[0].agregado_en === fechaAnexo, 'un PDF que ya estaba conserva su fecha al agregar otro')
const errAnexoMalo = await ponerAnexos([anexo('e', { sha256: 'no-es-un-hash' })])
const errAnexoPaginas = await ponerAnexos([anexo('e', { paginas: 1.5 })])
const errAnexoRepetido = await ponerAnexos([anexo('e'), anexo('e', { nombre: 'otra-copia.pdf' })])
const errAnexoMuchos = await ponerAnexos(Array.from({ length: 11 }, (_, i) => anexo(i.toString(16))))
const errAnexoTexto = await ponerAnexos([{ ...anexo('e'), texto: 'contenido del PDF' }])
const { rows: [sinTexto] } = await db.query('select evidencia_anexos from public.hallazgos where id = $1', [h2.id])
ok(errAnexoMalo?.includes('inválido') && errAnexoPaginas?.includes('inválido') && errAnexoRepetido?.includes('ya está registrado') && errAnexoMuchos?.includes('máximo 10')
  && errAnexoTexto === null && !('texto' in sinTexto.evidencia_anexos[0]),
  'de un PDF agregado solo se guarda la huella: hash válido, páginas enteras, sin repetir, máximo 10 y nada de su contenido',
  [errAnexoMalo, errAnexoPaginas, errAnexoRepetido, errAnexoMuchos, errAnexoTexto].join(' | '))
const { rows: [conArchivo] } = await comoUsuario(db, servicio, (tx) => tx.query(`insert into public.hallazgos (auditoria_id, user_id, entrada_auditor, clasificacion,
  justificacion, hallazgo_corregido, criterio_requisito, evidencia, evidencia_archivo) values ($1,$2,'x','FORTALEZA','j','h','c','e',$3) returning id`,
  [audA.id, A, JSON.stringify(anexo('f', { nombre: 'analizado.pdf' }))]))
const errAnexoAnalizado = await falla(comoA(`update public.hallazgos set evidencia_anexos = $2 where id = $1`, [conArchivo.id, JSON.stringify([anexo('f')])]))
ok(errAnexoAnalizado?.includes('ya está registrado'), 'el PDF que ya analizó la IA no se registra otra vez como agregado', errAnexoAnalizado)
await ponerAnexos([dosAnexos.evidencia_anexos[1]])
const { rows: histAnexos } = await db.query(`select 1 from public.hallazgos_historial where hallazgo_id = $1
  and jsonb_array_length(antes->'evidencia_anexos') = 2 and jsonb_array_length(despues->'evidencia_anexos') = 1`, [h2.id])
ok(histAnexos.length === 1, 'quitar un PDF agregado queda en el historial')
// 0014: el PDF analizado se puede QUITAR (no reemplazar); el historial conserva cuál era
const errPdfOtro = await falla(comoA(`update public.hallazgos set evidencia_archivo = $2 where id = $1`, [conArchivo.id, JSON.stringify(anexo('9', { nombre: 'otro.pdf' }))]))
ok(errPdfOtro?.includes('no se pueden modificar'), 'el PDF analizado no se puede reemplazar por otro (0014)', errPdfOtro)
await db.query(`update public.hallazgos set estado = 'confirmado' where id = $1`, [conArchivo.id])
const errQuitarPdf = await falla(comoA(`update public.hallazgos set evidencia_archivo = null where id = $1`, [conArchivo.id]))
const { rows: [sinPdf] } = await db.query('select evidencia_archivo, estado from public.hallazgos where id = $1', [conArchivo.id])
const { rows: histPdf } = await db.query(`select cambiado_por from public.hallazgos_historial where hallazgo_id = $1
  and antes->'evidencia_archivo'->>'sha256' = $2 and despues->'evidencia_archivo' = 'null'::jsonb`, [conArchivo.id, 'f'.repeat(64)])
ok(errQuitarPdf === null && sinPdf.evidencia_archivo === null && sinPdf.estado === 'editado' && histPdf[0]?.cambiado_por === A,
  'el auditor puede quitar el PDF analizado: el historial guarda cuál era y quién lo quitó, y vuelve a Pendiente (0014)', `${errQuitarPdf} | ${JSON.stringify(sinPdf)}`)
await db.query('delete from public.hallazgos_historial where hallazgo_id = $1', [conArchivo.id])
await db.query('delete from public.hallazgos where id = $1', [conArchivo.id]) // solo era para esta prueba
const { rows: columnaUmbrales } = await db.query(`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'auditorias' and column_name = 'umbrales_riesgo'`)
const errUmbrales = await falla(comoA(`update public.auditorias set umbrales_riesgo = '{"bajo": 1, "moderado": 2, "alto": 3}' where id = $1`, [audA.id]))
ok(columnaUmbrales.length === 0 && Boolean(errUmbrales), 'la escala de niveles de riesgo es fija: ninguna auditoría guarda ni edita umbrales (0008)', errUmbrales)

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

console.log('\n▸ Perfiles existentes al aplicar la 0009 (cargo escrito a mano → lista)')
{
  const vieja = await crearBaseLocal({ hasta: '0009', silencioso: true })
  const meta = (nombre, cedula, cargo, equipoNombre, equipoCargo) => ({
    nombre_completo: nombre, cedula, celular: '3001234567', cargo, equipo_auditor_nombre: equipoNombre, equipo_auditor_cargo: equipoCargo,
    alcance: 'PROCESOS', proceso: 'Urgencias', sistema: '', acepto_tratamiento_datos: 'true',
  })
  const coincide = await registrarUsuario(vieja, 'v1@hila.test', meta('Vera Vieja', '1085000001', '  auditor MEDICO ', 'Laura Gómez', 'enfermeria'))
  const libre = await registrarUsuario(vieja, 'v2@hila.test', meta('Victor Viejo', '1085000002', 'Auditor interno', 'Pedro Pérez', 'Profesional de calidad'))
  await aplicarMigraciones(vieja, { desde: '0009', silencioso: true })
  const { rows } = await vieja.query('select id, cargos, equipo_auditor, tipo_evaluador from public.profiles')
  const v1 = rows.find((r) => r.id === coincide)
  const v2 = rows.find((r) => r.id === libre)
  ok(JSON.stringify(v1?.cargos) === '["Auditor médico"]' && v1?.equipo_auditor[0]?.nombre === 'Laura Gómez' && JSON.stringify(v1?.equipo_auditor[0]?.cargos) === '["Enfermería"]',
    'un cargo escrito que coincide con la lista (sin importar mayúsculas ni tildes) se conserva', JSON.stringify(v1))
  ok(JSON.stringify(v2?.cargos) === '[]' && v2?.equipo_auditor[0]?.nombre === 'Pedro Pérez' && JSON.stringify(v2?.equipo_auditor[0]?.cargos) === '[]',
    'si no coincide, el perfil queda sin cargos (la app pide completarlo) y conserva el nombre del compañero', JSON.stringify(v2))
  ok(rows.every((r) => !('tipo_evaluador' in r) || r.tipo_evaluador === null), 'los perfiles anteriores quedan sin evaluador (la app pide completarlo)')
  const errAprobarViejo = await falla(vieja.query('update public.profiles set aprobado = true where id = $1', [libre]))
  ok(errAprobarViejo === null, 'un perfil anterior sin cargos se puede seguir aprobando', errAprobarViejo)
  await vieja.close()
}

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Todas las pruebas de base de datos pasaron\n')
process.exit(fallos ? 1 : 0)
