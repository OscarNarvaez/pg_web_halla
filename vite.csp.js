// Content Security Policy del sitio (docs/SEGURIDAD.md S5). Se usa en vite.config.js y se prueba en
// scripts/probar-validacion.mjs.

/**
 * Normaliza la URL del proyecto Supabase: quita espacios, saltos de línea (un «\r\n» pegado al copiar el
 * valor en GitHub dejó una vez la CSP sin Supabase y bloqueó el registro) y barras finales.
 * Si la variable existe pero no es un origen https válido, LANZA: es mejor que el build falle a publicar
 * un sitio que no puede hablar con su backend.
 * @returns {string} el origen (https://<ref>.supabase.co) o '' si la variable no está definida
 */
export function normalizarUrlSupabase(valor) {
  const limpio = String(valor ?? '').trim().replace(/\/+$/, '')
  if (!limpio) return ''
  let url
  try {
    url = new URL(limpio)
  } catch {
    throw new Error(`VITE_SUPABASE_URL no es una URL válida: ${JSON.stringify(valor)}`)
  }
  if (url.protocol !== 'https:') throw new Error(`VITE_SUPABASE_URL debe usar https://: ${JSON.stringify(valor)}`)
  if (url.pathname !== '/' || url.search || url.hash || url.username) {
    throw new Error(`VITE_SUPABASE_URL debe ser solo el origen, como https://<ref>.supabase.co: ${JSON.stringify(valor)}`)
  }
  return url.origin
}

/** Política completa. Solo scripts propios y conexiones al proyecto Supabase configurado. */
export function politicaCsp(origenSupabase) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // 'unsafe-inline' solo para estilos: React y Recharts usan atributos style
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${origenSupabase ? ` ${origenSupabase} ${origenSupabase.replace('https://', 'wss://')}` : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join('; ')
}
