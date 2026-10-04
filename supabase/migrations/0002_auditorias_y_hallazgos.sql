-- ════════════════════════════════════════════════════════════════════════════
-- 0002 · Auditorías y hallazgos
-- ════════════════════════════════════════════════════════════════════════════

create type public.estado_auditoria as enum ('borrador','en_curso','cerrada');
create type public.estado_hallazgo  as enum ('generado','editado','confirmado','descartado');

create table public.auditorias (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  codigo           text not null check (length(trim(codigo)) >= 3),   -- p. ej. AI-2026-014
  titulo           text not null check (length(trim(titulo)) >= 3),
  alcance          public.alcance_tipo not null,
  proceso          public.proceso_tipo,
  sistema          public.sistema_tipo,
  objetivo         text,                          -- lo puede redactar la IA
  criterios        text[] not null default '{}',  -- normas aplicables, las puede sugerir la IA
  area_auditada    text,
  auditado_nombre  text,
  auditado_cargo   text,
  fecha_inicio     date,
  fecha_fin        date,
  estado           public.estado_auditoria not null default 'borrador',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint alcance_auditoria_coherente check (
    (alcance = 'PROCESOS' and proceso is not null and sistema is null) or
    (alcance = 'SISTEMAS' and sistema is not null and proceso is null)
  ),
  constraint fechas_coherentes check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);
create unique index auditorias_codigo_usuario_idx on public.auditorias (user_id, codigo);
create index auditorias_usuario_idx on public.auditorias (user_id, creado_en desc);

create trigger auditorias_actualizado_en
  before update on public.auditorias
  for each row execute function public.tocar_actualizado_en();

create table public.hallazgos (
  id                  uuid primary key default gen_random_uuid(),
  auditoria_id        uuid not null references public.auditorias(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  consecutivo         int  not null,              -- 1,2,3... por auditoría (lo asigna el trigger)
  entrada_auditor     text not null,              -- texto crudo, NUNCA se sobrescribe
  clasificacion       public.clasificacion_tipo not null,
  justificacion       text not null,
  hallazgo_corregido  text not null,
  criterio_requisito  text not null,
  evidencia           text not null,
  severidad           text check (severidad in ('alta','media','baja')), -- sugerida por la IA
  estado              public.estado_hallazgo not null default 'generado',
  editado_por_usuario boolean not null default false,
  modelo_ia           text,
  prompt_version      text,
  respuesta_cruda     jsonb,                       -- JSON completo devuelto por Gemini
  criterios_citados   jsonb not null default '[]'::jsonb,
  avisos              text[] not null default '{}', -- p. ej. estructura no verificada (V4)
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index hallazgos_usuario_idx on public.hallazgos (user_id, creado_en desc);
create unique index hallazgos_consecutivo_idx on public.hallazgos (auditoria_id, consecutivo);

-- Consecutivo por auditoría. Se calcula en el servidor (no en el cliente: hay carreras).
-- El bloqueo de la fila de la auditoría serializa las inserciones concurrentes.
create or replace function public.asignar_consecutivo()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from public.auditorias where id = new.auditoria_id for update;
  select coalesce(max(consecutivo), 0) + 1 into new.consecutivo
  from public.hallazgos where auditoria_id = new.auditoria_id;
  return new;
end $$;

create trigger hallazgos_consecutivo
  before insert on public.hallazgos
  for each row execute function public.asignar_consecutivo();

-- Trazabilidad: la entrada del auditor y la procedencia de la IA no se pueden modificar.
-- Cualquier cambio de los campos redactados marca editado_por_usuario = true.
create or replace function public.proteger_hallazgo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.entrada_auditor is distinct from old.entrada_auditor
     or new.respuesta_cruda is distinct from old.respuesta_cruda
     or new.modelo_ia is distinct from old.modelo_ia
     or new.prompt_version is distinct from old.prompt_version
     or new.consecutivo is distinct from old.consecutivo
     or new.auditoria_id is distinct from old.auditoria_id
     or new.user_id is distinct from old.user_id then
    raise exception 'La entrada original del auditor y la trazabilidad de la IA no se pueden modificar'
      using errcode = 'P0001';
  end if;

  if new.clasificacion       is distinct from old.clasificacion
     or new.justificacion      is distinct from old.justificacion
     or new.hallazgo_corregido is distinct from old.hallazgo_corregido
     or new.criterio_requisito is distinct from old.criterio_requisito
     or new.evidencia          is distinct from old.evidencia
     or new.severidad          is distinct from old.severidad then
    new.editado_por_usuario := true;
  end if;

  new.actualizado_en := now();
  return new;
end $$;

create trigger hallazgos_proteger
  before update on public.hallazgos
  for each row execute function public.proteger_hallazgo();
