import { ESTADOS_HALLAZGO } from '../../lib/catalogos'
import { fechaHora } from '../../lib/formato'
import { Modal } from '../ui/Modal'
import { Boton } from '../ui/Boton'
import { TarjetaResultado } from './TarjetaResultado'

/** Ver y editar un hallazgo guardado. Cada cambio se guarda al aplicarlo. */
export function ModalHallazgo({ hallazgo, alCerrar, alCambiar, alConfirmar, guardando }) {
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
            <Boton onClick={() => alConfirmar(hallazgo)} cargando={guardando}>Confirmar hallazgo</Boton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <TarjetaResultado hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={guardando || hallazgo.estado === 'descartado'} />
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
