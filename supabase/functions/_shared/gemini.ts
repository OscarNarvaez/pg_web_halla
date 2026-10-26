// Cliente mínimo de la API de Gemini (generateContent) con salida estructurada, reintentos y cascada
// de modelos. Verificado el 3/10/2026 (docs/RECONOCIMIENTO.md §D):
//  - el nivel gratuito permite 20 solicitudes diarias POR PROYECTO Y POR MODELO
//    (GenerateRequestsPerDayPerProjectPerModel-FreeTier), así que agotar un modelo no agota los demás;
//  - Gemini 3.x razona por defecto y esos tokens cuentan contra maxOutputTokens → thinkingLevel 'low';
//  - la parte de la respuesta puede traer thoughtSignature: se toma la parte con texto.

export interface ConfigGemini {
  apiKey: string
  /** Modelos en orden de preferencia: el primero es el principal, los demás son respaldo. */
  modelos: string[]
  maxTokens: number
  nivelRazonamiento?: 'low' | 'medium' | 'high' | null
  /** Esperas antes de cada reintento sobre el MISMO modelo, en ms. Por defecto 1 s, 4 s, 10 s. */
  esperas?: number[]
  /** Tiempo máximo total, para no pasar el límite de ejecución de la Edge Function. */
  presupuestoMs?: number
  /**
   * Tiempo máximo de UNA petición a Gemini (sin pasar del presupuesto restante). Por defecto 45 s. Sin él, una respuesta
   * lenta podía alargar la llamada más allá del presupuesto, que solo se revisa entre intentos.
   */
  tiempoPorIntentoMs?: number
  /**
   * Si el modelo en curso no termina en este tiempo, arranca en paralelo el siguiente de la cascada y gana el primero
   * que responda bien. Por defecto 12 s.
   */
  esperaRespaldoMs?: number
  fetchImpl?: typeof fetch
}

export interface PeticionGemini {
  sistema: string
  mensaje: string
  esquema: unknown
  temperatura?: number
}

export interface RespuestaGemini {
  json: unknown
  texto: string
  modelo: string
  modeloVersion: string | null
  finishReason: string | null
  tokensEntrada: number | null
  tokensSalida: number | null
  intentos: number
  latenciaMs: number
  /** Modelos que se intentaron antes del que respondió, con el motivo. */
  descartados: Array<{ modelo: string; motivo: string }>
}

export class ErrorGemini extends Error {
  estado: number
  codigo: string
  intentos: number
  constructor(mensaje: string, estado: number, codigo: string, intentos: number) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.intentos = intentos
  }
}

// Memoria por instancia (isolate) de los modelos que no conviene intentar por un rato: sin cuota diaria
// o saturados. Evita recorrer en cada llamada modelos que ya se sabe que van a fallar.
const noDisponibleHasta = new Map<string, number>()
const ESPERA_SATURADO_MS = 60_000

/** Ordena los modelos dejando al final los marcados como no disponibles (sin descartarlos del todo). */
export function ordenarModelos(modelos: string[], ahora = Date.now()): string[] {
  const disponibles = modelos.filter((m) => (noDisponibleHasta.get(m) ?? 0) <= ahora)
  const enEspera = modelos.filter((m) => (noDisponibleHasta.get(m) ?? 0) > ahora)
  return [...disponibles, ...enEspera]
}

function marcarNoDisponible(modelo: string, ms: number) {
  noDisponibleHasta.set(modelo, Date.now() + ms)
}

interface DetalleError {
  mensaje: string
  cuotaDiaria: boolean
  esperaSugeridaMs: number | null
}

function leerError(crudo: string): DetalleError {
  try {
    const error = JSON.parse(crudo)?.error
    const detalles: Array<Record<string, unknown>> = error?.details ?? []
    const cuota = detalles.find((d) => String(d['@type'] ?? '').includes('QuotaFailure')) as
      | { violations?: Array<{ quotaId?: string }> }
      | undefined
    const reintento = detalles.find((d) => String(d['@type'] ?? '').includes('RetryInfo')) as { retryDelay?: string } | undefined
    const segundos = reintento?.retryDelay ? Number.parseFloat(reintento.retryDelay) : null
    const cuotaDiaria =
      Boolean(cuota?.violations?.some((v) => /PerDay/i.test(v.quotaId ?? ''))) || (segundos !== null && segundos > 120)
    return {
      mensaje: String(error?.message ?? crudo).split('\n')[0].slice(0, 300),
      cuotaDiaria,
      esperaSugeridaMs: segundos !== null && Number.isFinite(segundos) ? segundos * 1000 : null,
    }
  } catch {
    return { mensaje: crudo.slice(0, 300), cuotaDiaria: false, esperaSugeridaMs: null }
  }
}

