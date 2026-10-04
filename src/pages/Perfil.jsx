import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { aFilaAlcance, esquemaPerfil, integranteVacio, perfilIncompleto } from '../lib/esquemas'
import { fechaHora, formatearCedula } from '../lib/formato'
import { Encabezado } from '../components/layout/Encabezado'
import { CamposAlcance, CamposAuditor, CamposEquipo } from '../components/perfil/CamposPerfil'
import { Badge, Boton, Tarjeta } from '../components/ui'

/** Valores del formulario a partir del perfil guardado (un perfil anterior puede no tener cargos ni equipo). */
const valoresDe = (p) => ({
  ...p,
  proceso: p.proceso ?? '',
  sistema: p.sistema ?? '',
  tipo_evaluador: p.tipo_evaluador ?? undefined,
  cargos: p.cargos ?? [],
  equipo_auditor: p.equipo_auditor?.length ? p.equipo_auditor : [integranteVacio()],
})

export default function Perfil() {
  const { perfil, usuario, guardarPerfil } = useAuth()
  const { notificar } = useToast()
  const [error, setError] = useState('')
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaPerfil),
    defaultValues: valoresDe(perfil),
  })

  const enviar = async (d) => {
    setError('')
    const r = await guardarPerfil({ ...d, ...aFilaAlcance(d) })
    if (r.error) return setError(r.error)
    reset(valoresDe(r.perfil))
    notificar('Perfil actualizado', 'exito')
  }

  return (
    <>
      <Encabezado titulo="Mi perfil" descripcion="Estos datos aparecen en la sección de equipo auditor y en las firmas del informe." />
      <form onSubmit={handleSubmit(enviar)} noValidate className="max-w-3xl space-y-6">
        {error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{error}</p>}
        {perfilIncompleto(perfil) && (
          <p className="rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
            Faltan datos que pide el informe: tu grupo de auditores (internos o externos), tus cargos de la lista
            institucional y los de cada persona de tu equipo auditor. Complétalos y guarda los cambios: sin ellos no se
            puede generar el informe.
          </p>
        )}
        <Tarjeta titulo="Cuenta">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-tinta-500">Correo</dt><dd className="font-medium text-tinta-900 break-all">{usuario?.email}</dd></div>
            <div><dt className="text-tinta-500">Cédula registrada</dt><dd className="font-medium text-tinta-900">{formatearCedula(perfil.cedula)}</dd></div>
            <div><dt className="text-tinta-500">Rol</dt><dd><Badge tono={perfil.rol === 'admin' ? 'marca' : 'neutro'}>{perfil.rol === 'admin' ? 'Administrador' : 'Auditor'}</Badge></dd></div>
            <div><dt className="text-tinta-500">Cuenta aprobada</dt><dd className="text-tinta-900">{perfil.aprobado_en ? fechaHora(perfil.aprobado_en) : 'Sí'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-tinta-500">Autorización de tratamiento de datos</dt><dd className="text-tinta-900">{perfil.acepto_tratamiento_datos_en ? `Otorgada el ${fechaHora(perfil.acepto_tratamiento_datos_en)} (Ley 1581 de 2012)` : 'No registrada'}</dd></div>
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Datos del auditor"><CamposAuditor register={register} errors={errors} control={control} /></Tarjeta>
        <Tarjeta titulo="Equipo auditor y alcance">
          <div className="space-y-6">
            <CamposEquipo register={register} errors={errors} control={control} />
            <CamposAlcance register={register} errors={errors} control={control} setValue={setValue} />
          </div>
        </Tarjeta>
        <div className="flex justify-end">
          <Boton type="submit" cargando={isSubmitting} disabled={!isDirty}>Guardar cambios</Boton>
        </div>
      </form>
    </>
  )
}
