# halla.ink — notas permanentes del proyecto

Sistema experto de clasificación y redacción de hallazgos de auditoría interna del
**Hospital Infantil Los Ángeles (HILA)**. Especificación completa: `PROMPT_CLAUDE_CODE_HALLA.md`.
Reconocimiento y discrepancias con el prompt: `docs/RECONOCIMIENTO.md`.

## Reglas innegociables

1. El usuario **nunca** elige la clasificación antes del análisis. La IA decide; editar después
   marca `editado_por_usuario = true`.
2. La IA no cita numerales que no estén verificados contra `criterios_normativos`. Sin criterio
   verificable → exactamente `[Requisito específico pendiente de identificación/validación]`.
   Una NO_CONFORMIDAD sin requisito **sigue siendo** NO_CONFORMIDAD.
3. `GEMINI_API_KEY` solo vive en los secretos de Supabase (y en `supabase/functions/.env` local,
   gitignored). Nunca en `src/`, en `VITE_*` ni en el bundle.
4. `entrada_auditor` nunca se sobrescribe. Todo hallazgo guarda respuesta cruda, modelo y versión del prompt.
5. El prompt del sistema (`supabase/functions/_shared/prompt-sistema-experto.ts`) es el ANEXO A
   **literal**. No se resume ni se reescribe.

## Stack

- Frontend: React 18 + Vite + **JavaScript (no TypeScript)** + Tailwind CSS **3.4** (`tailwind.config.js`).
- Backend: Supabase (Postgres + Auth + RLS + Edge Functions en TypeScript/Deno).
- IA: Gemini `gemini-3.8-flash` con `thinkingLevel: 'low'` (ver `docs/RECONOCIMIENTO.md` §D).
- Hosting: GitHub Pages con dominio `halla.ink`.

## Comandos (solo pnpm)

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm build               # genera dist/ con 404.html y CNAME
pnpm lint
pnpm ingest:dry          # trocea normas/ sin subir nada; imprime el resumen
pnpm ingest              # requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno
pnpm verificar-rls       # requiere un proyecto Supabase real
supabase functions serve --env-file supabase/functions/.env
```

## Convenciones

- Código, comentarios, nombres de variables y textos de interfaz **en español**.
- Catálogos en `src/lib/catalogos.js` = enums de Postgres = `supabase/functions/_shared/catalogos.ts`.
  Si cambias uno, cambia los tres.
- Claves sin tilde con guion bajo en BD y JSON (`NO_CONFORMIDAD`); etiquetas con tilde en pantalla.
- Componentes de UI propios en `src/components/ui/` (sin librería externa), con `forwardRef` y JSDoc.
- Colores por clasificación: tonos `nc`, `obs`, `fort`, `om` de Tailwind. Nunca solo color: siempre texto.
- Commits convencionales en español (`feat(db): …`), sin trailers de coautoría.
- `Primer_prototipo/` es referencia histórica: no se toca.
