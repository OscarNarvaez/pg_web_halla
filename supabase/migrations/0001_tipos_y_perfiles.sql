-- ════════════════════════════════════════════════════════════════════════════
-- 0001 · Tipos y perfiles de auditor
-- Los valores de los enum deben coincidir EXACTAMENTE con src/lib/catalogos.js
-- ════════════════════════════════════════════════════════════════════════════

create type public.alcance_tipo as enum ('PROCESOS', 'SISTEMAS');

create type public.proceso_tipo as enum (
  'Nutrición','Imágenes diagnósticas','Gestión hospitalaria universitaria','Control interno',
  'Gestión cliente','Terapias','Hospital seguro','Gestión de calidad','Comercial y mercadeo',
  'Gestión humana','Gestión de recursos físicos','Gestión de la información','Gestión gerencial',
  'Gestión del ambiente físico','Gestión financiera','Hospitalización','Cirugía','Urgencias',
  'Consulta externa'
);

create type public.sistema_tipo as enum (
  'Sistema Ambiental','Sistema de Seguridad y Salud en el Trabajo','Sistema de calidad',
  'SARLAFT Y SICOF','UACAI','Empresa familiar'
);

create type public.clasificacion_tipo as enum (
  'FORTALEZA','NO_CONFORMIDAD','OBSERVACION','OPORTUNIDAD_DE_MEJORA'
);

create type public.rol_tipo as enum ('auditor','admin');

-- Marca de tiempo de actualización, reutilizada por todas las tablas
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  nombre_completo        text not null check (length(trim(nombre_completo)) >= 3),
  cedula                 text not null,
  celular                text not null,
  cargo                  text not null check (length(trim(cargo)) >= 2),
  equipo_auditor_nombre  text not null check (length(trim(equipo_auditor_nombre)) >= 3), -- siempre una persona adicional
  equipo_auditor_cargo   text not null check (length(trim(equipo_auditor_cargo)) >= 2),
  alcance                public.alcance_tipo not null,
  proceso                public.proceso_tipo,
  sistema                public.sistema_tipo,
  rol                    public.rol_tipo not null default 'auditor',
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),

  -- exactamente uno de los dos, según el alcance
  constraint alcance_coherente check (
    (alcance = 'PROCESOS' and proceso is not null and sistema is null) or
    (alcance = 'SISTEMAS' and sistema is not null and proceso is null)
  ),
  constraint cedula_valida  check (cedula  ~ '^[0-9]{6,12}$'),
  constraint celular_valido check (celular ~ '^[0-9]{10}$')
);

create unique index profiles_cedula_idx on public.profiles (cedula);

create trigger profiles_actualizado_en
  before update on public.profiles
  for each row execute function public.tocar_actualizado_en();

-- Crea el perfil al registrarse, leyendo raw_user_meta_data (options.data de signUp).
-- Si los metadatos faltan o no cumplen las restricciones, NO hace fallar el registro: deja un
-- WARNING en el log y el frontend crea el perfil con el usuario ya autenticado (fallback),
-- mostrando el error real en español en lugar del «Database error saving new user» opaco.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ? 'nombre_completo' then
    begin
      insert into public.profiles (
        id, nombre_completo, cedula, celular, cargo,
        equipo_auditor_nombre, equipo_auditor_cargo, alcance, proceso, sistema
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
        nullif(new.raw_user_meta_data->>'sistema','')::public.sistema_tipo
      );
    exception when others then
      raise warning 'handle_new_user: no se pudo crear el perfil de %: % (%)', new.id, sqlerrm, sqlstate;
    end;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
