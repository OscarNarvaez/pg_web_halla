-- 0009 · Cargos de una lista institucional y equipo auditor de varias personas (decisión del dueño, 4/10/2026).
--
--  · El auditor líder elige uno o varios cargos de la lista de LÍDERES (antes escribía el cargo a mano).
--  · El equipo auditor pasa de una sola persona a una lista de 1 a 10 personas; cada una con uno o varios
--    cargos de la lista de EQUIPO AUDITOR.
--  · Las listas son las mismas de src/lib/catalogos.js y supabase/functions/_shared/catalogos.ts
--    (CARGOS_LIDER y CARGOS_EQUIPO). Si cambias una, cambia las tres.

-- ─── Listas de cargos ───────────────────────────────────────────────────────
create or replace function public.cargos_lider()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'Asesor control interno', 'Asesor control interno (externo)', 'Asesor sistema integrado de calidad',
    'Asesora de contratación', 'Asesora de docencia e investigación', 'Asesora PAMEC', 'Auditor externo',
    'Auditor médico', 'Coordinadora', 'Coordinadora UACAI', 'Enfermera', 'Gestora de enfermería',
    'Gestora gestión clínica', 'Jefe de activos fijos', 'Jefe de suministro', 'Líder equipo', 'Nutricionista',
    'Subgerente de ambiente físico', 'Subgerente de cirugía', 'Subgerente de gestión de recursos físicos',
    'Subgerente de hospitalización no crítica', 'Subgerente gestión financiera'
  ]::text[]
$$;

create or replace function public.cargos_equipo()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'Asesor control interno', 'Auxiliar', 'Auxiliar administrativo', 'Coordinadora auditora de cuentas',
    'Coordinadora cuidado crítico', 'Coordinadora gestión documental', 'Coordinadora imagenología',
    'Coordinadora sala de cirugía', 'Coordinadora seguridad y salud en el trabajo', 'Doctor', 'Enfermera',
    'Enfermería', 'Interventor contratación', 'Interventor contratación equipo', 'Jefe de control de calidad',
    'Jefe de producción gases medicinales', 'Jefe de suministros', 'Médico', 'Médico especialista pediatra',
    'Profesional apoyo riesgos', 'Químico farmacéutico', 'Subgerente apoyo', 'Subgerente de gestión humana',
    'Subgerente servicio farmacéutico', 'Tesorera'
  ]::text[]
$$;

-- ─── Columnas nuevas ────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists cargos text[] not null default '{}',
  add column if not exists equipo_auditor jsonb not null default '[]'::jsonb;

-- Datos anteriores: el cargo escrito a mano se conserva solo si coincide con uno de la lista (sin importar
-- mayúsculas ni tildes). Si no coincide, el perfil queda sin cargos y la aplicación pide completarlo.
update public.profiles p set
  cargos = coalesce((
    select array_agg(c) from unnest(public.cargos_lider()) c
     where lower(extensions.unaccent(c)) = lower(extensions.unaccent(btrim(p.cargo)))
  ), '{}'),
  equipo_auditor = case
    when length(btrim(coalesce(p.equipo_auditor_nombre, ''))) >= 3 then jsonb_build_array(jsonb_build_object(
      'nombre', btrim(p.equipo_auditor_nombre),
      'cargos', to_jsonb(coalesce((
        select array_agg(c) from unnest(public.cargos_equipo()) c
         where lower(extensions.unaccent(c)) = lower(extensions.unaccent(btrim(p.equipo_auditor_cargo)))
      ), '{}'))))
    else '[]'::jsonb
  end;

alter table public.profiles
  drop column if exists cargo,
  drop column if exists equipo_auditor_nombre,
  drop column if exists equipo_auditor_cargo;

-- ─── Validación en la base de datos ────────────────────────────────────────
-- Se aplica al crear el perfil y cada vez que cambian los cargos o el equipo. Un perfil anterior sin
-- cargos sigue siendo válido (por ejemplo, para aprobarlo) hasta que su dueño lo edite.
create or replace function public.validar_cargos_perfil()
returns trigger language plpgsql set search_path = '' as $$
declare
  integrante jsonb;
  v_nombre text;
  v_cargos text[];
  normalizado jsonb := '[]'::jsonb;
