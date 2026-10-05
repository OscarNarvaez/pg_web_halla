import { problemasDeEstructura } from '../../../lib/estructura'
import { CampoEditable } from '../CampoEditable'
import { EvidenciaEditable } from '../EvidenciaEditable'
import { EstructuraRedaccion } from '../EstructuraRedaccion'
import { AvisosHallazgo } from '../AvisosHallazgo'
import { AVISOS_DEL_PASO } from './pasos'

// El aviso guardado «no se pudo verificar la estructura» lo reemplaza la verificación en vivo, que sigue cada edición
const AVISO_ESTRUCTURA = /^Revisa la redacción: no se pudo verificar/

/**
 * Paso 4: el hallazgo reescrito con la fórmula obligatoria de su categoría, y la evidencia (con carga de PDF).
 * La fórmula se verifica en vivo: también después de editar el texto o de corregir la clasificación.
 */
export function PasoRedaccion({ hallazgo, alCambiar, deshabilitado = false }) {
  const problemas = problemasDeEstructura(hallazgo.clasificacion, hallazgo.hallazgo_corregido, hallazgo.criterios_citados ?? [])
  return (
    <div className="space-y-5">
      <AvisosHallazgo avisos={(hallazgo.avisos ?? []).filter((a) => !AVISO_ESTRUCTURA.test(a))} filtro={AVISOS_DEL_PASO.redaccion} />
      <div>
        <CampoEditable etiqueta="Hallazgo corregido" valor={hallazgo.hallazgo_corregido} destacado deshabilitado={deshabilitado} minimo={20}
          alGuardar={(v) => alCambiar({ hallazgo_corregido: v })} />
        <EstructuraRedaccion clasificacion={hallazgo.clasificacion} problemas={problemas} />
      </div>
      <EvidenciaEditable hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={deshabilitado} />
    </div>
  )
}
