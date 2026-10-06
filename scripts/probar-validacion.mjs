// Pruebas unitarias de la validación anti-alucinación (V1–V6), sin red ni base de datos.
// Uso: pnpm probar:validacion
import {
  verificarCitas, depurarReferencias, quitarDatosInventados, verificarEstructura, limpiarTexto, validarHallazgo,
  validarRiesgoYControles, escala15, AVISO_RIESGO_INCOMPLETO, dimensionValida,
} from '../supabase/functions/_shared/validar-salida.ts'
import { construirMensaje, construirReparacion, GUIA_REDACCION } from '../supabase/functions/_shared/motor.ts'
import { problemasDeEstructura } from '../src/lib/estructura.js'
import { readFileSync } from 'node:fs'
import { construirConsulta } from '../supabase/functions/_shared/recuperar-criterios.ts'
import { MARCADOR_PENDIENTE } from '../supabase/functions/_shared/catalogos.ts'
import { anonimizar } from '../supabase/functions/_shared/anonimizar.ts'
import * as catalogosServidor from '../supabase/functions/_shared/catalogos.ts'
import * as catalogosCliente from '../src/lib/catalogos.js'
import { normalizarUrlSupabase, politicaCsp } from '../vite.csp.js'
import { mensajeError, describirError } from '../src/lib/supabase.js'

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
ok(JSON.stringify(verificarEstructura('FORTALEZA', 'Se evidencia seguimiento mensual sistemático a los indicadores del proceso y uso de sus resultados para definir acciones, favoreciendo la toma de decisiones basada en datos.', [])).includes('porque'),
  'Fortaleza sin «porque» falla: la guía del dueño pide qué es relevante + porque + beneficio en el presente')
ok(verificarEstructura('FORTALEZA', 'Se evidencia seguimiento mensual sistemático a los indicadores del proceso y uso de sus resultados para definir acciones, porque favorece la toma de decisiones basada en datos.', []).length === 0, 'Fortaleza con «porque» y beneficio en presente pasa')
ok(verificarEstructura('FORTALEZA', 'El equipo tiene un excelente seguimiento de los indicadores del proceso, lo que permitirá mejorar la toma de decisiones del servicio en los próximos meses.', []).length >= 2, 'Fortaleza con «excelente» y beneficio futuro falla')
ok(verificarEstructura('OPORTUNIDAD_DE_MEJORA', 'El registro de asistencia en formato físico es susceptible de mejorar mediante su digitalización, lo cual permitirá agilizar la consolidación de la información y facilitar su análisis.', []).length === 0, 'Oportunidad de mejora bien formada pasa')
ok(verificarEstructura('OPORTUNIDAD_DE_MEJORA', 'El registro de asistencia se realiza correctamente en formato físico y podría digitalizarse para agilizar la consolidación de la información del proceso auditado.', []).length >= 1, 'Oportunidad de mejora sin «susceptible de mejorar» ni futuro falla')
ok(verificarEstructura('OBSERVACION', 'Firmas poco legibles.', []).some((p) => p.includes('breve')), 'redacción demasiado breve falla (V5)')
ok(verificarEstructura('OPORTUNIDAD_DE_MEJORA', 'El registro de asistencia en formato físico es susceptible de mejorar mediante su digitalización y así se agilizará la consolidación; esto permitirá facilitar su análisis.', [])
  .some((p) => p.includes('para lo cual')), 'Oportunidad de mejora sin «para lo cual» (o «lo cual») falla')
ok(verificarEstructura('NO_CONFORMIDAD', 'En la Revisión por la dirección del 14 de julio de 2021 no se incluyó la información relacionada con las decisiones y acciones frente a las oportunidades de mejora. NTC-ISO 9001:2015, numeral 9.3.3.', v933).length === 0,
  'NC al estilo del dueño («no se incluyó…» + requisito, sin la palabra «incumpliendo») pasa')

