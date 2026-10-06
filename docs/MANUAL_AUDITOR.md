# Manual del auditor · halla

halla es la herramienta del Hospital Infantil Los Ángeles para registrar los hallazgos de auditoría
interna. Usted describe con sus palabras lo que observó; el sistema decide si es una **no conformidad**,
una **observación**, una **oportunidad de mejora** o una **fortaleza**, lo redacta con lenguaje técnico
de auditoría, busca el requisito aplicable en las normas cargadas, evalúa el riesgo con el PR13_GQ y propone
controles. Todo llega a una matriz consolidada que usted valida y descarga en Excel, y al final se genera el informe.

**El juicio profesional sigue siendo suyo.** Todo lo que propone la IA se puede revisar y corregir antes
de guardarlo.

---

## 1. Crear la cuenta

Entre a **halla.ink → Crear cuenta**. Son tres pasos:

1. **Cuenta:** correo y contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número).
2. **Datos del auditor:** nombre completo, cédula, celular, **grupo de auditores** y **cargos**. Puede escribir la
   cédula con puntos (1.085.123.456) y el celular con +57: el sistema los normaliza. En el grupo elija si pertenece
   a los **Auditores Internos** o a los **Auditores Externos**: es el «Evaluador» de la Ficha Técnica del informe y
   aparece también en su portada. Los cargos no se escriben: pulse **Cargos**,
   busque en la lista de líderes (no importan las tildes) y marque uno o varios, hasta 5. Cada cargo elegido
   aparece como una etiqueta con una × para quitarlo.
3. **Equipo auditor y alcance:** las personas que lo acompañan en la auditoría, al menos una y hasta 10. Para
   cada una escriba el nombre y elija uno o varios cargos de la lista del equipo auditor. Con **Agregar otra
   persona al equipo** suma más personas y con **Quitar** retira las que sobran. Indique también si usted
   audita **procesos** o **sistemas**, y con cuál. Al final debe **autorizar el tratamiento de sus datos
   personales** (Ley 1581 de 2012). Registre en el equipo solo a personas que sepan que aparecerán en los informes.

Abra el enlace de confirmación que le llega al correo (revise también el correo no deseado). Después, **un
administrador debe aprobar su cuenta**: hasta entonces verá el aviso «Tu cuenta está pendiente de
aprobación». Avísele al administrador de la plataforma.

Su sesión queda abierta el tiempo que quiera, aunque cierre el navegador, hasta que pulse **Salir**. **En un
computador compartido, pulse siempre Salir al terminar.** Estos datos aparecen en la Ficha
Técnica del informe (evaluador, equipo auditor y líder del equipo); puede cambiarlos en **Mi perfil**.

**Si su cuenta es anterior al 4 de octubre de 2026**, antes el cargo se escribía a mano. Si lo que escribió
coincide con un cargo de la lista, se conservó; si no, verá el aviso «Completa tu perfil»: entre a **Mi
perfil**, elija su grupo de auditores, sus cargos y los de su equipo, y guarde. Sin eso no se puede generar el
informe.

## 2. Crear una auditoría

**Auditorías → Nueva auditoría.** Una auditoría agrupa los hallazgos de un proceso o sistema y termina
en un informe.

- El **código** se propone solo (AI-2026-001, AI-2026-002…). Puede cambiarlo.
- Escriba el **título**, las fechas de inicio y terminación **planeadas** y confirme el proceso o sistema. Las
  fechas **reales** son opcionales aquí: puede registrarlas al generar el informe.
- El botón **Sugerir con IA** propone el objetivo, el área auditada y las normas aplicables. Revise y
  ajuste lo que haga falta antes de guardar.

Al pulsar **Crear auditoría** la plataforma le pregunta cómo quiere empezar:

- **Sí, crear la lista de verificación:** abre la lista de la nueva auditoría (§3) para preparar la visita.
- **Iniciar directamente la auditoría:** lo lleva a la auditoría para registrar hallazgos. Puede crear la lista
  más adelante con el botón **Crear lista de verificación**.

