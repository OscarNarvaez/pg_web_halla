# Casos de prueba obligatorios (§14)

## Cómo se ejecutaron

Con `pnpm probar:motor`, que ejecuta **los mismos módulos que la Edge Function** `clasificar-hallazgo`:
recuperación con `buscar_criterios` sobre los 246 fragmentos de `normas/` cargados en Postgres (PGlite),
llamada real a la API de Gemini con el prompt del sistema del ANEXO A (más la metodología de riesgo del
PR13_GQ en el mensaje de usuario) y validación V1–V7.
Lo único que no interviene es la capa HTTP de Supabase (JWT, RLS y persistencia), que se prueba aparte con
`pnpm probar:bd` y, contra el proyecto real, con `pnpm verificar-rls`.

- Fecha: 2026-10-04
- Cascada de modelos: `gemini-3.8-flash` → `gemini-flash-latest` → `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`
- Contexto: alcance `PROCESOS`, auditoría `AI-2026-001`, fecha `2026-10-03`.
- El modelo principal respondió con 503 (alta demanda) en varios casos y `gemini-flash-latest` agotó su cuota diaria en el caso 6, así que respondieron los de respaldo. Cada caso indica cuál.
- Los niveles de riesgo usan la escala fija (Bajo 1–4, Moderado 5–9, Alto 10–16, Extremo 17–25).

## Corrida del 5/10/2026: guía de redacción por categoría (PROMPT_VERSION 1.3.0)

Misma prueba, con la guía de redacción del dueño en el mensaje de usuario (fórmula de cada categoría con sus
conectores «porque» y «para lo cual», y sus ejemplos) y V3 ajustada a ella. **Los 7 casos clasifican como se
espera y todas las redacciones siguen la fórmula de su categoría.** En una primera corrida, el caso 7 coincidió
con errores 503 de dos modelos: la fortaleza copió «excelente» del texto del auditor y la reparación V4 no
alcanzó a ejecutarse, así que el hallazgo quedó con el aviso «Revisa la redacción». Repetido el caso con el
servicio disponible, salió bien. Estas salidas son las de `scripts/fixtures/motor-casos.json`.

| # | Clasificación | Hallazgo corregido | Fórmula (V3) | Modelo |
|---|---|---|---|---|
| 1 | No conformidad | Durante la auditoría al proceso de Hospitalización se evidenció que en 5 de 20 historias clínicas revisadas no se encontró registrada la valoración de enfermería, incumpliendo la conservación de información documentada para tener la confianza de que los procesos se realizan según lo planificado y el control de la provisión del servicio bajo condiciones controladas, establecido en la NTC-ISO 9001:2015, numerales 4.4 y 8.5.1. | ✓ | gemini-3.8-flash |
| 2 | Fortaleza | El seguimiento mensual a los indicadores y la utilización de sus resultados para definir acciones, porque permite la toma de decisiones informada y favorece la mejora continua del proceso de gestión de calidad. | ✓ | gemini-3.8-flash |
| 3 | Observación | Se evidencia falta de legibilidad en algunas firmas de los registros, situación que podría impactar la trazabilidad y la identificación del personal responsable en el proceso. | ✓ | gemini-3.5-flash-lite |
| 4 | Oportunidad de mejora | El método utilizado para el registro de asistencia es susceptible de mejorar, para lo cual se puede digitalizar el formato, lo que permitirá agilizar la consolidación de la información y facilitar su análisis. | ✓ | gemini-3.5-flash-lite |
| 5 | No conformidad | En la revisión por la dirección no se incluyeron las decisiones y acciones relacionadas con las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3. | ✓ | gemini-3.5-flash-lite |
| 6 | Oportunidad de mejora | La capacidad y gestión del parqueadero de visitantes es susceptible de mejorar, para lo cual se podrían implementar alternativas de señalización, control de cupos o convenios de estacionamiento, lo que permitirá optimizar la accesibilidad, el confort y la comodidad de los usuarios durante los días de mayor afluencia. | ✓ | gemini-3.8-flash |
| 7 | No conformidad | Durante la auditoría en el área de Urgencias se evidenció la presencia de un extintor vencido, incumpliendo con el aseguramiento del entorno adecuado para la operación de los procesos, establecido en la NTC-ISO 9001:2015, numeral 8.5.1. | ✓ | gemini-3.8-flash |
| 7 | Fortaleza | El dominio del protocolo de código azul por parte del personal del área de Urgencias, porque favorece la respuesta oportuna y segura ante emergencias médicas de los pacientes. | ✓ | gemini-3.8-flash |

