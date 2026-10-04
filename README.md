# halla

Sistema experto de clasificación y redacción de hallazgos de auditoría interna del
**Hospital Infantil Los Ángeles** (Pasto, Nariño) · [halla.ink](https://halla.ink)

Antes de la visita, el auditor prepara su lista de verificación (el formato del hospital, para anotar en sitio).
Un asistente de 7 pasos guía al auditor: describe lo que observó (o carga un PDF, que se lee en su navegador
y no se sube), y la IA identifica la norma, el numeral y el requisito en los documentos cargados **sin
inventar numerales**, clasifica el hallazgo (no conformidad, observación, oportunidad de mejora o
fortaleza), lo redacta con la estructura técnica de la categoría, evalúa el riesgo con las escalas del
PR13_GQ (mapa de calor 5 × 5) y propone controles. Todo llega a una matriz consolidada que el auditor valida
y descarga en Excel, y al final se genera el informe con el formato oficial del hospital (la plantilla
`src/formato_de_informe_final/Auditoria_interna.odt`, llena tal cual), en ODT y PDF.

- Frontend: React 18 + Vite + Tailwind CSS, en GitHub Pages.
- Backend: Supabase (PostgreSQL con RLS, Auth y Edge Functions).
- IA: Gemini, llamada solo desde las Edge Functions; la API key nunca llega al navegador.

## Uso

```bash
pnpm install
cp .env.example .env.local   # URL y anon key de Supabase
pnpm dev                     # http://localhost:5173
pnpm build
pnpm lint
```

## Pruebas

```bash
pnpm probar            # sin red: prompt literal, validación anti-alucinación, cascada de modelos,
                       # migraciones + RLS (Postgres en WASM) y búsqueda en las normas
pnpm probar:motor      # los 7 casos obligatorios contra Gemini real (consume cuota)
pnpm probar:interfaz   # extremo a extremo en Chromium con Supabase simulado
```

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/RECONOCIMIENTO.md`](docs/RECONOCIMIENTO.md) | Punto de partida, prototipo y discrepancias con el prompt maestro |
| [`docs/BASE_DE_DATOS.md`](docs/BASE_DE_DATOS.md) | Modelo de datos, RLS, búsqueda e ingesta de normas |
| [`docs/PRUEBAS.md`](docs/PRUEBAS.md) | Los 7 casos obligatorios con las respuestas reales de la IA |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Auditoría de seguridad: hallazgos, correcciones y lo pendiente antes de producción |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Supabase, secretos, GitHub Pages y DNS paso a paso |
| [`docs/MANUAL_AUDITOR.md`](docs/MANUAL_AUDITOR.md) | Manual para los auditores |

La especificación completa está en [`PROMPT_CLAUDE_CODE_HALLA.md`](PROMPT_CLAUDE_CODE_HALLA.md).
