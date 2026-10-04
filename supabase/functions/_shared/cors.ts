// CORS con orígenes explícitos: nunca «*».
const ORIGENES_PERMITIDOS = new Set([
  'https://halla.ink',
  'https://www.halla.ink',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

export function cabecerasCors(req: Request): Record<string, string> {
  const origen = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGENES_PERMITIDOS.has(origen) ? origen : 'https://halla.ink',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function respuestaJson(req: Request, cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors(req), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function respuestaError(req: Request, mensaje: string, estado: number, codigo?: string): Response {
  return respuestaJson(req, { ok: false, error: mensaje, codigo }, estado)
}

/** Atiende el preflight. Devuelve la respuesta si era OPTIONS, o null para seguir. */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecerasCors(req) })
  if (req.method !== 'POST') return respuestaError(req, 'Método no permitido', 405)
  return null
}
