// Postgres local en WASM (PGlite) que imita lo mínimo de Supabase para probar las migraciones
// sin Docker ni proyecto en la nube: roles anon/authenticated/service_role, esquema auth con
// auth.users, auth.uid() y auth.role(), esquema extensions y los privilegios por defecto.
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const ARRANQUE_SUPABASE = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  $$;

  create schema if not exists extensions;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant all on all tables in schema auth to service_role;
`

/**
 * Aplica en orden las migraciones de supabase/migrations cuyo nombre esté en [desde, hasta).
 * Con `hasta` se puede simular la base de producción antes de una migración y luego aplicarla.
 */
export async function aplicarMigraciones(db, { desde = '', hasta = '\uffff', silencioso = false } = {}) {
  const dir = join(RAIZ, 'supabase', 'migrations')
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith('.sql') && f >= desde && f < hasta).sort()) {
    try {
      await db.exec(readFileSync(join(dir, archivo), 'utf8'))
      if (!silencioso) console.log(`  ✓ migración ${archivo}`)
    } catch (e) {
      throw new Error(`La migración ${archivo} falló: ${e.message}`)
    }
  }
}

/** Crea la base local con las migraciones aplicadas en orden (todas, o las anteriores a `hasta`). */
export async function crearBaseLocal({ silencioso = false, hasta } = {}) {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } })
  await db.exec(ARRANQUE_SUPABASE)
  await aplicarMigraciones(db, { hasta, silencioso })
  return db
}

/**
 * Ejecuta una función con la identidad de un usuario, como lo haría PostgREST con su JWT.
 * @param {PGlite} db
 * @param {{ id?: string, rol: 'authenticated'|'anon'|'service_role' }} quien
 */
export async function comoUsuario(db, quien, fn) {
  const claims = JSON.stringify({ sub: quien.id ?? '', role: quien.rol })
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
    await tx.exec(`set local role ${quien.rol}`)
    return fn(tx)
  })
}

/** Registra un usuario como lo hace Supabase Auth (dispara on_auth_user_created). */
export async function registrarUsuario(db, email, metadatos) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify(metadatos)],
  )
  return rows[0].id
}
