-- 0014 · El auditor puede quitar el PDF analizado de un hallazgo (decisión del dueño, 5/10/2026).
--
-- Hasta la 0013, `evidencia_archivo` (la huella del PDF que analizó la IA) era inmutable. El dueño pidió poder
-- quitar cualquier documento cargado si el auditor se equivocó o se arrepiente. Se permite SOLO quitarlo (pasar a
-- null), nunca cambiarlo por otro: la constancia de qué archivo se analizó queda en `hallazgos_historial`, que ahora
-- registra `evidencia_archivo` (quién lo quitó, cuándo y la huella anterior). La entrada original del auditor, con el
-- texto que se analizó, sigue intacta. Quitarlo es un cambio de contenido: devuelve a pendiente un hallazgo validado.

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
     -- El PDF analizado se puede quitar, pero no reemplazar por otro
     or (new.evidencia_archivo is distinct from old.evidencia_archivo and new.evidencia_archivo is not null) then
    raise exception 'La entrada original del auditor y la trazabilidad de la IA no se pueden modificar'
      using errcode = 'P0001';
  end if;

  contenido_cambio :=
       new.clasificacion        is distinct from old.clasificacion
    or new.justificacion        is distinct from old.justificacion
    or new.hallazgo_corregido   is distinct from old.hallazgo_corregido
    or new.criterio_requisito   is distinct from old.criterio_requisito
    or new.evidencia            is distinct from old.evidencia
    or new.evidencia_archivo    is distinct from old.evidencia_archivo
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

-- ─── Historial: también el PDF analizado (para saber cuál era si se quita) ──
create or replace function public.registrar_historial_hallazgo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  campos text[] := array['clasificacion','justificacion','hallazgo_corregido','criterio_requisito','evidencia','severidad',
    'estado','criterios_citados','riesgo_descripcion','riesgo_dimension','riesgo_probabilidad','riesgo_impacto',
    'riesgo_justificacion','controles','nota_validacion','evidencia_anexos','evidencia_archivo'];
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
