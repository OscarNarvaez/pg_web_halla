// POST /functions/v1/clasificar-hallazgo
// Clasifica y redacta un hallazgo con la IA, validando la salida contra los criterios cargados (§9.1).
// Controles de seguridad: docs/SEGURIDAD.md (S1 anonimización, S2 cuentas aprobadas, S4 cuota atómica).
import { preflight, respuestaError, respuestaJson } from '../_shared/cors.ts'
import {
  autenticar, clienteAdmin, config, finalizarEvento, leerCuerpo, mensajeLimite, MENSAJE_NO_APROBADO, RE_UUID, reservarUso,
} from '../_shared/supabase.ts'
import { ErrorGemini, llamarGemini, mensajeErrorGemini } from '../_shared/gemini.ts'
import { PROMPT_SISTEMA_EXPERTO } from '../_shared/prompt-sistema-experto.ts'
import { ESQUEMA_SALIDA } from '../_shared/esquema-salida.ts'
import { recuperarCriterios, type Criterio } from '../_shared/recuperar-criterios.ts'
import { clasificarHallazgo } from '../_shared/motor.ts'
import { anonimizar, totalRetirados } from '../_shared/anonimizar.ts'

const FUNCION = 'clasificar-hallazgo'
const MIN_CARACTERES = 25
const MAX_CARACTERES = 6000
const MAX_NOTAS = 2000

interface Cuerpo {
  auditoria_id?: string
  entrada_auditor?: string
  contexto?: { notas?: string }
  persistir?: boolean
}