export async function llamarGemini(config: ConfigGemini, peticion: PeticionGemini): Promise<RespuestaGemini> {
  const esperas = config.esperas ?? [1000, 4000, 10000]
  const hacerFetch = config.fetchImpl ?? fetch
  const presupuesto = config.presupuestoMs ?? 100_000
  const tiempoPorIntento = config.tiempoPorIntentoMs ?? 45_000
  const esperaRespaldo = config.esperaRespaldoMs ?? 12_000
  const inicio = Date.now()
  const restante = () => presupuesto - (Date.now() - inicio)
  const modelos = ordenarModelos(config.modelos.filter(Boolean))
  if (!modelos.length) throw new ErrorGemini('No hay modelos de IA configurados.', 500, 'sin_modelo', 0)
  if (restante() <= 0) throw new ErrorGemini('La IA tardó demasiado en responder.', 504, 'tiempo_agotado', 0)

  const descartados: Array<{ modelo: string; motivo: string }> = []
  let ultimo: ErrorGemini | null = null
  let intentosTotales = 0
  let usarRazonamiento = Boolean(config.nivelRazonamiento)
  // Se cancela al terminar la llamada (con o sin respuesta): corta las peticiones y las esperas que sigan en curso
  const fin = new AbortController()

  /** Espera entre intentos: no pasa del presupuesto y se interrumpe si la llamada ya terminó. */
  const esperar = (ms: number) =>
    new Promise<void>((listo) => {
      const t = setTimeout(listo, Math.max(0, Math.min(ms, restante())))
      fin.signal.addEventListener('abort', () => {
        clearTimeout(t)
        listo()
      }, { once: true })
    })

  type Resultado = Omit<RespuestaGemini, 'intentos' | 'latenciaMs' | 'descartados'>

  /**
   * Un modelo con sus reintentos. Devuelve su respuesta o null para pasar al siguiente modelo; lanza solo cuando no
   * tiene sentido seguir (400: el mismo error se repetiría con cualquier modelo).
   */
  async function intentarModelo(modelo: string, hayRespaldo: boolean): Promise<Resultado | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`
    for (let intento = 1; intento <= esperas.length + 1; intento++) {
      if (fin.signal.aborted || restante() <= 0) return null
      intentosTotales++
      const generationConfig: Record<string, unknown> = {
        temperature: peticion.temperatura ?? 0.2, // clasificación consistente, no creativa
        topP: 0.8,
        maxOutputTokens: config.maxTokens,
        responseMimeType: 'application/json',
        responseSchema: peticion.esquema,
      }
      if (usarRazonamiento && config.nivelRazonamiento) generationConfig.thinkingConfig = { thinkingLevel: config.nivelRazonamiento }

      // Cada petición (y la lectura de su respuesta) tiene su propio límite de tiempo, y se corta si otro modelo ya respondió
      const control = new AbortController()
      const cancelar = () => control.abort()
      fin.signal.addEventListener('abort', cancelar, { once: true })
      const reloj = setTimeout(cancelar, Math.max(1, Math.min(tiempoPorIntento, restante())))
      let res: Response
      let crudo: string
      try {
        res = await hacerFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: peticion.sistema }] },
            contents: [{ role: 'user', parts: [{ text: peticion.mensaje }] }],
            generationConfig,
          }),
          signal: control.signal,
        })
        crudo = await res.text()
      } catch (e) {
        if (fin.signal.aborted) return null
        if (control.signal.aborted) {
          // Un modelo lento no se reintenta: se pasa al siguiente con el tiempo que quede
          ultimo = new ErrorGemini('La IA tardó demasiado en responder.', 504, 'tiempo_agotado', intentosTotales)
          descartados.push({ modelo, motivo: 'tiempo agotado' })
          if (hayRespaldo) marcarNoDisponible(modelo, ESPERA_SATURADO_MS)
          return null
        }
        ultimo = new ErrorGemini(`Error de red con Gemini: ${(e as Error).message}`, 503, 'red', intentosTotales)
        if (intento <= esperas.length) {
          await esperar(esperas[intento - 1])
          continue
        }
        return null
      } finally {
        clearTimeout(reloj)
        fin.signal.removeEventListener('abort', cancelar)
      }
      if (fin.signal.aborted) return null // otro modelo ya respondió

      if (!res.ok) {
        const detalle = leerError(crudo)
        // Cuota diaria agotada: reintentar el mismo modelo es inútil; se pasa al siguiente
        if (res.status === 429 && detalle.cuotaDiaria) {
          ultimo = new ErrorGemini(detalle.mensaje, 429, 'cuota_diaria', intentosTotales)
          descartados.push({ modelo, motivo: 'cuota diaria agotada' })
          marcarNoDisponible(modelo, detalle.esperaSugeridaMs ?? 3_600_000)
          return null
        }
        // Modelo inexistente o retirado
        if (res.status === 404) {
          ultimo = new ErrorGemini(detalle.mensaje, 404, 'modelo_no_disponible', intentosTotales)
          descartados.push({ modelo, motivo: 'modelo no disponible' })
          marcarNoDisponible(modelo, 24 * 3_600_000)
          return null
        }
        // 400: error de esquema o de prompt → no se reintenta (salvo que el modelo no acepte thinkingConfig)
        if (res.status === 400) {
          if (usarRazonamiento && /thinking/i.test(detalle.mensaje)) {
            usarRazonamiento = false
            intento--
            continue
          }
          throw new ErrorGemini(detalle.mensaje, 400, 'peticion_invalida', intentosTotales)
        }
        ultimo = new ErrorGemini(detalle.mensaje, res.status, `http_${res.status}`, intentosTotales)
        const reintentable = res.status === 429 || res.status >= 500
        // Con un modelo de respaldo disponible, un 503 «high demand» solo se reintenta una vez
        const maxIntentos = res.status >= 500 && hayRespaldo ? 2 : esperas.length + 1
        if (reintentable && intento < maxIntentos) {
          await esperar(Math.max(esperas[intento - 1], Math.min(detalle.esperaSugeridaMs ?? 0, 15000)))
          continue
        }
        descartados.push({ modelo, motivo: res.status === 429 ? 'límite por minuto' : `error ${res.status}` })
        if (hayRespaldo) marcarNoDisponible(modelo, ESPERA_SATURADO_MS)
        return null
      }

      const datos = JSON.parse(crudo)
      const candidato = datos?.candidates?.[0]
      const finishReason: string | null = candidato?.finishReason ?? null
      const parte = (candidato?.content?.parts ?? []).find(
        (p: { text?: string; thought?: boolean }) => typeof p.text === 'string' && !p.thought,
      )
      const texto: string = parte?.text ?? ''

      let json: unknown = null
      if (texto) {
        try {
          json = JSON.parse(texto)
        } catch {
          json = null
        }
      }
      if (!texto || json === null) {
        const codigo = finishReason === 'MAX_TOKENS' ? 'max_tokens' : !texto ? 'vacio' : 'json_invalido'
        ultimo = new ErrorGemini(
          codigo === 'max_tokens' ? 'La respuesta de la IA se cortó por longitud.' : 'La IA devolvió una respuesta vacía o inválida.',
          502,
          codigo,
          intentosTotales,
        )
        if (intento <= 1) {
          await esperar(esperas[0])
          continue
        }
        descartados.push({ modelo, motivo: codigo })
        return null
      }

      return {
        json,
        texto,
        modelo,
        modeloVersion: datos?.modelVersion ?? null,
        finishReason,
        tokensEntrada: datos?.usageMetadata?.promptTokenCount ?? null,
        tokensSalida: (datos?.usageMetadata?.candidatesTokenCount ?? 0) + (datos?.usageMetadata?.thoughtsTokenCount ?? 0) || null,
      }
    }
    return null
  }

  /** Error cuando ningún modelo respondió. */
  const errorFinal = () => {
    const todosSinCuota = descartados.length > 0 && descartados.every((d) => d.motivo === 'cuota diaria agotada' || d.motivo === 'modelo no disponible')
    if (todosSinCuota && descartados.some((d) => d.motivo === 'cuota diaria agotada')) {
      return new ErrorGemini('Se agotó la cuota diaria de todos los modelos configurados.', 429, 'cuota_diaria', intentosTotales)
    }
    return ultimo ?? new ErrorGemini('No se pudo completar la llamada a Gemini.', 503, 'desconocido', intentosTotales)
  }

  // Cascada con respaldo en paralelo (25/10/2026): cuando Google está saturado, un modelo puede quedarse colgado o
  // tardar en devolver un 503, y la cascada no alcanzaba a llegar a los modelos que sí respondían. Si el modelo en curso
  // no termina en `esperaRespaldo`, arranca el siguiente SIN cancelar el primero; gana el primero que responda bien y
  // los demás se cancelan. Un modelo que falla da paso al siguiente de inmediato si no hay otro en curso.
  return await new Promise<RespuestaGemini>((resolver, rechazar) => {
    let siguiente = 0
    const enCurso = new Set<string>()
    let terminado = false
    let relojRespaldo: ReturnType<typeof setTimeout> | undefined
    let relojTotal: ReturnType<typeof setTimeout> | undefined

    const terminar = (respuesta: Resultado | null, error: ErrorGemini | null) => {
      if (terminado) return
      terminado = true
      clearTimeout(relojRespaldo)
      clearTimeout(relojTotal)
      if (respuesta) {
        // Los modelos que seguían en curso fueron más lentos: quedan para después en esta instancia
        for (const lento of enCurso) {
          descartados.push({ modelo: lento, motivo: 'lento' })
          marcarNoDisponible(lento, ESPERA_SATURADO_MS)
        }
      }
      fin.abort()
      if (respuesta) resolver({ ...respuesta, intentos: intentosTotales, latenciaMs: Date.now() - inicio, descartados })
      else rechazar(error ?? errorFinal())
    }

    const lanzar = () => {
      if (terminado) return
      clearTimeout(relojRespaldo)
      if (siguiente >= modelos.length) {
        if (!enCurso.size) terminar(null, errorFinal())
        return
      }
      const m = siguiente++
      const modelo = modelos[m]
      enCurso.add(modelo)
      intentarModelo(modelo, m < modelos.length - 1).then(
        (respuesta) => {
          enCurso.delete(modelo)
          if (respuesta) terminar(respuesta, null)
          else if (!enCurso.size) lanzar() // falló y no hay otro en curso: el siguiente, sin esperar
        },
        (e) => {
          enCurso.delete(modelo)
          terminar(null, e instanceof ErrorGemini ? e : new ErrorGemini(String((e as Error)?.message ?? e), 500, 'desconocido', intentosTotales))
        },
      )
      // Si este modelo no termina pronto, el siguiente arranca en paralelo
      if (siguiente < modelos.length) relojRespaldo = setTimeout(lanzar, esperaRespaldo)
    }

    relojTotal = setTimeout(() => terminar(null, ultimo ?? new ErrorGemini('La IA tardó demasiado en responder.', 504, 'tiempo_agotado', intentosTotales)), Math.max(0, restante()))
    lanzar()
  })
}

/** Mensaje en español para mostrar al auditor según el error de Gemini. */
export function mensajeErrorGemini(e: ErrorGemini): { mensaje: string; estado: number } {
  if (e.codigo === 'cuota_diaria') {
    return {
      mensaje: 'Se agotó la cuota diaria gratuita del servicio de IA. Se restablece en las próximas horas; tu texto no se perdió.',
      estado: 429,
    }
  }
  if (e.estado === 429) {
    return {
      mensaje: 'El servicio de IA alcanzó su límite de solicitudes por minuto. Espera un minuto y vuelve a intentarlo.',
      estado: 429,
    }
  }
  if (e.estado >= 500 || e.codigo === 'red') {
    return { mensaje: 'El servicio de IA está saturado o no responde. Inténtalo de nuevo en unos segundos.', estado: 503 }
  }
  if (e.estado === 404) return { mensaje: 'Ningún modelo de IA configurado está disponible. Avísale al administrador.', estado: 502 }
  // No se reenvía el mensaje de Google al usuario: puede contener detalles internos
  return { mensaje: 'La IA no pudo procesar la solicitud. Inténtalo de nuevo; si persiste, avísale al administrador.', estado: 502 }
}
