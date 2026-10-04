# Casos de prueba obligatorios (§14)

## Cómo se ejecutaron

Con `pnpm probar:motor`, que ejecuta **los mismos módulos que la Edge Function** `clasificar-hallazgo`:
recuperación con `buscar_criterios` sobre los 246 fragmentos de `normas/` cargados en Postgres (PGlite),
llamada real a la API de Gemini con el prompt del sistema del ANEXO A y validación V1–V6.
Lo único que no interviene es la capa HTTP de Supabase (JWT, RLS y persistencia), que se prueba aparte con
`pnpm probar:bd` y, contra el proyecto real, con `pnpm verificar-rls`.

- Fecha: 2026-10-04
- Cascada de modelos: `gemini-3.8-flash` → `gemini-flash-latest` → `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`
- Contexto: alcance `PROCESOS`, auditoría `AI-2026-001`, fecha `2026-10-03`.
- El modelo principal ya había agotado su cuota diaria gratuita en corridas anteriores, así que respondieron los de respaldo. Cada caso indica cuál.

## Resumen

| # | Entrada (resumida) | Esperada | Obtenida | Criterio | Modelo | Resultado |
|---|---|---|---|---|---|---|
| 1 | Se revisaron 20 historias clínicas y en 5 de ellas no se enc… | No conformidad | No conformidad | NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 8.5.1 | `gemini-3.6-flash` | ✓ |
| 2 | El equipo realiza seguimiento mensual a los indicadores y ut… | Fortaleza | Fortaleza | NTC-ISO 9001:2015 9.1.3 | `gemini-3.6-flash` | ✓ |
| 3 | Los registros están completos, pero algunas firmas son poco … | Observación | Observación | Marcador pendiente | `gemini-3.6-flash` | ✓ |
| 4 | El registro de asistencia actualmente se realiza correctamen… | Oportunidad de mejora | Oportunidad de mejora | Marcador pendiente | `gemini-3.6-flash` | ✓ |
| 5 | En la revisión por la dirección no se incluyeron las decisio… | No conformidad | No conformidad | NTC-ISO 9001:2015 9.3.3 | `gemini-3.6-flash` | ✓ |
| 6 | El parqueadero de visitantes es pequeño y se llena los viern… | Cualquiera, sin inventar numeral | Oportunidad de mejora | Marcador pendiente | `gemini-3.7-flash` | ✓ |
| 7 | Se evidenció extintor vencido en el área de urgencias y adem… | No conformidad + Fortaleza | No conformidad + Fortaleza | NTC-ISO 9001:2015 8.5.1 / NTC-ISO 9001:2015 7.2 | `gemini-3.5-flash` | ✓ |

## Detalle de cada caso

### Caso 1

**Entrada del auditor** (proceso: Hospitalización):

> Se revisaron 20 historias clínicas y en 5 de ellas no se encontró registrada la valoración de enfermería requerida.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 8.4.3, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 8.3.2, PR13-GQ 4, PR13-GQ 5, NTC-ISO 9001:2015 7.1.6, NTC-ISO 9001:2015 8.2.4, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 8.6, PR13-GQ 5
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · descartados: `gemini-3.8-flash` (cuota diaria agotada), `gemini-flash-latest` (cuota diaria agotada), `gemini-3.7-flash` (error 503) · 37.6 s
- Reparación V4: no fue necesaria

- **Clasificación:** No conformidad · severidad media
- **Hallazgo corregido:** Durante la revisión de historias clínicas realizada el [fecha por confirmar] en el servicio de Hospitalización, se evidenció que 5 de las 20 historias clínicas auditadas no contaban con la valoración de enfermería registrada, incumpliendo el control de la prestación del servicio bajo condiciones controladas y la conservación de la información documentada necesaria para apoyar la operación de los procesos, según lo establecido en la NTC-ISO 9001:2015, numerales 7.5.1 y 8.5.1.
- **Criterio / requisito:** NTC-ISO 9001:2015, numerales 7.5.1 y 8.5.1
- **Justificación:** Existe un incumplimiento comprobado mediante evidencia objetiva (5 de 20 historias clínicas revisadas sin el registro obligatorio de la valoración de enfermería), lo cual vulnera las condiciones controladas y el mantenimiento de la información documentada del servicio.
- **Evidencia:** En 5 de 20 historias clínicas revisadas en el servicio de Hospitalización no se encontró registrada la valoración de enfermería.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.5.1 — Información documentada — Generalidades; NTC-ISO 9001:2015 8.5.1 — Control de la producción y de la provisión del servicio
- **Citas descartadas por V1:** NTC-ISO 9001:2015 4.4.2 (el numeral 4.4.2 no coincide con 4.4)
- **Referencias retiradas por V2:** numeral 4.4.2
- **Datos reemplazados por V6:** 3 de octubre de 2026
- **Avisos al auditor:** Se retiraron referencias normativas que no corresponden a los criterios cargados. · Se marcaron fechas o cifras que no aparecen en tu texto: complétalas o confírmalas.

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD → obtenida NO_CONFORMIDAD
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 2