## 3. Preparar la lista de verificación

Antes de ir al lugar de la auditoría, cree la lista al crear la auditoría (§2) o, dentro de ella, con **Crear lista de
verificación**. Es su hoja de trabajo, con el formato del hospital: organice ahí lo que va a verificar y anote durante
la visita. **No pasa por la IA** ni cambia los hallazgos, la matriz o el informe.

- **Auditoría No y Fecha:** el código de la auditoría y la fecha de la lista.
- **INFORMACION GENERAL:** quién la elabora, el proceso, el cargo y nombre de los auditados, la fecha y el lugar de
  ejecución. Se llenan con los datos de la auditoría y de su perfil; puede cambiarlos.
- **LISTA DE VERIFICACIÓN:** secciones (por ejemplo, «GESTION DE RECURSOS FISICOS (MANTENIMIENTO)») con filas de
  normatividad o requisito, pregunta, documentos o evidencia, la marca **NC** (No Conforme), **O** (Oportunidad),
  **OB** (Observación) o **F** (Fortaleza) y sus anotaciones. Cada fila admite una sola marca; púlsela otra vez para
  quitarla. Use **Agregar fila** y **Agregar sección** para ampliarla.
- **Guardar cambios:** la barra de abajo siempre está a la vista. Además, la lista se guarda sola un momento después
  de cada cambio, y también con **Ctrl+S**. La barra dice «Cambios sin guardar», «Guardando…» o «Cambios guardados
  a las…». Si sale de la página o **cierra la sesión**, lo pendiente se guarda antes; si cierra la pestaña con
  cambios sin guardar, el navegador le avisa.
- **Continuar con la auditoría:** guarda y lo lleva a la auditoría.
- **Cada vez que entre a una auditoría que tiene lista**, la plataforma le pregunta si quiere **seguir editando la
  lista** o **continuar con el proceso de auditoría**, y le muestra el avance (cuántos puntos tienen marca) y la
  última edición. No pregunta cuando vuelve a la auditoría desde la lista, un hallazgo, la matriz o el informe.
- **Descargar PDF** la entrega en carta horizontal, para llevarla impresa.
- Con la auditoría cerrada, la lista queda en solo lectura (se puede ver y descargar). Si necesita cambiarla, reabra
  la auditoría.

Lo que encuentre en la visita lo registra después como hallazgo con el asistente (§4).

## 4. Registrar un hallazgo: el asistente de 7 pasos

Dentro de la auditoría: **Nuevo hallazgo**. La plataforma lo guía paso a paso; arriba verá los 7 pasos y
puede volver a cualquiera de ellos. Lo que cambie se guarda al pasar de un paso a otro.

| Paso | Qué hace usted | Qué hace la IA |
|---|---|---|
| 1. Evidencia | Escribe lo que encontró o carga un PDF | — |
| 2. Requisito | Revisa la norma, el numeral y el requisito | Los busca en las normas cargadas |
| 3. Clasificación | Revisa la categoría y su justificación | Decide la categoría |
| 4. Redacción | Revisa el hallazgo redactado y la evidencia; puede cargar otro PDF de evidencia | Lo reescribe con la fórmula de la categoría |
| 5. Riesgo | Confirma o ajusta el riesgo | Lo identifica y lo evalúa con el PR13_GQ |
| 6. Controles | Adopta controles o escribe los suyos | Propone controles |
| 7. Matriz | Envía todo a la matriz consolidada | — |

### Paso 1 · Evidencia

Describa lo que observó como lo contaría a un colega. No se preocupe por la redacción técnica ni por la
categoría: eso lo hace el sistema. Lo que sí importa es el **contenido**:

> **No escriba datos de pacientes ni de funcionarios**: ni nombres, ni números de documento, ni de historia
> clínica. Describa el hecho, no a la persona («en 5 historias clínicas…», no «la historia de María Pérez…»).
> El texto se envía a un servicio de inteligencia artificial externo; aunque el sistema retira esos datos
> antes de enviarlo, no puede detectarlos todos.

