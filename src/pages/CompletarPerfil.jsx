import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../contexts/AuthContext'
import { esquemaCompletarPerfil, aFilaAlcance } from '../lib/esquemas'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { CamposAlcance, CamposAuditor, CamposEquipo } from '../components/perfil/CamposPerfil'
import { AutorizacionDatos } from '../components/perfil/AutorizacionDatos'
import { Boton } from '../components/ui'

/** Se muestra cuando hay sesión pero no perfil (el trigger y el fallback no pudieron crearlo). */
export default function CompletarPerfil() {
  const { usuario, guardarPerfil, errorPerfil, salir } = useAuth()
  const [error, setError] = useState('')
  const meta = usuario?.user_metadata ?? {}
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(esquemaCompletarPerfil),
    defaultValues: {
      nombre_completo: meta.nombre_completo ?? '', cedula: meta.cedula ?? '', celular: meta.celular ?? '', cargo: meta.cargo ?? '',
      equipo_auditor_nombre: meta.equipo_auditor_nombre ?? '', equipo_auditor_cargo: meta.equipo_auditor_cargo ?? '',
      alcance: meta.alcance || undefined, proceso: meta.proceso ?? '', sistema: meta.sistema ?? '',
      acepto_tratamiento_datos: meta.acepto_tratamiento_datos === 'true',
    },
  })

  const enviar = async (d) => {
    setError('')
    const r = await guardarPerfil({ ...d, ...aFilaAlcance(d), acepto_tratamiento_datos: d.acepto_tratamiento_datos })
    if (r.error) setError(r.error)
  }

  return (
    <LayoutPublico titulo="Completa tu perfil de auditor" descripcion="Tus datos aparecen en las firmas del informe de auditoría." ancho="max-w-xl">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-6">
        {(error || errorPerfil) && (
          <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{error || errorPerfil}</p>
        )}
        <CamposAuditor register={register} errors={errors} />
        <CamposEquipo register={register} errors={errors} />
        <CamposAlcance register={register} errors={errors} control={control} setValue={setValue} />
        <AutorizacionDatos register={register} error={errors.acepto_tratamiento_datos?.message} />
        <div className="flex flex-wrap justify-between gap-3">
          <Boton variante="fantasma" onClick={salir}>Salir</Boton>
          <Boton type="submit" cargando={isSubmitting}>Guardar perfil</Boton>
        </div>
      </form>
    </LayoutPublico>
  )
}