begin
  -- Cargos del líder: sin repetidos, en el orden elegido
  select coalesce(array_agg(c order by o), '{}') into v_cargos
    from (select btrim(c) as c, min(o) as o from unnest(coalesce(new.cargos, '{}')) with ordinality as u(c, o) group by btrim(c)) x;
  if cardinality(v_cargos) < 1 or cardinality(v_cargos) > 5 then
    raise exception 'Elige entre 1 y 5 cargos (al menos un cargo)' using errcode = 'P0001';
  end if;
  if not v_cargos <@ public.cargos_lider() then
    raise exception 'Cargo no permitido para el auditor líder' using errcode = 'P0001';
  end if;
  new.cargos := v_cargos;

  -- Equipo auditor: de 1 a 10 personas, cada una con nombre y de 1 a 5 cargos de la lista del equipo
  if new.equipo_auditor is null or jsonb_typeof(new.equipo_auditor) <> 'array'
     or jsonb_array_length(new.equipo_auditor) < 1 or jsonb_array_length(new.equipo_auditor) > 10 then
    raise exception 'El equipo auditor debe tener entre 1 y 10 personas' using errcode = 'P0001';
  end if;
  for integrante in select * from jsonb_array_elements(new.equipo_auditor) loop
    if jsonb_typeof(integrante) <> 'object' or jsonb_typeof(integrante->'cargos') is distinct from 'array' then
      raise exception 'Cada integrante del equipo auditor debe tener nombre y cargos' using errcode = 'P0001';
    end if;
    v_nombre := btrim(coalesce(integrante->>'nombre', ''));
    if char_length(v_nombre) < 3 or char_length(v_nombre) > 120 then
      raise exception 'Cada integrante del equipo auditor debe tener un nombre de 3 a 120 caracteres' using errcode = 'P0001';
    end if;
    if exists (select 1 from jsonb_array_elements(integrante->'cargos') e where jsonb_typeof(e) <> 'string') then
      raise exception 'Cargo no permitido para el equipo auditor' using errcode = 'P0001';
    end if;
    select coalesce(array_agg(c order by o), '{}') into v_cargos
      from (select btrim(c) as c, min(o) as o from jsonb_array_elements_text(integrante->'cargos') with ordinality as u(c, o) group by btrim(c)) x;
    if cardinality(v_cargos) < 1 or cardinality(v_cargos) > 5 then
      raise exception 'Cada integrante del equipo auditor debe tener entre 1 y 5 cargos (al menos un cargo)' using errcode = 'P0001';
    end if;
    if not v_cargos <@ public.cargos_equipo() then
      raise exception 'Cargo no permitido para el equipo auditor' using errcode = 'P0001';
    end if;
    normalizado := normalizado || jsonb_build_array(jsonb_build_object('nombre', v_nombre, 'cargos', to_jsonb(v_cargos)));
  end loop;
  new.equipo_auditor := normalizado;
  return new;
end $$;

drop trigger if exists profiles_validar_cargos on public.profiles;
create trigger profiles_validar_cargos
  before insert or update of cargos, equipo_auditor on public.profiles
  for each row execute function public.validar_cargos_perfil();

-- ─── Registro: el perfil se crea con los cargos y el equipo de options.data ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  if meta ? 'nombre_completo' then
    begin
      insert into public.profiles (
        id, nombre_completo, cedula, celular, cargos, equipo_auditor, alcance, proceso, sistema,
        acepto_tratamiento_datos_en
      ) values (
        new.id,
        meta->>'nombre_completo',
        meta->>'cedula',
        meta->>'celular',
        case when jsonb_typeof(meta->'cargos') = 'array'
             then array(select jsonb_array_elements_text(meta->'cargos')) else '{}'::text[] end,
        case when jsonb_typeof(meta->'equipo_auditor') = 'array' then meta->'equipo_auditor' else '[]'::jsonb end,
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

-- ─── Permisos: el usuario edita sus cargos y su equipo ─────────────────────
-- (los permisos de las columnas eliminadas desaparecen con ellas)
grant update (cargos, equipo_auditor) on public.profiles to authenticated;
revoke execute on function public.validar_cargos_perfil() from public, anon, authenticated;
grant execute on function public.cargos_lider() to authenticated, service_role;
grant execute on function public.cargos_equipo() to authenticated, service_role;
