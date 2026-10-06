// POST /functions/v1/generar-informe
// Consolida los hallazgos en el informe con el formato oficial. Las estadísticas se calculan en código; la IA solo
// redacta las secciones narrativas (incluida la revisión de los indicadores que registró el auditor), en UNA llamada.
import { preflight, respuestaError, respuestaJson } from '../_shared/cors.ts'
import { autenticar, clienteAdmin, config, finalizarEvento, leerCuerpo, MENSAJE_NO_APROBADO, RE_UUID, reservarUso } from '../_shared/supabase.ts'
import { anonimizar } from '../_shared/anonimizar.ts'
import { ErrorGemini, llamarGemini } from '../_shared/gemini.ts'
import { ESQUEMA_INFORME } from '../_shared/esquema-salida.ts'
import {
  calcularEstadisticas, cifrasNoRastreables, construirContenido, construirMensajeInforme, narrativaRespaldo, perfilIncompletoInforme,
  revisados, SISTEMA_INFORME, type HallazgoInforme, type Narrativa, type PerfilInforme,
} from '../_shared/informe.ts'
import { limpiarTexto, recortarEnOracion } from '../_shared/validar-salida.ts'
import { TIPOS_EVALUADOR } from '../_shared/catalogos.ts'

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
    .select('nombre_completo, cedula, cargos, equipo_auditor, tipo_evaluador')
    .eq('id', userId)
    .maybeSingle()
  if (!perfil) return respuestaError(req, 'Completa tu perfil de auditor antes de generar el informe.', 409, 'sin_perfil')
  if (perfilIncompletoInforme(perfil as PerfilInforme)) {
    return respuestaError(req, 'Completa en «Mi perfil» tu grupo de auditores, tus cargos y los de tu equipo auditor antes de generar el informe: van en la Ficha Técnica.', 409, 'perfil_incompleto')
  }

  const { data: hallazgos, error } = await admin
    .from('hallazgos')
    .select('id, consecutivo, clasificacion, hallazgo_corregido, criterio_requisito, evidencia, severidad, estado, editado_por_usuario, criterios_citados, riesgo_descripcion, riesgo_dimension, riesgo_probabilidad, riesgo_impacto, controles, evidencia_archivo, evidencia_anexos')
    .eq('auditoria_id', auditoria.id)
    .neq('estado', 'descartado')
    .order('consecutivo')
  if (error) return respuestaError(req, 'No se pudieron leer los hallazgos.', 500, 'lectura')
  const lista = (hallazgos ?? []) as HallazgoInforme[]
  if (!lista.some((h) => h.estado === 'confirmado')) {
    return respuestaError(req, 'Valida al menos un hallazgo antes de generar el informe.', 409, 'sin_confirmados')
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
    riesgo_descripcion: h.riesgo_descripcion ? anonimizar(h.riesgo_descripcion).texto : null,
  }))
  // Del equipo auditor a la IA solo llegan los cargos, nunca los nombres
  const p = perfil as PerfilInforme
  const equipoIa = { lider: p.cargos, integrantes: p.equipo_auditor.map((m) => m.cargos), evaluador: TIPOS_EVALUADOR[p.tipo_evaluador as keyof typeof TIPOS_EVALUADOR] ?? '' }
  const auditoriaIa = {
    ...auditoria,
    titulo: anonimizar(auditoria.titulo).texto,
    objetivo: auditoria.objetivo ? anonimizar(auditoria.objetivo).texto : null,
    // Los indicadores los escribe el auditor: también pasan por la anonimización
    indicadores_revisados: revisados(auditoria).map((i) => ({
      nombre: anonimizar(i.nombre).texto, meta: anonimizar(i.meta).texto, resultado: anonimizar(i.resultado).texto, observacion: anonimizar(i.observacion).texto,
    })),
  }
  try {
    if ('error' in reserva) throw new ErrorGemini('límite de uso de la IA', 429, reserva.error, 0)
    const r = await llamarGemini(
      { apiKey: cfg.geminiApiKey, modelos: cfg.geminiModelos, maxTokens: cfg.geminiMaxTokens, nivelRazonamiento: cfg.geminiNivelRazonamiento, presupuestoMs: 110_000 },
      { sistema: SISTEMA_INFORME, mensaje: construirMensajeInforme(auditoriaIa, paraIa, estadisticas, equipoIa), esquema: ESQUEMA_INFORME, temperatura: 0.3 },
    )
    modelo = r.modelo
    const s = r.json as Partial<Record<keyof Narrativa, unknown>>
    const texto = (v: unknown, max = 1500) => recortarEnOracion(limpiarTexto(typeof v === 'string' ? v : ''), max)
    const textos = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map((x) => texto(x, 400)).filter(Boolean).slice(0, max)
    const respaldo = narrativaRespaldo(auditoria, estadisticas)
    // Cada sección que la IA no entregue se completa con la plantilla de respaldo
    narrativa = {
      objetivo: auditoria.objetivo?.trim() ? '' : texto(s.objetivo, 500) || respaldo.objetivo,
      alcance: texto(s.alcance) || respaldo.alcance,
      criterios_seleccion_equipo: textos(s.criterios_seleccion_equipo, 6).length ? textos(s.criterios_seleccion_equipo, 6) : respaldo.criterios_seleccion_equipo,
      priorizacion_procesos: texto(s.priorizacion_procesos) || respaldo.priorizacion_procesos,
      riesgos_oportunidades: texto(s.riesgos_oportunidades) || respaldo.riesgos_oportunidades,
      oportunidades: texto(s.oportunidades) || respaldo.oportunidades,
      observaciones: texto(s.observaciones) || respaldo.observaciones,
      conclusiones: texto(s.conclusiones, 2500) || respaldo.conclusiones,
      indicadores: revisados(auditoria).length ? texto(s.indicadores, 2500) || respaldo.indicadores : '',
    }
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
    avisos.push('La IA no estuvo disponible: las secciones narrativas se redactaron con una plantilla. Revísalas y ajústalas.')
    if (!('error' in reserva)) {
      await finalizarEvento(admin, reserva.id, {
        modelo: cfg.geminiModelos[0], prompt_version: cfg.promptVersion,
        exito: false, codigo_error: err.codigo ?? 'error', latencia_ms: Date.now() - inicio, detalle: { mensaje: String(err.message).slice(0, 500) },
      })
    }
  }
  if (estadisticas.sin_confirmar) avisos.push(`El informe incluye ${estadisticas.sin_confirmar} hallazgo(s) sin validar.`)
  if (!auditoria.fecha_inicio_real || !auditoria.fecha_fin_real) avisos.push('Faltan las fechas reales de la auditoría: la Ficha Técnica las deja en blanco.')
  if (!revisados(auditoria).length) avisos.push('No registraste indicadores priorizados del proceso: la sección «Indicadores» dirá que no se registraron.')

  // 5. Contenido con la estructura del formato oficial y nueva versión
  const { data: ultima } = await admin.from('informes').select('version').eq('auditoria_id', auditoria.id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = (ultima?.version ?? 0) + 1
  const contenido = construirContenido({
    auditoria, perfil: p, hallazgos: lista, estadisticas, narrativa,
    generadoEn: new Date().toISOString(), version, avisos,
  })

  const { data: informe, error: errInforme } = await admin
    .from('informes')
    .insert({
      auditoria_id: auditoria.id,
      user_id: userId,
      version,
      resumen_ejecutivo: narrativa.observaciones, // la sección «Observaciones» es el resumen general del formato
      conclusiones: narrativa.conclusiones,
      recomendaciones: null, // la plantilla oficial ya no tiene recomendaciones (5/10/2026)
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
