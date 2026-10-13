import { supabase } from '../lib/supabase'
import { useConsulta } from './useConsulta'

const COLUMNAS_LISTA = 'id, codigo, titulo, alcance, proceso, sistema, estado, fecha_inicio, fecha_fin, creado_en, actualizado_en, hallazgos(clasificacion, estado)'

/** Auditorías del usuario con el conteo de hallazgos no descartados por clasificación. */
export function useAuditorias() {
  return useConsulta(
    async () => {
      const { data, error } = await supabase.from('auditorias').select(COLUMNAS_LISTA).order('creado_en', { ascending: false })
      if (error) return { data: null, error }
      return {
        data: data.map(({ hallazgos, ...a }) => {
          const vigentes = (hallazgos ?? []).filter((h) => h.estado !== 'descartado')
          const conteo = vigentes.reduce((acc, h) => ({ ...acc, [h.clasificacion]: (acc[h.clasificacion] ?? 0) + 1 }), {})
          return { ...a, total_hallazgos: vigentes.length, conteo }
        }),
        error: null,
      }
    },
    [],
    { inicial: [] },
  )
}

/** Una auditoría por id. */
export function useAuditoria(id) {
  return useConsulta(() => supabase.from('auditorias').select('*').eq('id', id).maybeSingle(), [id])
}

/**
 * Propone el siguiente código <sigla>-<año>-<consecutivo> a partir de las auditorías del usuario: AI (auditoría
 * interna) o AE (externa), según su grupo de auditores.
 */
export async function proponerCodigo(sigla = 'AI', anio = new Date().getFullYear()) {
  const { data } = await supabase.from('auditorias').select('codigo').like('codigo', `${sigla}-${anio}-%`)
  const max = (data ?? []).reduce((m, a) => Math.max(m, Number(a.codigo.split('-')[2]) || 0), 0)
  return `${sigla}-${anio}-${String(max + 1).padStart(3, '0')}`
}
