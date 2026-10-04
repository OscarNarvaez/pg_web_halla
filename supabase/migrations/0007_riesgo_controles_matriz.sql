-- 0007 · Riesgo (PR13_GQ), controles, PDF de evidencia y matriz consolidada con validación.
-- El dueño amplió el alcance de V1 el 2026-10-04 (docs/RECONOCIMIENTO.md, Fase 8).

-- ─── Estado «Se sugiere hacer cambios» ─────────────────────────────────────
-- En la matriz: generado/editado = Pendiente · confirmado = Validado · cambios_sugeridos = Se sugiere hacer cambios.
-- (El valor nuevo no se usa en esta migración: Postgres no permite usarlo en la misma transacción.)
alter type public.estado_hallazgo add value if not exists 'cambios_sugeridos';

-- ─── Riesgo, controles, PDF de evidencia y nota de validación ──────────────
alter table public.hallazgos
  add column if not exists riesgo_descripcion   text,
  add column if not exists riesgo_dimension     text,
  add column if not exists riesgo_probabilidad  smallint,
  add column if not exists riesgo_impacto       smallint,
  add column if not exists riesgo_justificacion text,
  add column if not exists controles            jsonb not null default '[]'::jsonb,
  add column if not exists evidencia_archivo    jsonb,
  add column if not exists nota_validacion      text;

alter table public.hallazgos
  add constraint riesgo_descripcion_largo check (char_length(riesgo_descripcion) <= 1000),
  add constraint riesgo_justificacion_largo check (char_length(riesgo_justificacion) <= 1500),
  -- Dimensiones de impacto del PR13_GQ V4 (numeral 5, «Análisis y valoración del riesgo»)
  add constraint riesgo_dimension_valida check (riesgo_dimension in (
    'AMBIENTAL', 'CALIDAD_SEGURIDAD_PACIENTE', 'FINANCIERO', 'LEGAL', 'PRESTACION_SERVICIO', 'REPUTACIONAL')),
  add constraint riesgo_probabilidad_rango check (riesgo_probabilidad between 1 and 5),
  add constraint riesgo_impacto_rango check (riesgo_impacto between 1 and 5),
  add constraint nota_validacion_largo check (char_length(nota_validacion) <= 1000),
  -- Del PDF solo se guarda la huella: el archivo nunca sale del navegador del auditor
  add constraint evidencia_archivo_valida check (
    evidencia_archivo is null or (
      jsonb_typeof(evidencia_archivo) = 'object'
      and coalesce(evidencia_archivo->>'sha256', '') ~ '^[0-9a-f]{64}$'
      and char_length(coalesce(evidencia_archivo->>'nombre', '')) between 1 and 200
      and jsonb_typeof(evidencia_archivo->'paginas') = 'number'
      and (evidencia_archivo->>'paginas')::numeric between 1 and 500
    ));

-- ─── Umbrales de nivel de riesgo por auditoría ─────────────────────────────
-- Riesgo inherente = probabilidad × impacto (1 a 25). Puntaje ≤ bajo → Bajo; ≤ moderado → Moderado;
-- ≤ alto → Alto; mayor → Extremo. Son valores de referencia editables (el PR13 no fija los cortes).
alter table public.auditorias
  add column if not exists umbrales_riesgo jsonb not null default '{"bajo": 4, "moderado": 9, "alto": 16}'::jsonb;
alter table public.auditorias
  add constraint umbrales_riesgo_validos check (
    jsonb_typeof(umbrales_riesgo->'bajo') = 'number'
    and jsonb_typeof(umbrales_riesgo->'moderado') = 'number'
    and jsonb_typeof(umbrales_riesgo->'alto') = 'number'
    and (umbrales_riesgo->>'bajo')::numeric = trunc((umbrales_riesgo->>'bajo')::numeric)
    and (umbrales_riesgo->>'moderado')::numeric = trunc((umbrales_riesgo->>'moderado')::numeric)
    and (umbrales_riesgo->>'alto')::numeric = trunc((umbrales_riesgo->>'alto')::numeric)
    and (umbrales_riesgo->>'bajo')::numeric >= 1
    and (umbrales_riesgo->>'bajo')::numeric < (umbrales_riesgo->>'moderado')::numeric
    and (umbrales_riesgo->>'moderado')::numeric < (umbrales_riesgo->>'alto')::numeric
    and (umbrales_riesgo->>'alto')::numeric <= 24
  );