console.log('\n▸ Guía de redacción del dueño (fórmulas por categoría)')
const v933Guia = [{ criterio_id: 'x', numeral: '9.3.3', documento: 'NTC-ISO 9001:2015', titulo: 'Salidas de la revisión por la dirección' }]
const malosEjemplos = Object.entries(GUIA_REDACCION).flatMap(([c, g]) => g.ejemplos.map((e) => [c, e, verificarEstructura(c, e, v933Guia)])).filter(([, , p]) => p.length)
ok(!malosEjemplos.length, 'cada ejemplo de la guía cumple la fórmula de su categoría', JSON.stringify(malosEjemplos))
ok(Object.entries(GUIA_REDACCION).every(([c, g]) => catalogosCliente.ESTRUCTURAS[c]?.formula === g.formula && catalogosCliente.ESTRUCTURAS[c]?.ejemplo === g.ejemplos[0]),
  'la pantalla muestra las mismas fórmulas y ejemplos que recibe la IA')
const mensajeGuia = construirMensaje({ alcance: 'PROCESOS', proceso: 'Urgencias', codigo: 'AI-1', titulo: 'T' }, [], 'Texto del auditor')
ok(mensajeGuia.includes('## GUÍA DE REDACCIÓN DEL HOSPITAL') && mensajeGuia.indexOf('## GUÍA DE REDACCIÓN') < mensajeGuia.indexOf('## HALLAZGO REPORTADO')
  && Object.values(GUIA_REDACCION).every((g) => mensajeGuia.includes(g.formula)) && mensajeGuia.includes('porque permite') && mensajeGuia.includes('Se establece una NO CONFORMIDAD cuando'),
  'la guía de redacción va en el mensaje de usuario, antes del hallazgo (el prompt del sistema sigue siendo el ANEXO A literal)')
const reparacion = construirReparacion('M', '{}', [{ indice: 0, h: { clasificacion: 'FORTALEZA', problemas: ['no dice por qué es relevante con «porque»'] } }])
ok(reparacion.includes(`Fórmula de la categoría: ${GUIA_REDACCION.FORTALEZA.formula}`), 'la reparación recuerda la fórmula y un ejemplo de la categoría')
// La app verifica lo que edita el auditor con las mismas reglas que el servidor aplica a la IA
const motorCasos = JSON.parse(readFileSync(new URL('./fixtures/motor-casos.json', import.meta.url), 'utf8'))
const corpus = [
  ...Object.values(GUIA_REDACCION).flatMap((g) => g.ejemplos),
  ...motorCasos.resultados.flatMap((r) => r.resultado.hallazgos.map((h) => h.hallazgo_corregido)),
  'Firmas poco legibles.', `En 5 de 20 historias no se encontró la valoración, incumpliendo ${MARCADOR_PENDIENTE}.`,
  'El equipo tiene un excelente seguimiento de los indicadores, lo que permitirá mejorar la toma de decisiones del servicio en los próximos meses del año.',
]
const distintos = corpus.flatMap((texto) => Object.keys(GUIA_REDACCION).map((c) => [c, texto]))
  .filter(([c, texto]) => JSON.stringify(verificarEstructura(c, texto, v933Guia)) !== JSON.stringify(problemasDeEstructura(c, texto, v933Guia)))
ok(!distintos.length, `la verificación de la app (src/lib/estructura.js) coincide con la del servidor en ${corpus.length * 4} casos`, JSON.stringify(distintos[0]))

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

console.log('\n▸ V7 · riesgo y controles (PR13_GQ)')
const ENTRADA_NC = 'Se revisaron 20 historias clínicas de Hospitalización y en 5 no se encontró la valoración de enfermería al ingreso.'
const baseNC = { clasificacion: 'NO_CONFORMIDAD', justificacion: 'j', hallazgo_corregido: 'h', criterio_requisito: 'c', evidencia: 'e', criterios_citados: [] }
const riesgoBueno = { descripcion: 'Posibilidad de omitir la valoración inicial del paciente debido a la falta de registro, lo que podría retrasar su atención.', dimension: 'CALIDAD_SEGURIDAD_PACIENTE', probabilidad: 4, impacto: '3', justificacion: 'Se presentó en 5 de 20 historias revisadas.' }
let v7 = validarRiesgoYControles({ ...baseNC, riesgo: riesgoBueno, controles: [{ descripcion: 'Verificar diariamente el registro de la valoración al ingreso por la jefe de servicio.', tipo: 'PREVENTIVO', criterio_id: 'c-933' }] }, ENTRADA_NC, entregados, [])
ok(v7.riesgo.probabilidad === 4 && v7.riesgo.impacto === 3 && v7.riesgo.dimension === 'CALIDAD_SEGURIDAD_PACIENTE' && v7.avisos.length === 0,
  'acepta un riesgo completo (y el impacto «3» como texto)', JSON.stringify(v7))
