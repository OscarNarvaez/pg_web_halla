-- 0012 · PDF de evidencia también al editar el hallazgo (decisión del dueño, 5/10/2026).
--
-- `evidencia_archivo` es la huella del PDF que se ANALIZÓ con la IA: es trazabilidad de la entrada y no cambia nunca.
-- Los PDF que el auditor carga después, al editar la evidencia (paso 4 del asistente, detalle o matriz), quedan
-- registrados aparte en `evidencia_anexos`, con el mismo formato. Como antes, el archivo nunca sale del navegador:
-- solo llegan su texto (al cuadro de evidencia, que edita el auditor) y su huella.

alter table public.hallazgos
  add column if not exists evidencia_anexos jsonb not null default '[]'::jsonb;

-- ─── Validación y normalización ────────────────────────────────────────────
-- Hasta 10 × { nombre (1 a 200, sin caracteres de control ni barras), paginas (entero 1 a 500), sha256, agregado_en }.
-- La fecha la pone el servidor; un PDF que ya estaba conserva la suya. No se repite un PDF (ni el ya analizado).
create or replace function public.validar_evidencia_anexos()
returns trigger language plpgsql set search_path = '' as $$
declare
  anexo jsonb;
  v_nombre text;
  v_sha text;
  v_paginas numeric;
  v_agregado timestamptz;
  vistos text[] := '{}';
  normalizados jsonb := '[]'::jsonb;
begin
  if new.evidencia_anexos is null or jsonb_typeof(new.evidencia_anexos) <> 'array' then
    raise exception 'PDF de evidencia inválido: se esperaba una lista' using errcode = 'P0001';
  end if;
  if jsonb_array_length(new.evidencia_anexos) > 10 then
    raise exception 'Un hallazgo admite como máximo 10 PDF de evidencia agregados al editar' using errcode = 'P0001';
  end if;
  for anexo in select * from jsonb_array_elements(new.evidencia_anexos) loop
    if jsonb_typeof(anexo) <> 'object' or jsonb_typeof(anexo->'paginas') is distinct from 'number' then
      raise exception 'PDF de evidencia inválido: solo se guardan su nombre, sus páginas y su huella SHA-256' using errcode = 'P0001';
    end if;
    v_nombre := btrim(regexp_replace(coalesce(anexo->>'nombre', ''), '[[:cntrl:]/\\]', '', 'g'));
    v_sha := lower(coalesce(anexo->>'sha256', ''));
    v_paginas := (anexo->>'paginas')::numeric;
    if char_length(v_nombre) not between 1 and 200 or v_sha !~ '^[0-9a-f]{64}$'
       or v_paginas <> trunc(v_paginas) or v_paginas not between 1 and 500 then
      raise exception 'PDF de evidencia inválido: solo se guardan su nombre, sus páginas y su huella SHA-256' using errcode = 'P0001';
    end if;
    if v_sha = any(vistos) or v_sha = coalesce(new.evidencia_archivo->>'sha256', '') then
      raise exception 'Ese PDF ya está registrado en el hallazgo' using errcode = 'P0001';
    end if;
    vistos := vistos || v_sha;
    v_agregado := null;
    if tg_op = 'UPDATE' then
      select (o->>'agregado_en')::timestamptz into v_agregado
        from jsonb_array_elements(old.evidencia_anexos) o where o->>'sha256' = v_sha limit 1;
    end if;
    normalizados := normalizados || jsonb_build_array(jsonb_build_object(
      'nombre', v_nombre, 'paginas', v_paginas::int, 'sha256', v_sha, 'agregado_en', coalesce(v_agregado, now())));
  end loop;
  new.evidencia_anexos := normalizados;
  return new;
end $$;

drop trigger if exists hallazgos_validar_evidencia_anexos on public.hallazgos;
create trigger hallazgos_validar_evidencia_anexos
  before insert or update of evidencia_anexos on public.hallazgos
  for each row execute function public.validar_evidencia_anexos();

-- ─── Protección: agregar o quitar un PDF es cambiar el contenido ───────────
-- Igual que en 0007, más `evidencia_anexos`: marca editado_por_usuario y devuelve a pendiente un hallazgo validado.
create or replace function public.proteger_hallazgo()
returns trigger language plpgsql set search_path = '' as $$
declare
  contenido_cambio boolean;
begin
  if new.entrada_auditor is distinct from old.entrada_auditor
     or new.respuesta_cruda is distinct from old.respuesta_cruda
     or new.modelo_ia is distinct from old.modelo_ia
     or new.prompt_version is distinct from old.prompt_version
     or new.consecutivo is distinct from old.consecutivo
     or new.auditoria_id is distinct from old.auditoria_id
     or new.user_id is distinct from old.user_id
     or new.creado_en is distinct from old.creado_en
     or new.evidencia_archivo is distinct from old.evidencia_archivo then
    raise exception 'La entrada original del auditor y la trazabilidad de la IA no se pueden modificar'
      using errcode = 'P0001';
  end if;

  contenido_cambio :=
       new.clasificacion        is distinct from old.clasificacion
    or new.justificacion        is distinct from old.justificacion
    or new.hallazgo_corregido   is distinct from old.hallazgo_corregido
    or new.criterio_requisito   is distinct from old.criterio_requisito
    or new.evidencia            is distinct from old.evidencia
    or new.evidencia_anexos     is distinct from old.evidencia_anexos
    or new.severidad            is distinct from old.severidad
    or new.riesgo_descripcion   is distinct from old.riesgo_descripcion
    or new.riesgo_dimension     is distinct from old.riesgo_dimension
    or new.riesgo_probabilidad  is distinct from old.riesgo_probabilidad
    or new.riesgo_impacto       is distinct from old.riesgo_impacto
    or new.riesgo_justificacion is distinct from old.riesgo_justificacion
    or new.controles            is distinct from old.controles;

  if contenido_cambio then
    new.editado_por_usuario := true;
    -- Una validación no sobrevive a un cambio de contenido: hay que volver a validar
    if old.estado = 'confirmado' and new.estado = 'confirmado' then
      new.estado := 'editado';
    end if;
  end if;

  new.actualizado_en := now();
  return new;
end $$;

-- ─── Historial con los PDF agregados ───────────────────────────────────────
create or replace function public.registrar_historial_hallazgo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  campos text[] := array['clasificacion','justificacion','hallazgo_corregido','criterio_requisito','evidencia','severidad',
    'estado','criterios_citados','riesgo_descripcion','riesgo_dimension','riesgo_probabilidad','riesgo_impacto',
    'riesgo_justificacion','controles','nota_validacion','evidencia_anexos'];
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

revoke execute on function public.validar_evidencia_anexos() from public, anon, authenticated;
