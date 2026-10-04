-- ════════════════════════════════════════════════════════════════════════════
-- 0006 · Endurecimiento de seguridad (auditoría de seguridad, docs/SEGURIDAD.md)
--
--  S2  Aprobación de cuentas: un usuario recién registrado no accede a nada hasta que un
--      administrador lo aprueba. Antes, cualquiera en internet podía registrarse y usar la IA.
--  S3  Integridad y trazabilidad: citas normativas validadas en la base de datos, marcas de
--      tiempo fijadas por el servidor, sin borrado físico e historial de cambios de hallazgos.
--  S4  Cuota de IA atómica: la reserva se hace al inicio con bloqueo por usuario, con límite
--      diario y por minuto (antes se evadía lanzando peticiones en paralelo).
--  S9  Autorización de tratamiento de datos personales (Ley 1581 de 2012) obligatoria.
--  S11 Mínimo privilegio: sin permisos para anon, sin TRUNCATE y topes de tamaño en la búsqueda.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Columnas nuevas de profiles ────────────────────────────────────────────
alter table public.profiles
  add column if not exists aprobado boolean not null default false,
  add column if not exists aprobado_por uuid references auth.users(id) on delete set null,
  add column if not exists aprobado_en timestamptz,
  add column if not exists acepto_tratamiento_datos_en timestamptz;

-- ─── Funciones de autorización ─────────────────────────────────────────────
-- Un usuario activo es uno con perfil aprobado por un administrador.
create or replace function public.usuario_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.aprobado
  );
$$;

-- Un administrador también debe estar aprobado.
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.aprobado
  );
$$;