ok(v7.controles[0].criterio_id === 'c-933' && v7.controles[0].origen === 'ia' && v7.controles[0].adoptado === false, 'el control propuesto conserva su criterio entregado y llega sin adoptar')
v7 = validarRiesgoYControles({ ...baseNC, clasificacion: 'FORTALEZA', riesgo: riesgoBueno, controles: [{ descripcion: 'Un control que no aplica a una fortaleza', tipo: 'PREVENTIVO' }] }, ENTRADA_NC, entregados, [])
ok(v7.riesgo === null && v7.controles.length === 0, 'una FORTALEZA no lleva riesgo ni controles')
v7 = validarRiesgoYControles({ ...baseNC, riesgo: { ...riesgoBueno, probabilidad: 7, dimension: 'INVENTADA' }, controles: [] }, ENTRADA_NC, entregados, [])
ok(v7.riesgo.probabilidad === null && v7.riesgo.dimension === null && v7.avisos.includes(AVISO_RIESGO_INCOMPLETO), 'una probabilidad fuera de 1 a 5 o una dimensión inventada quedan vacías con aviso')
ok(escala15(2.5) === null && escala15('5') === 5 && escala15(0) === null, 'la escala solo admite enteros de 1 a 5')
ok(dimensionValida('CALIDAD_SEGURIDAD_PACIENTE') === 'CALIDAD_SEGURIDAD_PACIENTE' && dimensionValida('Calidad en la atención y seguridad del paciente') === 'CALIDAD_SEGURIDAD_PACIENTE'
  && dimensionValida('prestacion del servicio') === 'PRESTACION_SERVICIO' && dimensionValida(' Reputacional ') === 'REPUTACIONAL' && dimensionValida('calidad_seguridad_paciente') === 'CALIDAD_SEGURIDAD_PACIENTE'
  && dimensionValida('INVENTADA') === null && dimensionValida(3) === null,
  'V7 reconoce la dimensión del PR13 escrita con su nombre, tildes o minúsculas; lo desconocido se descarta')
v7 = validarRiesgoYControles({ ...baseNC, riesgo: { ...riesgoBueno, dimension: 'Calidad en la atención y seguridad del paciente' }, controles: [] }, ENTRADA_NC, entregados, [])
ok(v7.riesgo.dimension === 'CALIDAD_SEGURIDAD_PACIENTE' && !v7.avisos.includes(AVISO_RIESGO_INCOMPLETO), 'una dimensión con el nombre en vez de la clave ya no deja el riesgo incompleto')
v7 = validarRiesgoYControles({ ...baseNC, riesgo: riesgoBueno, controles: [{ descripcion: 'Auditar el registro según la NTC-ISO 9001:2015 numeral 7.5.3 cada 15 días.', tipo: 'OTRO', criterio_id: 'inventado' }] }, ENTRADA_NC, entregados, [])
ok(v7.controles[0].criterio_id === null && v7.controlesSinCriterio.includes('inventado'), 'un control con un criterio que no se entregó pierde la cita (V1)')
ok(v7.controles[0].tipo === 'CORRECTIVO' && v7.controles[0].descripcion.includes('[cantidad por confirmar]'), 'tipo inválido → correctivo en una NC; cifras inventadas en el control se marcan (V6)', v7.controles[0].descripcion)
v7 = validarRiesgoYControles({ ...baseNC, riesgo: { ...riesgoBueno, justificacion: 'Según la escala del PR13_GQ, es probable.' }, controles: [] }, ENTRADA_NC, entregados, [])
ok(v7.riesgo.justificacion.includes('PR13_GQ') && v7.avisos.some((a) => /no propuso controles/.test(a)), 'mencionar el PR13 en el riesgo no es una referencia inventada; sin controles hay aviso', v7.riesgo.justificacion)
const mensajeRiesgo = construirMensaje({ alcance: 'PROCESOS', proceso: 'Urgencias', codigo: 'AI-1', titulo: 'T' }, entregados, ENTRADA_NC)
ok(/METODOLOGÍA DE RIESGO/.test(mensajeRiesgo) && /5 Casi seguro/.test(mensajeRiesgo) && /CALIDAD_SEGURIDAD_PACIENTE/.test(mensajeRiesgo) && mensajeRiesgo.indexOf('METODOLOGÍA') < mensajeRiesgo.indexOf('HALLAZGO REPORTADO'),
  'el mensaje entrega las escalas del PR13 antes del hallazgo (el prompt del sistema no cambia)')

