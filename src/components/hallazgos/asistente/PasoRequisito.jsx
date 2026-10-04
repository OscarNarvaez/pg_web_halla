import { useEffect, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { MARCADOR_PENDIENTE } from '../../../lib/catalogos'
import { mensajeError, supabase } from '../../../lib/supabase'
import { CampoEditable } from '../CampoEditable'
import { AvisosHallazgo } from '../AvisosHallazgo'
import { AVISOS_DEL_PASO } from './pasos'
import { SkeletonTexto } from '../../ui/Skeleton'

/**
 * Paso 2: la norma, el numeral y el requisito que sustentan el hallazgo. El texto del requisito se lee de
 * criterios_normativos (la fuente única): la IA solo pudo citar criterios verificados de esa tabla.
 */
export function PasoRequisito({ hallazgo, alCambiar, deshabilitado = false }) {
  const citados = hallazgo.criterios_citados ?? []
  const clave = citados.map((c) => c.criterio_id).join(',')
  const [resultado, setResultado] = useState({ clave: null, criterios: [], error: '' })

  useEffect(() => {
    if (!clave) return undefined
    let activo = true
    supabase
      .from('criterios_normativos')
      .select('id, documento_codigo, documento_titulo, numeral, titulo, contenido, idioma')
      .in('id', clave.split(','))
      .then(({ data, error }) => {
        if (activo) setResultado({ clave, criterios: data ?? [], error: error ? mensajeError(error) : '' })
      })
    return () => {
      activo = false
    }
  }, [clave])

  const cargando = Boolean(clave) && resultado.clave !== clave
  const porId = new Map(resultado.criterios.map((c) => [c.id, c]))

  return (
    <div className="space-y-5">
      <AvisosHallazgo avisos={hallazgo.avisos} filtro={AVISOS_DEL_PASO.requisito} />
      {citados.length === 0 ? (
        <div className="rounded-lg border border-tinta-300 bg-tinta-50 p-4 text-sm text-tinta-700">
          <p className="font-mono text-xs">{MARCADOR_PENDIENTE}</p>
          <p className="mt-2">
            Ningún numeral de las normas cargadas sustenta este hallazgo de forma verificable, y la IA no inventa requisitos.
            Si conoces el requisito aplicable, escríbelo abajo en «Criterio / requisito».
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {citados.map((c) => {
            const criterio = porId.get(c.criterio_id)
            return (
              <li key={`${c.criterio_id}-${c.numeral}`} className="rounded-lg border border-halla-100 bg-white p-4">
                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-tinta-500">Norma</dt>
                  <dd className="text-tinta-900">
                    <span className="inline-flex items-center gap-1.5 font-semibold"><BookOpenText className="size-4 text-halla-600" aria-hidden="true" />{c.documento}</span>
                    {criterio?.documento_titulo && <span className="text-tinta-500"> · {criterio.documento_titulo}</span>}
                  </dd>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-tinta-500">Numeral</dt>
                  <dd className="text-tinta-900"><span className="font-semibold tabular-nums">{c.numeral ?? 'Sin numeral'}</span>{c.titulo && ` · ${c.titulo}`}</dd>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-tinta-500">Requisito</dt>
                  <dd>
                    {cargando && <SkeletonTexto lineas={3} />}
                    {!cargando && resultado.error && <p className="text-sm text-nc-texto">{resultado.error}</p>}
                    {!cargando && criterio && (
                      <>
                        <p className="max-h-56 overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-tinta-900">{criterio.contenido}</p>
                        {criterio.idioma === 'en' && <p className="mt-1 text-xs text-tinta-500">Texto original en inglés: la redacción del hallazgo lo cita en español.</p>}
                      </>
                    )}
                    {!cargando && !resultado.error && !criterio && <p className="text-sm italic text-tinta-500">Este criterio ya no está en la base normativa cargada.</p>}
                  </dd>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
      <CampoEditable
        etiqueta="Criterio / requisito"
        valor={hallazgo.criterio_requisito}
        deshabilitado={deshabilitado}
        alGuardar={(v) => alCambiar({ criterio_requisito: v })}
      />
    </div>
  )
}
