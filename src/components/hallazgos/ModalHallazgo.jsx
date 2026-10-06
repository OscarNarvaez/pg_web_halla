import { useEffect, useId } from 'react'
import { ESTADOS_HALLAZGO } from '../../lib/catalogos'
import { fechaHora } from '../../lib/formato'
import { faltantesParaValidar } from '../../lib/riesgo'
import { Modal } from '../ui/Modal'
import { Boton } from '../ui/Boton'
import { TarjetaResultado } from './TarjetaResultado'

// Sección donde se completa lo que falta para validar: el riesgo o, si solo faltan controles, los controles
const seccionFaltante = (faltan) => (faltan.every((f) => f.includes('control')) ? 'controles' : 'riesgo')

/**
 * Ver y editar un hallazgo guardado. Cada cambio se guarda al aplicarlo.
 * Con `irAFaltante` (se intentó validar y faltaba algo) se abre directamente en la sección por completar.
 */
export function ModalHallazgo({ hallazgo, alCerrar, alCambiar, alValidar, guardando, conteo, irAFaltante = false }) {
  const id = useId()
  const ids = { riesgo: `${id}-riesgo`, controles: `${id}-controles` }
  const faltan = hallazgo ? faltantesParaValidar(hallazgo) : []
  const irA = (comportamiento) => document.getElementById(ids[seccionFaltante(faltan)])?.scrollIntoView({ behavior: comportamiento, block: 'start' })

  useEffect(() => {
    if (irAFaltante && hallazgo?.id) irA('auto')
    // Solo al abrir: después el auditor se mueve por el hallazgo libremente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irAFaltante, hallazgo?.id])

  if (!hallazgo) return <Modal abierto={false} alCerrar={alCerrar} titulo="" />
  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      ancho="xl"
      titulo={`Hallazgo H-${String(hallazgo.consecutivo).padStart(2, '0')} · ${ESTADOS_HALLAZGO[hallazgo.estado]}`}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>Cerrar</Boton>
          {hallazgo.estado !== 'confirmado' && hallazgo.estado !== 'descartado' && (
            <Boton onClick={() => alValidar(hallazgo)} cargando={guardando} disabled={faltan.length > 0}
              title={faltan.length ? `Para validarlo falta ${faltan.join(', ')}` : undefined}>
              Validar hallazgo
            </Boton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {hallazgo.estado === 'cambios_sugeridos' && hallazgo.nota_validacion && (
          <p className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
            <span className="font-semibold">Cambios sugeridos:</span> {hallazgo.nota_validacion}
          </p>
        )}
        {faltan.length > 0 && hallazgo.estado !== 'descartado' && (
          <p role="status" className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
            Para validarlo falta {faltan.join(', ')}.{' '}
            <button type="button" onClick={() => irA('smooth')} className="font-semibold underline">Completar ahora</button>
          </p>
        )}
        <TarjetaResultado hallazgo={hallazgo} alCambiar={alCambiar} conteo={conteo} ids={ids} deshabilitado={guardando || hallazgo.estado === 'descartado'} />
        <section className="rounded-lg bg-tinta-50 p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-tinta-500">Texto original del auditor</h3>
          <p className="mt-2 whitespace-pre-wrap text-tinta-700">{hallazgo.entrada_auditor}</p>
          <p className="mt-3 text-xs text-tinta-500">
            {hallazgo.modelo_ia ? `Generado con ${hallazgo.modelo_ia} · prompt ${hallazgo.prompt_version}` : 'Copia creada por el auditor'} · creado {fechaHora(hallazgo.creado_en)}
            {hallazgo.editado_por_usuario && ' · editado por el auditor'}
          </p>
        </section>
      </div>
    </Modal>
  )
}