**Entrada del auditor** (proceso: Gestión de calidad):

> El equipo realiza seguimiento mensual a los indicadores y utiliza los resultados para definir acciones.

- Criterios recuperados (12): NTC-ISO 9001:2015 9.1.1, NTC-ISO 9001:2015 9.1.3, NTC-ISO 9001:2015 7.1.5.1, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 9.3.2, NTC-ISO 9001:2015 7.1.5.2, PR13-GQ 5, NTC-ISO 9001:2015 6.2, NTC-ISO 9001:2015 4.3, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 10.2, NTC-ISO 9001:2015 10.3
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · 5.8 s
- Reparación V4: no fue necesaria

- **Clasificación:** Fortaleza · severidad baja
- **Hallazgo corregido:** Se evidencia el seguimiento mensual a los indicadores de gestión y el uso sistemático de sus resultados para la definición de acciones, lo cual favorece la toma de decisiones basada en evidencia y contribuye al fortalecimiento continuo del desempeño del proceso.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 9.1.3
- **Justificación:** El proceso realiza un seguimiento sistemático mensual a los indicadores e integra activamente sus resultados en la toma de decisiones y definición de acciones, representando una práctica destacada con impacto positivo en la gestión.
- **Evidencia:** Seguimiento mensual documentado a los indicadores del proceso y registros de acciones definidas a partir del análisis de los resultados.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 9.1.3 — Análisis y evaluación

Verificaciones:

- ✓ clasificación esperada FORTALEZA → obtenida FORTALEZA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 3

**Entrada del auditor** (proceso: Consulta externa):

> Los registros están completos, pero algunas firmas son poco legibles.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 8.5.3, NTC-ISO 9001:2015 8.4.1, NTC-ISO 9001:2015 8.4.3, PR13-GQ 4, NTC-ISO 9001:2015 8.6, NTC-ISO 9001:2015 8.3.3, NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 8.5.6, NTC-ISO 9001:2015 8.5.2, NTC-ISO 9001:2015 8.3.6
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · 10.0 s
- Reparación V4: no fue necesaria

- **Clasificación:** Observación · severidad baja
- **Hallazgo corregido:** Se evidencia que en los registros del proceso la firma de los responsables presenta baja legibilidad, situación que podría afectar la clara identificación de los firmantes y la trazabilidad de la información conservada.
- **Criterio / requisito:** [Requisito específico pendiente de identificación/validación]
- **Justificación:** No se demuestra el incumplimiento de un requisito obligatorio documentado o normativo explícito sobre las firmas, pero la baja legibilidad de las mismas constituye una debilidad que puede comprometer la trazabilidad y la autenticidad de los registros.
- **Evidencia:** Registros del proceso de Consulta externa completados que presentan firmas poco legibles.

Verificaciones:

- ✓ clasificación esperada OBSERVACION → obtenida OBSERVACION
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 4

**Entrada del auditor** (proceso: Gestión humana):

> El registro de asistencia actualmente se realiza correctamente en formato físico.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 10.2, PR13-GQ 5, NTC-ISO 9001:2015 4.4, PR13-GQ 5, NTC-ISO 9001:2015 9.2, NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 4.3, NTC-ISO 9001:2015 8.3.5, NTC-ISO 9001:2015 9.1.1, NTC-ISO 9001:2015 7.2
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · 13.0 s
- Reparación V4: no fue necesaria

- **Clasificación:** Oportunidad de mejora · severidad baja
- **Hallazgo corregido:** El proceso de registro de asistencia en el área de Gestión Humana es susceptible de mejorar mediante la implementación de mecanismos o herramientas digitales de registro, lo cual permitirá agilizar la consolidación de la información y facilitar su posterior análisis.
- **Criterio / requisito:** [Requisito específico pendiente de identificación/validación]
- **Justificación:** El registro de asistencia se realiza de manera correcta cumpliendo con la actividad; no obstante, el proceso presenta una posibilidad de optimización mediante la digitalización del registro para mejorar la eficiencia del proceso de Gestión Humana.
- **Evidencia:** Verificación del registro de asistencia de personal realizado actualmente en formato físico de forma correcta.

Verificaciones:

- ✓ clasificación esperada OPORTUNIDAD_DE_MEJORA → obtenida OPORTUNIDAD_DE_MEJORA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 5

**Entrada del auditor** (proceso: Gestión gerencial):

> En la revisión por la dirección no se incluyeron las decisiones y acciones frente a las oportunidades de mejora.