Las secciones siguientes («Resumen» y «Detalle de cada caso») son de la corrida del 4/10/2026 (PROMPT_VERSION 1.2.0).

## Resumen

| # | Entrada (resumida) | Esperada | Obtenida | Criterio | Riesgo (PR13) | Controles | Modelo | Resultado |
|---|---|---|---|---|---|---|---|---|
| 1 | Se revisaron 20 historias clínicas y en 5 de ellas no se enc… | No conformidad | No conformidad | NTC-ISO 9001:2015 4.4.2 | P3 × I3 = 9 (Moderado) | 2 | `gemini-flash-latest` | ✓ |
| 2 | El equipo realiza seguimiento mensual a los indicadores y ut… | Fortaleza | Fortaleza | NTC-ISO 9001:2015 9.1.3 | No aplica | 0 | `gemini-flash-latest` | ✓ |
| 3 | Los registros están completos, pero algunas firmas son poco … | Observación | Observación | NTC-ISO 9001:2015 7.5.3 | P3 × I2 = 6 (Moderado) | 2 | `gemini-flash-latest` | ✓ |
| 4 | El registro de asistencia actualmente se realiza correctamen… | Oportunidad de mejora | Oportunidad de mejora | NTC-ISO 9001:2015 7.5.3 | P2 × I1 = 2 (Bajo) | 1 | `gemini-flash-latest` | ✓ |
| 5 | En la revisión por la dirección no se incluyeron las decisio… | No conformidad | No conformidad | NTC-ISO 9001:2015 9.3.3 | P2 × I2 = 4 (Bajo) | 2 | `gemini-3.8-flash` | ✓ |
| 6 | El parqueadero de visitantes es pequeño y se llena los viern… | Cualquiera, sin inventar numeral | Oportunidad de mejora | NTC-ISO 9001:2015 7.1.3 | P4 × I1 = 4 (Bajo) | 1 | `gemini-3.7-flash` | ✓ |
| 7 | Se evidenció extintor vencido en el área de urgencias y adem… | No conformidad + Fortaleza | No conformidad + Fortaleza | NTC-ISO 9001:2015 8.5.1 / NTC-ISO 9001:2015 7.2 | P3 × I4 = 12 (Alto) / No aplica | 2 / 0 | `gemini-3.6-flash` | ✓ |

## Detalle de cada caso

### Caso 1

**Entrada del auditor** (proceso: Hospitalización):

> Se revisaron 20 historias clínicas y en 5 de ellas no se encontró registrada la valoración de enfermería requerida.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 8.4.3, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 8.3.2, PR13-GQ 4, PR13-GQ 5, NTC-ISO 9001:2015 7.1.6, NTC-ISO 9001:2015 8.2.4, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 8.6, PR13-GQ 5
- Modelo: `gemini-flash-latest` (versión gemini-3.8-flash) · descartados: `gemini-3.8-flash` (error 503) · 16.7 s
- Reparación V4: no fue necesaria

