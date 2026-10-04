import { useWatch } from 'react-hook-form'
import { Network, Workflow } from 'lucide-react'
import { PROCESOS, SISTEMAS } from '../../lib/catalogos'
import { cx } from '../../lib/cx'
import { Campo } from '../ui/Campo'
import { Select } from '../ui/Select'

/** Nombre, cédula, celular y cargo del auditor. Recibe los métodos de react-hook-form. */
export function CamposAuditor({ register, errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre completo" autoComplete="name" required error={errors.nombre_completo?.message} className="sm:col-span-2" {...register('nombre_completo')} />
      <Campo etiqueta="Número de cédula" inputMode="numeric" autoComplete="off" required ayuda="Solo números; puedes escribirla con puntos." error={errors.cedula?.message} {...register('cedula')} />
      <Campo etiqueta="Número de celular" type="tel" inputMode="tel" autoComplete="tel-national" required ayuda="10 dígitos; el prefijo +57 se quita solo." error={errors.celular?.message} {...register('celular')} />
      <Campo etiqueta="Cargo" autoComplete="organization-title" required error={errors.cargo?.message} className="sm:col-span-2" {...register('cargo')} />
    </div>
  )
}

/** Persona del equipo auditor (siempre una persona adicional). */
export function CamposEquipo({ register, errors }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-tinta-900">Equipo auditor</legend>
      <p className="mt-1 text-xs text-tinta-500">El equipo auditor corresponde siempre a una persona adicional.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del equipo auditor" required error={errors.equipo_auditor_nombre?.message} {...register('equipo_auditor_nombre')} />
        <Campo etiqueta="Cargo del equipo auditor" required error={errors.equipo_auditor_cargo?.message} {...register('equipo_auditor_cargo')} />
      </div>
    </fieldset>
  )
}

const OPCIONES_ALCANCE = [
  { valor: 'PROCESOS', titulo: 'Procesos', descripcion: `Auditas uno de los ${PROCESOS.length} procesos del hospital.`, icono: Workflow },
  { valor: 'SISTEMAS', titulo: 'Sistemas', descripcion: `Auditas uno de los ${SISTEMAS.length} sistemas de gestión.`, icono: Network },
]

/**
 * Alcance con dos tarjetas seleccionables. Al elegir, aparece el selector correspondiente;
 * el selector contrario se limpia y se oculta (nunca ambos ni ninguno).
 */
export function CamposAlcance({ register, errors, control, setValue, nombreGrupo = 'alcance' }) {
  const alcance = useWatch({ control, name: 'alcance' })
  // Al elegir un alcance se limpia el selector contrario: nunca quedan ambos
  const campoAlcance = register('alcance', {
    onChange: (e) => setValue(e.target.value === 'PROCESOS' ? 'sistema' : 'proceso', '', { shouldValidate: false }),
  })

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-tinta-900">Alcance</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-describedby={errors.alcance ? `${nombreGrupo}-error` : undefined}>
        {OPCIONES_ALCANCE.map(({ valor, titulo, descripcion, icono: Icono }) => (
          <label
            key={valor}
            className={cx(
              'relative flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-halla-500',
              alcance === valor ? 'border-halla-600 bg-halla-50' : 'border-tinta-100 bg-white hover:border-tinta-300',
            )}
          >
            <input type="radio" value={valor} className="sr-only" {...campoAlcance} />
            <Icono className={cx('mt-0.5 size-5 shrink-0', alcance === valor ? 'text-halla-700' : 'text-tinta-300')} aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-tinta-900">{titulo}</span>
              <span className="block text-xs text-tinta-500">{descripcion}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.alcance && (
        <p id={`${nombreGrupo}-error`} className="mt-1.5 text-sm font-medium text-nc-texto" role="alert">{errors.alcance.message}</p>
      )}
      {alcance === 'PROCESOS' && (
        <Select etiqueta="Proceso" opciones={PROCESOS} marcador="Elige el proceso" required className="mt-4" error={errors.proceso?.message} {...register('proceso')} />
      )}
      {alcance === 'SISTEMAS' && (
        <Select etiqueta="Sistema" opciones={SISTEMAS} marcador="Elige el sistema" required className="mt-4" error={errors.sistema?.message} {...register('sistema')} />
      )}
    </fieldset>
  )
}
