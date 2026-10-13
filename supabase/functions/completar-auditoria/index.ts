// POST /functions/v1/completar-auditoria
// La IA propone los campos que no se le piden al auditor: objetivo, normas aplicables y área auditada.
// El código AI-<año>-<consecutivo> (AE- para auditores externos) se calcula en código, no con la IA. El auditor puede editar todo.
import { preflight, respuestaError, respuestaJson } from '../_shared/cors.ts'
import { autenticar, clienteAdmin, config, finalizarEvento, leerCuerpo, MENSAJE_NO_APROBADO, reservarUso } from '../_shared/supabase.ts'
import { ErrorGemini, llamarGemini } from '../_shared/gemini.ts'
import { esquemaCompletarAuditoria } from '../_shared/esquema-salida.ts'
import { documentosParaAlcance, INSTITUCION, PROCESOS, SISTEMAS, textosAuditoria } from '../_shared/catalogos.ts'
import { anonimizar } from '../_shared/anonimizar.ts'

const FUNCION = 'completar-auditoria'

interface Cuerpo {
  alcance?: 'PROCESOS' | 'SISTEMAS'
  proceso?: string | null
  sistema?: string | null
  titulo?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

/** Instrucciones según el grupo del auditor: auditoría interna o externa (decisión del dueño, 13/10/2026). */
const sistema = (t: ReturnType<typeof textosAuditoria>) => `Eres ${t.auditor} líder de la auditoría al ${INSTITUCION.nombre} (${INSTITUCION.ciudad}).
Propón los datos de planeación de una auditoría ${t.tipo}:
- "objetivo": una sola oración en infinitivo (por ejemplo, «Evaluar…»), específica para el proceso o sistema auditado, que mencione la verificación del cumplimiento de los criterios aplicables. Máximo 60 palabras.
- "area_auditada": el área o servicio donde se ejecuta la auditoría, en pocas palabras.
- "criterios": las normas aplicables, elegidas EXCLUSIVAMENTE de la lista entregada.
No inventes normas, fechas, nombres ni cifras. Redacta en español, en tercera persona. Responde solo con el JSON.`

async function siguienteCodigo(admin: ReturnType<typeof clienteAdmin>, userId: string, anio: number, sigla: string): Promise<string> {
  const { data } = await admin.from('auditorias').select('codigo').eq('user_id', userId).like('codigo', `${sigla}-${anio}-%`)
  const max = (data ?? []).reduce((m: number, a: { codigo: string }) => Math.max(m, Number(a.codigo.split('-')[2]) || 0), 0)
  return `${sigla}-${anio}-${String(max + 1).padStart(3, '0')}`
}

Deno.serve(async (req) => {
  const corto = preflight(req)
  if (corto) return corto
  const inicio = Date.now()
  const cfg = config()
  const admin = clienteAdmin()

  const usuario = await autenticar(admin, req)
  if (!usuario) return respuestaError(req, 'Tu sesión no es válida o expiró. Vuelve a ingresar.', 401, 'no_autenticado')
  if (!usuario.aprobado) return respuestaError(req, MENSAJE_NO_APROBADO, 403, 'no_aprobado')
  const userId = usuario.id
  const t = textosAuditoria(usuario.tipoEvaluador)

  const { datos: c, error: errCuerpo } = await leerCuerpo<Cuerpo>(req, 4_000)
  if (errCuerpo === 'grande') return respuestaError(req, 'La solicitud es demasiado grande.', 413, 'demasiado_grande')
  const alcance = c?.alcance
  const objeto = alcance === 'SISTEMAS' ? c?.sistema : c?.proceso
  // Solo valores del catálogo: nada arbitrario llega al prompt
  const objetoValido = alcance === 'SISTEMAS' ? SISTEMAS.includes(String(objeto)) : alcance === 'PROCESOS' && PROCESOS.includes(String(objeto))
  if (!alcance || !objetoValido) return respuestaError(req, 'Elige el alcance y el proceso o sistema a auditar.', 400, 'datos_invalidos')
  const fechaValida = (f: unknown) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)
  const fechaInicio = fechaValida(c?.fecha_inicio) ? String(c?.fecha_inicio) : null
  const fechaFin = fechaValida(c?.fecha_fin) ? String(c?.fecha_fin) : null
  const titulo = typeof c?.titulo === 'string' ? anonimizar(c.titulo.slice(0, 200)).texto : null

  const anio = Number((fechaInicio ?? '').slice(0, 4)) || new Date().getFullYear()
  const codigo = await siguienteCodigo(admin, userId, anio, t.sigla)

  // Solo normas aplicables al alcance Y efectivamente cargadas en criterios_normativos
  const { data: cargados } = await admin.rpc('resumen_documentos')
  const disponibles = new Set(((cargados ?? []) as Array<{ documento_codigo: string }>).map((d) => d.documento_codigo))
  const aplicables = documentosParaAlcance(alcance, c?.sistema).filter((d) => disponibles.size === 0 || disponibles.has(d))

  const respaldo = {
    codigo,
    objetivo: `Evaluar el cumplimiento de los requisitos aplicables ${alcance === 'SISTEMAS' ? `al ${objeto}` : `al proceso de ${objeto}`} del ${INSTITUCION.nombre}, con base en la evidencia objetiva recopilada durante la auditoría ${t.tipo}.`,
    criterios: aplicables,
    area_auditada: String(objeto),
  }

  if (!aplicables.length) return respuestaJson(req, { ok: true, sugerencia: respaldo, meta: { modelo: null, ia: false } })
  // Cuota reservada antes de llamar a la IA; sin cupo, la planeación no se bloquea: propuesta básica
  const reserva = await reservarUso(admin, userId, FUNCION, cfg)
  if ('error' in reserva) {
    return respuestaJson(req, { ok: true, sugerencia: respaldo, meta: { modelo: null, ia: false, aviso: 'Se alcanzó el límite de uso de la IA; se propusieron valores básicos.' } })
  }

  const mensaje = [
    `Alcance: ${alcance}`,
    `${alcance === 'SISTEMAS' ? 'Sistema' : 'Proceso'} auditado: ${objeto}`,
    titulo ? `Título propuesto por el auditor: ${titulo}` : '',
    fechaInicio ? `Periodo: ${fechaInicio} a ${fechaFin ?? fechaInicio}` : '',
    `Normas disponibles: ${aplicables.join(' | ')}`,
  ].filter(Boolean).join('\n')

  try {
    const r = await llamarGemini(
      { apiKey: cfg.geminiApiKey, modelos: cfg.geminiModelos, maxTokens: 1024, nivelRazonamiento: cfg.geminiNivelRazonamiento, presupuestoMs: 45_000 },
      { sistema: sistema(t), mensaje, esquema: esquemaCompletarAuditoria(aplicables), temperatura: 0.3 },
    )
    const s = r.json as { objetivo?: string; area_auditada?: string; criterios?: string[] }
    const criterios = (s.criterios ?? []).filter((d) => aplicables.includes(d)) // nunca normas inventadas
    await finalizarEvento(admin, reserva.id, {
      modelo: r.modelo, prompt_version: cfg.promptVersion, exito: true, codigo_error: null,
      latencia_ms: Date.now() - inicio, tokens_entrada: r.tokensEntrada, tokens_salida: r.tokensSalida,
    })
    return respuestaJson(req, {
      ok: true,
      sugerencia: {
        codigo,
        objetivo: s.objetivo?.trim() || respaldo.objetivo,
        criterios: criterios.length ? criterios : aplicables,
        area_auditada: s.area_auditada?.trim() || respaldo.area_auditada,
      },
      meta: { modelo: r.modelo, ia: true, latencia_ms: Date.now() - inicio },
    })
  } catch (e) {
    const err = e as ErrorGemini
    await finalizarEvento(admin, reserva.id, {
      modelo: cfg.geminiModelos[0], prompt_version: cfg.promptVersion,
      exito: false, codigo_error: err.codigo ?? 'error', latencia_ms: Date.now() - inicio, detalle: { mensaje: String(err.message).slice(0, 500) },
    })
    // La planeación nunca se bloquea: se devuelve una propuesta básica
    return respuestaJson(req, { ok: true, sugerencia: respaldo, meta: { modelo: null, ia: false, aviso: 'La IA no estuvo disponible; se propusieron valores básicos.' } })
  }
})
