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
- `scripts/fixtures/motor-casos.json`: salidas reales del motor, usadas por la prueba de interfaz. Si cambia el
  mensaje o el esquema de salida, regenéralo con `pnpm probar:motor -- --md scripts/fixtures/motor-casos.json`.
- `src/components/hallazgos/asistente/`: los pasos del asistente; `TarjetaResultado` los reúne para el modal.
- `src/components/riesgo/`: mapa de calor, selector de escala y nivel. `src/lib/matriz.js`: textos de la
  matriz (pantalla y Excel); `src/lib/exportar-matriz.js` se importa bajo demanda.

## Decisiones tomadas (no re-litigar sin el dueño)

- Alcance: el prompt maestro **más** (decisión del dueño, 4/10/2026) el asistente de 7 pasos, el PDF de evidencia,
  el riesgo PR13, los controles, la matriz consolidada y la lista de verificación. Sigue en Fase 8 la conclusión
  integrada ISO 19011 (`docs/RECONOCIMIENTO.md`).
- Lista de verificación (formato del dueño, 0011, `src/pages/ListaVerificacion.jsx`): hoja de trabajo del auditor,
  una por auditoría, con guardado automático y PDF (`exportar-lista.js`). NO pasa por la IA ni alimenta hallazgos,
  matriz ni informe. Textos del formato en `src/lib/lista-verificacion.js`. Flujo (decisión del dueño, 5/10/2026):
  al crear la auditoría se pregunta «lista o auditoría» (`ModalEleccion`); abrir la lista la crea; al ENTRAR a una
  auditoría con lista se pregunta SIEMPRE si sigue con la lista o con la auditoría (no al volver desde sus páginas:
  `RutaAnteriorContext`). Barra con «Guardar cambios» siempre visible; lo pendiente se guarda antes de cerrar sesión
  (`src/lib/guardado-pendiente.js`).
- PDF de evidencia: se lee en el navegador (`src/lib/pdf-evidencia.js`) y NUNCA se sube; solo viajan su texto
  y su huella `{nombre, paginas, sha256}`. Se carga en el paso 1 (`evidencia_archivo`, el que analiza la IA, inmutable)
  y también al editar la evidencia (decisión del dueño, 5/10/2026): paso 4, detalle y matriz, con `EvidenciaEditable`
  → `evidencia_anexos` (0012). Ambos van a «Archivos adjuntos» del informe.
- Matriz: «Validado» = estado `confirmado`. Se descarga (Excel) solo con TODOS los vigentes validados; validar
  exige riesgo completo y un control adoptado (`faltantesParaValidar` en `src/lib/riesgo.js`). Editar un
  validado lo devuelve a pendiente en el servidor (trigger `proteger_hallazgo`).
- Riesgo: la IA propone probabilidad e impacto (1 a 5, escalas del PR13 en `catalogos`); el NIVEL lo calcula el
  código con la escala FIJA `UMBRALES_RIESGO` (Bajo 1–4, Moderado 5–9, Alto 10–16, Extremo 17–25). La escala
  de niveles NO es editable (decisión del dueño): no agregues campos ni columnas para cambiarla. La metodología va en el mensaje de usuario
  (`bloqueRiesgo()` en `motor.ts`), nunca en el prompt del sistema. Colores de zona en `COLORES_ZONA`,
  validados con el skill dataviz para deuteranopía.
- Institución fija: HILA (`INSTITUCION` en `src/lib/catalogos.js` y `_shared/catalogos.ts`).
- Cargos (decisión del dueño, 4/10/2026): NO se escriben a mano. El líder elige 1 a 5 de `CARGOS_LIDER` y cada persona
  del equipo auditor (1 a 10 personas, `profiles.equipo_auditor` jsonb) elige 1 a 5 de `CARGOS_EQUIPO`. Las listas
  están en `catalogos.js`, `_shared/catalogos.ts` y `public.cargos_lider()`/`cargos_equipo()` (0009): cambia las
  tres. Selector accesible en `src/components/ui/SelectorMultiple.jsx`.
- Informe final = formato oficial `src/formato_de_informe_final/Auditoria_interna.odt` (decisión del dueño, 4/10/2026):
  «es tal cual ese formato, no debe cambiar». NUNCA edites la plantilla ni su orden; el dueño la reemplaza. El ODT se
  llena SOBRE la plantilla (`src/lib/exportar-odt.js`, anclas por TEXTO, no por estilos); el PDF
  (`exportar-pdf.js`, Liberation Sans OFL) y la vista (`VistaInforme`) la reproducen. Textos fijos en
  `src/lib/formato-informe.js`. Únicos ajustes al llenar: campos de página en el pie (la plantilla traía «Página /») y
  la posición del pie de la página maestra 2 (venía a mitad de hoja). Contenido `version_estructura: 3`; las versiones
  anteriores se regeneran. Sin firmas: la plantilla no las tiene. «Evaluador» = `profiles.tipo_evaluador` (0010).
- Logo de HILA: `src/assets/logo-hila.webp` en la interfaz (`Marca`, `VistaInforme`); el PDF y el ODT usan la imagen de la
  propia plantilla. Siempre sobre fondo blanco: su texto perimetral es oscuro.
- Redacción (guía del dueño, 5/10/2026): fórmula por categoría en `GUIA_REDACCION` (`_shared/motor.ts`, va en el MENSAJE
  de usuario con `bloqueRedaccion()`; nunca en el prompt del sistema). Fortaleza = qué es relevante + «porque» + beneficio
  presente; OM = susceptible de mejorar + «para lo cual»/«lo cual» + beneficio futuro; NC = evidencia + incumplimiento
  (también «no se…») + requisito; Observación = debilidad + impacto potencial. V3 (`verificarEstructura`) y la app
  (`src/lib/estructura.js`, aviso en vivo al editar o corregir la clasificación, sin bloquear) usan las MISMAS reglas:
  `probar:validacion` las compara. `ESTRUCTURAS` (catalogos.js) = mismas fórmulas y ejemplos.
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
