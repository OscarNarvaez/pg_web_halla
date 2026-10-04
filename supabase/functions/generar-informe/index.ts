// POST /functions/v1/generar-informe
// Consolida los hallazgos en el informe ISO 19011. Las estadísticas se calculan en código; la IA solo
// redacta resumen ejecutivo, conclusiones y recomendaciones, en UNA llamada (§9.5).
import { preflight, respuestaError, respuestaJson } from '../_shared/cors.ts'
import { autenticar, clienteAdmin, config, finalizarEvento, leerCuerpo, MENSAJE_NO_APROBADO, RE_UUID, reservarUso } from '../_shared/supabase.ts'
import { anonimizar } from '../_shared/anonimizar.ts'
import { ErrorGemini, llamarGemini } from '../_shared/gemini.ts'
import { ESQUEMA_INFORME } from '../_shared/esquema-salida.ts'
import {
  calcularEstadisticas, cifrasNoRastreables, construirContenido, construirMensajeInforme, narrativaRespaldo,
  SISTEMA_INFORME, type HallazgoInforme, type Narrativa,
} from '../_shared/informe.ts'
import { limpiarTexto } from '../_shared/validar-salida.ts'

const FUNCION = 'generar-informe'

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

  const { datos: cuerpo, error: errCuerpo } = await leerCuerpo<{ auditoria_id?: string }>(req, 2_000)
  if (errCuerpo === 'grande') return respuestaError(req, 'La solicitud es demasiado grande.', 413, 'demasiado_grande')
  if (!cuerpo?.auditoria_id || !RE_UUID.test(cuerpo.auditoria_id)) return respuestaError(req, 'Falta el identificador de la auditoría.', 400, 'datos_invalidos')

  // 1. Propiedad de la auditoría
  const { data: auditoria } = await admin.from('auditorias').select('*').eq('id', cuerpo.auditoria_id).maybeSingle()
  if (!auditoria || auditoria.user_id !== userId) return respuestaError(req, 'No tienes acceso a esa auditoría.', 403, 'prohibido')

  // 2. Perfil y hallazgos no descartados, por consecutivo
  const { data: perfil } = await admin
    .from('profiles')
    .select('nombre_completo, cedula, cargo, equipo_auditor_nombre, equipo_auditor_cargo')
    .eq('id', userId)
    .maybeSingle()
  if (!perfil) return respuestaError(req, 'Completa tu perfil de auditor antes de generar el informe.', 409, 'sin_perfil')

  const { data: hallazgos, error } = await admin
    .from('hallazgos')
    .select('id, consecutivo, clasificacion, hallazgo_corregido, criterio_requisito, evidencia, severidad, estado, editado_por_usuario, criterios_citados')
    .eq('auditoria_id', auditoria.id)
    .neq('estado', 'descartado')
    .order('consecutivo')
  if (error) return respuestaError(req, 'No se pudieron leer los hallazgos.', 500, 'lectura')
  const lista = (hallazgos ?? []) as HallazgoInforme[]
  if (!lista.some((h) => h.estado === 'confirmado')) {
    return respuestaError(req, 'Confirma al menos un hallazgo antes de generar el informe.', 409, 'sin_confirmados')
  }

  // 3. Estadísticas en código: los números no se alucinan
  const estadisticas = calcularEstadisticas(lista)

  // 4. Narrativa con UNA llamada a la IA (o respaldo determinista si no está disponible)
  const avisos: string[] = []
  let narrativa: Narrativa
  let modelo: string | null = null
  // Cuota reservada antes de llamar a la IA; sin cupo, el informe sale con narrativa de plantilla
  const reserva = await reservarUso(admin, userId, FUNCION, cfg)
  // A la IA llegan los hallazgos anonimizados (pueden contener nombres o documentos de pacientes)
  const paraIa = lista.map((h) => ({
    ...h,
    hallazgo_corregido: anonimizar(h.hallazgo_corregido).texto,
    criterio_requisito: anonimizar(h.criterio_requisito).texto,
    evidencia: anonimizar(h.evidencia).texto,
  }))
  const auditoriaIa = { ...auditoria, titulo: anonimizar(auditoria.titulo).texto, objetivo: auditoria.objetivo ? anonimizar(auditoria.objetivo).texto : null }
  try {
    if ('error' in reserva) throw new ErrorGemini('límite de uso de la IA', 429, reserva.error, 0)
    const r = await llamarGemini(
      { apiKey: cfg.geminiApiKey, modelos: cfg.geminiModelos, maxTokens: cfg.geminiMaxTokens, nivelRazonamiento: cfg.geminiNivelRazonamiento, presupuestoMs: 110_000 },
      { sistema: SISTEMA_INFORME, mensaje: construirMensajeInforme(auditoriaIa, paraIa, estadisticas), esquema: ESQUEMA_INFORME, temperatura: 0.3 },
    )
    modelo = r.modelo
    const s = r.json as Partial<Narrativa>
    narrativa = {
      resumen_ejecutivo: limpiarTexto(s.resumen_ejecutivo ?? ''),
      conclusiones: limpiarTexto(s.conclusiones ?? ''),
      recomendaciones: (s.recomendaciones ?? []).map(limpiarTexto).filter(Boolean).slice(0, 8),
    }
    const respaldo = narrativaRespaldo(auditoria, estadisticas)
    if (!narrativa.resumen_ejecutivo) narrativa.resumen_ejecutivo = respaldo.resumen_ejecutivo
    if (!narrativa.conclusiones) narrativa.conclusiones = respaldo.conclusiones
    if (!narrativa.recomendaciones.length) narrativa.recomendaciones = respaldo.recomendaciones
    const cifras = cifrasNoRastreables(narrativa, auditoria, lista, estadisticas)
    if (cifras.length) avisos.push(`La narrativa menciona cifras que no están en los hallazgos ni en las estadísticas (${cifras.join(', ')}): revísala antes de firmar.`)
    if (!('error' in reserva)) {
      await finalizarEvento(admin, reserva.id, {
        modelo, prompt_version: cfg.promptVersion, exito: true, codigo_error: null,
        latencia_ms: Date.now() - inicio, tokens_entrada: r.tokensEntrada, tokens_salida: r.tokensSalida, detalle: { cifras_no_rastreables: cifras },
      })
    }
  } catch (e) {
    const err = e as ErrorGemini
    narrativa = narrativaRespaldo(auditoria, estadisticas)
    avisos.push('La IA no estuvo disponible: el resumen, las conclusiones y las recomendaciones se redactaron con una plantilla. Revísalos y ajústalos.')
    if (!('error' in reserva)) {
      await finalizarEvento(admin, reserva.id, {
        modelo: cfg.geminiModelos[0], prompt_version: cfg.promptVersion,
        exito: false, codigo_error: err.codigo ?? 'error', latencia_ms: Date.now() - inicio, detalle: { mensaje: String(err.message).slice(0, 500) },
      })
    }
  }
  if (estadisticas.sin_confirmar) avisos.push(`El informe incluye ${estadisticas.sin_confirmar} hallazgo(s) sin confirmar.`)

  // 5. Contenido con la estructura ISO 19011 y nueva versión
  const { data: ultima } = await admin.from('informes').select('version').eq('auditoria_id', auditoria.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = (ultima?.version ?? 0) + 1
  const contenido = construirContenido({
    auditoria, perfil, hallazgos: lista, estadisticas, narrativa,
    fechaEmision: new Date().toISOString().slice(0, 10), version, avisos,
  })

  const { data: informe, error: errInforme } = await admin
    .from('informes')
    .insert({
      auditoria_id: auditoria.id,
      user_id: userId,
      version,
      resumen_ejecutivo: narrativa.resumen_ejecutivo,
      conclusiones: narrativa.conclusiones,
      recomendaciones: narrativa.recomendaciones.map((r) => `- ${r}`).join('\n'),
      estadisticas,
      contenido,
      modelo_ia: modelo,
      prompt_version: cfg.promptVersion,
    })
    .select()
    .single()
  if (errInforme) return respuestaError(req, 'No se pudo guardar el informe. Inténtalo de nuevo.', 500, 'persistencia')

  return respuestaJson(req, { ok: true, informe, meta: { modelo, ia: Boolean(modelo), latencia_ms: Date.now() - inicio } })
})