-- Aprobar o desactivar una cuenta. Solo administradores; nadie se desactiva a sí mismo.
create or replace function public.aprobar_auditor(p_id uuid, p_aprobado boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede aprobar cuentas' using errcode = '42501';
  end if;
  if p_id = (select auth.uid()) and not p_aprobado then
    raise exception 'Un administrador no puede desactivar su propia cuenta' using errcode = '42501';
  end if;
  update public.profiles
     set aprobado = p_aprobado,
         aprobado_por = case when p_aprobado then (select auth.uid()) else null end,
         aprobado_en = case when p_aprobado then now() else null end
   where id = p_id;
  if not found then
    raise exception 'No existe ese perfil' using errcode = 'P0002';
  end if;
end $$;

-- ─── Perfil: valores que fija el servidor al crearlo ───────────────────────
-- rol = auditor y aprobado = false siempre; la autorización de datos es obligatoria y su fecha
-- la pone el servidor (el cliente no puede antedatarla).
create or replace function public.validar_nuevo_perfil()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.rol := 'auditor';
  new.aprobado := false;
  new.aprobado_por := null;
  new.aprobado_en := null;
  new.creado_en := now();
  new.actualizado_en := now();
  if new.acepto_tratamiento_datos_en is null then
    raise exception 'Se requiere la autorización de tratamiento de datos personales (Ley 1581 de 2012)'
      using errcode = 'P0001';
  end if;
  new.acepto_tratamiento_datos_en := now();
  return new;
end $$;

drop trigger if exists profiles_validar_nuevo on public.profiles;
create trigger profiles_validar_nuevo
  before insert on public.profiles
  for each row execute function public.validar_nuevo_perfil();

-- El trigger de registro ahora lee la autorización de datos de options.data
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ? 'nombre_completo' then
    begin
      insert into public.profiles (
        id, nombre_completo, cedula, celular, cargo,
        equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso, sistema,
        acepto_tratamiento_datos_en
      ) values (
        new.id,
        new.raw_user_meta_data->>'nombre_completo',
        new.raw_user_meta_data->>'cedula',
        new.raw_user_meta_data->>'celular',
        new.raw_user_meta_data->>'cargo',
        new.raw_user_meta_data->>'equipo_auditor_nombre',
        new.raw_user_meta_data->>'equipo_auditor_cargo',
        (new.raw_user_meta_data->>'alcance')::public.alcance_tipo,
        nullif(new.raw_user_meta_data->>'proceso','')::public.proceso_tipo,
        nullif(new.raw_user_meta_data->>'sistema','')::public.sistema_tipo,
        case when new.raw_user_meta_data->>'acepto_tratamiento_datos' = 'true' then now() end
      );
    exception when others then
      raise warning 'handle_new_user: no se pudo crear el perfil de %: % (%)', new.id, sqlerrm, sqlstate;
    end;
  end if;
  return new;
end $$;

-- ─── Marcas de tiempo fijadas por el servidor ──────────────────────────────
create or replace function public.fijar_marcas_insercion()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.creado_en := now();
  new.actualizado_en := now();
  return new;
end $$;

create or replace function public.conservar_creado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.creado_en := old.creado_en;
  return new;
end $$;

drop trigger if exists auditorias_marcas on public.auditorias;
create trigger auditorias_marcas before insert on public.auditorias
  for each row execute function public.fijar_marcas_insercion();
drop trigger if exists auditorias_conservar_creado on public.auditorias;
create trigger auditorias_conservar_creado before update on public.auditorias
  for each row execute function public.conservar_creado_en();
drop trigger if exists profiles_conservar_creado on public.profiles;
create trigger profiles_conservar_creado before update on public.profiles
  for each row execute function public.conservar_creado_en();

-- hallazgos: el consecutivo y las marcas de tiempo los pone el servidor
create or replace function public.asignar_consecutivo()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform 1 from public.auditorias where id = new.auditoria_id for update;
  select coalesce(max(consecutivo), 0) + 1 into new.consecutivo
  from public.hallazgos where auditoria_id = new.auditoria_id;
  new.creado_en := now();
  new.actualizado_en := now();
  return new;
end $$;

-- informes: la fecha de generación la pone el servidor
create or replace function public.fijar_generado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.generado_en := now();
  return new;
end $$;
drop trigger if exists informes_generado_en on public.informes;
create trigger informes_generado_en before insert on public.informes
  for each row execute function public.fijar_generado_en();

-- La protección de hallazgos ahora incluye creado_en
create or replace function public.proteger_hallazgo()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.entrada_auditor is distinct from old.entrada_auditor
     or new.respuesta_cruda is distinct from old.respuesta_cruda
     or new.modelo_ia is distinct from old.modelo_ia
     or new.prompt_version is distinct from old.prompt_version
     or new.consecutivo is distinct from old.consecutivo
     or new.auditoria_id is distinct from old.auditoria_id
     or new.user_id is distinct from old.user_id
     or new.creado_en is distinct from old.creado_en then
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

-- ─── Citas normativas validadas en la base de datos ────────────────────────
-- Toda cita debe apuntar a un criterio real; el numeral debe ser el del fragmento o un
-- sub-numeral que aparezca literalmente en su texto. Documento y título se toman de la BD.
create or replace function public.validar_criterios_citados()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cita jsonb;
  c record;
  v_numeral text;
  normalizadas jsonb := '[]'::jsonb;
begin
  if new.criterios_citados is null or jsonb_typeof(new.criterios_citados) <> 'array' then
    new.criterios_citados := '[]'::jsonb;
    return new;
  end if;
  if jsonb_array_length(new.criterios_citados) > 20 then
    raise exception 'Demasiadas citas normativas en un hallazgo' using errcode = 'P0001';
  end if;
  for cita in select * from jsonb_array_elements(new.criterios_citados) loop
    select cn.id, cn.documento_codigo, cn.numeral as numeral_bd, cn.titulo, cn.contenido into c
      from public.criterios_normativos cn
     where cn.id::text = cita->>'criterio_id';
    if not found then
      raise exception 'Cita normativa no verificable: el criterio % no existe', cita->>'criterio_id' using errcode = 'P0001';
    end if;
    v_numeral := nullif(trim(cita->>'numeral'), '');
    if c.numeral_bd is not null and v_numeral is distinct from c.numeral_bd
       and not (v_numeral like c.numeral_bd || '.%' and position(v_numeral in c.contenido) > 0) then
      raise exception 'Cita normativa no verificable: el numeral % no corresponde al criterio', v_numeral using errcode = 'P0001';
    end if;
    normalizadas := normalizadas || jsonb_build_array(jsonb_build_object(
      'criterio_id', c.id, 'numeral', coalesce(v_numeral, c.numeral_bd), 'documento', c.documento_codigo,
      'titulo', c.titulo, 'verificado', true));
  end loop;
  new.criterios_citados := normalizadas;
  return new;
end $$;

drop trigger if exists hallazgos_validar_citas on public.hallazgos;
create trigger hallazgos_validar_citas
  before insert or update of criterios_citados on public.hallazgos
  for each row execute function public.validar_criterios_citados();

-- ─── Historial de cambios de los hallazgos ─────────────────────────────────
create table if not exists public.hallazgos_historial (
  id           bigserial primary key,
  hallazgo_id  uuid not null references public.hallazgos(id) on delete cascade,
  cambiado_por uuid references auth.users(id) on delete set null,
  cambiado_en  timestamptz not null default now(),
  antes        jsonb not null,
  despues      jsonb not null
);
create index if not exists hallazgos_historial_idx on public.hallazgos_historial (hallazgo_id, cambiado_en);

create or replace function public.registrar_historial_hallazgo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  campos text[] := array['clasificacion','justificacion','hallazgo_corregido','criterio_requisito','evidencia','severidad','estado','criterios_citados'];
  antes jsonb;
  despues jsonb;
begin
  select jsonb_object_agg(k, v) into antes from jsonb_each(to_jsonb(old)) as e(k, v) where k = any(campos);
  select jsonb_object_agg(k, v) into despues from jsonb_each(to_jsonb(new)) as e(k, v) where k = any(campos);
  if antes is distinct from despues then
    insert into public.hallazgos_historial (hallazgo_id, cambiado_por, antes, despues)
    values (new.id, (select auth.uid()), antes, despues);
  end if;
  return new;
end $$;

drop trigger if exists hallazgos_historial_cambios on public.hallazgos;
create trigger hallazgos_historial_cambios
  after update on public.hallazgos
  for each row execute function public.registrar_historial_hallazgo();

alter table public.hallazgos_historial enable row level security;
create policy "historial: lectura del dueño o admin" on public.hallazgos_historial
  for select to authenticated
  using (
    public.es_admin() or (public.usuario_activo() and exists (
      select 1 from public.hallazgos h where h.id = hallazgo_id and h.user_id = (select auth.uid())))
  );

-- ─── Cuota de IA atómica (S4) ──────────────────────────────────────────────
-- La Edge Function reserva el uso ANTES de llamar a la IA. El bloqueo por usuario impide que
-- peticiones en paralelo cuenten el mismo cupo. Devuelve el id del evento o un error 429.
create or replace function public.reservar_uso_ia(
  p_user uuid, p_funcion text, p_limite_dia int, p_limite_minuto int
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  dia int;
  minuto int;
  nuevo bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ia:' || p_user::text, 0));
  select count(*) filter (where creado_en > now() - interval '24 hours'),
         count(*) filter (where creado_en > now() - interval '1 minute')
    into dia, minuto
    from public.ia_eventos
   where user_id = p_user and creado_en > now() - interval '24 hours';
  if dia >= p_limite_dia then
    raise exception 'limite_diario' using errcode = 'P0001';
  end if;
  if minuto >= p_limite_minuto then
    raise exception 'limite_minuto' using errcode = 'P0001';
  end if;
  insert into public.ia_eventos (user_id, funcion, exito, codigo_error)
  values (p_user, p_funcion, false, 'en_curso')
  returning id into nuevo;
  return nuevo;
end $$;

-- ─── Búsqueda con topes de tamaño ──────────────────────────────────────────
create or replace function public.buscar_criterios(
  consulta   text,
  documentos text[] default null,
  limite     int    default 12
)
returns table (
  id uuid, documento_codigo text, numeral text, titulo text, contenido text, idioma text, puntaje real
)
language sql stable set search_path = '' as $$
  select c.id, c.documento_codigo, c.numeral, c.titulo,
         left(c.contenido, 2500) as contenido,
         c.idioma,
         ts_rank(c.busqueda, q, 1) as puntaje
  from public.criterios_normativos c,
       websearch_to_tsquery('public.es_unaccent'::regconfig, left(coalesce(consulta, ''), 1000)) q
  where (documentos is null or c.documento_codigo = any(documentos[1:10]))
    and c.busqueda @@ q
  order by puntaje desc, c.orden asc
  limit greatest(1, least(limite, 50));
$$;

create or replace function public.explorar_criterios(
  consulta   text,
  documentos text[] default null,
  limite     int    default 20
)
returns table (
  id uuid, documento_codigo text, numeral text, titulo text, extracto text, puntaje real
)
language sql stable set search_path = '' as $$
  select c.id, c.documento_codigo, c.numeral, c.titulo,
         ts_headline('public.es_unaccent'::regconfig, c.contenido, q,
           'StartSel=⟦, StopSel=⟧, MaxWords=45, MinWords=20, MaxFragments=2, FragmentDelimiter=" … "') as extracto,
         ts_rank(c.busqueda, q, 1) as puntaje
  from public.criterios_normativos c,
       websearch_to_tsquery('public.es_unaccent'::regconfig, left(coalesce(consulta, ''), 300)) q
  where (documentos is null or c.documento_codigo = any(documentos[1:10]))
    and c.busqueda @@ q
  order by puntaje desc, c.orden asc
  limit greatest(1, least(limite, 50));
$$;

-- ─── Políticas RLS: solo usuarios activos (aprobados); sin borrado físico ───
drop policy if exists "auditoria propia o admin: lectura" on public.auditorias;
drop policy if exists "auditoria propia: creación" on public.auditorias;
drop policy if exists "auditoria propia: edición" on public.auditorias;
drop policy if exists "auditoria propia: eliminación" on public.auditorias;

create policy "auditoria propia o admin: lectura" on public.auditorias
  for select to authenticated
  using ((user_id = (select auth.uid()) and public.usuario_activo()) or public.es_admin());
create policy "auditoria propia: creación" on public.auditorias
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.usuario_activo());
create policy "auditoria propia: edición" on public.auditorias
  for update to authenticated
  using (user_id = (select auth.uid()) and public.usuario_activo())
  with check (user_id = (select auth.uid()) and public.usuario_activo());

drop policy if exists "hallazgo propio o admin: lectura" on public.hallazgos;
drop policy if exists "hallazgo propio: creación sin procedencia de IA" on public.hallazgos;
drop policy if exists "hallazgo propio: edición" on public.hallazgos;
drop policy if exists "hallazgo propio: eliminación" on public.hallazgos;

create policy "hallazgo propio o admin: lectura" on public.hallazgos
  for select to authenticated
  using ((user_id = (select auth.uid()) and public.usuario_activo()) or public.es_admin());
create policy "hallazgo propio: creación sin procedencia de IA" on public.hallazgos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.usuario_activo()
    and exists (select 1 from public.auditorias a where a.id = auditoria_id and a.user_id = (select auth.uid()) and a.estado <> 'cerrada')
    and respuesta_cruda is null and modelo_ia is null and prompt_version is null
  );
