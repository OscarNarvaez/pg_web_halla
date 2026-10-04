-- 0010 · Datos que pide la Ficha Técnica del formato oficial del informe (src/formato_de_informe_final/
-- Auditoria_interna.odt), decisión del dueño del 4/10/2026:
--
--  · «Evaluador»: el auditor elige al registrarse si pertenece a los Auditores Internos o a los Auditores
--    Externos. El informe lo toma de su perfil (también va en la portada del formato).
--  · «Fecha inicio / terminación (real)»: las fechas actuales de la auditoría son las planeadas; se agregan
--    las reales.

-- ─── Evaluador ──────────────────────────────────────────────────────────────
-- Mismas claves que TIPOS_EVALUADOR en src/lib/catalogos.js y supabase/functions/_shared/catalogos.ts.
create type public.evaluador_tipo as enum ('AUDITORES_INTERNOS', 'AUDITORES_EXTERNOS');

alter table public.profiles add column if not exists tipo_evaluador public.evaluador_tipo;

-- Obligatorio al crear el perfil y al cambiarlo. Un perfil anterior sin evaluador sigue siendo válido
-- (por ejemplo, para aprobarlo) hasta que su dueño lo complete en «Mi perfil».
create or replace function public.validar_tipo_evaluador()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tipo_evaluador is null then
    raise exception 'Elige si perteneces a los Auditores Internos o a los Auditores Externos' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_validar_evaluador on public.profiles;
create trigger profiles_validar_evaluador
  before insert or update of tipo_evaluador on public.profiles
  for each row execute function public.validar_tipo_evaluador();

-- El registro crea el perfil con el evaluador de options.data
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  if meta ? 'nombre_completo' then
    begin
      insert into public.profiles (
        id, nombre_completo, cedula, celular, cargos, equipo_auditor, tipo_evaluador, alcance, proceso, sistema,
        acepto_tratamiento_datos_en
      ) values (
        new.id,
        meta->>'nombre_completo',
        meta->>'cedula',
        meta->>'celular',
        case when jsonb_typeof(meta->'cargos') = 'array'
             then array(select jsonb_array_elements_text(meta->'cargos')) else '{}'::text[] end,
        case when jsonb_typeof(meta->'equipo_auditor') = 'array' then meta->'equipo_auditor' else '[]'::jsonb end,
        nullif(meta->>'tipo_evaluador', '')::public.evaluador_tipo,
        (meta->>'alcance')::public.alcance_tipo,
        nullif(meta->>'proceso','')::public.proceso_tipo,
        nullif(meta->>'sistema','')::public.sistema_tipo,
        case when meta->>'acepto_tratamiento_datos' = 'true' then now() end
      );
    exception when others then
      raise warning 'handle_new_user: no se pudo crear el perfil de %: % (%)', new.id, sqlerrm, sqlstate;
    end;
  end if;
  return new;
end $$;

grant update (tipo_evaluador) on public.profiles to authenticated;
revoke execute on function public.validar_tipo_evaluador() from public, anon, authenticated;

-- ─── Fechas reales de la auditoría ─────────────────────────────────────────
-- fecha_inicio y fecha_fin (0002) son las planeadas.
alter table public.auditorias
  add column if not exists fecha_inicio_real date,
  add column if not exists fecha_fin_real date;

alter table public.auditorias
  add constraint fechas_reales_coherentes check (
    fecha_fin_real is null or fecha_inicio_real is null or fecha_fin_real >= fecha_inicio_real
  );
