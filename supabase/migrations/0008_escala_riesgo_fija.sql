-- 0008 · La escala de niveles de riesgo es fija (decisión del dueño, 4/10/2026).
-- Bajo 1–4 · Moderado 5–9 · Alto 10–16 · Extremo 17–25 (UMBRALES_RIESGO en src/lib/catalogos.js). Ya no se
-- guarda ni se edita por auditoría: se retira la columna que la 0007 había creado para eso.
alter table public.auditorias drop constraint if exists umbrales_riesgo_validos;
alter table public.auditorias drop column if exists umbrales_riesgo;