create policy "hallazgo propio: edición" on public.hallazgos
  for update to authenticated
  using (user_id = (select auth.uid()) and public.usuario_activo())
  with check (user_id = (select auth.uid()) and public.usuario_activo());

-- Informes: los genera SOLO la Edge Function (service_role); el cliente únicamente los lee
drop policy if exists "informe propio o admin: lectura" on public.informes;
drop policy if exists "informe propio: creación" on public.informes;
drop policy if exists "informe propio: edición" on public.informes;
drop policy if exists "informe propio: eliminación" on public.informes;

create policy "informe propio o admin: lectura" on public.informes
  for select to authenticated
  using ((user_id = (select auth.uid()) and public.usuario_activo()) or public.es_admin());

drop policy if exists "criterios: lectura autenticados" on public.criterios_normativos;
create policy "criterios: lectura usuarios activos" on public.criterios_normativos
  for select to authenticated
  using (public.usuario_activo());

drop policy if exists "perfil propio: creación" on public.profiles;
create policy "perfil propio: creación" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and rol = 'auditor' and aprobado = false);

-- ─── Mínimo privilegio ─────────────────────────────────────────────────────
-- anon no necesita nada del esquema public: el registro y el ingreso van por Supabase Auth.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- authenticated: nada de TRUNCATE/REFERENCES/TRIGGER, ni borrado, ni escritura de tablas del servidor
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke delete on public.profiles, public.auditorias, public.hallazgos, public.informes,
  public.criterios_normativos, public.ia_eventos, public.hallazgos_historial from authenticated;
revoke insert, update on public.informes, public.criterios_normativos, public.ia_eventos,
  public.hallazgos_historial from authenticated;
-- profiles: las columnas de aprobación y la autorización de datos no son editables por el usuario
revoke update on public.profiles from authenticated;
grant update (
  nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo,
  alcance, proceso, sistema
) on public.profiles to authenticated;

-- Funciones: nada ejecutable por PUBLIC/anon; solo lo necesario para authenticated
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on function public.usuario_activo() to authenticated, service_role;
grant execute on function public.es_admin() to authenticated, service_role;
grant execute on function public.aprobar_auditor(uuid, boolean) to authenticated;
grant execute on function public.buscar_criterios(text, text[], int) to authenticated, service_role;
grant execute on function public.explorar_criterios(text, text[], int) to authenticated, service_role;
grant execute on function public.resumen_documentos() to authenticated, service_role;
revoke execute on function public.reservar_uso_ia(uuid, text, int, int) from authenticated;
grant execute on function public.reservar_uso_ia(uuid, text, int, int) to service_role;