- **Clasificación:** No conformidad · severidad media
- **Hallazgo corregido:** Durante la auditoría al proceso de Hospitalización se evidenció que en 5 de 20 historias clínicas revisadas no se encontró registrada la valoración de enfermería requerida, incumpliendo con la conservación de la información documentada necesaria para apoyar la operación y evidenciar que los procesos se realizan según lo planificado, de acuerdo con lo establecido en la NTC-ISO 9001:2015, numeral 4.4.2.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 4.4.2
- **Justificación:** Se evidencia el incumplimiento de la conservación de información documentada requerida para asegurar la operación y control del servicio de hospitalización, al no encontrarse la valoración de enfermería en 5 de 20 historias clínicas revisadas.
- **Evidencia:** Ausencia del registro de la valoración de enfermería en 5 de 20 historias clínicas revisadas durante la auditoría.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 4.4.2 — Sistema de gestión de la calidad y sus procesos
- **Riesgo (V7):** Posibilidad de fallas en la continuidad del cuidado o eventos adversos debido a la ausencia del registro de la valoración de enfermería en la historia clínica, lo que podría ocasionar un deterioro de severidad moderada en el estado de salud del paciente.
  - Dimensión: Calidad en la atención y seguridad del paciente · probabilidad 3 (Posible) × impacto 3 (Moderado) = 9, nivel **Moderado**
  - Justificación: Se estima una probabilidad posible (3) dado que la omisión se detectó en el 25% de la muestra evaluada (5 de 20 casos). El impacto se valora como moderado (3) puesto que la falta de información clínica clave puede derivar en decisiones de cuidado inadecuadas que afecten transitoriamente la salud del paciente hospitalizado.
- **Control preventivo propuesto:** La Coordinación de Enfermería debe realizar auditorías mensuales de adherencia al diligenciamiento completo y oportuno de la valoración de enfermería en historias clínicas. *(con criterio verificado)*
- **Control correctivo propuesto:** El personal de enfermería responsable de los 5 casos identificados debe revisar y registrar de manera extemporánea o complementaria la valoración del estado de los pacientes, dejando constancia de la trazabilidad y justificación en el sistema clínico. *(con criterio verificado)*

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD → obtenida NO_CONFORMIDAD
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 2

**Entrada del auditor** (proceso: Gestión de calidad):

> El equipo realiza seguimiento mensual a los indicadores y utiliza los resultados para definir acciones.

- Criterios recuperados (12): NTC-ISO 9001:2015 9.1.1, NTC-ISO 9001:2015 9.1.3, NTC-ISO 9001:2015 7.1.5.1, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 9.3.2, NTC-ISO 9001:2015 7.1.5.2, PR13-GQ 5, NTC-ISO 9001:2015 6.2, NTC-ISO 9001:2015 4.3, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 10.2, NTC-ISO 9001:2015 10.3
- Modelo: `gemini-flash-latest` (versión gemini-3.8-flash) · 17.9 s
- Reparación V4: no fue necesaria

- **Clasificación:** Fortaleza · severidad baja
- **Hallazgo corregido:** Se evidencia seguimiento mensual a los indicadores por parte del equipo y la utilización sistemática de sus resultados para la definición de acciones, porque favorece la toma de decisiones basada en evidencia y el mejoramiento continuo del proceso.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 9.1.3
- **Justificación:** El proceso evidencia una práctica sistemática y positiva consistente en el seguimiento periódico a los indicadores y la toma de decisiones basada en datos para definir acciones, lo cual genera un beneficio demostrado para la mejora y la gestión del sistema de calidad.
- **Evidencia:** Seguimiento mensual documentado a los indicadores y formulación de acciones a partir de los resultados obtenidos.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 9.1.3 — Análisis y evaluación
- **Riesgo (V7):** no aplica (fortaleza)

Verificaciones:

- ✓ clasificación esperada FORTALEZA → obtenida FORTALEZA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 3

**Entrada del auditor** (proceso: Consulta externa):

> Los registros están completos, pero algunas firmas son poco legibles.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 8.5.3, NTC-ISO 9001:2015 8.4.1, NTC-ISO 9001:2015 8.4.3, PR13-GQ 4, NTC-ISO 9001:2015 8.6, NTC-ISO 9001:2015 8.3.3, NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 8.5.6, NTC-ISO 9001:2015 8.5.2, NTC-ISO 9001:2015 8.3.6
- Modelo: `gemini-flash-latest` (versión gemini-3.8-flash) · 10.5 s
- Reparación V4: no fue necesaria