- **Qué revisó:** historias clínicas, actas, registros, el área física…
- **Cuántos:** «se revisaron 20 historias clínicas».
- **Qué encontró y dónde:** «en 5 de ellas no estaba registrada la valoración de enfermería».
- Si conoce el procedimiento o la norma que aplica, menciónelo.

Ejemplo bueno:

> Se revisaron 20 historias clínicas del servicio de Hospitalización y en 5 de ellas no se encontró
> registrada la valoración de enfermería al ingreso.

Ejemplo pobre (le falta evidencia):

> Las historias están mal.

**Si registró los hallazgos en un PDF**, use **Cargar un PDF de evidencia** (hasta 20 MB y 100 páginas):

- Si el PDF tiene texto, el sistema lo extrae y lo pone en el cuadro de evidencia. Revíselo y borre lo que no
  sea evidencia (encabezados, firmas, datos personales).
- Si el PDF es **escaneado** (una imagen), no tiene texto que extraer: describa su contenido en el cuadro.
- Si el texto pasa de 6 000 caracteres, elija qué páginas importar y analice el resto como otro hallazgo.
- **El PDF no sale de su computador**: se lee en el navegador. En el hallazgo solo quedan el nombre del
  archivo, el número de páginas y una huella digital (SHA-256) que permite comprobar después cuál archivo fue.
- **También puede cargar un PDF al editar el hallazgo** (paso 4 o **Ver y editar**, ver §6).

Pulse **Analizar con IA**. Tarda normalmente entre 5 y 20 segundos. **Usted no elige la categoría**: la
determina el sistema con este orden de preguntas:

1. ¿Hay un requisito obligatorio que no se cumple, con evidencia? → **No conformidad**
2. ¿Hay una debilidad o un riesgo, sin incumplimiento? → **Observación**
3. ¿Hay una práctica positiva destacada con beneficio demostrable? → **Fortaleza**
4. ¿Se cumple, pero podría hacerse mejor? → **Oportunidad de mejora**

Si en un mismo texto describe dos situaciones de distinto tipo (por ejemplo, un extintor vencido y un
personal que domina muy bien un protocolo), el sistema las separa en dos hallazgos. En los pasos 2 a 6
verá los botones **Situación 1** y **Situación 2** para revisar cada una.

### Paso 2 · Norma, numeral y requisito

Por cada requisito que sustenta el hallazgo verá la **norma** (por ejemplo, NTC-ISO 9001:2015), el
**numeral** (9.3.3) y el **texto del requisito** tal como está en el documento cargado. La IA solo puede
citar numerales que existan en esos documentos.

Si no hay un requisito verificable, el criterio dice literalmente *[Requisito específico pendiente de
identificación/validación]*. Si usted conoce el requisito (un procedimiento institucional, una
resolución), escríbalo en **Criterio / requisito**.

### Paso 3 · Clasificación

La categoría que decidió la IA, la justificación y la severidad sugerida. Si su criterio profesional no
coincide, use **Corregir clasificación**: quedará registrado que usted la cambió.

### Paso 4 · Redacción

El hallazgo reescrito con la fórmula obligatoria de su categoría (ver §5) y la evidencia. Haga clic sobre
cualquier texto para corregirlo. Su texto original **siempre se conserva** tal como lo escribió («Ver texto
original del auditor») y no se puede modificar: es la evidencia de lo que usted reportó.

### Paso 5 · Riesgo

La IA identifica el riesgo y lo evalúa con las escalas del procedimiento **PR13_GQ Gestión de riesgos**:

- **Riesgo identificado:** «Posibilidad de <evento> debido a <causa>, lo que podría <consecuencia>».
- **Dimensión de impacto:** calidad en la atención y seguridad del paciente, prestación del servicio,
  legal, financiero, reputacional o ambiental.
