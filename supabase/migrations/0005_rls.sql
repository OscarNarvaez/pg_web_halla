-- ════════════════════════════════════════════════════════════════════════════
-- 0005 · Seguridad a nivel de fila (RLS) en TODAS las tablas
--
-- Dos correcciones respecto del borrador del prompt maestro (§7.5):
--  1. La política de «admin» no puede consultar public.profiles desde una política de
--     public.profiles: provoca «infinite recursion detected in policy». Se usa la función
--     security definer public.es_admin(), que lee la tabla sin pasar por RLS.
--  2. `revoke update (rol) on profiles from authenticated` NO tiene efecto si el rol conserva el
--     UPDATE a nivel de tabla (Supabase lo concede por defecto). Se revoca el UPDATE de tabla y se
--     concede solo por columnas, y además un trigger bloquea el cambio de rol (defensa en profundidad).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.rol = 'admin'
  );
$$;
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ─── profiles ───────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "perfil propio o admin: lectura" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.es_admin());

-- Fallback del registro: el usuario crea SU perfil, y siempre como auditor
create policy "perfil propio: creación" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) and rol = 'auditor');

create policy "perfil propio: edición" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Impide la escalada de privilegios: UPDATE solo sobre columnas permitidas (rol excluido)
revoke update on public.profiles from authenticated, anon;
grant update (
  nombre_completo, cedula, celular, cargo, equipo_auditor_nombre, equipo_auditor_cargo,
  alcance, proceso, sistema
) on public.profiles to authenticated;

create or replace function public.bloquear_cambio_rol()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.rol is distinct from old.rol and coalesce((select auth.role()), '') in ('authenticated', 'anon') then
    raise exception 'No está permitido cambiar el rol desde la aplicación' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_bloquear_rol
  before update on public.profiles
  for each row execute function public.bloquear_cambio_rol();

-- ─── auditorias ─────────────────────────────────────────────────────────────
alter table public.auditorias enable row level security;

create policy "auditoria propia o admin: lectura" on public.auditorias
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_admin());

create policy "auditoria propia: creación" on public.auditorias
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "auditoria propia: edición" on public.auditorias
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "auditoria propia: eliminación" on public.auditorias
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── hallazgos ──────────────────────────────────────────────────────────────
alter table public.hallazgos enable row level security;

create policy "hallazgo propio o admin: lectura" on public.hallazgos
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_admin());

-- Desde el cliente solo se crean copias (acción «duplicar»): nunca con procedencia de IA.
-- Los hallazgos generados por la IA los inserta la Edge Function con la service role.
create policy "hallazgo propio: creación sin procedencia de IA" on public.hallazgos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.auditorias a where a.id = auditoria_id and a.user_id = (select auth.uid()))
    and respuesta_cruda is null and modelo_ia is null and prompt_version is null
  );

create policy "hallazgo propio: edición" on public.hallazgos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "hallazgo propio: eliminación" on public.hallazgos
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── informes ───────────────────────────────────────────────────────────────
alter table public.informes enable row level security;

create policy "informe propio o admin: lectura" on public.informes
  for select to authenticated
  using (user_id = (select auth.uid()) or public.es_admin());

create policy "informe propio: creación" on public.informes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.auditorias a where a.id = auditoria_id and a.user_id = (select auth.uid()))
  );

create policy "informe propio: edición" on public.informes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "informe propio: eliminación" on public.informes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── criterios_normativos: lectura para autenticados, escritura solo service_role ───
alter table public.criterios_normativos enable row level security;

create policy "criterios: lectura autenticados" on public.criterios_normativos
  for select to authenticated
  using (true);

revoke execute on function public.buscar_criterios(text, text[], int)   from public, anon;
revoke execute on function public.explorar_criterios(text, text[], int) from public, anon;
revoke execute on function public.resumen_documentos()                  from public, anon;
grant  execute on function public.buscar_criterios(text, text[], int)   to authenticated, service_role;
grant  execute on function public.explorar_criterios(text, text[], int) to authenticated, service_role;
grant  execute on function public.resumen_documentos()                  to authenticated, service_role;

-- ─── ia_eventos: lectura solo admin, escritura solo service_role ───
alter table public.ia_eventos enable row level security;

create policy "ia_eventos: lectura admin" on public.ia_eventos
  for select to authenticated
  using (public.es_admin());
