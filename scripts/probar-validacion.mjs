// Pruebas unitarias de la validación anti-alucinación (V1–V6), sin red ni base de datos.
// Uso: pnpm probar:validacion
import {
  verificarCitas, depurarReferencias, quitarDatosInventados, verificarEstructura, limpiarTexto, validarHallazgo,
} from '../supabase/functions/_shared/validar-salida.ts'
import { construirConsulta } from '../supabase/functions/_shared/recuperar-criterios.ts'
import { MARCADOR_PENDIENTE } from '../supabase/functions/_shared/catalogos.ts'
import { anonimizar } from '../supabase/functions/_shared/anonimizar.ts'
import * as catalogosServidor from '../supabase/functions/_shared/catalogos.ts'
import * as catalogosCliente from '../src/lib/catalogos.js'

let fallos = 0
const ok = (c, d, det = '') => {
  console.log(`  ${c ? '✓' : '✗'} ${d}${!c && det ? `\n      → ${det}` : ''}`)
  if (!c) fallos++
}

const C933 = { id: 'c-933', documento_codigo: 'NTC-ISO 9001:2015', numeral: '9.3.3', titulo: 'Salidas de la revisión por la dirección', contenido: 'Las salidas de la revisión por la dirección deben incluir las decisiones y acciones relacionadas con las oportunidades de mejora.', idioma: 'es', puntaje: 0.2 }
const C753 = { id: 'c-753', documento_codigo: 'NTC-ISO 9001:2015', numeral: '7.5.3', titulo: 'Control de la información documentada', contenido: 'La información documentada requerida debe controlarse.', idioma: 'es', puntaje: 0.1 }
const entregados = [C933, C753]

console.log('\n▸ V1 · criterios citados reales')
let r = verificarCitas([{ criterio_id: 'c-933', numeral: '9.3.3', documento: 'ISO 9001' }], entregados)
ok(r.verificadas.length === 1 && r.verificadas[0].documento === 'NTC-ISO 9001:2015', 'acepta una cita entregada y toma el documento de la BD')
r = verificarCitas([{ criterio_id: 'inventado', numeral: '8.5.1', documento: 'NTC-ISO 9001:2015' }], entregados)
ok(r.verificadas.length === 0 && r.descartadas.length === 1, 'descarta un criterio_id que no se entregó')
r = verificarCitas([{ criterio_id: 'c-933', numeral: '9.3.2', documento: 'NTC-ISO 9001:2015' }], entregados)
ok(r.verificadas.length === 0, 'descarta un id real con un numeral que no coincide')
r = verificarCitas([{ criterio_id: 'c-44b', numeral: '4.4.2', documento: '' }], [{ id: 'c-44b', documento_codigo: 'NTC-ISO 9001:2015', numeral: '4.4', titulo: 'SGC', contenido: '4.4.1 La organización debe… 4.4.2 En la medida en que sea necesario…', idioma: 'es', puntaje: 0 }])
ok(r.verificadas[0]?.numeral === '4.4.2', 'acepta el sub-numeral 4.4.2 del fragmento 4.4 porque aparece en su texto (caso 1 real)')
r = verificarCitas([{ criterio_id: 'c-44b', numeral: '4.4.9', documento: '' }], [{ id: 'c-44b', documento_codigo: 'NTC-ISO 9001:2015', numeral: '4.4', titulo: 'SGC', contenido: '4.4.1 La organización debe… 4.4.2 En la medida…', idioma: 'es', puntaje: 0 }])
ok(r.verificadas.length === 0, 'rechaza un sub-numeral que no aparece en el texto del fragmento')
r = verificarCitas([{ criterio_id: 'c-933', numeral: 'numeral 9.3.3.', documento: 'x' }], entregados)
ok(r.verificadas.length === 1, 'tolera «numeral 9.3.3.» como 9.3.3')