console.log('\n▸ Informe final con el formato oficial (version_estructura 4)')
{
  const informe = await import('../supabase/functions/_shared/informe.ts')
  const aud = { id: 'a1', codigo: 'AI-2026-001', titulo: 'Auditoría a Urgencias', alcance: 'PROCESOS', proceso: 'Urgencias', sistema: null, objetivo: '',
    criterios: ['NTC-ISO 9001:2015', 'PR13-GQ'], area_auditada: 'Urgencias', auditado_nombre: null, auditado_cargo: null,
    fecha_inicio: '2026-10-01', fecha_fin: '2026-10-03', fecha_inicio_real: '2026-10-02', fecha_fin_real: null }
  const perfilInf = { nombre_completo: 'Ana Pérez', cedula: '1085123456', cargos: ['Auditor médico', 'Coordinadora'], equipo_auditor: [{ nombre: 'Luis Ruiz', cargos: ['Médico'] }], tipo_evaluador: 'AUDITORES_EXTERNOS' }
  const pdf = { nombre: 'acta.pdf', paginas: 2, sha256: 'a'.repeat(64) }
  const base = { severidad: null, estado: 'confirmado', criterio_requisito: 'c', evidencia: 'e', criterios_citados: [], controles: [{ descripcion: 'x', tipo: 'PREVENTIVO', origen: 'ia', adoptado: true }] }
  const hs = [
    { ...base, id: 'h1', consecutivo: 1, clasificacion: 'NO_CONFORMIDAD', hallazgo_corregido: 'NC uno', riesgo_probabilidad: 4, riesgo_impacto: 5, evidencia_archivo: pdf },
    { ...base, id: 'h2', consecutivo: 2, clasificacion: 'FORTALEZA', hallazgo_corregido: 'Fortaleza uno', controles: [], evidencia_archivo: pdf },
    { ...base, id: 'h3', consecutivo: 3, clasificacion: 'OBSERVACION', hallazgo_corregido: 'Obs uno', riesgo_probabilidad: 2, riesgo_impacto: 2,
      evidencia_anexos: [pdf, { nombre: 'registro-firmas.pdf', paginas: 1, sha256: 'e'.repeat(64), agregado_en: '2026-10-05T10:00:00Z' }] },
  ]
  const e = informe.calcularEstadisticas(hs)
  const n = informe.narrativaRespaldo(aud, e)
  ok(Object.entries(n).every(([k, v]) => k === 'indicadores' || (Array.isArray(v) ? v.length : String(v).length) > 0) && n.indicadores === '',
    'la plantilla de respaldo llena todas las secciones narrativas (sin indicadores registrados, su revisión queda vacía)')
  const c = informe.construirContenido({ auditoria: aud, perfil: perfilInf, hallazgos: hs, estadisticas: e, narrativa: n, generadoEn: '2026-10-04T17:14:00Z', version: 1, avisos: [] })
  ok(JSON.stringify(c.hallazgos.map((g) => g.clasificacion)) === '["FORTALEZA","OPORTUNIDAD_DE_MEJORA","OBSERVACION","NO_CONFORMIDAD"]', 'las listas siguen el orden del formato: fortalezas, oportunidades, observaciones, no conformidades')
  ok(c.ficha.evaluador === 'Auditores Externos' && c.encabezado.evaluador === 'Auditores Externos' && c.encabezado.anio === '2026' && c.encabezado.objeto === 'Urgencias',
    'el evaluador y el título de la portada salen del perfil y de la auditoría')
  ok(c.ficha.inicio_planeada === '2026-10-01' && c.ficha.inicio_real === '2026-10-02' && c.ficha.fin_real === '' && c.ficha.lider.cargo === 'Auditor médico, Coordinadora'
    && c.ficha.equipo[0].nombre === 'Luis Ruiz', 'la Ficha Técnica lleva fechas planeadas y reales, el líder y el equipo')
  ok(JSON.stringify(c.ficha.adjuntos) === '["acta.pdf (2 páginas)","registro-firmas.pdf (1 página)"]',
    'los PDF de evidencia (analizados y agregados al editar) van en «Archivos adjuntos», sin repetir', JSON.stringify(c.ficha.adjuntos))
  ok(c.objetivo === n.objetivo && n.objetivo.startsWith('Evaluar'), 'si la auditoría no trae objetivo, se redacta uno')
  ok(c.version_estructura === 4 && !('recomendaciones' in c) && !('recomendaciones' in n), 'la plantilla vigente ya no tiene recomendaciones (versión 4 del contenido)')
  ok(c.indicadores.area === 'Urgencias' && !c.indicadores.revisados.length && c.indicadores.revision === informe.SIN_INDICADORES,
    'sin indicadores registrados, la sección lo dice (y no muestra las cifras de la auditoría)', JSON.stringify(c.indicadores))
  ok(informe.cifrasAuditoria(e).some((l) => l.includes('Riesgos evaluados con la escala del PR13_GQ: 2 (Bajo 1 · Moderado 0 · Alto 0 · Extremo 1)')) && informe.cifrasAuditoria(e).some((l) => l === 'Controles adoptados: 2.'),
    'las cifras de la auditoría las sigue calculando el código, como contexto para la IA')
  // Con indicadores registrados por el auditor (0013)
  const audInd = { ...aud, area_auditada: 'Servicio de Urgencias', indicadores_revisados: [
    { nombre: 'Oportunidad en la atención de triage II', meta: '≤ 30 minutos', resultado: '42 minutos', observacion: 'Dato del último trimestre.' },
    { nombre: 'Proporción de reingresos a urgencias', meta: '', resultado: '', observacion: '' },
  ] }
  const nInd = { ...informe.narrativaRespaldo(audInd, e), indicadores: 'El indicador de oportunidad en triage II (42 minutos) supera la meta de 30 minutos.' }
  const cInd = informe.construirContenido({ auditoria: audInd, perfil: perfilInf, hallazgos: hs, estadisticas: e, narrativa: nInd, generadoEn: '2026-10-04T17:14:00Z', version: 2, avisos: [] })
  ok(cInd.indicadores.area === 'Servicio de Urgencias' && cInd.indicadores.revisados.length === 2 && cInd.indicadores.revisados[0].resultado === '42 minutos'
    && cInd.indicadores.revision === nInd.indicadores && informe.narrativaRespaldo(audInd, e).indicadores.startsWith('Se revisaron dos indicadores priorizados del proceso de Servicio de Urgencias'),
    'con indicadores registrados: el área de la plantilla, la lista exacta del auditor y la revisión redactada', JSON.stringify(cInd.indicadores))
  ok(!informe.cifrasNoRastreables(nInd, audInd, hs, e).length && JSON.stringify(informe.cifrasNoRastreables({ ...nInd, indicadores: 'Resultado de 57 minutos.' }, audInd, hs, e)) === '["57"]',
    'las cifras de los indicadores registrados son rastreables; una inventada se detecta')
  const msgInd = informe.construirMensajeInforme(audInd, hs, e, { lider: ['Coordinadora'], integrantes: [['Médico']], evaluador: 'Auditores Externos' })
  const msgSin = informe.construirMensajeInforme(aud, hs, e, { lider: ['Coordinadora'], integrantes: [['Médico']], evaluador: 'Auditores Externos' })
  ok(msgInd.includes('## INDICADORES PRIORIZADOS DEL PROCESO (registrados por el auditor; proceso: Servicio de Urgencias)')
    && msgInd.includes('[I1] Oportunidad en la atención de triage II · meta: ≤ 30 minutos · resultado: 42 minutos · observación del auditor: Dato del último trimestre.')
    && msgInd.includes('[I2] Proporción de reingresos a urgencias · meta: no definida · resultado: no informado') && msgSin.includes('No se registraron indicadores'),
    'la IA recibe los indicadores del auditor (o el aviso de que no hay) para redactar la revisión')
  const { ESQUEMA_INFORME } = await import('../supabase/functions/_shared/esquema-salida.ts')
  ok(ESQUEMA_INFORME.required.includes('indicadores') && !('recomendaciones' in ESQUEMA_INFORME.properties) && !/recomendaciones/.test(informe.SISTEMA_INFORME),
    'la IA ya no redacta recomendaciones y sí la revisión de indicadores')
  // La vista, el PDF y el ODT arman las secciones igual (src/lib/formato-informe.js)
  const formato = await import('../src/lib/formato-informe.js')
  const seccionInd = formato.seccionesFormato(cInd).find((x) => x.titulo === 'Indicadores')
  ok(seccionInd.antes === 'Revisión de indicadores priorizados en el proceso de Servicio de Urgencias' && seccionInd.antesPlantilla === formato.TEXTOS_FORMATO.revisionIndicadores
    && seccionInd.vinetas[0] === 'Oportunidad en la atención de triage II: meta ≤ 30 minutos; resultado 42 minutos. Dato del último trimestre.'
    && seccionInd.vinetas[1] === 'Proporción de reingresos a urgencias: meta no definida; resultado no informado.'
    && formato.seccionesFormato(cInd).at(-1).titulo === 'Conclusiones' && !formato.esFormatoOficial({ version_estructura: 3 }) && formato.esFormatoOficial(cInd),
    'Indicadores: la línea de la plantilla con el área, cada indicador y la revisión; termina en Conclusiones; los informes de la versión 3 se regeneran')
  // Cada texto que el sistema busca en la plantilla tiene que estar en ella (avisa si el dueño la vuelve a cambiar)
  const { unzipSync, strFromU8 } = await import('fflate')
  const odt = unzipSync(readFileSync(new URL('../src/formato_de_informe_final/Auditoria_interna.odt', import.meta.url)))
  const textoPlantilla = ['content.xml', 'styles.xml'].map((x) => strFromU8(odt[x])).join(' ')
    .replace(/<text:s text:c="(\d+)"\/>/g, (_, k) => ' '.repeat(Number(k))).replace(/<text:s\/>/g, ' ').replace(/<\/text:(p|h)>/g, '\n').replace(/<[^>]+>/g, '')
  const lineasPlantilla = textoPlantilla.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
  const buscados = [...Object.entries(formato.TEXTOS_FORMATO).filter(([k]) => k !== 'marcadorArea').map(([, v]) => v),
    ...formato.LISTAS_HALLAZGOS.map((l) => l.titulo), ...formato.seccionesFormato(cInd).map((x) => x.titulo)]
  const faltan = buscados.filter((t) => !lineasPlantilla.some((l) => l === t || l.startsWith(`${t} `) || l.includes(t)))
  ok(!faltan.length && !lineasPlantilla.includes('RECOMENDACIONES:'), 'la plantilla oficial tiene todos los textos que el sistema busca (y ya no RECOMENDACIONES:)', faltan.join(' | '))
  ok(JSON.stringify(informe.cifrasNoRastreables({ ...n, conclusiones: 'Se revisaron 37 historias.' }, aud, hs, e)) === '["37"]', 'una cifra inventada en la narrativa se detecta')
  ok(!informe.perfilIncompletoInforme(perfilInf) && informe.perfilIncompletoInforme({ ...perfilInf, tipo_evaluador: null }), 'sin grupo de evaluador el informe no se puede generar')
}

