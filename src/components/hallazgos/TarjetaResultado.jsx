import { CLASIFICACIONES, TONOS } from '../../lib/catalogos'
import { PasoClasificacion } from './asistente/PasoClasificacion'
import { PasoControles } from './asistente/PasoControles'
import { PasoRedaccion } from './asistente/PasoRedaccion'
import { PasoRequisito } from './asistente/PasoRequisito'
import { PasoRiesgo } from './asistente/PasoRiesgo'

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-3 border-t border-tinta-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-halla-700">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * Hallazgo completo con las mismas secciones del asistente (clasificación, redacción, requisito, riesgo y
 * controles), editables en el sitio. Se usa al ver un hallazgo guardado desde el detalle o la matriz.
 * La clasificación la decidió la IA; el auditor solo puede corregirla después, de forma explícita.
 */
export function TarjetaResultado({ hallazgo, alCambiar, umbrales, conteo, deshabilitado = false }) {
  const tono = CLASIFICACIONES[hallazgo.clasificacion]?.tono
  return (
    <article
      className="space-y-5 overflow-hidden rounded-lg border border-tinta-100 bg-white p-5 shadow-sm"
      style={{ borderTop: `4px solid ${TONOS[tono]?.solido ?? '#9fb0bf'}` }}
    >
      <Seccion titulo="Clasificación"><PasoClasificacion hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={deshabilitado} /></Seccion>
      <Seccion titulo="Redacción"><PasoRedaccion hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={deshabilitado} /></Seccion>
      <Seccion titulo="Norma, numeral y requisito"><PasoRequisito hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={deshabilitado} /></Seccion>
      <Seccion titulo="Riesgo"><PasoRiesgo hallazgo={hallazgo} alCambiar={alCambiar} umbrales={umbrales} conteo={conteo} deshabilitado={deshabilitado} /></Seccion>
      <Seccion titulo="Controles"><PasoControles hallazgo={hallazgo} alCambiar={alCambiar} deshabilitado={deshabilitado} /></Seccion>
    </article>
  )
}