Deno.serve(async (req) => {
  const corto = preflight(req)
  if (corto) return corto

  const inicio = Date.now()
  const cfg = config()
  const admin = clienteAdmin()

  // 1. Autenticación: el user_id sale del token, nunca del cuerpo
  const usuario = await autenticar(admin, req)
  if (!usuario) return respuestaError(req, 'Tu sesión no es válida o expiró. Vuelve a ingresar.', 401, 'no_autenticado')
  if (!usuario.aprobado) return respuestaError(req, MENSAJE_NO_APROBADO, 403, 'no_aprobado')

  const { datos: cuerpo, error: errCuerpo } = await leerCuerpo<Cuerpo>(req)
  if (errCuerpo === 'grande') return respuestaError(req, 'La solicitud es demasiado grande.', 413, 'demasiado_grande')
  if (!cuerpo || typeof cuerpo !== 'object') return respuestaError(req, 'Solicitud inválida.', 400, 'datos_invalidos')
  const entrada = typeof cuerpo.entrada_auditor === 'string' ? cuerpo.entrada_auditor.trim() : ''
  const notas = typeof cuerpo.contexto?.notas === 'string' ? cuerpo.contexto.notas.trim() || null : null
  const persistir = cuerpo.persistir !== false
  if (!cuerpo.auditoria_id || !RE_UUID.test(cuerpo.auditoria_id)) return respuestaError(req, 'Falta el identificador de la auditoría.', 400, 'datos_invalidos')
  if (entrada.length < MIN_CARACTERES) return respuestaError(req, `Describe el hallazgo con al menos ${MIN_CARACTERES} caracteres.`, 400, 'entrada_corta')
  if (entrada.length > MAX_CARACTERES) return respuestaError(req, `El texto supera los ${MAX_CARACTERES} caracteres. Divide la observación en varios hallazgos.`, 400, 'entrada_larga')
  if (notas && notas.length > MAX_NOTAS) return respuestaError(req, `Las notas superan los ${MAX_NOTAS} caracteres.`, 400, 'notas_largas')

  // 2. Autorización: la auditoría debe pertenecer al usuario
  const { data: auditoria } = await admin
    .from('auditorias')
    .select('id, user_id, codigo, titulo, alcance, proceso, sistema, area_auditada, fecha_inicio, estado')
    .eq('id', cuerpo.auditoria_id)
    .maybeSingle()
  if (!auditoria || auditoria.user_id !== usuario.id) return respuestaError(req, 'No tienes acceso a esa auditoría.', 403, 'prohibido')
  if (auditoria.estado === 'cerrada') return respuestaError(req, 'La auditoría está cerrada: no admite hallazgos nuevos.', 409, 'auditoria_cerrada')

  // 3. Cuota: se reserva ANTES de llamar a la IA, de forma atómica
  const reserva = await reservarUso(admin, usuario.id, FUNCION, cfg)
  if ('error' in reserva) return respuestaError(req, mensajeLimite(reserva.error, cfg), reserva.error === 'interno' ? 500 : 429, reserva.error)

  // Anonimización: a la IA (tercero) no llegan nombres, documentos, teléfonos ni correos.
  // En la base de datos propia se conserva el texto original (trazabilidad).
  const entradaIa = anonimizar(entrada)
  const notasIa = notas ? anonimizar(notas) : null
  const anonimizacion = {
    entrada: entradaIa.retirados,
    notas: notasIa?.retirados ?? null,
    total: totalRetirados(entradaIa.retirados) + (notasIa ? totalRetirados(notasIa.retirados) : 0),
  }

  // 4. Recuperación de criterios normativos (sobre el texto anonimizado)
  const buscar = async (consulta: string, documentos: string[] | null, limite: number): Promise<Criterio[]> => {
    const { data, error } = await admin.rpc('buscar_criterios', { consulta, documentos, limite })
    if (error) throw new Error(`buscar_criterios: ${error.message}`)
    return (data ?? []) as Criterio[]
  }
  let recuperacion
  try {
    recuperacion = await recuperarCriterios(buscar, { entrada: entradaIa.texto, alcance: auditoria.alcance, proceso: auditoria.proceso, sistema: auditoria.sistema, limite: 12 })
  } catch (e) {
    console.error(e)
    recuperacion = { criterios: [] as Criterio[], consulta: '', filtrado: false } // se continúa sin criterios
  }

  // 5-7. Prompt, llamada a Gemini y validación
  const llamar = (mensaje: string) =>
    llamarGemini(
      { apiKey: cfg.geminiApiKey, modelos: cfg.geminiModelos, maxTokens: cfg.geminiMaxTokens, nivelRazonamiento: cfg.geminiNivelRazonamiento, presupuestoMs: 110_000 },
      { sistema: PROMPT_SISTEMA_EXPERTO, mensaje, esquema: ESQUEMA_SALIDA },
    )

  let resultado
  try {
    resultado = await clasificarHallazgo({
      entrada: entradaIa.texto,
      notas: notasIa?.texto ?? null,
      contexto: {
        alcance: auditoria.alcance,
        proceso: auditoria.proceso,
        sistema: auditoria.sistema,
        area_auditada: auditoria.area_auditada,
        codigo: auditoria.codigo,
        titulo: auditoria.titulo,
        fecha: auditoria.fecha_inicio ?? new Date().toISOString().slice(0, 10),
      },
      criterios: recuperacion.criterios,
      llamar,
    })
  } catch (e) {
    const err = e instanceof ErrorGemini ? e : new ErrorGemini((e as Error).message, 502, 'salida_invalida', 0)
    const { mensaje, estado } = mensajeErrorGemini(err)
    // 9. Registro también en el error (el detalle técnico queda en la bitácora, no en la respuesta)
    await finalizarEvento(admin, reserva.id, {
      modelo: cfg.geminiModelos[0], prompt_version: cfg.promptVersion, exito: false, codigo_error: err.codigo,
      latencia_ms: Date.now() - inicio, detalle: { mensaje: err.message.slice(0, 500), anonimizacion },
    })
    return respuestaError(req, mensaje, estado, err.codigo)
  }

  const llamadaPrincipal = resultado.llamadas[0]
  const modeloUsado = resultado.llamadas.map((l) => l.modelo).filter((m, i, a) => a.indexOf(m) === i).join(' + ')

  // 8. Persistencia (con la service role: la procedencia de IA solo la escribe el servidor)
  let ids: Array<string | null> = resultado.hallazgos.map(() => null)
  if (persistir) {
    ids = []
    // Una fila a la vez para que el trigger asigne consecutivos en el orden devuelto por la IA
    for (const h of resultado.hallazgos) {
      const { data, error } = await admin
        .from('hallazgos')
        .insert({
          auditoria_id: auditoria.id,
          user_id: usuario.id,
          entrada_auditor: entrada, // original, completo: no sale de la base de datos propia
          clasificacion: h.clasificacion,
          justificacion: h.justificacion,
          hallazgo_corregido: h.hallazgo_corregido,
          criterio_requisito: h.criterio_requisito,
          evidencia: h.evidencia,
          severidad: h.severidad,
          estado: 'generado',
          modelo_ia: modeloUsado,
          prompt_version: cfg.promptVersion,
          respuesta_cruda: {
            ...resultado.respuestas,
            contexto: { notas },
            modelo_version: llamadaPrincipal.modeloVersion,
            anonimizacion,
            recuperacion: { consulta: recuperacion.consulta, filtrado: recuperacion.filtrado, criterios: recuperacion.criterios.map((c) => c.id) },
          },
          criterios_citados: h.criterios_citados,
          avisos: h.avisos,
        })
        .select('id')
        .single()
      if (error) {
        console.error('persistencia:', error.message)
        await finalizarEvento(admin, reserva.id, { modelo: modeloUsado, prompt_version: cfg.promptVersion, exito: false, codigo_error: 'persistencia', detalle: { mensaje: error.message } })
        return respuestaError(req, 'La IA respondió, pero no se pudo guardar el hallazgo. Inténtalo de nuevo.', 500, 'persistencia')
      }
      ids.push(data.id)
    }
    if (auditoria.estado === 'borrador') await admin.from('auditorias').update({ estado: 'en_curso' }).eq('id', auditoria.id)
  }

  const latencia = Date.now() - inicio
  await finalizarEvento(admin, reserva.id, {
    modelo: modeloUsado,
    prompt_version: cfg.promptVersion,
    exito: true,
    codigo_error: null,
    latencia_ms: latencia,
    tokens_entrada: resultado.llamadas.reduce((s, l) => s + (l.tokensEntrada ?? 0), 0) || null,
    tokens_salida: resultado.llamadas.reduce((s, l) => s + (l.tokensSalida ?? 0), 0) || null,
    detalle: {
      reparado: resultado.reparado,
      anonimizacion,
      modelos_descartados: llamadaPrincipal.descartados,
      citas_descartadas: resultado.hallazgos.flatMap((h) => h.registro.citas_descartadas),
      referencias_eliminadas: resultado.hallazgos.flatMap((h) => h.registro.referencias_eliminadas),
      datos_reemplazados: resultado.hallazgos.flatMap((h) => h.registro.datos_reemplazados),
      estructura_sin_verificar: resultado.hallazgos.filter((h) => h.problemas.length).map((h) => h.problemas),
    },
  })

  return respuestaJson(req, {
    ok: true,
    hallazgos: resultado.hallazgos.map((h, i) => ({
      id: ids[i],
      clasificacion: h.clasificacion,
      justificacion: h.justificacion,
      hallazgo_corregido: h.hallazgo_corregido,
      criterio_requisito: h.criterio_requisito,
      evidencia: h.evidencia,
      severidad: h.severidad,
      criterios_citados: h.criterios_citados,
      avisos: h.avisos,
    })),
    meta: {
      modelo: modeloUsado,
      prompt_version: cfg.promptVersion,
      latencia_ms: latencia,
      criterios_recuperados: recuperacion.criterios.length,
      reparado: resultado.reparado,
      datos_personales_retirados: anonimizacion.total,
    },
  })
})