console.log('\n▸ Resultados de la auditoría (consolidado bajo la matriz)')
{
  const { resultadosAuditoria, tintaSobre, SIN_NORMA } = await import('../src/lib/resultados.js')
  const cita = (documento) => ({ criterio_id: 'x', numeral: '1', documento })
  const r = resultadosAuditoria([
    { clasificacion: 'NO_CONFORMIDAD', estado: 'confirmado', criterios_citados: [cita('NTC-ISO 9001:2015'), cita('NTC-ISO 9001:2015')] },
    { clasificacion: 'FORTALEZA', estado: 'generado', criterios_citados: [cita('NTC-ISO 9001:2015'), cita('PR13-GQ')] },
    { clasificacion: 'OBSERVACION', estado: 'editado', criterios_citados: [] },
    { clasificacion: 'FORTALEZA', estado: 'cambios_sugeridos', criterios_citados: [cita('PR13-GQ')] },
    { clasificacion: 'OPORTUNIDAD_DE_MEJORA', estado: 'descartado', criterios_citados: [cita('ISO 19011')] },
  ])
  ok(r.total === 4 && JSON.stringify(r.porClasificacion.map((d) => [d.clasificacion, d.n, d.porcentaje]))
    === JSON.stringify([['NO_CONFORMIDAD', 1, 25], ['FORTALEZA', 2, 50], ['OBSERVACION', 1, 25], ['OPORTUNIDAD_DE_MEJORA', 0, 0]]),
  'cuenta los hallazgos vigentes por clasificación, en el orden NC, F, O, OM, con su porcentaje (los descartados no cuentan)')
  ok(JSON.stringify(r.normas.map((f) => [f.norma, f.total])) === JSON.stringify([['NTC-ISO 9001:2015', 2], ['PR13-GQ', 2], [SIN_NORMA, 1]]) && r.maximo === 2
    && r.normas[0].conteo.NO_CONFORMIDAD === 1 && r.normas[0].conteo.FORTALEZA === 1,
    'por norma: un hallazgo cuenta una vez en cada documento que cita; sin criterio verificado va al final como requisito pendiente')
  ok(resultadosAuditoria([]).total === 0 && resultadosAuditoria([]).porClasificacion.every((d) => d.porcentaje === 0) && !resultadosAuditoria([]).normas.length,
    'sin hallazgos: todo en cero, sin barras')
  ok(tintaSobre('#b42318') === '#ffffff' && tintaSobre('#b7791f') === '#16222c', 'el número dentro de un segmento usa el color de texto con más contraste sobre su relleno')
}

