# Reconocimiento del repositorio — Fase 0

Fecha: 3 de octubre de 2026. Documento de entrada para todas las fases siguientes: qué había en el
repositorio, qué se reutiliza del prototipo y en qué puntos el prompt maestro
(`PROMPT_CLAUDE_CODE_HALLA.md`) no coincide con la realidad.

## Decisiones del dueño del proyecto

1. **Alcance de V1: solo el prompt maestro.** Las etapas de riesgo, controles, lista de verificación,
   matriz CSV y conclusión integrada ISO 19011 del prototipo quedan fuera (ver [Fase 8](#fase-8-opcional)).
2. **Institución fija:** Hospital Infantil Los Ángeles (HILA), Pasto, Nariño. Nombre y marca van en
   el código (`src/lib/catalogos.js` → `INSTITUCION`). El proceso o sistema auditado sí es dinámico.
3. **Credenciales:** al inicio solo existía la API key de Google AI Studio. El proyecto Supabase se
   crea al final; hasta entonces las fases 2, 3, 4 y 7 se escriben pero su verificación real queda
   pendiente (ver `docs/DESPLIEGUE.md`).

## A. Estado inicial del repositorio

Rama `main`, un solo commit, remoto `github.com/OscarNarvaez/pg_web_halla`. Contenido:

```
documentos_MD/          5 .md normativos (nombres con espacios y paréntesis)
Primer_prototipo/       README.md + artefacto/{canvas.json, Main.dc.html}
PROMPT_CLAUDE_CODE_HALLA.md
```

No existía nada de la infraestructura que el prompt da por hecha: ni `.github/workflows/`, ni
`CNAME`, ni `.gitignore`, ni `package.json`, ni `src/`, `docs/` o `supabase/`.

Herramientas locales: node 24, pnpm 12, supabase CLI 2.119, gh 2.46. No hace falta `deno` local: el
CLI de Supabase lo trae embebido.

## B. `Primer_prototipo/`

Es la fuente de un **artefacto de diseño de claude.ai** («Auditoría Interna HILA Versión 3»): un único
`Main.dc.html` de 2 395 líneas escrito en un DSL propio del editor (`<x-dc>`, `<sc-if>`, `<sc-for>`,
`{{…}}`, clase `DCLogic`, `support.js` ausente). **No es React y no compila fuera de claude.ai**, así
que no se reutiliza código: se reutiliza como especificación de producto.

- Siete pestañas: Lista de verificación · Nuevo hallazgo · Normas y documentos · Resultados · Matriz
  consolidada · Conclusión · Informe.
- Pipeline de siete etapas: Evidencia → Requisito → Clasificación → Hallazgo → Riesgo → Control → Conclusión.
- **No usa IA**: clasifica con expresiones regulares de pistas léxicas (`CUES`) y recupera requisitos
  con un BM25 artesanal (`rank()`), un stemmer de sufijos y un diccionario de sinónimos (`SYN`).

### Se conserva

| Qué | Líneas | Destino |
|---|---|---|
| Diccionario `SYN` hospital → vocabulario ISO | 750-763 | Expansión de consulta en `_shared/recuperar-criterios.ts` |
| Stopwords `STOP` | 714 | Limpieza de la consulta de recuperación |
| Textos de estructura y ejemplo por categoría (`ST`) | 2221-2226 | `ESTRUCTURAS` en `catalogos.js`, alineados al ANEXO A |
| Regla «no se inventa nada; lo que falta va entre corchetes» y banner de fuente única | 130, 425 | Copy de la pantalla de captura |
| Colores semánticos NC/FO/OB/OM | 707-711 | `tailwind.config.js` (`*.solido`) |
| Redacción de la conclusión final (adecuación/conveniencia/eficiencia) | 1755-1788 | Instrucción narrativa de `generar-informe` |
| Criterios del informe = solo normas y numerales realmente citados | 1724-1739 | `generar-informe` |
| Accesibilidad (`aria-*`, roles de tabla, foco visible) | todo | Componentes de `src/components/ui/` |

### Se rehace

- `localStorage` → Supabase + RLS.
- Clasificación por regex → Edge Function `clasificar-hallazgo` con Gemini.
- BM25 en el navegador sobre documentos subidos → `buscar_criterios` (FTS de PostgreSQL) sobre
  `criterios_normativos` precargada.
- PDF y DOCX escritos a mano (ZIP, CRC32, métricas AFM) → `jspdf` + `docx`.
- Paleta y tipografía del prototipo (`#0B5A66`, Public Sans, Newsreader) → paleta `tinta`/`halla`,
  Inter y Source Serif 4 del prompt (§6.1).

### Se elimina

- **El selector manual de clasificación de la etapa 3** (líneas 411-416): viola la regla innegociable
  n.º 1. La clasificación nace de la IA; el auditor solo puede editarla después y queda marcado
  `editado_por_usuario = true`.
- Las funciones fuera de alcance de V1 (ver Fase 8).

### Pendiente del prototipo

`Main.dc.html` referencia blobs que no están en el repositorio: el **logo del hospital**
(`/_blob/e615…`) y la base normativa (`/_blob/889a…`). La base normativa se sustituye por `normas/`;
**el logo hay que conseguirlo aparte** y ponerlo en `public/`. Mientras tanto la marca es tipográfica.

## C. Documentos normativos

Se movieron de `documentos_MD/` a `normas/` con los nombres del prompt (§4).

El `RE_NUMERAL` del prompt capta la mayoría de los encabezados (9001: 82/110, 45001: 65/207,
14001: 61/113, 19011: 80/168, PR13: 7/14), pero probado contra los archivos reales tiene cuatro
defectos que `scripts/ingest-normas.mjs` corrige:

1. **El último numeral se come el anexo.** `10.3 Mejora continua` arrastra 27 k caracteres en 9001,
   62 k en 45001 y 59 k en 14001; `7.6` arrastra 33 k en 19011. Los anexos y la bibliografía usan
   encabezados sin numeral (`Anexo A`, `Annex A`, `Bibliografía`). → Se tratan como corte de chunk.
2. **Numeral y término en líneas separadas** (definiciones de 45001 y 19011): `##### **3.1**` y en la
   línea siguiente `##### **organización**`. → Un encabezado que es solo numeral toma el siguiente
   encabezado como título.
3. **Contenido dentro del encabezado** (14001): `## **3.2.5 Objetivo.** Resultado a lograr.` → Se corta
   el título en `.**` y el resto pasa al contenido.
4. **PR13-GQ es OCR de tablas sin numerales utilizables.** Solo 14 encabezados; el 90 % del contenido
   está en un único bloque `5. CONTENIDO:` de 24 k caracteres con columnas mezcladas, `<br>` como
   separador y pies de página incrustados. **Los numerales que citaba el prototipo (`5.4`, `5.6`) no
   existen en el documento: estaban escritos a mano en el HTML.** → Troceado propio por actividades y
   subtítulos, `numeral = null`. PR13 aporta criterios de **baja precisión**; la validación V2 hace que,
   si no hay un criterio verificable, el hallazgo lleve el marcador de requisito pendiente.

El criterio de aceptación de la Fase 3 es alcanzable: `9.3.3 Salidas de la revisión por la dirección`
se trocea limpio (376 caracteres).

## D. Gemini — verificado contra la API

Pruebas con la API key real el 3 de octubre de 2026:

| Modelo | Resultado |
|---|---|
| `gemini-2.5-flash` (default del prompt §5) | **404**: «This model is no longer available to new users. Please update your code to use models/gemini-3.8-flash» |
| `gemini-flash-latest` | 404 |
| `gemini-3.5-flash` | 404 |
| **`gemini-3.8-flash`** | **200**: respeta `responseMimeType` + `responseSchema` con `enum` y arreglos anidados; clasificó `NO_CONFORMIDAD` y copió el `criterio_id` exacto citando 9.3.3 |

Los tres modelos que fallan **aparecen en `GET /v1beta/models`**: el listado no refleja lo que la key
puede usar. Hay que probar con `generateContent`.

Ajustes de diseño derivados:

- **Gemini 3.x razona por defecto** (344 tokens de pensamiento en la prueba), y esos tokens cuentan
  contra `maxOutputTokens`. Con 2 048 hay riesgo de `finishReason: MAX_TOKENS` con texto vacío.
  Se usa `thinkingConfig: { thinkingLevel: 'low' }` (0 tokens de pensamiento, latencia de 6,2 s a
  1,7 s, misma clasificación y cita) y `GEMINI_MAX_OUTPUT_TOKENS=4096`.
- La parte de la respuesta trae `thoughtSignature`: se lee `parts.find(p => p.text)`, no `parts[0].text`.
- **2 de 5 llamadas devolvieron `503 high demand`**: los reintentos con backoff cubren 429 y todo 5xx.

## E. Discrepancias del prompt maestro con la realidad

| # | El prompt dice | Realidad | Resolución |
|---|---|---|---|
| 1 | «Workflow ya existente, no lo rompas» (§0, §1.3) | No hay ningún workflow | Se crea `deploy.yml` desde cero |
| 2 | `GEMINI_MODEL=gemini-2.5-flash` | 404 para usuarios nuevos | `gemini-3.8-flash` |
| 3 | `GEMINI_MAX_OUTPUT_TOKENS=2048` | Insuficiente con razonamiento activo | `4096` + `thinkingLevel: low` |
| 4 | `grep -ri "AIza" src/ dist/` (§13) | Las keys nuevas tienen formato `AQ.…` | `grep -riE "AIza[0-9A-Za-z_-]{20,}\|AQ\.[0-9A-Za-z_-]{20,}"` |
| 5 | `npm` en todo (§12.1, Anexo C) | Regla del equipo: solo pnpm | pnpm, `pnpm/action-setup`, `pnpm-lock.yaml` |
| 6 | Normas en `normas/` con guiones bajos | Estaban en `documentos_MD/` con espacios | `git mv` con los nombres del prompt |
| 7 | El prototipo degrada NC → Observación si no hay requisito | El ANEXO A manda mantener NC con el marcador pendiente | Gana el ANEXO A (regla innegociable y validación V2) |
| 8 | PR13 con numerales `5.4`, `5.6` | No existen en el documento | Troceado sin numeral, documentado como baja precisión |
| 9 | `to_tsvector('spanish')` no quita tildes | Se intenta `es_unaccent` | Si falla en Supabase: normalizar en la consulta y documentarlo |

## Fase 8 opcional

Funciones del prototipo que el dueño dejó fuera de V1, descritas para poder retomarlas:

- **Riesgo por hallazgo (etapa 5):** probabilidad e impacto de 1 a 5 según el PR13-GQ, riesgo
  inherente = P × I, niveles Bajo/Moderado/Alto/Extremo con umbrales editables (por defecto 4/9/16),
  mapa de calor 5 × 5 con el conteo de hallazgos por casilla. Requiere columnas `probabilidad`,
  `impacto` y `riesgo_descripcion` en `hallazgos`.
- **Controles recomendados (etapa 6):** frases de los documentos con verbos de control y controles
  escritos por el auditor; alimentan las recomendaciones del informe.
- **Lista de verificación de auditorías internas:** formato institucional con secciones, filas
  requisito/pregunta/evidencia y marca NC/O/OB/F.
- **Matriz consolidada con exportación CSV.**
- **Conclusión integrada ISO 19011:** juicio del auditor (favorable / con reservas / desfavorable)
  sobre adecuación, conveniencia y eficiencia, con justificación.
- **Recuperación semántica con `pgvector`** como complemento del FTS.
