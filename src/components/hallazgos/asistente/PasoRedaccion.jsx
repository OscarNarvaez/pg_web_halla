import { ESTRUCTURAS } from '../../../lib/catalogos'
import { CampoEditable } from '../CampoEditable'
import { AvisosHallazgo } from '../AvisosHallazgo'
import { AVISOS_DEL_PASO } from './pasos'

/** Paso 4: el hallazgo reescrito con la estructura obligatoria de su categoría, y la evidencia. */
export function PasoRedaccion({ hallazgo, alCambiar, deshabilitado = false }) {
  const estructura = ESTRUCTURAS[hallazgo.clasificacion]
  return (
    <div className="space-y-5">
      <AvisosHallazgo avisos={hallazgo.avisos} filtro={AVISOS_DEL_PASO.redaccion} />
      <div>
        <CampoEditable etiqueta="Hallazgo corregido" valor={hallazgo.hallazgo_corregido} destacado deshabilitado={deshabilitado} minimo={20}
          alGuardar={(v) => alCambiar({ hallazgo_corregido: v })} />
        {estructura && (
          <p className="mt-2 text-xs text-tinta-500">
            Estructura aplicada: <span className="font-medium text-tinta-700">{estructura.formula}</span>
          </p>
        )}
      </div>
      <CampoEditable etiqueta="Evidencia" valor={hallazgo.evidencia} deshabilitado={deshabilitado} minimo={5}
        alGuardar={(v) => alCambiar({ evidencia: v })} />
    </div>
  )
}