console.log('\n▸ Catálogos del cliente y del servidor')
ok(JSON.stringify(catalogosServidor.PROCESOS) === JSON.stringify(catalogosCliente.PROCESOS), 'los 19 procesos coinciden entre el frontend y las Edge Functions')
ok(JSON.stringify(catalogosServidor.SISTEMAS) === JSON.stringify(catalogosCliente.SISTEMAS), 'los 6 sistemas coinciden entre el frontend y las Edge Functions')
ok(JSON.stringify(catalogosServidor.DOCUMENTOS_POR_ALCANCE) === JSON.stringify(catalogosCliente.DOCUMENTOS_POR_ALCANCE), 'el mapa de documentos por alcance coincide')
ok(catalogosServidor.MARCADOR_PENDIENTE === catalogosCliente.MARCADOR_PENDIENTE, 'el marcador de requisito pendiente es idéntico')
ok(['ESCALA_PROBABILIDAD', 'NIVELES_IMPACTO', 'DIMENSIONES_IMPACTO', 'TIPOS_CONTROL', 'FUENTE_RIESGO'].every((k) =>
  JSON.stringify(catalogosServidor[k]) === JSON.stringify(catalogosCliente[k])), 'las escalas de riesgo del PR13 coinciden entre el frontend y las Edge Functions')
