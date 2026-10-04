import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** true si faltan las variables de entorno de Supabase (la app muestra un aviso en lugar de romperse). */
export const supabaseSinConfigurar = !url || !anonKey || url.includes('xxxxxxxx')

// Cliente único. La anon key es pública por diseño: la seguridad la dan las políticas RLS.
export const supabase = supabaseSinConfigurar
  ? null
  : createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })

/** Traduce los errores habituales de Supabase Auth y PostgREST a mensajes en español. */
export function mensajeError(error) {
  if (!error) return ''
  const texto = String(error.message ?? error)
  const codigo = error.code ?? ''
  const mapa = [
    [/user already registered|already been registered/i, 'Ese correo ya está registrado.'],
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.'],
    [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit|too many requests/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [/profiles_cedula_idx|cedula.*duplicate|duplicate.*cedula/i, 'Ya existe un auditor registrado con esa cédula.'],
    [/auditorias_codigo_usuario_idx/i, 'Ya tienes una auditoría con ese código.'],
    [/jwt expired/i, 'Tu sesión expiró. Vuelve a ingresar.'],
    [/failed to fetch|network/i, 'No hay conexión con el servidor. Revisa tu conexión a internet.'],
    [/row-level security/i, 'No tienes permiso para realizar esta acción.'],
  ]
  for (const [patron, mensaje] of mapa) if (patron.test(texto) || patron.test(codigo)) return mensaje
  return texto
}

/**
 * Invoca una Edge Function y normaliza la respuesta de error, incluido el 429 por cuota.
 * @returns {Promise<{ data: any, error: { mensaje: string, estado?: number } | null }>}
 */
export async function invocarFuncion(nombre, cuerpo) {
  if (!supabase) return { data: null, error: { mensaje: 'Supabase no está configurado.' } }
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
  if (!error) return { data, error: null }

  // FunctionsHttpError trae la respuesta original en error.context
  let estado
  let mensaje = 'No se pudo completar la solicitud. Inténtalo de nuevo.'
  try {
    estado = error.context?.status
    const cuerpoError = await error.context?.json?.()
    if (cuerpoError?.error) mensaje = cuerpoError.error
  } catch {
    // respuesta sin JSON: se conserva el mensaje genérico
  }
  if (estado === 429 && !/cuota|límite|limite/i.test(mensaje)) {
    mensaje = 'El servicio de IA está saturado en este momento. Espera un minuto y vuelve a intentarlo.'
  }
  if (estado === 401) mensaje = 'Tu sesión expiró. Vuelve a ingresar.'
  return { data: null, error: { mensaje, estado } }
}