- **Probabilidad (1 a 5):** Raro, Improbable, Posible, Probable, Casi seguro. Debajo de cada valor verá su
  descripción del PR13. La IA solo conoce lo que usted escribió: si sabe con qué frecuencia ha ocurrido,
  ajuste la probabilidad.
- **Impacto (1 a 5):** Insignificante, Menor, Moderado, Mayor, Catastrófico, con la descripción de la
  dimensión elegida.

El **nivel de riesgo** no lo decide la IA: lo calcula el sistema. Riesgo inherente = probabilidad ×
impacto, y el puntaje se ubica en Bajo, Moderado, Alto o Extremo. Junto al nivel verá el tratamiento que
indica el PR13. Una no conformidad nunca se «asume»: el PR13 no admite aceptar riesgos que conlleven un
incumplimiento normativo.

El **mapa de calor 5 × 5** muestra en cada casilla el puntaje y el nivel; el círculo oscuro dice cuántos
hallazgos de la auditoría están en esa casilla, y el borde grueso marca el hallazgo actual. Puede hacer clic
en una casilla para elegir la probabilidad y el impacto a la vez.

La escala de niveles es **fija** y no se puede editar: **Bajo** de 1 a 4, **Moderado** de 5 a 9, **Alto** de
10 a 16 y **Extremo** de 17 a 25. Es la misma para todas las auditorías.

Una **fortaleza** no lleva riesgo ni controles.

### Paso 6 · Controles

La IA propone de uno a tres controles (preventivos o correctivos). **Marque los que desea adoptar**: los de
la IA no se reescriben; si quiere otro, agréguelo como control propio con **Agregar control**. Sus controles
se pueden editar y eliminar.

### Paso 7 · Enviar a la matriz

Un resumen de cada hallazgo con su requisito, su nivel de riesgo y los controles adoptados. Si a alguno le
falta algo para poder validarlo después (el riesgo o un control adoptado), se lo indica con un enlace para
completarlo. **Enviar a la matriz consolidada** guarda todo y lo lleva a la matriz, donde el hallazgo queda
como **Pendiente**.

### Los avisos

| Aviso | Qué hacer |
|---|---|
| **Requisito pendiente** | No hay en las normas cargadas un requisito que sustente el hallazgo. Si usted lo conoce, escríbalo en el campo. |
| **Se marcaron fechas o cifras…** | La IA escribió un dato que usted no dio. Se reemplazó por *[fecha por confirmar]* o *[cantidad por confirmar]*: complételo o bórrelo. |
| **Se retiraron referencias normativas…** | La IA citó algo que no está en las normas cargadas y se quitó. Revise que el criterio quede bien. |
| **Revisa la redacción** | La redacción no sigue del todo la fórmula de la categoría. Corríjala a mano. |
| **Completa el riesgo** | La IA no propuso una probabilidad, un impacto o una dimensión válidos. Elíjalos en el paso 5. |
| **La IA no propuso controles** | Agregue al menos uno propio en el paso 6. |

El sistema **nunca inventa** numerales, normas, fechas ni cifras: si no puede verificarlos, lo dice.

### Reanalizar o descartar

En el paso 1, después del análisis:

- **Reanalizar:** descarta este resultado y vuelve a analizar el mismo texto.
- **Descartar:** descarta el resultado; su texto sigue en la caja por si quiere reescribirlo.

## 5. Las cuatro fórmulas de redacción

Una vez clasificado, cada hallazgo se redacta con la fórmula de su categoría (guía del hospital):

