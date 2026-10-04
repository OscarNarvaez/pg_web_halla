// Acceso a Supabase desde las Edge Functions (solo Deno). Única capa con la service role.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { leerConfig, type Config } from './config.ts'

export function clienteAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno de la función')
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function config(): Config {
  return leerConfig((clave) => Deno.env.get(clave))
}

/** Devuelve el id del usuario a partir del JWT de la cabecera Authorization, o null si no es válido. */
export async function usuarioDelToken(admin: SupabaseClient, req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

/** Llamadas a la IA del usuario en las últimas 24 horas (para el límite diario). */
export async function usoUltimas24h(admin: SupabaseClient, userId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin
    .from('ia_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('creado_en', desde)
  return count ?? 0
}

export interface Evento {
  user_id: string | null
  funcion: string
  modelo?: string | null
  prompt_version?: string | null
  exito: boolean
  codigo_error?: string | null
  detalle?: unknown
  latencia_ms?: number | null
  tokens_entrada?: number | null
  tokens_salida?: number | null
}

/** Registra la llamada en ia_eventos. Nunca lanza: la bitácora no debe tumbar la respuesta. */
export async function registrarEvento(admin: SupabaseClient, evento: Evento): Promise<void> {
  try {
    const { error } = await admin.from('ia_eventos').insert(evento)
    if (error) console.error('ia_eventos:', error.message)
  } catch (e) {
    console.error('ia_eventos:', (e as Error).message)
  }
}

export async function leerJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
