import { useEffect, useState } from 'react'
import { supabase, mensajeError } from '../../lib/supabase'
import { Modal } from '../ui/Modal'
import { SkeletonTexto } from '../ui/Skeleton'
import { Badge } from '../ui/Badge'

/** Texto completo de un numeral normativo, leído de criterios_normativos. */
export function ModalCriterio({ criterioId, alCerrar }) {
  const [resultado, setResultado] = useState({ id: null, criterio: null, error: '' })

  useEffect(() => {
    if (!criterioId) return undefined
    let activo = true
    supabase
      .from('criterios_normativos')
      .select('id, documento_codigo, documento_titulo, numeral, titulo, contenido, idioma, parte')
      .eq('id', criterioId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (!activo) return
        setResultado({
          id: criterioId,
          criterio: data ?? null,
          error: err ? mensajeError(err) : data ? '' : 'Este criterio ya no está en la base normativa cargada.',
        })
      })
    return () => {
      activo = false
    }
  }, [criterioId])

  // Mientras llega la respuesta del criterio pedido, no se muestra el anterior
  const { criterio, error } = resultado.id === criterioId ? resultado : { criterio: null, error: '' }

  return (
    <Modal
      abierto={Boolean(criterioId)}
      alCerrar={alCerrar}
      titulo={criterio ? `${criterio.documento_codigo}${criterio.numeral ? ` · numeral ${criterio.numeral}` : ''}` : 'Criterio normativo'}
    >
      {error && <p className="text-sm text-nc-texto">{error}</p>}
      {!criterio && !error && <SkeletonTexto lineas={6} />}
      {criterio && (
        <article>
          <h3 className="font-semibold text-tinta-900">{criterio.titulo}</h3>
          <p className="mt-0.5 text-xs text-tinta-500">
            {criterio.documento_titulo}
            {criterio.parte > 1 ? ` · fragmento ${criterio.parte}` : ''}
          </p>
          {criterio.idioma === 'en' && (
            <Badge tono="neutro" className="mt-2">Texto original en inglés</Badge>
          )}
          <div className="mt-4 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-tinta-700">{criterio.contenido}</div>
        </article>
      )}
    </Modal>
  )
}
