import { useId } from 'react'
import { INSTITUCION } from '../../lib/catalogos'

/**
 * Autorización de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013).
 * Texto base: debe validarlo el área jurídica del hospital y enlazar la política oficial de tratamiento.
 */
export function AutorizacionDatos({ register, error }) {
  const id = useId()
  return (
    <div className="rounded-lg border border-tinta-100 bg-tinta-50 p-4 text-sm">
      <details className="group">
        <summary className="cursor-pointer font-medium text-tinta-900">Tratamiento de datos personales</summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-tinta-700">
          <p>
            El {INSTITUCION.nombre}, como responsable, tratará tu nombre, cédula, celular, cargo y correo, así como la
            información de las auditorías que registres, con la única finalidad de gestionar las auditorías internas
            de la institución: identificarte como auditor, firmar los informes y conservar la trazabilidad de los hallazgos.
          </p>
          <p>
            Para clasificar y redactar los hallazgos, el texto que escribes se envía a un servicio de inteligencia
            artificial de un tercero (Google). Antes de enviarlo, el sistema retira nombres, números de documento y de
            historia clínica, teléfonos y correos; aun así, no escribas datos de pacientes.
          </p>
          <p>
            Como titular puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, y revocar esta
            autorización, a través del administrador de la plataforma o de los canales de protección de datos del hospital.
          </p>
        </div>
      </details>
      <div className="mt-3 flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-4 rounded border-tinta-300 text-halla-700 focus:ring-halla-500"
          {...register('acepto_tratamiento_datos')}
        />
        <label htmlFor={id} className="text-tinta-900">
          Autorizo el tratamiento de mis datos personales en los términos anteriores (Ley 1581 de 2012).
          <span className="text-nc-texto" aria-hidden="true"> *</span>
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-nc-texto">{error}</p>
      )}
    </div>
  )
}