console.log('\n▸ V2 · referencias no verificadas')
const v933 = verificarCitas([{ criterio_id: 'c-933', numeral: '9.3.3', documento: '' }], entregados).verificadas
let d = depurarReferencias('incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3.', v933, '')
ok(d.texto === 'incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3.', 'conserva una referencia verificada', d.texto)
d = depurarReferencias('incumpliendo lo establecido en la ISO 45001:2018, numeral 8.1.2.', v933, '')
ok(!/45001|8\.1\.2/.test(d.texto) && d.texto.includes(MARCADOR_PENDIENTE), 'reemplaza norma y numeral no verificados por el marcador', d.texto)
ok((d.texto.match(/\[Requisito/g) ?? []).length === 1, 'colapsa marcadores consecutivos en uno solo', d.texto)
d = depurarReferencias('incumpliendo la Resolución 3100 de 2019.', [], '')
ok(d.texto.includes(MARCADOR_PENDIENTE) && !/3100/.test(d.texto), 'reemplaza una resolución que la IA «recordó»', d.texto)
d = depurarReferencias('incumpliendo la Resolución 3100 de 2019.', [], 'El servicio no cumple la Resolución 3100 de 2019 en habilitación')
ok(d.texto.includes('3100'), 'conserva una norma legal que el propio auditor mencionó', d.texto)
d = depurarReferencias('según lo dispuesto en (8.5.1) y en el PR13-GQ', v933, '')
ok(!/8\.5\.1/.test(d.texto) && !/PR13/.test(d.texto), 'detecta numerales sueltos entre paréntesis y el PR13 no verificado', d.texto)
d = depurarReferencias('numeral 9.3 de la NTC-ISO 9001:2015', v933, '')
ok(d.texto.includes('9.3'), 'acepta el numeral padre de uno verificado (9.3 ⊃ 9.3.3)', d.texto)

const C44 = { id: 'c-44', documento_codigo: 'NTC-ISO 9001:2015', numeral: '4.4', titulo: 'Sistema de gestión de la calidad y sus procesos', contenido: '4.4.1 La organización debe establecer… 4.4.2 En la medida en que sea necesario, la organización debe conservar información documentada.', idioma: 'es', puntaje: 0.1 }
const C851 = { id: 'c-851', documento_codigo: 'NTC-ISO 9001:2015', numeral: '8.5.1', titulo: 'Control de la producción y de la provisión del servicio', contenido: 'La organización debe implementar la producción y provisión del servicio bajo condiciones controladas.', idioma: 'es', puntaje: 0.1 }
const vCaso1 = verificarCitas([{ criterio_id: 'c-44', numeral: '4.4', documento: '' }, { criterio_id: 'c-851', numeral: '8.5.1', documento: '' }], [C44, C851]).verificadas
d = depurarReferencias('establecido en la NTC-ISO 9001:2015, numerales 4.4.2 y 8.5.1.', vCaso1, '', [C44, C851])
ok(d.texto === 'establecido en la NTC-ISO 9001:2015, numerales 4.4.2 y 8.5.1.', 'acepta un sub-numeral (4.4.2) que aparece en el texto verificado de 4.4 (caso 1 real)', d.texto)
d = depurarReferencias('establecido en la NTC-ISO 9001:2015, numerales 8.5.1 y 9.9.9.', vCaso1, '', [C44, C851])
ok(d.texto === 'establecido en la NTC-ISO 9001:2015, numeral 8.5.1.' && d.eliminadas.includes('numeral 9.9.9'), 'en una lista conserva los numerales verificados y retira solo los inventados', d.texto)
d = depurarReferencias('numeral 4.4.7', vCaso1, '', [C44, C851])
ok(d.texto.includes(MARCADOR_PENDIENTE), 'rechaza un sub-numeral que NO aparece en el texto verificado', d.texto)

console.log('\n▸ V6 · fechas y cifras inventadas')
const entrada1 = 'Se revisaron 20 historias clínicas y en 5 de ellas no se encontró registrada la valoración de enfermería.'
let q = quitarDatosInventados('Durante la revisión del 14 de julio de 2021 se evidenció que en 5 de 20 historias clínicas (25 %)…', entrada1, entregados)
ok(q.texto.includes('[fecha por confirmar]') && !q.texto.includes('2021'), 'reemplaza una fecha que no está en la entrada', q.texto)
ok(q.texto.includes('20 historias clínicas') && q.texto.includes('25 %'), 'conserva las cifras de la entrada y el porcentaje calculable 5/20', q.texto)
q = quitarDatosInventados('en 30 historias clínicas y durante 6 meses', entrada1, entregados)
ok(q.texto.includes('[cantidad por confirmar] historias') && q.texto.includes('[cantidad por confirmar] meses'), 'reemplaza cantidades que no están en la entrada', q.texto)
q = quitarDatosInventados('se revisaron 20 historias', 'Se revisaron veinte historias clínicas', [])
ok(!q.texto.includes('['), 'reconoce cifras escritas en palabras en la entrada («veinte» = 20)', q.texto)

console.log('\n▸ V3 · estructura por categoría')
ok(verificarEstructura('NO_CONFORMIDAD', 'En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3, lo que afecta la mejora.', v933).length === 0, 'NC bien formada pasa')
ok(verificarEstructura('NO_CONFORMIDAD', 'Se evidencia que el registro de la valoración de enfermería es susceptible de mejorar en las historias clínicas revisadas por el equipo auditor del servicio.', []).length >= 2, 'NC sin «incumpl…», sin requisito y con lenguaje de mejora falla')
ok(verificarEstructura('NO_CONFORMIDAD', `En 5 de 20 historias clínicas revisadas no se encontró registrada la valoración de enfermería, incumpliendo ${MARCADOR_PENDIENTE}.`, []).length === 0, 'NC con el marcador pendiente cuenta como requisito identificado')
ok(verificarEstructura('OBSERVACION', 'Se evidencia baja legibilidad en algunas firmas de los registros revisados, situación que podría afectar la trazabilidad de la información en el proceso.', []).length === 0, 'Observación bien formada pasa')
ok(verificarEstructura('OBSERVACION', 'Se evidencia baja legibilidad en algunas firmas de los registros revisados, incumpliendo lo establecido en el procedimiento de gestión documental institucional.', []).some((p) => p.includes('incumplimiento')), 'Observación que afirma incumplimiento falla')
ok(verificarEstructura('FORTALEZA', 'Se evidencia seguimiento mensual sistemático a los indicadores del proceso y uso de sus resultados para definir acciones, favoreciendo la toma de decisiones basada en datos.', []).length === 0, 'Fortaleza con gerundio de beneficio («favoreciendo», como el ejemplo del Anexo A) pasa')
ok(verificarEstructura('FORTALEZA', 'El equipo tiene un excelente seguimiento de los indicadores del proceso, lo que permitirá mejorar la toma de decisiones del servicio en los próximos meses.', []).length >= 2, 'Fortaleza con «excelente» y beneficio futuro falla')
ok(verificarEstructura('OPORTUNIDAD_DE_MEJORA', 'El registro de asistencia en formato físico es susceptible de mejorar mediante su digitalización, lo cual permitirá agilizar la consolidación de la información y facilitar su análisis.', []).length === 0, 'Oportunidad de mejora bien formada pasa')
ok(verificarEstructura('OPORTUNIDAD_DE_MEJORA', 'El registro de asistencia se realiza correctamente en formato físico y podría digitalizarse para agilizar la consolidación de la información del proceso auditado.', []).length >= 1, 'Oportunidad de mejora sin «susceptible de mejorar» ni futuro falla')
ok(verificarEstructura('OBSERVACION', 'Firmas poco legibles.', []).some((p) => p.includes('breve')), 'redacción demasiado breve falla (V5)')

console.log('\n▸ V5 · limpieza')
ok(limpiarTexto('**Hallazgo corregido:** "Se evidencia algo."') === 'Se evidencia algo.', 'quita rótulos, negritas y comillas envolventes', limpiarTexto('**Hallazgo corregido:** "Se evidencia algo."'))
ok(limpiarTexto('## Título\n- uno\n- dos') === 'Título uno dos', 'quita encabezados Markdown y viñetas', limpiarTexto('## Título\n- uno\n- dos'))

console.log('\n▸ Validación completa de un hallazgo')
const v = validarHallazgo({
  clasificacion: 'NO_CONFORMIDAD',
  justificacion: 'Existe evidencia objetiva de incumplimiento de un requisito obligatorio relacionado con el registro de la valoración de enfermería en la historia clínica.',
  hallazgo_corregido: 'Durante la revisión del 3 de marzo de 2026 de 20 historias clínicas, en 5 no se encontró registrada la valoración de enfermería, incumpliendo la Resolución 1995 de 1999, artículo 5.',
  criterio_requisito: 'Resolución 1995 de 1999, artículo 5',
  evidencia: '5 de 20 historias clínicas sin valoración de enfermería registrada.',
  severidad: 'alta',
  criterios_citados: [{ criterio_id: 'otro', numeral: '5', documento: 'Resolución 1995' }],
}, entrada1, entregados)
ok(v.criterio_requisito === MARCADOR_PENDIENTE, 'sin criterio verificado, criterio_requisito = marcador exacto', v.criterio_requisito)
ok(v.clasificacion === 'NO_CONFORMIDAD', 'una NC sin requisito sigue siendo NC (Anexo A)')
ok(!/1995|marzo/.test(v.hallazgo_corregido), 'el hallazgo corregido queda sin la norma ni la fecha inventadas', v.hallazgo_corregido)
ok(v.problemas.length === 0, 'tras depurar, la NC conserva su estructura (el marcador cuenta como requisito)', v.problemas.join('; '))
ok(v.avisos.length >= 2, 'quedan avisos visibles para el auditor', v.avisos.join(' | '))
const v2 = validarHallazgo({
  clasificacion: 'NO_CONFORMIDAD', justificacion: 'x'.repeat(80), evidencia: 'e',
  hallazgo_corregido: 'En la revisión por la dirección no se incluyeron las decisiones frente a las oportunidades de mejora, incumpliendo lo establecido en la ISO 14001:2015, numeral 9.3.',
  criterio_requisito: 'ISO 14001:2015, numeral 9.3', criterios_citados: [{ criterio_id: 'c-933', numeral: '9.3.3', documento: 'NTC-ISO 9001:2015' }],
}, 'En la revisión por la dirección no se incluyeron las decisiones', entregados)
ok(v2.criterio_requisito === 'NTC-ISO 9001:2015, numeral 9.3.3 (Salidas de la revisión por la dirección)', 'si el criterio queda solo con el marcador pero hay una cita verificada, se arma con ella', v2.criterio_requisito)
const vOm = validarHallazgo({ clasificacion: 'OPORTUNIDAD_DE_MEJORA', justificacion: 'x'.repeat(80), evidencia: 'e', hallazgo_corregido: 'h', criterio_requisito: 'r', criterios_citados: [] }, 'x', entregados)
ok(vOm.criterio_requisito === MARCADOR_PENDIENTE && !vOm.avisos.some((a) => a.includes('identifícalo')), 'sin cita: marcador en el criterio, pero el aviso de «identifícalo» solo aplica a no conformidades')

console.log('\n▸ Consulta de recuperación')
const consulta = construirConsulta('Se evidenció extintor vencido en el área de urgencias y no se encontró el registro', 'Urgencias')
ok(consulta.includes(' or ') && consulta.includes('extintor') && consulta.includes('emergencias'), 'arma una consulta «or» y añade sinónimos (extintor → emergencias)', consulta)
ok(!/\bor or\b|\bnot\b|\band\b/.test(consulta) && !/\bse\b|\bel\b/.test(consulta), 'sin stopwords ni operadores sueltos', consulta)

console.log('\n▸ Anonimización antes de enviar a la IA (S1)')
const anon = (t) => anonimizar(t).texto
ok(anon('La paciente María José Pérez Gómez, HC 1234567, fue atendida.') === 'La paciente [nombre retirado], HC [número retirado], fue atendida.', 'retira el nombre del paciente y el número de historia clínica', anon('La paciente María José Pérez Gómez, HC 1234567, fue atendida.'))
ok(anon('La Auxiliar Ana Gómez no registró.') === 'La Auxiliar [nombre retirado] no registró.', 'retira el nombre aunque el rol esté en mayúscula tras «La»')
ok(anon('El Dr. Carlos Ruiz y la jefe de enfermería Laura Martínez Ñáñez') === 'El Dr. [nombre retirado] y la jefe de enfermería [nombre retirado]', 'retira nombres de personal con tratamiento o cargo')
ok(anon('el niño Santiago de la Cruz esperó') === 'el niño [nombre retirado] esperó', 'retira apellidos compuestos con «de la»')
ok(anon('al 300 123 4567, al (602) 731 2345 y a madre@gmail.com') === 'al [teléfono retirado], al [teléfono retirado] y a [correo retirado]', 'retira celulares, teléfonos fijos y correos')
ok(anon('CC 1.085.123.456 y cédula de ciudadanía No. 52123456') === 'CC [número retirado] y cédula de ciudadanía No. [número retirado]', 'retira números de documento con y sin puntos')
const legitimo = 'Se revisaron 20 historias clínicas del servicio de Urgencias del Hospital Infantil Los Ángeles; facturas por $1.500.000; NTC-ISO 9001:2015 numeral 9.3.3; Resolución 3100 de 2019; el auxiliar de Enfermería.'
ok(anon(legitimo) === legitimo, 'no altera el contenido de auditoría: cifras, montos, normas, servicios y la institución', anon(legitimo))

console.log('\n▸ Catálogos del cliente y del servidor')
ok(JSON.stringify(catalogosServidor.PROCESOS) === JSON.stringify(catalogosCliente.PROCESOS), 'los 19 procesos coinciden entre el frontend y las Edge Functions')
ok(JSON.stringify(catalogosServidor.SISTEMAS) === JSON.stringify(catalogosCliente.SISTEMAS), 'los 6 sistemas coinciden entre el frontend y las Edge Functions')
ok(JSON.stringify(catalogosServidor.DOCUMENTOS_POR_ALCANCE) === JSON.stringify(catalogosCliente.DOCUMENTOS_POR_ALCANCE), 'el mapa de documentos por alcance coincide')
ok(catalogosServidor.MARCADOR_PENDIENTE === catalogosCliente.MARCADOR_PENDIENTE, 'el marcador de requisito pendiente es idéntico')

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Validación verificada\n')
process.exit(fallos ? 1 : 0)