| Categoría | Cuándo | Fórmula | Ejemplo |
|---|---|---|---|
| **No conformidad** | Se evidencia el incumplimiento de un requisito, norma o procedimiento | Evidencia + incumplimiento + requisito incumplido | En la Revisión por la dirección del 14 de julio de 2021 no se incluyó la información relacionada con las decisiones y acciones relacionadas con las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3. |
| **Fortaleza** | Se identifica una práctica positiva y destacable que genera beneficios al proceso o al sistema | Qué es relevante + **porque** + beneficio obtenido en el presente | El liderazgo de la alta dirección del sistema de gestión, porque permite la mejora de los procesos y la competencia de su personal. |
| **Observación** | Hay una situación que requiere atención o seguimiento, pero no es un incumplimiento comprobado | Aspecto a mejorar o debilidad + impacto que se generaría en el proceso, sistema o estrategia | Se evidencia falta de planificación de los cambios relacionados con la reposición e incursión de tecnología biomédica, que podría impactar en la ocurrencia de posibles eventos adversos. |
| **Oportunidad de mejora** | El proceso cumple, pero puede optimizarse para obtener mejores resultados | Qué es susceptible de mejorar + **para lo cual** + beneficio en el futuro | La infraestructura para la prestación de los servicios es susceptible de mejorar, lo cual permitirá contar con espacios agradables y de confort para el cliente. |

Se establece una **no conformidad** cuando el hallazgo incumple requisitos del cliente, legales, de la organización o
de ISO 9001; se repite durante la recolección de la información; genera un alto impacto para la entidad; la
documentación es diferente a lo que sucede en la realidad; el auditado no conoce las disposiciones documentadas
aplicables; hay contradicciones en procedimientos, formatos o guías; faltan las evidencias objetivas (registros); o
falta consignar información en los registros.

Una no conformidad sin requisito identificado **sigue siendo no conformidad**: el criterio queda como
pendiente para que usted lo complete.

**La plataforma revisa la fórmula mientras usted edita.** Debajo del hallazgo corregido verá «Sigue la fórmula de…»
o, si no la cumple, «Ajusta la redacción a la fórmula de…» con lo que falta (por ejemplo, el «porque» de una
fortaleza) y un ejemplo. **Si corrige la clasificación**, el texto conserva la fórmula de la categoría anterior: la
plataforma se lo avisa para que lo ajuste. Es una guía: no le impide guardar ni validar.

## 6. Gestionar los hallazgos de una auditoría

En el detalle de la auditoría verá los contadores por categoría (haga clic en uno para filtrar), un
buscador y la lista de hallazgos. Cada uno tiene un número (H-01, H-02…), su nivel de riesgo y un estado:

| Estado | Significa |
|---|---|
| **Pendiente** | La IA lo produjo y usted aún no lo valida. Si usted lo modificó, dice «Pendiente (editado)». |
| **Validado** | Usted lo revisó y lo aprobó. |
| **Se sugiere hacer cambios** | Hay que corregirlo antes de validarlo; puede llevar una nota con los cambios sugeridos. |
| **Descartado** | No se incluye en la matriz ni en el informe. Se puede restaurar. |

Acciones: **Ver y editar**, **Validar**, **Duplicar** (útil para dos situaciones parecidas) y
**Descartar**. Cuando termine, puede **Cerrar la auditoría** para que no admita hallazgos nuevos.

**Cargar un PDF de evidencia al editar.** En el paso 4 del asistente y en **Ver y editar** (desde el detalle o
la matriz), debajo de la evidencia está **Cargar un PDF de evidencia**:

- Si el PDF tiene texto, se agrega al final del cuadro de evidencia, que se abre para que lo revise. Borre lo que no
  sea evidencia y pulse **Aplicar**: se guardan la evidencia y el PDF. **Cancelar** (o Esc) descarta los dos.
- Si es escaneado, describa su contenido en el cuadro y pulse **Aplicar** para registrarlo.
- Debajo aparecen los **PDF de evidencia registrados**: el que analizó la IA (no se puede quitar) y los que agregó
  al editar, con su fecha; estos se pueden quitar. Un mismo PDF no se registra dos veces.
- Todos aparecen en «Archivos adjuntos» de la Ficha Técnica del informe. Como cualquier edición, agregar o quitar
  un PDF devuelve a Pendiente un hallazgo validado.