- **Clasificación:** Observación · severidad baja
- **Hallazgo corregido:** Se evidencia baja legibilidad en algunas de las firmas consignadas en los registros del proceso de Consulta externa, situación que podría dificultar la clara identificación del personal responsable y comprometer la trazabilidad de la atención.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 7.5.3
- **Justificación:** No se evidencia un incumplimiento directo y demostrable a un requisito mandatorio ya que los registros se encuentran diligenciados y completos, pero la baja legibilidad en algunas firmas constituye una debilidad que representa un riesgo potencial para la trazabilidad y la atribución de responsabilidades.
- **Evidencia:** Registros del proceso completamente diligenciados que presentan algunas firmas con baja legibilidad.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.5.3 — Control de la información documentada
- **Riesgo (V7):** Posibilidad de pérdida de trazabilidad en la atención clínica debido a la baja legibilidad en las firmas de los registros, lo que podría dificultar la identificación inequívoca del profesional tratante ante requerimientos asistenciales o legales.
  - Dimensión: Prestación del servicio · probabilidad 3 (Posible) × impacto 2 (Menor) = 6, nivel **Moderado**
  - Justificación: Se estima una probabilidad posible (3) al evidenciarse en varios registros evaluados durante la auditoría. El impacto se califica como menor (2), dado que los registros se encuentran completos y la afectación generaría eventuales reprocesos de validación interna sin suspender ni comprometer directamente la prestación del servicio.
- **Control preventivo propuesto:** La coordinación de Consulta externa debe socializar con el equipo de salud la directriz sobre el registro claro de firmas acompañado de sello, código o posfirma legible en los formatos asistenciales. *(con criterio verificado)*
- **Control preventivo propuesto:** El líder del proceso de Consulta externa debe realizar auditorías mensuales de adherencia al diligenciamiento y preservación de la legibilidad de la información documentada. *(con criterio verificado)*

Verificaciones:

- ✓ clasificación esperada OBSERVACION → obtenida OBSERVACION
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 4

**Entrada del auditor** (proceso: Gestión humana):

> El registro de asistencia actualmente se realiza correctamente en formato físico.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 10.2, PR13-GQ 5, NTC-ISO 9001:2015 4.4, PR13-GQ 5, NTC-ISO 9001:2015 9.2, NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 4.3, NTC-ISO 9001:2015 8.3.5, NTC-ISO 9001:2015 9.1.1, NTC-ISO 9001:2015 7.2
- Modelo: `gemini-flash-latest` (versión gemini-3.8-flash) · 59.2 s
- Reparación V4: no fue necesaria

- **Clasificación:** Oportunidad de mejora · severidad baja
- **Hallazgo corregido:** El proceso de registro de asistencia es susceptible de mejorar mediante la adopción de herramientas digitales o sistematizadas para su diligenciamiento, lo cual permitirá agilizar la consolidación de la información, fortalecer la trazabilidad y optimizar los tiempos de análisis del proceso de Gestión humana.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 7.5.3
- **Justificación:** El proceso cumple con el registro adecuado de asistencia en medio físico y no presenta incumplimientos normativos ni debilidades críticas, pero existe la posibilidad de optimizar la gestión mediante su digitalización.
- **Evidencia:** El registro de asistencia se realiza de manera conforme y controlada a través de formato físico.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.5.3 — Control de la información documentada
- **Riesgo (V7):** Posibilidad de reprocesos o demoras en la consolidación de datos debido al diligenciamiento exclusivamente manual en papel, lo que podría generar demoras en los análisis y reportes del proceso.
  - Dimensión: Prestación del servicio · probabilidad 2 (Improbable) × impacto 1 (Insignificante) = 2, nivel **Bajo**
  - Justificación: Dado que el registro se efectúa correctamente, demoras sustanciales son poco frecuentes (improbable), y la persistencia del medio físico no compromete la atención ni afecta la prestación del servicio asistencial (insignificante).
- **Control preventivo propuesto:** Evaluar e implementar un mecanismo digitalizado para la captura y consolidación de la asistencia en las actividades de Gestión humana por parte de la coordinación del área. *(con criterio verificado)*

Verificaciones:

- ✓ clasificación esperada OPORTUNIDAD_DE_MEJORA → obtenida OPORTUNIDAD_DE_MEJORA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 5

**Entrada del auditor** (proceso: Gestión gerencial):

> En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora.

