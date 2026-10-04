# Manual del auditor · halla

halla es la herramienta del Hospital Infantil Los Ángeles para registrar los hallazgos de auditoría
interna. Usted describe con sus palabras lo que observó; el sistema decide si es una **no conformidad**,
una **observación**, una **oportunidad de mejora** o una **fortaleza**, lo redacta con lenguaje técnico
de auditoría y busca el requisito aplicable en las normas cargadas. Al final, genera el informe.

**El juicio profesional sigue siendo suyo.** Todo lo que propone la IA se puede revisar y corregir antes
de guardarlo.

---

## 1. Crear la cuenta

Entre a **halla.ink → Crear cuenta**. Son tres pasos:

1. **Cuenta:** correo y contraseña (mínimo 8 caracteres).
2. **Datos del auditor:** nombre completo, cédula, celular y cargo. Puede escribir la cédula con puntos
   (1.085.123.456) y el celular con +57: el sistema los normaliza.
3. **Equipo auditor y alcance:** el nombre y el cargo de la persona que lo acompaña (el equipo auditor
   es siempre una persona adicional) y si usted audita **procesos** o **sistemas**, con cuál.

Si le pide confirmar el correo, abra el enlace que le llega (revise también el correo no deseado) y luego
ingrese. Estos datos aparecen en el informe, en la sección de equipo auditor y en las firmas; puede
cambiarlos en **Mi perfil**.

## 2. Crear una auditoría

**Auditorías → Nueva auditoría.** Una auditoría agrupa los hallazgos de un proceso o sistema y termina
en un informe.

- El **código** se propone solo (AI-2026-001, AI-2026-002…). Puede cambiarlo.
- Escriba el **título** y las fechas, y confirme el proceso o sistema.
- El botón **Sugerir con IA** propone el objetivo, el área auditada y las normas aplicables. Revise y
  ajuste lo que haga falta antes de guardar.

## 3. Registrar un hallazgo

Dentro de la auditoría: **Nuevo hallazgo**.

### Cómo escribirlo

Describa lo que observó como lo contaría a un colega. No se preocupe por la redacción técnica ni por la
categoría: eso lo hace el sistema. Lo que sí importa es el **contenido**:

- **Qué revisó:** historias clínicas, actas, registros, el área física…
- **Cuántos:** «se revisaron 20 historias clínicas».
- **Qué encontró y dónde:** «en 5 de ellas no estaba registrada la valoración de enfermería».
- Si conoce el procedimiento o la norma que aplica, menciónelo.

Ejemplo bueno:

> Se revisaron 20 historias clínicas del servicio de Hospitalización y en 5 de ellas no se encontró
> registrada la valoración de enfermería al ingreso.

Ejemplo pobre (le falta evidencia):

> Las historias están mal.

Si en un mismo texto describe dos situaciones de distinto tipo (por ejemplo, un extintor vencido y un
personal que domina muy bien un protocolo), el sistema las separa en dos hallazgos.

### Analizar

Pulse **Analizar con IA**. Tarda normalmente entre 3 y 8 segundos. **Usted no elige la categoría**: la
determina el sistema con este orden de preguntas:

1. ¿Hay un requisito obligatorio que no se cumple, con evidencia? → **No conformidad**
2. ¿Hay una debilidad o un riesgo, sin incumplimiento? → **Observación**
3. ¿Hay una práctica positiva destacada con beneficio demostrable? → **Fortaleza**
4. ¿Se cumple, pero podría hacerse mejor? → **Oportunidad de mejora**

### Leer el resultado

Cada hallazgo muestra:

| Campo | Qué es |
|---|---|
| **Clasificación** | La categoría, con su color. |
| **Hallazgo corregido** | La redacción técnica, con la fórmula obligatoria de la categoría (ver §4). |
| **Justificación** | Por qué se eligió esa categoría. |
| **Criterio / requisito** | La norma y el numeral aplicables. Las etiquetas debajo («NTC-ISO 9001:2015 · 9.3.3») abren el texto completo del numeral. |
| **Evidencia** | Los hechos que sustentan la clasificación. |
| **Severidad** | Alta, media o baja, sugerida por la IA. |

Haga clic sobre cualquier texto para corregirlo. Si su criterio profesional no coincide con la categoría,
use **Corregir clasificación**: quedará registrado que usted la cambió.

### Los avisos

| Aviso | Qué hacer |
|---|---|
| **Requisito pendiente** (etiqueta gris) | No hay en las normas cargadas un requisito que sustente el hallazgo. El criterio dice literalmente *[Requisito específico pendiente de identificación/validación]*. Si usted conoce el requisito (un procedimiento institucional, una resolución), escríbalo en el campo. |
| **Se marcaron fechas o cifras…** | La IA escribió un dato que usted no dio. Se reemplazó por *[fecha por confirmar]* o *[cantidad por confirmar]*: complételo o bórrelo. |
| **Se retiraron referencias normativas…** | La IA citó algo que no está en las normas cargadas y se quitó. Revise que el criterio quede bien. |
| **Revisa la redacción** | La redacción no sigue del todo la fórmula de la categoría. Corríjala a mano. |

