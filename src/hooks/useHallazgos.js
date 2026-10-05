import { supabase, mensajeError } from '../lib/supabase'
import { useConsulta } from './useConsulta'

export const COLUMNAS_HALLAZGO =
  'id, auditoria_id, consecutivo, entrada_auditor, clasificacion, justificacion, hallazgo_corregido, criterio_requisito, evidencia, severidad, estado, editado_por_usuario, modelo_ia, prompt_version, criterios_citados, avisos, riesgo_descripcion, riesgo_dimension, riesgo_probabilidad, riesgo_impacto, riesgo_justificacion, controles, evidencia_archivo, evidencia_anexos, nota_validacion, creado_en, actualizado_en'

/** Hallazgos de una auditoría, por consecutivo. */
export function useHallazgos(auditoriaId) {
  return useConsulta(
    () => supabase.from('hallazgos').select(COLUMNAS_HALLAZGO).eq('auditoria_id', auditoriaId).order('consecutivo'),
    [auditoriaId],
    { inicial: [] },
  )
}

/** Actualiza campos de un hallazgo. El trigger marca editado_por_usuario si cambian los campos redactados. */
export async function actualizarHallazgo(id, cambios) {
  const { data, error } = await supabase.from('hallazgos').update(cambios).eq('id', id).select(COLUMNAS_HALLAZGO).single()
  return { data, error: error ? mensajeError(error) : '' }
}

/** Copia un hallazgo como nuevo, sin procedencia de IA (la RLS lo exige así). */
export async function duplicarHallazgo(h, userId) {
  const { data, error } = await supabase
    .from('hallazgos')
    .insert({
      auditoria_id: h.auditoria_id,
      user_id: userId,
      entrada_auditor: h.entrada_auditor,
      clasificacion: h.clasificacion,
      justificacion: h.justificacion,
      hallazgo_corregido: h.hallazgo_corregido,
      criterio_requisito: h.criterio_requisito,
      evidencia: h.evidencia,
      severidad: h.severidad,
      criterios_citados: h.criterios_citados,
      riesgo_descripcion: h.riesgo_descripcion,
      riesgo_dimension: h.riesgo_dimension,
      riesgo_probabilidad: h.riesgo_probabilidad,
      riesgo_impacto: h.riesgo_impacto,
      riesgo_justificacion: h.riesgo_justificacion,
      controles: h.controles ?? [],
      // La copia no tiene procedencia de IA: el PDF analizado del original pasa a sus PDF registrados
      evidencia_anexos: [h.evidencia_archivo, ...(h.evidencia_anexos ?? [])].filter(Boolean)
        .map(({ nombre, paginas, sha256 }) => ({ nombre, paginas, sha256 })),
      estado: 'editado',
      editado_por_usuario: true,
    })
    .select(COLUMNAS_HALLAZGO)
    .single()
  return { data, error: error ? mensajeError(error) : '' }
}
