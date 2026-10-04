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

export interface Usuario {
  id: string
  aprobado: boolean
  rol: 'auditor' | 'admin'
}

/**
 * Valida el JWT de la cabecera Authorization y lee el perfil. El id sale SIEMPRE del token, nunca del
 * cuerpo. Devuelve null si el token no es válido; `aprobado` indica si un admin habilitó la cuenta.
 */
export async function autenticar(admin: SupabaseClient, req: Request): Promise<Usuario | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token || token.length > 4096) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: perfil } = await admin.from('profiles').select('aprobado, rol').eq('id', data.user.id).maybeSingle()
  return { id: data.user.id, aprobado: Boolean(perfil?.aprobado), rol: perfil?.rol ?? 'auditor' }
}

export const MENSAJE_NO_APROBADO = 'Tu cuenta está pendiente de aprobación por un administrador.'

/**
 * Reserva una llamada a la IA ANTES de hacerla, de forma atómica (bloqueo por usuario en la BD):
 * peticiones en paralelo ya no evaden el límite diario ni el límite por minuto.
 */
export async function reservarUso(
  admin: SupabaseClient, userId: string, funcion: string, cfg: Config,
): Promise<{ id: number } | { error: 'limite_diario' | 'limite_minuto' | 'interno' }> {
  const { data, error } = await admin.rpc('reservar_uso_ia', {
    p_user: userId, p_funcion: funcion, p_limite_dia: cfg.limiteDiario, p_limite_minuto: cfg.limitePorMinuto,
  })
  if (error) {
    if (/limite_diario/.test(error.message)) return { error: 'limite_diario' }
    if (/limite_minuto/.test(error.message)) return { error: 'limite_minuto' }
    console.error('reservar_uso_ia:', error.message)
    return { error: 'interno' }
  }
  return { id: Number(data) }
}

export function mensajeLimite(motivo: 'limite_diario' | 'limite_minuto' | 'interno', cfg: Config): string {
  if (motivo === 'limite_minuto') return `Hiciste demasiados análisis seguidos (máximo ${cfg.limitePorMinuto} por minuto). Espera un momento.`
  if (motivo === 'limite_diario') return `Alcanzaste el límite de ${cfg.limiteDiario} análisis con IA en 24 horas. Inténtalo más tarde.`
  return 'No se pudo registrar el uso de la IA. Inténtalo de nuevo.'
}

export interface CierreEvento {
  modelo?: string | null
  prompt_version?: string | null
  exito: boolean
  codigo_error?: string | null
  detalle?: unknown
  latencia_ms?: number | null
  tokens_entrada?: number | null
  tokens_salida?: number | null
}

/** Completa el evento reservado. Nunca lanza: la bitácora no debe tumbar la respuesta. */
export async function finalizarEvento(admin: SupabaseClient, id: number, cierre: CierreEvento): Promise<void> {
  try {
    const { error } = await admin.from('ia_eventos').update(cierre).eq('id', id)
    if (error) console.error('ia_eventos:', error.message)
  } catch (e) {
    console.error('ia_eventos:', (e as Error).message)
  }
}

/** Lee el cuerpo JSON con un tope de tamaño (evita agotar memoria con cuerpos enormes). */
export async function leerCuerpo<T>(req: Request, maxBytes = 32_000): Promise<{ datos: T | null; error?: 'grande' | 'invalido' }> {
  const declarado = Number(req.headers.get('content-length') ?? 0)
  if (declarado > maxBytes) return { datos: null, error: 'grande' }
  const texto = await req.text()
  if (new TextEncoder().encode(texto).length > maxBytes) return { datos: null, error: 'grande' }
  try {
    return { datos: JSON.parse(texto) as T }
  } catch {
    return { datos: null, error: 'invalido' }
  }
}

export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