- Criterios recuperados (12): NTC-ISO 9001:2015 9.3.3, NTC-ISO 9001:2015 9.3.2, NTC-ISO 9001:2015 6.1, NTC-ISO 9001:2015 9.3.1, NTC-ISO 9001:2015 10.3, NTC-ISO 9001:2015 10.1, NTC-ISO 9001:2015 10.2, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 9.1.3, NTC-ISO 9001:2015 5.1.2, PR13-GQ 5, PR13-GQ 4
- Modelo: `gemini-3.6-flash` (versión gemini-3.6-flash) · 5.2 s
- Reparación V4: no fue necesaria

- **Clasificación:** No conformidad · severidad media
- **Hallazgo corregido:** Durante la evaluación del proceso de Gestión Gerencial, se evidenció que en las salidas de la revisión por la dirección no se incluyeron las decisiones y acciones relacionadas con las oportunidades de mejora, incumpliendo lo establecido en la NTC-ISO 9001:2015, numeral 9.3.3, literal a.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 9.3.3, literal a
- **Justificación:** Existe un incumplimiento directo de un requisito obligatorio de la norma NTC-ISO 9001:2015, ya que las salidas de la revisión por la dirección deben incluir explícitamente las decisiones y acciones relacionadas con las oportunidades de mejora.
- **Evidencia:** Ausencia de decisiones y acciones registradas sobre oportunidades de mejora en el acta/registro de la revisión por la dirección.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 9.3.3 — Salidas de la revisión por la dirección

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD → obtenida NO_CONFORMIDAD
- ✓ cita verificada NTC-ISO 9001:2015 9.3.3
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 6

**Entrada del auditor** (proceso: Gestión de recursos físicos):

> El parqueadero de visitantes es pequeño y se llena los viernes.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.1.1, NTC-ISO 9001:2015 7.1.3, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 7.1.5.1, PR13-GQ 5, PR13-GQ 5, NTC-ISO 9001:2015 4.3, PR13-GQ 5, NTC-ISO 9001:2015 6.3, PR13-GQ 5, PR13-GQ 5, PR13-GQ 5
- Modelo: `gemini-3.7-flash` (versión gemini-3.7-flash) · 15.0 s
- Reparación V4: no fue necesaria

- **Clasificación:** Oportunidad de mejora · severidad baja
- **Hallazgo corregido:** La capacidad del área de parqueadero de visitantes es susceptible de mejorar mediante la evaluación de alternativas de ampliación, reorganización de espacios o convenios externos de estacionamiento, lo cual permitirá optimizar la disponibilidad de parqueo y brindar mayor comodidad a los usuarios durante los días de alta afluencia.
- **Criterio / requisito:** [Requisito específico pendiente de identificación/validación]
- **Justificación:** No se evidencia el incumplimiento de un requisito obligatorio ni una vulnerabilidad crítica para la prestación del servicio asistencial, pero existe una posibilidad de optimizar la capacidad y operatividad de la infraestructura asociada.
- **Evidencia:** Limitación de capacidad y saturación del parqueadero de visitantes durante los días viernes.

Verificaciones:

- ✓ clasificación esperada * → obtenida OPORTUNIDAD_DE_MEJORA
- ✓ sin numeral inventado: marcador pendiente o cita verificada
- ✓ el hallazgo corregido no menciona numerales sin verificar
- ✓ estructura de redacción verificada (V3) en todos los hallazgos

### Caso 7

**Entrada del auditor** (proceso: Urgencias):

> Se evidenció extintor vencido en el área de urgencias y además el personal muestra un excelente dominio del protocolo de código azul.

- Criterios recuperados (12): NTC-ISO 9001:2015 7.5.3, NTC-ISO 9001:2015 7.5.1, NTC-ISO 9001:2015 7.1.2, NTC-ISO 9001:2015 8.5.6, NTC-ISO 9001:2015 8.5.1, NTC-ISO 9001:2015 7.2, NTC-ISO 9001:2015 8.1, NTC-ISO 9001:2015 4.4, NTC-ISO 9001:2015 8.7, NTC-ISO 9001:2015 8.3.4, NTC-ISO 9001:2015 8.4.3, NTC-ISO 9001:2015 8.4.1
- Modelo: `gemini-3.5-flash` (versión gemini-3.5-flash) · descartados: `gemini-3.7-flash` (error 503), `gemini-3.6-flash` (error 503) · 34.7 s
- Reparación V4: no fue necesaria

#### Hallazgo 1 de 2

