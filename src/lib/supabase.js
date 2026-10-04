import { createClient } from '@supabase/supabase-js'

// Se limpian espacios, saltos de línea y la barra final: valores pegados en GitHub pueden traer «\r\n»
const url = String(import.meta.env?.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
const anonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** true si faltan las variables de entorno de Supabase (la app muestra un aviso en lugar de romperse). */
export const supabaseSinConfigurar = !url || !anonKey || url.includes('xxxxxxxx')

// Cliente único. La anon key es pública por diseño: la seguridad la dan las políticas RLS.
export const supabase = supabaseSinConfigurar
  ? null
  : createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })

/**
 * Traduce los errores de Supabase Auth y PostgREST a mensajes en español.
 * Los errores no previstos NO se muestran tal cual (pueden revelar tablas, columnas o reglas internas):
 * se registran en la consola y el usuario ve un mensaje genérico.
 */
export function mensajeError(error) {
  if (!error) return ''
  const texto = String(error.message ?? error)
  const codigo = String(error.code ?? '')
  const mapa = [
    [/user already registered|already been registered/i, 'No se pudo completar el registro. Si ya tienes cuenta, ingresa o recupera tu contraseña.'],
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    // Proveedor de correo o registro desactivado en Supabase (Authentication → Sign In / Providers)
    [/signups? (are |is )?(disabled|not allowed)|email_provider_disabled|signup_disabled/i, 'El registro de cuentas está desactivado en este momento. Avísale al administrador de la plataforma.'],
    [/email logins? (are |is )?disabled|logins? (are |is )?disabled/i, 'El ingreso con correo está desactivado en este momento. Avísale al administrador de la plataforma.'],
    [/email not confirmed/i, 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.'],
    [/password should be at least|password is too short|weak.?password|password.*(characters|contain)/i, 'La contraseña no cumple la política: al menos 10 caracteres, con mayúscula, minúscula y número.'],
    [/new password should be different/i, 'La contraseña nueva debe ser distinta de la anterior.'],
    [/rate limit|too many requests|over_email_send_rate_limit/i, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'],
    [/profiles_cedula_idx|cedula.*duplicate|duplicate.*cedula/i, 'Ya existe un auditor registrado con esa cédula.'],
    [/auditorias_codigo_usuario_idx/i, 'Ya tienes una auditoría con ese código.'],
    [/cedula_valida/i, 'La cédula debe tener entre 6 y 12 dígitos.'],
    [/celular_valido/i, 'El celular debe tener 10 dígitos.'],
    [/alcance_coherente|alcance_auditoria_coherente/i, 'Elige un proceso o un sistema, según el alcance.'],
    [/fechas_coherentes/i, 'La fecha final no puede ser anterior a la inicial.'],
    [/Ley 1581/i, 'Debes autorizar el tratamiento de tus datos personales.'],
    [/no verificable/i, 'Una de las citas normativas no corresponde a un criterio cargado.'],
    [/no se pueden modificar/i, 'La entrada original del auditor y la trazabilidad de la IA no se pueden modificar.'],
    [/jwt expired|invalid jwt|session.*(expired|missing)/i, 'Tu sesión expiró. Vuelve a ingresar.'],
    [/failed to fetch|network|load failed/i, 'No hay conexión con el servidor. Revisa tu conexión a internet.'],
    [/row-level security|permission denied|42501/i, 'No tienes permiso para realizar esta acción.'],
    // Columna, función o tabla inexistente: el esquema de la BD está desactualizado (falta `supabase db push`)
    [/^(42703|42883|42P01|PGRST20[2-5])$|does not exist|could not find the (function|table|.* column)/i,
      'La base de datos de la plataforma no está actualizada. Avísale al administrador (debe aplicar las migraciones pendientes).'],
  ]
  for (const [patron, mensaje] of mapa) {
    if (patron.test(texto) || patron.test(codigo)) {
      if (patron.source.includes('42703')) console.error('Esquema desactualizado:', describirError(error))
      return mensaje
    }
  }
  console.error('Error no previsto:', describirError(error))
  return 'No se pudo completar la acción. Inténtalo de nuevo; si persiste, avísale al administrador.'
}

/** Texto plano con código, mensaje, detalle y pista, para que el error se lea en la consola (no «Object»). */
export function describirError(error) {
  if (!error || typeof error !== 'object') return String(error)
  return ['code', 'error_code', 'status', 'message', 'details', 'hint']
    .filter((c) => error[c] !== undefined && error[c] !== null && error[c] !== '')
    .map((c) => `${c}: ${error[c]}`)
    .join(' · ')
}

/**
 * Invoca una Edge Function y normaliza la respuesta de error, incluido el 429 por cuota.
 * @returns {Promise<{ data: any, error: { mensaje: string, estado?: number } | null }>}
 */
export async function invocarFuncion(nombre, cuerpo) {
  if (!supabase) return { data: null, error: { mensaje: 'Supabase no está configurado.' } }
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
  if (!error) return { data, error: null }

  // La petición ni siquiera llegó (CORS o red). Las funciones solo aceptan el origen https://halla.ink:
  // si el sitio se abrió por http:// (HTTPS aún no activo), el navegador bloquea la respuesta.
  if (error.name === 'FunctionsFetchError') {
    const { protocol, hostname } = window.location
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (protocol === 'http:' && !local) {
      return { data: null, error: { mensaje: 'Por seguridad, la IA solo funciona con conexión cifrada (https://). Abre la plataforma con https:// o, si aún no está disponible, avísale al administrador.' } }
    }
    return { data: null, error: { mensaje: 'No se pudo contactar el servicio de IA. Revisa tu conexión a internet e inténtalo de nuevo.' } }
  }

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
