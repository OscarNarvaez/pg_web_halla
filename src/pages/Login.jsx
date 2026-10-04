import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../contexts/AuthContext'
import { esquemaIngreso } from '../lib/esquemas'
import { supabaseSinConfigurar } from '../lib/supabase'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { AvisoConfiguracion } from '../components/layout/AvisoConfiguracion'
import { Boton, Campo } from '../components/ui'

export default function Login() {
  const { ingresar, sesion, cargando } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from?.pathname ?? '/app'
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(esquemaIngreso) })

  if (supabaseSinConfigurar) return <AvisoConfiguracion />
  if (!cargando && sesion) return <Navigate to={destino} replace />

  const enviar = async ({ email, password }) => {
    setError('')
    const r = await ingresar(email, password)
    if (r.error) setError(r.error)
    else navigate(destino, { replace: true })
  }

  return (
    <LayoutPublico titulo="Ingresar" descripcion="Accede con tu correo institucional o personal.">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{error}</p>}
        <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
        <Boton type="submit" cargando={isSubmitting} className="w-full">Ingresar</Boton>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm">
        <Link to="/recuperar" className="enlace">Olvidé mi contraseña</Link>
        <Link to="/registro" className="enlace">Crear una cuenta</Link>
      </div>
    </LayoutPublico>
  )
}
