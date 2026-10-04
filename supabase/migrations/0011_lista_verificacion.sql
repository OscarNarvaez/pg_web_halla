-- 0011 · Lista de verificación de la auditoría (decisión del dueño, 4/10/2026).
--
-- Es la hoja de trabajo que el auditor prepara antes de ir al lugar de la auditoría y en la que anota durante la
-- visita: encabezado (información general) y secciones con filas de requisito, pregunta, documentos o evidencia,
-- marca NC / O / OB / F y anotaciones. No pasa por la IA ni alimenta los hallazgos, la matriz o el informe.
-- Una lista por auditoría.

create table if not exists public.listas_verificacion (
  auditoria_id   uuid primary key references public.auditorias(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  encabezado     jsonb not null default '{}'::jsonb,
  secciones      jsonb not null default '[]'::jsonb,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ─── Validación y normalización ────────────────────────────────────────────
-- encabezado: { fecha, elaborada_por, proceso, auditados, fecha_ejecucion, lugar } (textos de hasta 300)
-- secciones:  hasta 30 × { titulo (≤ 300), filas: hasta 200 × { requisito, pregunta, documentos, anotaciones (≤ 2000),
--             marca: NC | O | OB | F | null } }
create or replace function public.validar_lista_verificacion()
returns trigger language plpgsql set search_path = '' as $$
declare
  seccion jsonb;
  fila jsonb;
  campo text;
  filas jsonb;
  secciones jsonb := '[]'::jsonb;
  encabezado jsonb := '{}'::jsonb;
  texto text := '';
begin
  if new.encabezado is null or jsonb_typeof(new.encabezado) <> 'object' then
    raise exception 'Lista de verificación inválida: el encabezado debe ser un objeto' using errcode = 'P0001';
  end if;
  foreach campo in array array['fecha', 'elaborada_por', 'proceso', 'auditados', 'fecha_ejecucion', 'lugar'] loop
    texto := btrim(coalesce(new.encabezado->>campo, ''));
    if char_length(texto) > 300 then
      raise exception 'Lista de verificación: el campo % supera 300 caracteres', campo using errcode = 'P0001';
    end if;
    encabezado := encabezado || jsonb_build_object(campo, texto);
  end loop;

  if new.secciones is null or jsonb_typeof(new.secciones) <> 'array' or jsonb_array_length(new.secciones) > 30 then
    raise exception 'Lista de verificación: admite hasta 30 secciones' using errcode = 'P0001';
  end if;
  for seccion in select * from jsonb_array_elements(new.secciones) loop
    if jsonb_typeof(seccion) <> 'object' or jsonb_typeof(coalesce(seccion->'filas', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(seccion->'filas', '[]'::jsonb)) > 200 then
      raise exception 'Lista de verificación: cada sección admite hasta 200 filas' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(seccion->>'titulo', ''))) > 300 then
      raise exception 'Lista de verificación: el título de una sección supera 300 caracteres' using errcode = 'P0001';
    end if;
    filas := '[]'::jsonb;
    for fila in select * from jsonb_array_elements(coalesce(seccion->'filas', '[]'::jsonb)) loop
      if jsonb_typeof(fila) <> 'object' then
        raise exception 'Lista de verificación: fila inválida' using errcode = 'P0001';
      end if;
      if nullif(fila->>'marca', '') is not null and fila->>'marca' not in ('NC', 'O', 'OB', 'F') then
        raise exception 'Lista de verificación: la marca debe ser NC, O, OB o F' using errcode = 'P0001';
      end if;
      foreach campo in array array['requisito', 'pregunta', 'documentos', 'anotaciones'] loop
        if char_length(coalesce(fila->>campo, '')) > 2000 then
          raise exception 'Lista de verificación: un texto supera 2000 caracteres' using errcode = 'P0001';
        end if;
      end loop;
      filas := filas || jsonb_build_array(jsonb_build_object(
        'requisito', coalesce(fila->>'requisito', ''),
        'pregunta', coalesce(fila->>'pregunta', ''),
        'documentos', coalesce(fila->>'documentos', ''),
        'marca', nullif(fila->>'marca', ''),
        'anotaciones', coalesce(fila->>'anotaciones', '')));
    end loop;
    secciones := secciones || jsonb_build_array(jsonb_build_object('titulo', btrim(coalesce(seccion->>'titulo', '')), 'filas', filas));
  end loop;

  new.encabezado := encabezado;
  new.secciones := secciones;
  if tg_op = 'INSERT' then
    new.creado_en := now();
  else
    new.creado_en := old.creado_en;
    if new.auditoria_id is distinct from old.auditoria_id or new.user_id is distinct from old.user_id then
      raise exception 'La lista de verificación no se puede pasar a otra auditoría' using errcode = 'P0001';
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists listas_verificacion_validar on public.listas_verificacion;
create trigger listas_verificacion_validar
  before insert or update on public.listas_verificacion
  for each row execute function public.validar_lista_verificacion();

-- ─── RLS: solo el dueño de la auditoría (aprobado) la edita; el admin la lee ─
alter table public.listas_verificacion enable row level security;

create policy "lista propia o admin: lectura" on public.listas_verificacion
  for select to authenticated
  using ((user_id = (select auth.uid()) and public.usuario_activo()) or public.es_admin());
create policy "lista propia: creación" on public.listas_verificacion
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.usuario_activo()
    and exists (select 1 from public.auditorias a where a.id = auditoria_id and a.user_id = (select auth.uid()) and a.estado <> 'cerrada')
  );
-- Una auditoría cerrada deja su lista en solo lectura
create policy "lista propia: edición" on public.listas_verificacion
  for update to authenticated
  using (user_id = (select auth.uid()) and public.usuario_activo())
  with check (
    user_id = (select auth.uid())
    and public.usuario_activo()
    and exists (select 1 from public.auditorias a where a.id = auditoria_id and a.user_id = (select auth.uid()) and a.estado <> 'cerrada')
  );

-- Mínimo privilegio, como el resto del esquema (0006): sin borrado físico ni permisos para anon
revoke all on public.listas_verificacion from anon;
revoke delete, truncate, references, trigger on public.listas_verificacion from authenticated;
revoke execute on function public.validar_lista_verificacion() from public, anon, authenticated;