const migracion0007 = readFileSync(new URL('../supabase/migrations/0007_riesgo_controles_matriz.sql', import.meta.url), 'utf8')
const dimensionesSql = [...migracion0007.match(/riesgo_dimension in \(([^)]*)\)/)[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort()
ok(JSON.stringify(dimensionesSql) === JSON.stringify(Object.keys(catalogosServidor.DIMENSIONES_IMPACTO).sort()), 'las dimensiones de impacto coinciden con el check de PostgreSQL', dimensionesSql.join(', '))
const migracion0009 = readFileSync(new URL('../supabase/migrations/0009_cargos_y_equipo_auditor.sql', import.meta.url), 'utf8')
const cargosSql = (funcion) => [...migracion0009.match(new RegExp(`function public\\.${funcion}\\(\\)[\\s\\S]*?array\\[([\\s\\S]*?)\\]::text\\[\\]`))[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const migracion0010 = readFileSync(new URL('../supabase/migrations/0010_evaluador_y_fechas_reales.sql', import.meta.url), 'utf8')
const evaluadoresSql = [...migracion0010.match(/evaluador_tipo as enum \(([^)]*)\)/)[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
ok(JSON.stringify(Object.keys(catalogosCliente.TIPOS_EVALUADOR)) === JSON.stringify(evaluadoresSql)
  && JSON.stringify(catalogosServidor.TIPOS_EVALUADOR) === JSON.stringify(catalogosCliente.TIPOS_EVALUADOR), 'los tipos de evaluador coinciden con el enum de PostgreSQL y entre cliente y servidor')
ok(JSON.stringify(catalogosServidor.UMBRALES_RIESGO) === JSON.stringify(catalogosCliente.UMBRALES_RIESGO)
  && Object.entries(catalogosServidor.NIVELES_RIESGO).every(([z, e]) => catalogosCliente.ZONAS_RIESGO[z]?.etiqueta === e), 'la escala fija de niveles de riesgo es la misma en el informe (servidor) y en la aplicación')
for (const [nombre, funcion] of [['CARGOS_LIDER', 'cargos_lider'], ['CARGOS_EQUIPO', 'cargos_equipo']]) {
  const sql = cargosSql(funcion)
  ok(JSON.stringify(catalogosServidor[nombre]) === JSON.stringify(catalogosCliente[nombre]) && JSON.stringify(sql) === JSON.stringify(catalogosCliente[nombre]),
    `la lista ${nombre} (${sql.length} cargos) coincide en el frontend, las Edge Functions y public.${funcion}()`, `${sql.length} en SQL, ${catalogosCliente[nombre].length} en el cliente`)
}

console.log('\n▸ Content Security Policy')
const REAL = 'https://obqkaegizxtbmdvcscdl.supabase.co'
ok(normalizarUrlSupabase(`${REAL}\r\n`) === REAL, 'la URL con «\\r\\n» pegado desde GitHub se normaliza (el valor que rompió el registro)')
ok(normalizarUrlSupabase(`  ${REAL}/ `) === REAL, 'quita espacios y la barra final')
ok(normalizarUrlSupabase(undefined) === '' && normalizarUrlSupabase('') === '', 'sin variable no hay origen (la app muestra el aviso de configuración)')
const lanza = (v) => { try { normalizarUrlSupabase(v); return false } catch { return true } }
ok(lanza('http://obqkaegizxtbmdvcscdl.supabase.co') && lanza('obqkaegizxtbmdvcscdl') && lanza(`${REAL}/rest/v1`), 'una URL inválida hace fallar el build en vez de publicar un sitio roto')
const csp = politicaCsp(normalizarUrlSupabase(`${REAL}\r\n`))
ok(csp.includes(`connect-src 'self' ${REAL} wss://obqkaegizxtbmdvcscdl.supabase.co`), 'la CSP permite conectar con el proyecto Supabase', csp)
ok(/script-src 'self';/.test(csp) && csp.includes("object-src 'none'"), 'la CSP solo permite scripts propios')

console.log('\n▸ Mensajes de error al usuario')
const silenciar = console.error
console.error = () => {}
const esquemaViejo = { code: 'PGRST204', message: "Could not find the 'acepto_tratamiento_datos_en' column of 'profiles' in the schema cache" }
ok(/no está actualizada/.test(mensajeError(esquemaViejo)), 'una columna inexistente (falta una migración) se explica como base de datos desactualizada')
ok(/no está actualizada/.test(mensajeError({ code: '42703', message: 'column profiles.aprobado does not exist' })), 'también con el código de Postgres 42703')
ok(/registro de cuentas está desactivado/.test(mensajeError({ code: 'email_provider_disabled', message: 'Email signups are disabled' })), 'registro desactivado en Supabase')
ok(/^No se pudo completar la acción/.test(mensajeError({ code: 'XX000', message: 'detalle interno de la tabla secreta' })), 'un error desconocido no se muestra tal cual al usuario')
console.error = silenciar
ok(describirError(esquemaViejo) === "code: PGRST204 · message: Could not find the 'acepto_tratamiento_datos_en' column of 'profiles' in the schema cache", 'la consola recibe el error en texto legible, no «Object»')

console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron\n` : '\n✓ Validación verificada\n')
process.exit(fallos ? 1 : 0)
