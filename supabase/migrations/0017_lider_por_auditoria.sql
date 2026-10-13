-- 0017 · Líder del equipo auditor por auditoría (decisión del dueño, 12/10/2026).
--
-- Hasta ahora el «Líder equipo» de la Ficha Técnica era siempre el dueño de la cuenta (su nombre y sus cargos del
-- perfil). Pero el líder de una auditoría no siempre es quien la registra en la plataforma: ahora cada auditoría guarda
-- el suyo, escrito a mano como el equipo auditor (0016). Empieza VACÍO y no se copia del perfil: el informe exige
-- registrarlo. Reglas: un nombre de 3 a 120 caracteres y de 1 a 5 cargos de la lista de líderes (`cargos_lider()`).

alter table public.auditorias
  add column if not exists lider_auditor jsonb;

create or replace function public.validar_lider_auditoria()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_nombre text;
  v_cargos text[];
begin
  -- Sin líder registrado (así empieza toda auditoría)
  if new.lider_auditor is null or new.lider_auditor = 'null'::jsonb then
    new.lider_auditor := null;
    return new;
  end if;
  if jsonb_typeof(new.lider_auditor) <> 'object' or jsonb_typeof(new.lider_auditor->'cargos') is distinct from 'array' then
    raise exception 'El líder del equipo auditor debe tener nombre y cargos' using errcode = 'P0001';
  end if;
  v_nombre := btrim(coalesce(new.lider_auditor->>'nombre', ''));
  if char_length(v_nombre) < 3 or char_length(v_nombre) > 120 then
    raise exception 'El líder del equipo auditor debe tener un nombre de 3 a 120 caracteres' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(new.lider_auditor->'cargos') e where jsonb_typeof(e) <> 'string') then
    raise exception 'Cargo no permitido para el líder del equipo auditor' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(c order by o), '{}') into v_cargos
    from (select btrim(c) as c, min(o) as o from jsonb_array_elements_text(new.lider_auditor->'cargos') with ordinality as u(c, o) group by btrim(c)) x;
  if cardinality(v_cargos) < 1 or cardinality(v_cargos) > 5 then
    raise exception 'El líder del equipo auditor debe tener entre 1 y 5 cargos (al menos un cargo)' using errcode = 'P0001';
  end if;
  if not v_cargos <@ public.cargos_lider() then
    raise exception 'Cargo no permitido para el líder del equipo auditor' using errcode = 'P0001';
  end if;
  new.lider_auditor := jsonb_build_object('nombre', v_nombre, 'cargos', to_jsonb(v_cargos));
  return new;
end $$;

drop trigger if exists auditorias_validar_lider on public.auditorias;
create trigger auditorias_validar_lider
  before insert or update of lider_auditor on public.auditorias
  for each row execute function public.validar_lider_auditoria();

revoke execute on function public.validar_lider_auditoria() from public, anon, authenticated;