El sistema **nunca inventa** numerales, normas, fechas ni cifras: si no puede verificarlos, lo dice.

### Guardar, reanalizar o descartar

- **Guardar hallazgo:** queda **confirmado** con sus correcciones.
- **Reanalizar:** descarta este resultado y vuelve a analizar el mismo texto.
- **Descartar:** descarta el resultado; su texto sigue en la caja por si quiere reescribirlo.

Su texto original **siempre se conserva** tal como lo escribió («Ver texto original del auditor») y no se
puede modificar: es la evidencia de lo que usted reportó.

## 4. Las cuatro fórmulas de redacción

| Categoría | Fórmula | Ejemplo |
|---|---|---|
| **No conformidad** | Evidencia + incumplimiento + requisito incumplido | En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3. |
| **Observación** | Debilidad + impacto potencial | Se evidencia falta de planificación de los cambios en tecnología biomédica, situación que podría incrementar el riesgo de eventos adversos. |
| **Oportunidad de mejora** | Susceptible de mejorar + beneficio futuro | El registro de asistencia es susceptible de mejorar mediante su digitalización, lo cual permitirá agilizar la consolidación de la información. |
| **Fortaleza** | Aspecto positivo + beneficio actual (en presente) | Se evidencia seguimiento sistemático a los indicadores, favoreciendo la toma de decisiones basada en datos. |

Una no conformidad sin requisito identificado **sigue siendo no conformidad**: el criterio queda como
pendiente para que usted lo complete.

## 5. Gestionar los hallazgos de una auditoría

En el detalle de la auditoría verá los contadores por categoría (haga clic en uno para filtrar), un
buscador y la lista de hallazgos. Cada uno tiene un número (H-01, H-02…) y un estado:

| Estado | Significa |
|---|---|
| **Generado** | La IA lo produjo y usted aún no lo revisó. |
| **Editado** | Usted lo modificó, pero no lo ha confirmado. |
| **Confirmado** | Usted lo revisó y lo aprobó. |
| **Descartado** | No se incluye en el informe. Se puede restaurar. |

Acciones: **Ver y editar**, **Confirmar**, **Duplicar** (útil para dos situaciones parecidas) y
**Descartar**. Cuando termine, puede **Cerrar la auditoría** para que no admita hallazgos nuevos.

## 6. Generar el informe

Con al menos un hallazgo confirmado, pulse **Generar informe**. El informe incluye todos los hallazgos
no descartados (si alguno está sin confirmar, se le avisa) y tiene once secciones: identificación,
objetivo, alcance, criterios, equipo auditor, metodología, resumen de resultados, hallazgos en detalle
(no conformidades, observaciones, oportunidades de mejora y fortalezas, en ese orden), conclusiones,
recomendaciones y firmas.

- **Las cifras las calcula el sistema**, no la IA. La IA solo redacta el resumen ejecutivo, las
  conclusiones y las recomendaciones.
- En **criterios de auditoría** aparecen únicamente las normas y numerales realmente citados.
- Si cambia los hallazgos, genere una **nueva versión**: las anteriores se conservan.
- Descárguelo en **PDF** o en **Word** (para editarlo), o imprímalo directamente.

## 7. Consultar las normas

**Normas** permite buscar en los documentos que el sistema puede citar: NTC-ISO 9001:2015, ISO 45001:2018,
NTC-ISO 14001:2015, ISO 19011 y el procedimiento PR13-GQ de gestión de riesgos. Si un numeral no aparece
ahí, el sistema no lo usa.

Use las palabras de la norma: «información documentada» encuentra más que «registros». La ISO 19011 está
en inglés, así que se encuentra con términos en inglés («audit findings»).

## 8. Preguntas frecuentes

**El análisis dice que se agotó la cuota de la IA.** El servicio gratuito tiene un número limitado de
análisis por día para todo el hospital. Su texto no se pierde: inténtelo más tarde o avise al
administrador. El informe se puede generar igual (con un texto de conclusiones de plantilla).

**El análisis tarda mucho.** Si el servicio de IA está saturado, el sistema reintenta y, si hace falta,
usa otro modelo. Puede esperar hasta un minuto.

**La IA clasificó algo que yo considero distinto.** Use **Corregir clasificación**. Quedará registrado que
la clasificación fue ajustada por usted.

**¿Puedo borrar un hallazgo?** Se descarta, no se borra: así queda la trazabilidad de todo lo analizado.

**¿Quién ve mis auditorías?** Solo usted y los administradores de la plataforma.
