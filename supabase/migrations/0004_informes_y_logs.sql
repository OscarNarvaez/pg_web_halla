-- ════════════════════════════════════════════════════════════════════════════
-- 0004 · Informes versionados y bitácora de llamadas a la IA
-- ════════════════════════════════════════════════════════════════════════════

create table public.informes (
  id                 uuid primary key default gen_random_uuid(),
  auditoria_id       uuid not null references public.auditorias(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  version            int  not null default 1,
  resumen_ejecutivo  text,
  conclusiones       text,
  recomendaciones    text,
  estadisticas       jsonb,     -- conteos por clasificación, por criterio, por severidad (calculados en código)
  contenido          jsonb,     -- estructura completa renderizable (ISO 19011)
  modelo_ia          text,
  prompt_version     text,
  generado_en        timestamptz not null default now()
);
create unique index informes_auditoria_version_idx on public.informes (auditoria_id, version desc);

create table public.ia_eventos (
  id             bigserial primary key,
  user_id        uuid references auth.users(id) on delete set null,
  funcion        text not null,          -- clasificar-hallazgo | generar-informe | completar-auditoria
  modelo         text,
  prompt_version text,
  exito          boolean not null,
  codigo_error   text,
  detalle        jsonb,                  -- p. ej. criterios descartados por V1, intentos, reparación V4
  latencia_ms    int,
  tokens_entrada int,
  tokens_salida  int,
  creado_en      timestamptz not null default now()
);
create index ia_eventos_usuario_dia_idx on public.ia_eventos (user_id, creado_en desc);
