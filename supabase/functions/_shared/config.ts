// Configuración de las Edge Functions. Recibe el lector de variables (Deno.env.get en producción)
// para que los módulos compartidos se puedan probar también en Node.

export interface Config {
  geminiApiKey: string
  /** Modelo principal seguido de los de respaldo, en orden de preferencia. */
  geminiModelos: string[]
  geminiMaxTokens: number
  geminiNivelRazonamiento: 'low' | 'medium' | 'high' | null
  promptVersion: string
  limiteDiario: number
  limitePorMinuto: number
}

// Verificados el 3/10/2026 con salida estructurada. Cada modelo tiene su propia cuota diaria gratuita
// (20 solicitudes), así que la cascada multiplica la capacidad. Los «lite» van al final: son más
// rápidos pero menos finos en la clasificación. gemini-2.5-* ya no están disponibles para cuentas nuevas.
export const MODELO_PRINCIPAL = 'gemini-3.8-flash'
export const MODELOS_RESPALDO = [
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
]

export function leerConfig(leer: (clave: string) => string | undefined): Config {
  const nivel = (leer('GEMINI_NIVEL_RAZONAMIENTO') ?? 'low').toLowerCase()
  const principal = leer('GEMINI_MODEL')?.trim() || MODELO_PRINCIPAL
  const respaldoEnv = leer('GEMINI_MODELOS_RESPALDO')
  const respaldo = respaldoEnv !== undefined
    ? respaldoEnv.split(',').map((m) => m.trim()).filter(Boolean)
    : MODELOS_RESPALDO
  return {
    geminiApiKey: leer('GEMINI_API_KEY') ?? '',
    geminiModelos: [principal, ...respaldo.filter((m) => m !== principal)],
    geminiMaxTokens: Number(leer('GEMINI_MAX_OUTPUT_TOKENS') ?? 4096),
    geminiNivelRazonamiento: nivel === 'off' || nivel === 'none' ? null : (nivel as Config['geminiNivelRazonamiento']),
    promptVersion: leer('PROMPT_VERSION') ?? '1.0.0',
    limiteDiario: Number(leer('LIMITE_IA_DIARIO_POR_USUARIO') ?? 120),
    limitePorMinuto: Number(leer('LIMITE_IA_POR_MINUTO') ?? 5),
  }
}
