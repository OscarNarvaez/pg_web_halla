# halla

Sistema experto de clasificación y redacción de hallazgos de auditoría interna del
**Hospital Infantil Los Ángeles** (Pasto, Nariño) · [halla.ink](https://halla.ink)

El auditor describe en lenguaje natural lo que observó. La IA clasifica el hallazgo (no conformidad,
observación, oportunidad de mejora o fortaleza), lo redacta con la estructura técnica de la categoría,
identifica el requisito en las normas cargadas **sin inventar numerales** y genera el informe de auditoría.

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
