import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabaseSinConfigurar } from '../lib/supabase'
import { fuerzaClave } from '../lib/esquemas'
import { LayoutPublico } from '../components/layout/LayoutPublico'
import { AvisoConfiguracion } from '../components/layout/AvisoConfiguracion'
import { Boton, Campo } from '../components/ui'

/** Pide el enlace de recuperación y, al volver desde el correo (PASSWORD_RECOVERY), fija la contraseña nueva. */
export default function RecuperarClave() {
  const { solicitarRecuperacion, cambiarClave, enRecuperacion } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [estado, setEstado] = useState({ enviando: false, error: '', enviado: false })

  if (supabaseSinConfigurar) return <AvisoConfiguracion />

  if (enRecuperacion) {
    const errorLocal = clave && clave.length < 8 ? 'La contraseña debe tener al menos 8 caracteres' : confirmacion && clave !== confirmacion ? 'Las contraseñas no coinciden' : ''
    return (
      <LayoutPublico titulo="Nueva contraseña" descripcion="Escribe la contraseña que usarás desde ahora.">
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (clave.length < 8 || clave !== confirmacion) return
            setEstado({ enviando: true, error: '' })
            const r = await cambiarClave(clave)
            if (r.error) setEstado({ enviando: false, error: r.error })
            else navigate('/app', { replace: true })
          }}
        >
          {estado.error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{estado.error}</p>}
          <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" required value={clave} onChange={(e) => setClave(e.target.value)}
            ayuda={clave ? `Seguridad: ${['muy débil', 'débil', 'aceptable', 'buena', 'fuerte'][fuerzaClave(clave)]}` : 'Mínimo 8 caracteres.'} />
          <Campo etiqueta="Confirma la contraseña" type="password" autoComplete="new-password" required value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)} error={errorLocal} />
          <Boton type="submit" cargando={estado.enviando} className="w-full">Guardar contraseña</Boton>
        </form>
      </LayoutPublico>
    )
  }

  return (
    <LayoutPublico titulo="Recuperar contraseña" descripcion="Te enviaremos un enlace para crear una contraseña nueva.">
      {estado.enviado ? (
        <p className="text-sm text-tinta-700" role="status">
          Si <strong>{email}</strong> tiene una cuenta en halla, recibirás un correo con el enlace en unos minutos.
        </p>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!/^\S+@\S+\.\S+$/.test(email)) return setEstado({ enviando: false, error: 'Escribe un correo válido' })
            setEstado({ enviando: true, error: '' })
            const r = await solicitarRecuperacion(email.trim().toLowerCase())
            setEstado({ enviando: false, error: r.error ?? '', enviado: !r.error })
          }}
        >
          {estado.error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{estado.error}</p>}
          <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Boton type="submit" cargando={estado.enviando} className="w-full">Enviar enlace</Boton>
        </form>
      )}
      <Link to="/ingresar" className="enlace mt-6 inline-block text-sm">Volver a ingresar</Link>
    </LayoutPublico>
  )
}
