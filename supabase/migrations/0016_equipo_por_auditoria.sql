-- 0016 · Equipo auditor por auditoría (decisión del dueño, 12/10/2026).
--
-- Hasta ahora el equipo auditor vivía solo en el perfil (0009) y todos los informes nombraban al equipo que el perfil
-- tuviera al generarlos. Ahora cada auditoría guarda el suyo, para que su informe nombre a quienes de verdad
-- participaron. Por defecto es el del perfil (el equipo habitual): si al crear la auditoría no se envía, se copia.
-- Mismas reglas que el perfil: de 1 a 10 personas, cada una con un nombre de 3 a 120 caracteres y de 1 a 5 cargos de
-- la lista del equipo auditor (`cargos_equipo()`). Solo queda vacío si el perfil tampoco tiene equipo (perfiles
-- anteriores a la 0009 sin completar); el informe lo exige.

alter table public.auditorias
  add column if not exists equipo_auditor jsonb not null default '[]'::jsonb;

create or replace function public.validar_equipo_auditoria()
returns trigger language plpgsql set search_path = '' as $$
declare
  integrante jsonb;
  v_nombre text;
  v_cargos text[];
  normalizado jsonb := '[]'::jsonb;
begin
  -- Al crear sin equipo, el del perfil del auditor (la RLS ya exige que la auditoría sea suya)
  if tg_op = 'INSERT' and (new.equipo_auditor is null or new.equipo_auditor = '[]'::jsonb) then
    select p.equipo_auditor into new.equipo_auditor from public.profiles p where p.id = new.user_id;
    new.equipo_auditor := coalesce(new.equipo_auditor, '[]'::jsonb);
  end if;

  if new.equipo_auditor is null or jsonb_typeof(new.equipo_auditor) <> 'array' or jsonb_array_length(new.equipo_auditor) > 10
     or (tg_op = 'UPDATE' and jsonb_array_length(new.equipo_auditor) < 1) then
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

drop trigger if exists auditorias_validar_equipo on public.auditorias;
create trigger auditorias_validar_equipo
  before insert or update of equipo_auditor on public.auditorias
  for each row execute function public.validar_equipo_auditoria();

revoke execute on function public.validar_equipo_auditoria() from public, anon, authenticated;

-- Las auditorías que ya existen toman el equipo que hoy tiene el perfil de su auditor (lo que sus informes mostraban)
update public.auditorias a
   set equipo_auditor = p.equipo_auditor
  from public.profiles p
 where p.id = a.user_id
   and a.equipo_auditor = '[]'::jsonb
   and jsonb_array_length(p.equipo_auditor) > 0;
