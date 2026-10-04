import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, MailCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { MINIMO_CLAVE, esquemaRegistro, fuerzaClave, integranteVacio } from '../lib/esquemas'
import { supabaseSinConfigurar } from '../lib/supabase'
import { cx } from '../lib/cx'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { AvisoConfiguracion } from '../components/layout/AvisoConfiguracion'
import { CamposAlcance, CamposAuditor, CamposEquipo } from '../components/perfil/CamposPerfil'
import { AutorizacionDatos } from '../components/perfil/AutorizacionDatos'
import { ReenviarConfirmacion } from '../components/auth/ReenviarConfirmacion'
import { Boton, Campo, CampoClave } from '../components/ui'

const PASOS = [
  { titulo: 'Cuenta', campos: ['email', 'password', 'confirmacion'] },
  { titulo: 'Datos del auditor', campos: ['nombre_completo', 'cedula', 'celular', 'cargos'] },
  { titulo: 'Equipo y alcance', campos: ['equipo_auditor', 'alcance', 'proceso', 'sistema', 'acepto_tratamiento_datos'] },
]

const NIVELES = [
  { texto: 'Muy débil', clase: 'bg-nc-solido' },
  { texto: 'Débil', clase: 'bg-nc-solido' },
  { texto: 'Aceptable', clase: 'bg-obs-solido' },
  { texto: 'Buena', clase: 'bg-fort-solido' },
  { texto: 'Fuerte', clase: 'bg-fort-solido' },
]

function MedidorClave({ control }) {
  const clave = useWatch({ control, name: 'password' }) ?? ''
  const nivel = fuerzaClave(clave)
  if (!clave) return null
  return (
    <div className="-mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < nivel ? NIVELES[nivel].clase : 'bg-tinta-100')} />
        ))}
      </div>
      <p className="mt-1 text-xs text-tinta-500">Seguridad de la contraseña: {NIVELES[nivel].texto}</p>
    </div>
  )
}

function Progreso({ paso }) {
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Pasos del registro">
      {PASOS.map((p, i) => (
        <li key={p.titulo} className="flex flex-1 items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
          <span
            className={cx(
              'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
              i < paso ? 'bg-halla-700 text-white' : i === paso ? 'border-2 border-halla-700 text-halla-700' : 'border border-tinta-300 text-tinta-500',
            )}
          >
            {i < paso ? <Check className="size-4" aria-hidden="true" /> : i + 1}
          </span>
          <span className={cx('hidden text-xs font-medium sm:inline', i === paso ? 'text-tinta-900' : 'text-tinta-500')}>{p.titulo}</span>
          <span className="sr-only">{i < paso ? '(completado)' : i === paso ? '(paso actual)' : '(pendiente)'}</span>
          {i < PASOS.length - 1 && <span className="h-px flex-1 bg-tinta-100" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

export default function Registro() {
  const { registrar, sesion, cargando } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [confirmarCorreo, setConfirmarCorreo] = useState('')
  const { register, handleSubmit, trigger, control, setValue, getValues, setError: marcarError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(esquemaRegistro),
    mode: 'onTouched',
    defaultValues: { cargos: [], equipo_auditor: [integranteVacio()], alcance: undefined, proceso: '', sistema: '', acepto_tratamiento_datos: false },
  })

  if (supabaseSinConfigurar) return <AvisoConfiguracion />
  if (!cargando && sesion && !confirmarCorreo) return <Navigate to="/app" replace />

  if (confirmarCorreo) {
    return (
      <LayoutPublico titulo="Revisa tu correo">
        <div className="flex gap-3 text-sm text-tinta-700">
          <MailCheck className="size-6 shrink-0 text-halla-600" aria-hidden="true" />
          <p>
            Si <strong>{confirmarCorreo}</strong> no tenía una cuenta, le enviamos un enlace de confirmación. Ábrelo para
            activar tu cuenta y luego ingresa; un administrador debe aprobarla antes de que puedas usar la plataforma.
            Si no ves el correo, revisa la carpeta de correo no deseado.
          </p>
        </div>
        <ReenviarConfirmacion email={confirmarCorreo} className="mt-6" />
        <Link to="/ingresar" className="enlace mt-6 inline-block text-sm">Ir a ingresar</Link>
      </LayoutPublico>
    )
  }

  const siguiente = async () => {
    const valido = await trigger(PASOS[paso].campos)
    // zod no evalúa la coincidencia de contraseñas mientras haya campos de otros pasos vacíos
    if (paso === 0 && valido && getValues('password') !== getValues('confirmacion')) {
      marcarError('confirmacion', { type: 'manual', message: 'Las contraseñas no coinciden' })
      return
    }
    if (valido) setPaso((p) => p + 1)
  }

  // Si al enviar queda un error en un paso anterior, se vuelve a ese paso para que se vea
  const alInvalido = (errores) => {
    const pasoConError = PASOS.findIndex((p) => p.campos.some((c) => errores[c]))
    if (pasoConError >= 0 && pasoConError !== paso) setPaso(pasoConError)
  }

  const enviar = async (datos) => {
    setError('')
    const r = await registrar(datos)
    if (r.error) {
      setError(r.error)
      if (/correo/i.test(r.error)) setPaso(0)
      if (/cédula/i.test(r.error)) setPaso(1)
      return
    }
    if (r.confirmarCorreo) setConfirmarCorreo(getValues('email'))
    else navigate('/app', { replace: true })
  }

  return (
    <LayoutPublico titulo="Crear cuenta de auditor" descripcion="Tres pasos. Tus datos aparecen en las firmas del informe." ancho="max-w-xl">
      <Progreso paso={paso} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (paso < PASOS.length - 1) siguiente()
          else handleSubmit(enviar, alInvalido)(e)
        }}
        noValidate
        className="space-y-5"
      >
        {error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{error}</p>}

        {paso === 0 && (
          <>
            <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
            <CampoClave etiqueta="Contraseña" autoComplete="new-password" required ayuda={`Mínimo ${MINIMO_CLAVE} caracteres, con mayúscula, minúscula y número.`} error={errors.password?.message} {...register('password')} />
            <MedidorClave control={control} />
            <CampoClave etiqueta="Confirma la contraseña" autoComplete="new-password" required error={errors.confirmacion?.message} {...register('confirmacion')} />
          </>
        )}
        {paso === 1 && <CamposAuditor register={register} errors={errors} control={control} />}
        {paso === 2 && (
          <>
            <CamposEquipo register={register} errors={errors} control={control} />
            <CamposAlcance register={register} errors={errors} control={control} setValue={setValue} />
            <AutorizacionDatos register={register} error={errors.acepto_tratamiento_datos?.message} />
          </>
        )}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          {paso > 0 ? (
            <Boton variante="secundario" onClick={() => setPaso((p) => p - 1)}>Atrás</Boton>
          ) : (
            <Link to="/ingresar" className="enlace self-center text-sm">Ya tengo cuenta</Link>
          )}
          <Boton type="submit" cargando={isSubmitting}>{paso < PASOS.length - 1 ? 'Continuar' : 'Crear cuenta'}</Boton>
        </div>
      </form>
    </LayoutPublico>
  )
}