- Criterios recuperados (12): NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 9.3.2, NTC-ISO 9001:2015 6.1, NTC-ISO 9001:2015 9.3.1, NTC-ISO 9001:2015 10.3, NTC-ISO 9001:2015 10.1, NTC-ISO 9001:2015 10.2, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 9.1.3, NTC-ISO 9001:2015 5.1.2, PR13-GQ 5, PR13-GQ 4
- Modelo: `gemini-3.8-flash` (versión gemini-3.8-flash) · 34.4 s
- Reparación V4: no fue necesaria

- **Clasificación:** No conformidad · severidad media
- **Hallazgo corregido:** Durante la revisión del informe de la revisión por la dirección se evidenció que no se incluyeron las decisiones y acciones frente a las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3 literal a).
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 9.3.3 literal a)
- **Justificación:** Se evidencia el incumplimiento de un requisito explícito y obligatorio de la norma NTC-ISO 9001:2015, numeral 9.3.3 literal a), el cual exige que las salidas de la revisión por la dirección incluyan decisiones y acciones relacionadas con las oportunidades de mejora.
- **Evidencia:** Ausencia de registro de decisiones y acciones relacionadas con las oportunidades de mejora dentro de las salidas de la revisión por la dirección.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 9.3.3 — Salidas de la revisión por la dirección
- **Riesgo (V7):** Posibilidad de estancamiento o pérdida de eficacia del sistema de gestión de la calidad debido a la omisión de decisiones y acciones estratégicas sobre las oportunidades de mejora en la revisión por la dirección, lo que podría generar reprocesos e ineficiencias en la gestión institucional.
  - Dimensión: Prestación del servicio · probabilidad 2 (Improbable) × impacto 2 (Menor) = 4, nivel **Bajo**
  - Justificación: La revisión por la dirección se ejecuta habitualmente de manera anual o periódica, haciendo que el evento sea poco frecuente (Improbable = 2). La falta de definición de estas decisiones puede ocasionar reprocesos en la gestión gerencial sin suspender la prestación directa de servicios de salud (Menor = 2).
- **Control correctivo propuesto:** La Gerencia y el área de Gestión de Calidad deben actualizar el acta o informe de la revisión por la dirección incorporando formalmente las decisiones y acciones tomadas frente a las oportunidades de mejora identificadas. *(con criterio verificado)*
- **Control preventivo propuesto:** El área de Gestión de Calidad debe implementar una lista de verificación previa al cierre de cada revisión por la dirección que valide la inclusión de todas las salidas obligatorias del estándar. *(con criterio verificado)*

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD → obtenida NO_CONFORMIDAD
- ✓ cita verificada NTC-ISO 9001:2015 9.3.3
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 6

**Entrada del auditor** (proceso: Gestión de recursos físicos):

> El parqueadero de visitantes es pequeño y se llena los viernes.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.1.1, NTC-ISO 9001:2015 7.1.3, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 7.1.5.1, PR13-GQ 5, PR13-GQ 5, NTC-ISO 9001:2015 4.3, PR13-GQ 5, NTC-ISO 9001:2015 6.3, PR13-GQ 5, PR13-GQ 5, PR13-GQ 5
- Modelo: `gemini-3.7-flash` (versión gemini-3.7-flash) · descartados: `gemini-3.8-flash` (error 503), `gemini-flash-latest` (cuota diaria agotada) · 21.8 s
- Reparación V4: no fue necesaria

- **Clasificación:** Oportunidad de mejora · severidad baja
- **Hallazgo corregido:** La capacidad y disponibilidad del parqueadero de visitantes es susceptible de mejorar mediante la evaluación de alternativas de ampliación, redistribución o convenios externos para días de alta afluencia, lo cual permitirá facilitar el acceso y mejorar la comodidad de los usuarios.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 7.1.3
- **Justificación:** No se evidencia incumplimiento de un requisito normativo o legal obligatorio aplicable a la capacidad del parqueadero, pero existe una oportunidad para optimizar la capacidad y gestión del espacio físico en beneficio de los usuarios.
- **Evidencia:** Durante la auditoría se constató que el parqueadero destinado para visitantes cuenta con una capacidad reducida y alcanza su ocupación máxima los días viernes.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.1.3 — Infraestructura
- **Riesgo (V7):** Posibilidad de inconformidad o congestión vehicular en el acceso debido a la capacidad limitada del parqueadero de visitantes los días viernes, lo que podría afectar la percepción de satisfacción y la imagen institucional.
  - Dimensión: Reputacional (imagen) · probabilidad 4 (Probable) × impacto 1 (Insignificante) = 4, nivel **Bajo**
  - Justificación: La saturación se presenta de forma recurrente semanalmente (probable), pero su impacto en la imagen hospitalaria es mínimo e insignificante al tratarse de un servicio complementario.
