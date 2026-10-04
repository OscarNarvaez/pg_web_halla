import { Controller, useController, useFieldArray, useWatch } from 'react-hook-form'
import { Building2, Network, Trash2, UserPlus, Users, Workflow } from 'lucide-react'
import { CARGOS_EQUIPO, CARGOS_LIDER, MAX_CARGOS, MAX_EQUIPO, PROCESOS, SISTEMAS, TIPOS_EVALUADOR } from '../../lib/catalogos'
import { integranteVacio } from '../../lib/esquemas'
import { cx } from '../../lib/cx'
import { Boton } from '../ui/Boton'
import { Campo } from '../ui/Campo'
import { Select } from '../ui/Select'
import { SelectorMultiple } from '../ui/SelectorMultiple'

/** Cargos de una lista cerrada (uno o varios) conectados a react-hook-form. */
function CampoCargos({ control, name, etiqueta, opciones, ayuda }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectorMultiple
          ref={field.ref}
          etiqueta={etiqueta}
          opciones={opciones}
          valor={field.value ?? []}
          // Marcar el campo como tocado al elegir: el error desaparece en cuanto hay un cargo, sin esperar a cerrar la lista
          alCambiar={(valor) => { field.onChange(valor); field.onBlur() }}
          alSalir={field.onBlur}
          maximo={MAX_CARGOS}
          marcador="Elige uno o varios cargos"
          nombreOpcion="cargo"
          ayuda={ayuda}
          error={fieldState.error?.message}
          required
        />
      )}
    />
  )
}

const OPCIONES_EVALUADOR = [
  { valor: 'AUDITORES_INTERNOS', descripcion: 'Trabajas en el hospital y auditas sus procesos o sistemas.', icono: Building2 },
  { valor: 'AUDITORES_EXTERNOS', descripcion: 'Auditas al hospital desde otra entidad o como contratista.', icono: Users },
]

/**
 * Grupo de auditores al que pertenece (el «Evaluador» de la Ficha Técnica del informe). Se valida al elegir: así el
 * mensaje de error desaparece en ese momento y no al salir del campo, que movería el formulario bajo el siguiente clic.
 */
function CampoEvaluador({ errors, control }) {
  const { field } = useController({ control, name: 'tipo_evaluador' })
  const elegido = field.value
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium text-tinta-700">
        ¿A qué grupo de auditores perteneces? <span className="text-nc-texto" aria-hidden="true">*</span>
      </legend>
      <p className="mt-0.5 text-xs text-tinta-500">Aparece como «Evaluador» en la Ficha Técnica del informe.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2" aria-describedby={errors.tipo_evaluador ? 'tipo_evaluador-error' : undefined}>
        {OPCIONES_EVALUADOR.map(({ valor, descripcion, icono: Icono }) => (
          <label
            key={valor}
            className={cx(
              'relative flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-halla-500',
              elegido === valor ? 'border-halla-600 bg-halla-50' : 'border-tinta-100 bg-white hover:border-tinta-300',
            )}
          >
            <input
              type="radio"
              name={field.name}
              value={valor}
              checked={elegido === valor}
              ref={valor === OPCIONES_EVALUADOR[0].valor ? field.ref : undefined}
              onChange={() => { field.onChange(valor); field.onBlur() }}
              className="sr-only"
            />
            <Icono className={cx('mt-0.5 size-5 shrink-0', elegido === valor ? 'text-halla-700' : 'text-tinta-300')} aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold text-tinta-900">{TIPOS_EVALUADOR[valor]}</span>
              <span className="block text-xs text-tinta-500">{descripcion}</span>
            </span>
          </label>
        ))}
      </div>
      {errors.tipo_evaluador && (
        <p id="tipo_evaluador-error" className="mt-1.5 text-sm font-medium text-nc-texto" role="alert">{errors.tipo_evaluador.message}</p>
      )}
    </fieldset>
  )
}

/** Nombre, cédula, celular, grupo de evaluador y cargos del auditor líder. Recibe los métodos de react-hook-form. */
export function CamposAuditor({ register, errors, control }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre completo" autoComplete="name" required error={errors.nombre_completo?.message} className="sm:col-span-2" {...register('nombre_completo')} />
      <Campo etiqueta="Número de cédula" inputMode="numeric" autoComplete="off" required ayuda="Solo números; puedes escribirla con puntos." error={errors.cedula?.message} {...register('cedula')} />
      <Campo etiqueta="Número de celular" type="tel" inputMode="tel" autoComplete="tel-national" required ayuda="10 dígitos; el prefijo +57 se quita solo." error={errors.celular?.message} {...register('celular')} />
      <CampoEvaluador errors={errors} control={control} />
      <div className="sm:col-span-2">
        <CampoCargos control={control} name="cargos" etiqueta="Cargos" opciones={CARGOS_LIDER}
          ayuda={`Elige uno o varios de la lista de líderes (hasta ${MAX_CARGOS}). Aparecen en tu firma del informe.`} />
      </div>
    </div>
  )
}

/** Equipo auditor: una o varias personas (hasta MAX_EQUIPO), cada una con uno o varios cargos. */
export function CamposEquipo({ register, errors, control }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'equipo_auditor' })
  const errorLista = errors.equipo_auditor?.message ?? errors.equipo_auditor?.root?.message
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-tinta-900">Equipo auditor</legend>
      <p className="mt-1 text-xs text-tinta-500">
        Las personas que te acompañan en la auditoría: al menos una y hasta {MAX_EQUIPO}. Cada una firma el informe.
      </p>
      <ol className="mt-3 space-y-3">
        {fields.map((campo, i) => (
          <li key={campo.id} className="rounded-lg border border-tinta-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-tinta-700">Persona {i + 1}</p>
              {fields.length > 1 && (
                <Boton variante="fantasma" tamano="sm" icono={Trash2} onClick={() => remove(i)} aria-label={`Quitar a la persona ${i + 1} del equipo auditor`}>
                  Quitar
                </Boton>
              )}
            </div>
            <div className="grid gap-4">
              <Campo etiqueta={`Nombre de la persona ${i + 1}`} required error={errors.equipo_auditor?.[i]?.nombre?.message} {...register(`equipo_auditor.${i}.nombre`)} />
              <CampoCargos control={control} name={`equipo_auditor.${i}.cargos`} etiqueta={`Cargos de la persona ${i + 1}`} opciones={CARGOS_EQUIPO} />
            </div>
          </li>
        ))}
      </ol>
      {errorLista && <p className="mt-1.5 text-sm font-medium text-nc-texto" role="alert">{errorLista}</p>}
      <Boton variante="secundario" tamano="sm" icono={UserPlus} className="mt-3" onClick={() => append(integranteVacio())} disabled={fields.length >= MAX_EQUIPO}>
        Agregar otra persona al equipo
      </Boton>
      {fields.length >= MAX_EQUIPO && <p className="mt-1 text-xs text-tinta-500">El equipo auditor admite como máximo {MAX_EQUIPO} personas.</p>}
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