Para validar un hallazgo (que no sea fortaleza) debe tener el riesgo completo (descripción, dimensión,
probabilidad e impacto) y al menos un control adoptado. **Si edita un hallazgo ya validado, vuelve a
Pendiente**: la validación corresponde a lo que usted revisó, no a una versión posterior.

Si intenta validar y le falta algo (por ejemplo, «Para validarlo falta la dimensión de impacto»), la plataforma abre
el hallazgo directamente en la sección por completar y marca en rojo el campo vacío. Complételo y pulse **Validar
hallazgo** en esa misma ventana.

## 7. La matriz consolidada

**Matriz consolidada** (en el detalle de la auditoría, o al terminar el paso 7) reúne todos los hallazgos
vigentes en una tabla con estas columnas: **ID, Clasificación, Norma y numeral, Evidencia, Riesgo,
Hallazgo, Evaluación, Controles y Estado**. Arriba verá cuántos hay en cada estado y el mapa de calor de
toda la auditoría.

En la columna **Estado** elija para cada hallazgo:

- **Pendiente:** aún sin revisar.
- **Validado:** revisado y aprobado.
- **Se sugiere hacer cambios:** se abre un cuadro para anotar qué cambiar (opcional).

Para corregir un hallazgo, haga clic en su ID (H-01…): se abre con todos sus pasos editables.

**Descargar matriz (Excel)** solo funciona cuando **todos** los hallazgos están en **Validado**:

- Si alguno está **Pendiente**, aparece el aviso «La matriz aún no se ha validado» con la lista de los que
  faltan.
- Si alguno tiene **Se sugiere hacer cambios**, tampoco se descarga: el aviso muestra cuáles y sus notas.

El archivo se llama `Matriz_<código>_<AAAAMMDD>.xlsx` e incluye las mismas columnas, el color del nivel de
riesgo y la escala de niveles.

**Resultados de la auditoría.** Debajo de la matriz está el consolidado, con los hallazgos vigentes (los
descartados no cuentan):

- **Hallazgos por clasificación:** un gráfico circular con el total al centro, la cantidad y el porcentaje de cada
  clasificación, y las siglas **NC** (no conformidad), **F** (fortaleza), **O** (observación) y **OM** (oportunidad
  de mejora).
- **Distribución de hallazgos por norma o documento:** una barra por norma, con sus hallazgos por clasificación. Un
  hallazgo que cita varias normas cuenta en cada una; los que no tienen requisito verificado aparecen como
  «Requisito pendiente de identificación».
- Sin hallazgos, el consolidado avisa que aún no hay datos para los gráficos.

## 8. Generar el informe

El informe final sigue **exactamente** el formato oficial del hospital (el documento
`Auditoria_interna.odt` que entregó la oficina de calidad). Con al menos un hallazgo validado:

1. **Registre las fechas reales** de la auditoría en el recuadro «Fechas reales de la auditoría» (las fechas que
   escribió al crear la auditoría son las planeadas). Si no las registra, quedan en blanco en la Ficha Técnica.
2. **Registre los indicadores priorizados del proceso** que revisó, en el recuadro «Indicadores priorizados del
   proceso»: el nombre, la meta, el resultado y, si quiere, una observación (hasta 15). Van en la sección
   «Indicadores» del informe, bajo «Revisión de indicadores priorizados en el proceso de <área auditada>». Si no
   registra ninguno, esa sección dice que no se registraron.
3. Pulse **Generar informe**. Incluye todos los hallazgos no descartados; si alguno está sin validar, se le avisa.

El informe tiene, en este orden:

| Parte | Qué lleva | Quién lo llena |
|---|---|---|
| Portada | Logo, «HOSPITAL INFANTIL LOS ANGELES», «Auditoria Interna - año - proceso», su grupo de auditores, el año y «Auditoria interna de SIG» | El sistema |
| Ficha Técnica | Fechas planeadas y reales, sistema de referencia (normas de la auditoría), evaluador, equipo auditor, líder del equipo y archivos adjuntos (los PDF de evidencia) | El sistema |
| Auditoria interna de SIG | Las listas FORTALEZAS IDENTIFICADAS, OPORTUNIDADES DE MEJORA, OBSERVACIONES y NO CONFORMIDADES, con la redacción validada de cada hallazgo | El sistema |
| Objetivo | El objetivo de la auditoría (si no lo escribió, lo redacta la IA) | Usted / la IA |
| Alcance, Criterios de selección equipo auditor, Priorización de procesos, Riesgos y oportunidades del programa auditoria, Oportunidades, Observaciones y Conclusiones | Texto redactado a partir de los hallazgos, los riesgos y el equipo | La IA |
| Criterios de auditoría y Métodos a emplear | Las normas (con los numerales citados) y los métodos de la auditoría | El sistema |
| Indicadores | «Revisión de indicadores priorizados en el proceso de <área auditada>», cada indicador con su meta y su resultado, y la revisión que compara el resultado con la meta | Usted registra los indicadores; la IA redacta la revisión |

- **Las cifras las calcula el sistema o las registra usted**, no la IA. Si la IA escribe una cifra que no está en los
  datos (hallazgos, indicadores o estadísticas), se le avisa.
- El formato vigente ya no tiene **RECOMENDACIONES**: la oficina de calidad las retiró de la plantilla.
- A la IA no llegan los nombres del equipo auditor, solo sus cargos.
- Si cambia los hallazgos, las fechas o los indicadores, genere una **nueva versión**: las anteriores se conservan.
- Descárguelo como **Documento (ODT)**, que es la plantilla oficial llena y se abre en LibreOffice y en Word, o en
  **PDF**, que reproduce el mismo formato.
- Un informe generado con una plantilla anterior (por ejemplo, con RECOMENDACIONES) no se descarga: genere una
  nueva versión.

## 9. Consultar las normas

**Normas** permite buscar en los documentos que el sistema puede citar: NTC-ISO 9001:2015, ISO 45001:2018,
NTC-ISO 14001:2015, ISO 19011 y el procedimiento PR13-GQ de gestión de riesgos. Si un numeral no aparece
ahí, el sistema no lo usa.

Use las palabras de la norma: «información documentada» encuentra más que «registros». La ISO 19011 está
en inglés, así que se encuentra con términos en inglés («audit findings»).

## 10. Preguntas frecuentes

**El análisis dice que se agotó la cuota de la IA.** El servicio gratuito tiene un número limitado de
análisis por día para todo el hospital. Su texto no se pierde: inténtelo más tarde o avise al
administrador. El informe se puede generar igual (con un texto de conclusiones de plantilla).

**El análisis tarda mucho.** Si el servicio de IA está saturado, el sistema reintenta y, si hace falta,
usa otro modelo. Puede esperar hasta un minuto.

**La IA clasificó algo que yo considero distinto.** Use **Corregir clasificación**. Quedará registrado que
la clasificación fue ajustada por usted.

**¿Puedo borrar un hallazgo?** Se descarta, no se borra: así queda la trazabilidad de todo lo analizado.

**¿Quién ve mis auditorías?** Solo usted y los administradores de la plataforma.

**¿Qué pasa si edito un hallazgo?** Se guarda un historial con la versión anterior, quién la cambió y cuándo.
Si estaba validado, vuelve a Pendiente.

**¿El PDF que cargo queda guardado en la plataforma?** No. Se lee en su navegador y solo se usa su texto.
El hallazgo guarda el nombre del archivo, sus páginas y su huella digital, para comprobar después cuál fue. Es
igual si lo carga antes del análisis o al editar el hallazgo.

**Me salió «Tu cuenta está pendiente de aprobación».** Un administrador debe aprobarla. Cuando lo haga,
pulse «Ya me aprobaron» o vuelva a ingresar.

**¿Qué datos míos guarda halla y para qué?** Nombre, cédula, celular, cargo y correo, para identificarlo como
auditor y firmar los informes. Puede pedir su actualización o supresión al administrador.
