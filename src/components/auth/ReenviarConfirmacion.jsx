import { useEffect, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Boton } from '../ui/Boton'

const ESPERA_SEGUNDOS = 60 // igual a max_frequency de supabase/config.toml

/**
 * Reenvía el correo de confirmación del registro. El mensaje es el mismo exista o no la cuenta
 * (no revela qué correos están registrados) y hay una espera entre intentos.
 */
export function ReenviarConfirmacion({ email, className }) {
  const { reenviarConfirmacion } = useAuth()
  const [estado, setEstado] = useState({ enviando: false, mensaje: '', error: '' })
  const [espera, setEspera] = useState(0)

  const enEspera = espera > 0
  useEffect(() => {
    if (!enEspera) return undefined
    const t = setInterval(() => setEspera((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [enEspera])

  const reenviar = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email ?? '')) {
      setEstado({ enviando: false, mensaje: '', error: 'Escribe tu correo para poder reenviar la confirmación.' })
      return
    }
    setEstado({ enviando: true, mensaje: '', error: '' })
    const r = await reenviarConfirmacion(email.trim().toLowerCase())
    setEspera(ESPERA_SEGUNDOS)
    setEstado(
      r.error
        ? { enviando: false, mensaje: '', error: r.error }
        : { enviando: false, mensaje: 'Si la cuenta existe y aún no está confirmada, enviamos un nuevo correo. Revisa también la carpeta de correo no deseado.', error: '' },
    )
  }

  return (
    <div className={className}>
      <Boton variante="secundario" icono={MailCheck} onClick={reenviar} cargando={estado.enviando} disabled={enEspera}>
        {enEspera ? `Reenviar correo (${espera} s)` : 'Reenviar correo de confirmación'}
      </Boton>
      {estado.mensaje && <p role="status" className="mt-2 text-sm text-tinta-700">{estado.mensaje}</p>}
      {estado.error && <p role="alert" className="mt-2 text-sm text-nc-texto">{estado.error}</p>}
    </div>
  )
}
