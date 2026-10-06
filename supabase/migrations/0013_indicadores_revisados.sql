-- 0013 · Indicadores priorizados del proceso que revisa el auditor (decisión del dueño, 5/10/2026).
--
-- La plantilla oficial del informe (Auditoria_interna.odt) cambió: la sección «Indicadores» dice ahora «Revisión de
-- indicadores priorizados en el proceso de (area auditada)» y ya no trae «RECOMENDACIONES». El auditor registra los
-- indicadores que revisó (nombre, meta, resultado y una observación) y la IA redacta la revisión con esos datos.
-- Lista: hasta 15 × { nombre (1 a 200), meta (≤ 120), resultado (≤ 120), observacion (≤ 500) }.

alter table public.auditorias
  add column if not exists indicadores_revisados jsonb not null default '[]'::jsonb;

create or replace function public.validar_indicadores_revisados()
returns trigger language plpgsql set search_path = '' as $$
declare
  indicador jsonb;
  v_nombre text;
  v_meta text;
  v_resultado text;
  v_observacion text;
  normalizados jsonb := '[]'::jsonb;
begin
  if new.indicadores_revisados is null or jsonb_typeof(new.indicadores_revisados) <> 'array' then
    raise exception 'Indicadores inválidos: se esperaba una lista' using errcode = 'P0001';
  end if;
  if jsonb_array_length(new.indicadores_revisados) > 15 then
    raise exception 'Una auditoría admite como máximo 15 indicadores revisados' using errcode = 'P0001';
  end if;
  for indicador in select * from jsonb_array_elements(new.indicadores_revisados) loop
    if jsonb_typeof(indicador) <> 'object' then
      raise exception 'Indicador inválido' using errcode = 'P0001';
    end if;
    v_nombre := btrim(coalesce(indicador->>'nombre', ''));
    v_meta := btrim(coalesce(indicador->>'meta', ''));
    v_resultado := btrim(coalesce(indicador->>'resultado', ''));
    v_observacion := btrim(coalesce(indicador->>'observacion', ''));
    if char_length(v_nombre) not between 1 and 200 then
      raise exception 'Cada indicador necesita un nombre de hasta 200 caracteres' using errcode = 'P0001';
    end if;
    if char_length(v_meta) > 120 or char_length(v_resultado) > 120 then
      raise exception 'La meta y el resultado de un indicador admiten hasta 120 caracteres' using errcode = 'P0001';
    end if;
    if char_length(v_observacion) > 500 then
      raise exception 'La observación de un indicador admite hasta 500 caracteres' using errcode = 'P0001';
    end if;
    -- Solo estos cuatro campos: nada más se guarda ni llega a la IA
    normalizados := normalizados || jsonb_build_array(jsonb_build_object(
      'nombre', v_nombre, 'meta', v_meta, 'resultado', v_resultado, 'observacion', v_observacion));
  end loop;
  new.indicadores_revisados := normalizados;
  return new;
end $$;

drop trigger if exists auditorias_validar_indicadores on public.auditorias;
create trigger auditorias_validar_indicadores
  before insert or update of indicadores_revisados on public.auditorias
  for each row execute function public.validar_indicadores_revisados();

revoke execute on function public.validar_indicadores_revisados() from public, anon, authenticated;