- **Control preventivo propuesto:** El área de Gestión de recursos físicos realizará un estudio de capacidad y rotación vehicular para implementar planes de contingencia o convenios de parqueo en días de alta demanda. *(con criterio verificado)*

Verificaciones:

- ✓ clasificación esperada * → obtenida OPORTUNIDAD_DE_MEJORA
- ✓ sin numeral inventado: marcador pendiente o cita verificada
- ✓ el hallazgo corregido no menciona numerales sin verificar
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

### Caso 7

**Entrada del auditor** (proceso: Urgencias):

> Se evidenció extintor vencido en el área de urgencias y además el personal muestra un excelente dominio del protocolo de código azul.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.1.2, NTC-ISO 9001:2015 8.5.6, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 7.2, NTC-ISO 9001:2015 8.1, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 8.7, NTC-ISO 9001:2015 8.3.4, NTC-ISO 9001:2015 8.4.3, NTC-ISO 9001:2015 8.4.1
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · descartados: `gemini-3.7-flash` (error 503) · 21.9 s
- Reparación V4: no fue necesaria

#### Hallazgo 1 de 2

- **Clasificación:** No conformidad · severidad alta
- **Hallazgo corregido:** Durante la inspección realizada en el área de Urgencias se evidenció un extintor con la fecha de mantenimiento y recarga vencida, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 8.5.1, literal d.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 8.5.1, literal d
- **Justificación:** Existe evidencia objetiva de un incumplimiento en los controles de infraestructura y equipos para la atención en el servicio de urgencias, al encontrarse un equipo de control de incendios vencido.
- **Evidencia:** Extintor ubicado en el área de urgencias con fecha de vencimiento expirada.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 8.5.1 — Control de la producción y de la provisión del servicio
- **Riesgo (V7):** Posibilidad de inoperatividad de los equipos de extinción de incendios debido a la falta de mantenimiento y recarga oportuna del extintor, lo que podría comprometer la seguridad de los pacientes y colaboradores ante una emergencia de conato de incendio.
  - Dimensión: Calidad en la atención y seguridad del paciente · probabilidad 3 (Posible) × impacto 4 (Mayor) = 12, nivel **Alto**
  - Justificación: El vencimiento del extintor en un área crítica como urgencias genera un riesgo directo sobre la seguridad de pacientes y personal ante un evento de fuego; la probabilidad es posible por falta de seguimiento en las fechas de recarga.
- **Control correctivo propuesto:** Realizar la recarga y sustitución inmediata del extintor vencido en el área de urgencias. *(con criterio verificado)*
- **Control preventivo propuesto:** Establecer un programa periódico de inspección y cronograma de mantenimiento de extintores y equipos de emergencia a cargo del área de SST. *(con criterio verificado)*

#### Hallazgo 2 de 2

- **Clasificación:** Fortaleza · severidad baja
- **Hallazgo corregido:** Se evidencia en el personal del área de Urgencias un elevado nivel de competencia y dominio del protocolo de Código Azul, favoreciendo la oportunidad de la respuesta médica y el fortalecimiento de la seguridad del paciente ante emergencias vitales.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 7.2
- **Justificación:** Se identifica una práctica positiva destacada en el personal de urgencias sobre el dominio del protocolo de código azul, lo que genera un beneficio directo en la seguridad y atención del paciente crítico.
- **Evidencia:** Demostración de excelente dominio práctico y teórico del protocolo de código azul por parte del personal del área de urgencias.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.2 — Competencia
- **Riesgo (V7):** no aplica (fortaleza)

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD + FORTALEZA → obtenida NO_CONFORMIDAD + FORTALEZA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
- ✓ riesgo PR13 completo y al menos un control (la FORTALEZA no lleva ninguno)