- **Clasificación:** No conformidad · severidad media
- **Hallazgo corregido:** Durante la auditoría realizada el [fecha por confirmar] en el área de Urgencias, se evidenció un extintor con fecha de vigencia expirada (vencido), incumpliendo el requisito de asegurar el uso de la infraestructura y el entorno adecuados para la operación de los procesos, establecido en la norma NTC-ISO 9001:2015, numeral 8.5.1, literal d).
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 8.5.1, literal d)
- **Justificación:** Se identificó un extintor con fecha de vigencia expirada en el área de urgencias, lo cual constituye un incumplimiento de los requisitos de control de la infraestructura y el entorno para la operación segura de los procesos.
- **Evidencia:** Extintor con fecha de vigencia expirada en el área de urgencias.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 8.5.1 — Control de la producción y de la provisión del servicio
- **Datos reemplazados por V6:** 3 de octubre de 2026
- **Avisos al auditor:** Se marcaron fechas o cifras que no aparecen en tu texto: complétalas o confírmalas.

#### Hallazgo 2 de 2

- **Clasificación:** Fortaleza · severidad baja
- **Hallazgo corregido:** Se evidencia un alto nivel de apropiación y dominio técnico por parte del personal del área de Urgencias respecto al protocolo de código azul, lo cual favorece la seguridad del paciente y contribuye a la efectividad en la atención de emergencias vitales.
- **Criterio / requisito:** NTC-ISO 9001:2015, numeral 7.2
- **Justificación:** El personal del área de urgencias demuestra un alto nivel de competencia y apropiación del protocolo de código azul, lo cual contribuye directamente a la seguridad del paciente y a la efectividad de la atención de emergencias.
- **Evidencia:** Demostración de dominio del protocolo de código azul por parte del personal de urgencias durante la auditoría.
- **Citas verificadas (V1):** NTC-ISO 9001:2015 7.2 — Competencia

Verificaciones:

- ✓ clasificación esperada NO_CONFORMIDAD + FORTALEZA → obtenida NO_CONFORMIDAD + FORTALEZA
- ✓ estructura de redacción verificada (V3) en todos los hallazgos
## Observaciones de la corrida

- **Los 7 casos cumplen lo esperado**, incluidos los dos que «más fallan»: el 6 no inventa numeral
  (queda el marcador pendiente) y el 7 separa la no conformidad de la fortaleza.
- **V6 funcionó en un caso real:** en los casos 1 y 7 el modelo fechó la observación con la fecha de la
  auditoría («3 de octubre de 2026»), dato que el auditor no escribió. Se reemplazó por
  `[fecha por confirmar]` y el auditor recibe el aviso.
- **V1 y V2 retiraron un sub-numeral (caso 1):** el modelo citó el fragmento 4.4 rotulándolo «4.4.2».
  Después de esta corrida, V1 y V2 se ajustaron para aceptar un sub-numeral **solo si aparece
  literalmente en el texto del fragmento verificado**; el caso quedó como prueba de regresión en
  `pnpm probar:validacion`. El resultado del caso no cambia: ya citaba 7.5.1 y 8.5.1 verificados.
- **Variación entre corridas:** en una corrida anterior el caso 3 citó 7.5.3 (*Control de la información
  documentada*) y en esta quedó con el marcador pendiente; ambos son válidos. La clasificación no varió en
  ninguna corrida.
- **Tiempos:** de 5 a 15 s cuando el modelo responde a la primera; hasta 38 s cuando la cascada salta
  modelos sin cuota o saturados (503).

## Pruebas automáticas sin red

```bash
pnpm probar          # todo lo siguiente, en orden
```

| Comando | Qué verifica | Resultado |
|---|---|---|
| `pnpm verificar:prompt` | El prompt del sistema es el ANEXO A literal | ✓ 15 600 caracteres idénticos |
| `pnpm probar:validacion` | V1–V6, anonimización antes de la IA y coherencia de catálogos | ✓ 52 comprobaciones |
| `pnpm probar:gemini` | Cascada de modelos, reintentos 1 s/4 s/10 s, cuota diaria, 400, MAX_TOKENS | ✓ 14 comprobaciones |
| `pnpm probar:bd` | Migraciones, RLS, aprobación de cuentas, ataques de integridad, cuota de IA | ✓ 65 comprobaciones |
| `pnpm probar:busqueda` | Ingesta de las normas y recuperación (9.3.3 primero, con y sin tildes) | ✓ 8 consultas |
| `pnpm probar:interfaz` | Extremo a extremo en Chromium: flujos, CSP, cuentas pendientes, admin, 360 px | ✓ 67 comprobaciones |

## Pendiente: contra la función desplegada

El §14 pide ejecutar los siete casos contra la Edge Function desplegada. Queda pendiente hasta crear el
proyecto Supabase (ver `docs/DESPLIEGUE.md`). Los pasos:

1. Desplegar (`supabase functions deploy …`) y cargar las normas (`pnpm ingest`).
2. Crear una auditoría desde la aplicación y capturar las siete entradas en la pantalla
   «Nuevo hallazgo».
3. Pegar aquí las respuestas y comprobar en `ia_eventos` el modelo y la latencia de cada una.
