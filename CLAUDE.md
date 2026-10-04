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

## Seguridad (docs/SEGURIDAD.md)

- Todo texto que vaya a Gemini pasa por `anonimizar()` (`_shared/anonimizar.ts`). La BD guarda el original.
- Solo cuentas aprobadas (`profiles.aprobado`) acceden a datos: RLS con `usuario_activo()` y 403 en las
  funciones. Nunca debilites esto para «simplificar» una prueba: aprueba al usuario de prueba.
- Cambios de esquema y permisos: SIEMPRE en una migración nueva (0007…), nunca editando las ya aplicadas.
  Al desplegar: `supabase db push` ANTES del `git push` del frontend (si no, la app pide columnas que no existen).
- Nada de borrado físico para el cliente; los informes solo los escribe la Edge Function.
- Cada ataque corregido vive como prueba en `scripts/probar-bd.mjs` o `scripts/probar-interfaz.mjs`.
- La CSP se genera en `vite.config.js`: si agregas un origen externo, agrégalo ahí con justificación.

## Stack

- Frontend: React 18 + Vite + **JavaScript (no TypeScript)** + Tailwind CSS **3.4** (`tailwind.config.js`).
- Backend: Supabase (Postgres + Auth + RLS + Edge Functions en TypeScript/Deno).
- IA: Gemini `gemini-3.8-flash` con `thinkingLevel: 'low'` y **cascada de modelos de respaldo**: el nivel
  gratuito da 20 solicitudes diarias por modelo (ver `docs/RECONOCIMIENTO.md` §D).
- Hosting: GitHub Pages con dominio `halla.ink` (workflow `.github/workflows/deploy.yml`).

## Comandos (solo pnpm)

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm build               # genera dist/ con 404.html y CNAME
pnpm lint                # debe quedar sin errores NI avisos
pnpm probar              # pruebas sin red: verificar:prompt, validacion, gemini, bd (PGlite), busqueda
pnpm probar:motor        # 7 casos del §14 contra Gemini real (lee supabase/functions/.env; gasta cuota)
pnpm probar:interfaz     # extremo a extremo: Chromium + Supabase simulado (necesita chromium-headless-shell)
pnpm check:funciones     # deno check de las Edge Functions (vía pnpm dlx deno)
pnpm ingest:dry          # trocea normas/ sin subir nada; imprime el resumen
pnpm ingest              # requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno
pnpm verificar-rls       # requiere un proyecto Supabase real
```

## Dónde está cada cosa

- `supabase/functions/_shared/`: módulos compartidos. Los que no tocan Deno (`motor.ts`,
  `validar-salida.ts`, `gemini.ts`, `informe.ts`, `recuperar-criterios.ts`, `config.ts`) se importan
  también desde Node 24 en los scripts de prueba: **no uses APIs de Deno ni enums de TS en ellos**, y
  usa extensiones `.ts` explícitas en los imports. Lo específico de Deno va en `supabase.ts` e `index.ts`.
- `scripts/lib/trocear-normas.mjs`: troceador de las normas (lo usan la ingesta y las pruebas).
- `scripts/lib/supabase-local.mjs`: Postgres en WASM con roles y `auth.*` de Supabase para probar sin Docker.
- `scripts/fixtures/motor-casos.json`: salidas reales del motor, usadas por la prueba de interfaz.

## Decisiones tomadas (no re-litigar sin el dueño)

- Alcance V1 = solo el prompt maestro. Riesgo PR13, controles, lista de verificación, matriz CSV y
  conclusión ISO 19011 del prototipo son Fase 8 (descritas en `docs/RECONOCIMIENTO.md`).
- Institución fija: HILA (`INSTITUCION` en `src/lib/catalogos.js` y `_shared/catalogos.ts`).
- Logo de HILA: `src/assets/logo-hila.webp` en la interfaz (`Marca`, `VistaInforme`) y `logo-hila.png` en el PDF
  y el Word (jsPDF y docx no leen WebP). Siempre sobre fondo blanco: su texto perimetral es oscuro.
- Ámbar de observación `#b7791f` (no `#94620a`): el del prototipo no se distinguía del rojo con deuteranopía.
- Fragmentos normativos de máximo 2 400 caracteres: `buscar_criterios` entrega 2 500 a la IA.
- V1/V2 aceptan un sub-numeral (4.4.2) solo si aparece literalmente en el texto del fragmento verificado (4.4).

## Convenciones

- Código, comentarios, nombres de variables y textos de interfaz **en español**.
- Catálogos en `src/lib/catalogos.js` = enums de Postgres = `supabase/functions/_shared/catalogos.ts`.
  Si cambias uno, cambia los tres.
- Claves sin tilde con guion bajo en BD y JSON (`NO_CONFORMIDAD`); etiquetas con tilde en pantalla.
- Componentes de UI propios en `src/components/ui/` (sin librería externa), con `forwardRef` y JSDoc.
- Colores por clasificación: tonos `nc`, `obs`, `fort`, `om` de Tailwind. Nunca solo color: siempre texto.
- Commits convencionales en español (`feat(db): …`), sin trailers de coautoría.
- `Primer_prototipo/` es referencia histórica: no se toca.