-- ─── Controles validados en la base de datos ───────────────────────────────
-- Cada control: { descripcion, tipo PREVENTIVO|CORRECTIVO, origen ia|auditor, adoptado, criterio_id }.
-- Si cita un criterio, debe existir (como las citas del hallazgo). Al editar, los controles «ia» solo
-- pueden cambiar `adoptado`: el auditor no puede hacer pasar un control propio por uno de la IA (el servidor sí los escribe).
create or replace function public.validar_controles()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  control jsonb;
  v_criterio uuid;
  v_documento text;
  v_numeral text;
  v_descripcion text;
  normalizados jsonb := '[]'::jsonb;
begin
  if new.controles is null or jsonb_typeof(new.controles) <> 'array' then
    new.controles := '[]'::jsonb;
    return new;
  end if;
  if jsonb_array_length(new.controles) > 10 then
    raise exception 'Un hallazgo admite como máximo 10 controles' using errcode = 'P0001';
  end if;
  for control in select * from jsonb_array_elements(new.controles) loop
    if jsonb_typeof(control) <> 'object' then
      raise exception 'Control inválido' using errcode = 'P0001';
    end if;
    v_descripcion := btrim(coalesce(control->>'descripcion', ''));
    if char_length(v_descripcion) < 5 or char_length(v_descripcion) > 600 then
      raise exception 'Cada control debe describirse en 5 a 600 caracteres' using errcode = 'P0001';
    end if;
    if coalesce(control->>'tipo', '') not in ('PREVENTIVO', 'CORRECTIVO') then
      raise exception 'Tipo de control inválido: %', control->>'tipo' using errcode = 'P0001';
    end if;
    if coalesce(control->>'origen', '') not in ('ia', 'auditor') then
      raise exception 'Origen de control inválido' using errcode = 'P0001';
    end if;
    v_criterio := null;
    v_documento := null;
    v_numeral := null;
    if nullif(control->>'criterio_id', '') is not null then
      select cn.id, cn.documento_codigo, cn.numeral into v_criterio, v_documento, v_numeral
        from public.criterios_normativos cn where cn.id::text = control->>'criterio_id';
      if not found then
        raise exception 'Control con criterio no verificable: %', control->>'criterio_id' using errcode = 'P0001';
      end if;
    end if;
    if tg_op = 'UPDATE' and control->>'origen' = 'ia' and coalesce((select auth.role()), '') <> 'service_role' and not exists (
      select 1 from jsonb_array_elements(old.controles) o
       where o->>'origen' = 'ia' and o->>'descripcion' = v_descripcion and o->>'tipo' = control->>'tipo'
         and coalesce(o->>'criterio_id', '') = coalesce(v_criterio::text, '')
    ) then
      raise exception 'Los controles propuestos por la IA no se pueden reescribir: agrega uno propio' using errcode = 'P0001';
    end if;
    normalizados := normalizados || jsonb_build_array(jsonb_build_object(
      'descripcion', v_descripcion,
      'tipo', control->>'tipo',
      'origen', control->>'origen',
      'adoptado', coalesce((control->>'adoptado')::boolean, false),
      'criterio_id', v_criterio,
      'documento', v_documento,
      'numeral', v_numeral));
  end loop;
  new.controles := normalizados;
  return new;
end $$;

drop trigger if exists hallazgos_validar_controles on public.hallazgos;
create trigger hallazgos_validar_controles
  before insert or update of controles on public.hallazgos
  for each row execute function public.validar_controles();

-- ─── Protección: el PDF es inmutable; editar un hallazgo validado lo devuelve a pendiente ──
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

-- ─── Historial con los campos nuevos ───────────────────────────────────────
create or replace function public.registrar_historial_hallazgo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  campos text[] := array['clasificacion','justificacion','hallazgo_corregido','criterio_requisito','evidencia','severidad',
    'estado','criterios_citados','riesgo_descripcion','riesgo_dimension','riesgo_probabilidad','riesgo_impacto',
    'riesgo_justificacion','controles','nota_validacion'];
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

revoke execute on function public.validar_controles() from public, anon, authenticated;
