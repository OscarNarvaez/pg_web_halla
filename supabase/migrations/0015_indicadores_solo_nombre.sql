-- 0015 · Indicadores: solo el nombre corto de cada uno (decisión del dueño, 10/10/2026).
--
-- En el informe, después del texto de la plantilla («Revisión de indicadores priorizados en el proceso de <área>») solo
-- se agregan los nombres de los indicadores, separados por comas y con «y» antes del último. Ya no se registran meta,
-- resultado ni observación (0013), y la IA no redacta una revisión. Cada indicador: 1 a 60 caracteres, sin comas ni
-- punto y coma (cada uno va en su propio campo; el sistema pone los separadores). Hasta 15.

create or replace function public.validar_indicadores_revisados()
returns trigger language plpgsql set search_path = '' as $$
declare
  indicador jsonb;
  v_nombre text;
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
    -- Sin espacios sobrantes ni punto final: el informe arma la frase
    v_nombre := btrim(regexp_replace(btrim(coalesce(indicador->>'nombre', '')), '\.+$', ''));
    if char_length(v_nombre) not between 1 and 60 then
      raise exception 'Cada indicador necesita un nombre corto, de hasta 60 caracteres' using errcode = 'P0001';
    end if;
    if v_nombre ~ '[,;]' then
      raise exception 'Un indicador no lleva comas: escribe cada indicador en su propio campo' using errcode = 'P0001';
    end if;
    normalizados := normalizados || jsonb_build_array(jsonb_build_object('nombre', v_nombre));
  end loop;
  new.indicadores_revisados := normalizados;
  return new;
end $$;

-- Los registrados con la 0013 conservan solo su nombre (recortado y sin comas), para que pasen la regla nueva
update public.auditorias a
   set indicadores_revisados = coalesce((
     select jsonb_agg(jsonb_build_object('nombre', n.nombre))
       from (
         select left(btrim(regexp_replace(regexp_replace(i->>'nombre', '[,;]+', ' ', 'g'), '\s+', ' ', 'g')), 60) as nombre
           from jsonb_array_elements(a.indicadores_revisados) i
       ) n
      where n.nombre <> ''
   ), '[]'::jsonb)
 where jsonb_array_length(a.indicadores_revisados) > 0;
