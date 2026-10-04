-- ════════════════════════════════════════════════════════════════════════════
-- 0003 · Criterios normativos (una fila por numeral) y búsqueda de texto completo
-- Es la ÚNICA fuente de requisitos que puede citar la IA.
-- ════════════════════════════════════════════════════════════════════════════

-- En Supabase las extensiones viven en el esquema "extensions"
create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Configuración de búsqueda en español que ignora tildes: «gestion» empata con «gestión».
create text search configuration public.es_unaccent (copy = pg_catalog.spanish);
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, pg_catalog.spanish_stem;

create table public.criterios_normativos (
  id                uuid primary key default gen_random_uuid(),
  documento_codigo  text not null,     -- 'NTC-ISO 9001:2015'
  documento_titulo  text not null,
  archivo           text not null,     -- '1_NTC_ISO_9001_2015.md'
  idioma            text not null default 'es' check (idioma in ('es','en')),
  numeral           text,              -- '9.3.3' (null en secciones sin numerar, p. ej. PR13-GQ)
  titulo            text not null,
  contenido         text not null,
  nivel             int,               -- profundidad del numeral: 9.3.3 → 3
  orden             int not null,      -- posición del fragmento dentro del archivo
  parte             int not null default 1, -- >1 cuando un numeral largo se partió en varios fragmentos
  aplica_a          text[] not null default '{}',
  creado_en         timestamptz not null default now(),
  -- Clave natural de la ingesta: permite upsert idempotente y conserva los id entre re-ingestas
  constraint criterios_archivo_orden_unico unique (archivo, orden)
);

-- Título y numeral pesan más (A) que el cuerpo (B)
alter table public.criterios_normativos
  add column busqueda tsvector generated always as (
    setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(numeral,'') || ' ' || coalesce(titulo,'')), 'A') ||
    setweight(to_tsvector('public.es_unaccent'::regconfig, coalesce(contenido,'')), 'B')
  ) stored;

create index criterios_busqueda_idx    on public.criterios_normativos using gin (busqueda);
create index criterios_titulo_trgm_idx on public.criterios_normativos using gin (titulo extensions.gin_trgm_ops);
create index criterios_doc_idx         on public.criterios_normativos (documento_codigo, orden);
create index criterios_numeral_idx     on public.criterios_normativos (documento_codigo, numeral);

-- Recuperación usada por las Edge Functions y por el explorador de normas.
-- «consulta» usa la sintaxis de websearch_to_tsquery: palabras sueltas = Y; «or» = O; "frase exacta".
-- La Edge Function construye consultas con «or» para que el texto libre del auditor recupere algo.
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
       websearch_to_tsquery('public.es_unaccent'::regconfig, consulta) q
  where (documentos is null or c.documento_codigo = any(documentos))
    and c.busqueda @@ q
  order by puntaje desc, c.orden asc
  limit greatest(1, least(limite, 50));
$$;

-- Variante para el explorador: devuelve un extracto con los términos marcados entre ⟦ y ⟧.
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
       websearch_to_tsquery('public.es_unaccent'::regconfig, consulta) q
  where (documentos is null or c.documento_codigo = any(documentos))
    and c.busqueda @@ q
  order by puntaje desc, c.orden asc
  limit greatest(1, least(limite, 50));
$$;

-- Conteo de fragmentos por documento (filtro del explorador y verificación de la ingesta)
create or replace function public.resumen_documentos()
returns table (documento_codigo text, documento_titulo text, idioma text, fragmentos bigint, numerales bigint)
language sql stable set search_path = '' as $$
  select documento_codigo, min(documento_titulo), min(idioma), count(*), count(distinct numeral)
  from public.criterios_normativos
  group by documento_codigo
  order by documento_codigo;
$$;