## Observaciones de la corrida

- **Los 7 casos cumplen lo esperado**, incluidos los dos que «más fallan»: el 6 no inventa numeral y el 7
  separa la no conformidad de la fortaleza. En el caso 6 el modelo citó NTC-ISO 9001:2015 7.1.3
  (infraestructura), un criterio verificado; en corridas anteriores dejó el marcador pendiente. Ambos son
  válidos: lo que no puede pasar es un numeral inventado.
- **Riesgo (V7):** todos los hallazgos que no son fortaleza traen riesgo completo con probabilidad e impacto
  de 1 a 5, y las fortalezas no traen ni riesgo ni controles. La dimensión elegida es coherente con el
  hallazgo: calidad y seguridad del paciente en lo clínico (casos 1 y 7), prestación del servicio en lo
  administrativo y reputacional en el parqueadero (caso 6).
- **El nivel lo calcula la aplicación.** El caso 5 (no conformidad) queda en nivel Bajo (2 × 2): la
  aplicación no propone «asumir» el riesgo, sino reducirlo, porque el PR13_GQ no admite aceptar riesgos que
  conlleven un incumplimiento normativo.
- **Controles:** de uno a dos por hallazgo, todos con un criterio verificado de la lista entregada. Ninguno
  cita normas fuera de ella.
- **Sin datos inventados en esta corrida:** V6 no tuvo que reemplazar fechas ni cifras.
- **Tiempos:** de 10 a 35 s, y hasta 59 s cuando la cascada salta modelos saturados (503). La salida es más
  larga que antes por el riesgo y los controles; por eso `GEMINI_MAX_OUTPUT_TOKENS` subió a 8192.

## Pruebas automáticas sin red

```bash
pnpm probar          # todo lo siguiente, en orden
```

| Comando | Qué verifica | Resultado |
|---|---|---|
| `pnpm verificar:prompt` | El prompt del sistema es el ANEXO A literal | ✓ 15 600 caracteres idénticos |
| `pnpm probar:validacion` | V1–V7, guía de redacción por categoría (y que la app verifique igual que el servidor), anonimización antes de la IA, coherencia de catálogos (cargos, evaluador y escala de riesgo) y contenido del informe oficial | ✓ 105 comprobaciones |
| `pnpm probar:gemini` | Cascada de modelos, reintentos 1 s/4 s/10 s, cuota diaria, 400, MAX_TOKENS | ✓ 14 comprobaciones |
| `pnpm probar:bd` | Migraciones, RLS, aprobación de cuentas, ataques de integridad, cuota de IA, riesgo, controles, cargos, equipo auditor, evaluador, fechas reales, lista de verificación, PDF agregados al editar e indicadores revisados (incluida la conversión de perfiles existentes) | ✓ 135 comprobaciones |
| `pnpm probar:busqueda` | Ingesta de las normas y recuperación (9.3.3 primero, con y sin tildes) | ✓ 8 consultas |
| `pnpm probar:interfaz` | Extremo a extremo en Chromium: asistente de 7 pasos, PDF de evidencia (al analizar y al editar), matriz y Excel, cargos de lista y equipo de varias personas, informe con la plantilla oficial (ODT y PDF, indicadores revisados, sin recomendaciones), lista de verificación (pregunta al crear y al entrar, guardado y cierre de sesión), CSP, cuentas pendientes, admin, sesión sin cierre por inactividad, validar sin dimensión de impacto, 360 px | ✓ 172 comprobaciones |

## Pendiente: contra la función desplegada

El §14 pide ejecutar los siete casos contra la Edge Function desplegada. Queda pendiente hasta crear el
proyecto Supabase (ver `docs/DESPLIEGUE.md`). Los pasos:

1. Desplegar (`supabase functions deploy …`) y cargar las normas (`pnpm ingest`).
2. Crear una auditoría desde la aplicación y capturar las siete entradas en el asistente
   «Nuevo hallazgo», recorriendo los 7 pasos hasta la matriz.
3. Pegar aquí las respuestas y comprobar en `ia_eventos` el modelo y la latencia de cada una.
