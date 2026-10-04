import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, mensajeError } from '../lib/supabase'

const AuthContext = createContext(null)

const CAMPOS_PERFIL = ['nombre_completo', 'cedula', 'celular', 'tipo_evaluador', 'cargos', 'equipo_auditor', 'alcance', 'proceso', 'sistema']
// Campos que son listas (migración 0009): nunca se envían como texto ni como null
const LISTAS_PERFIL = new Set(['cargos', 'equipo_auditor'])
const valorPerfil = (c, v) => (LISTAS_PERFIL.has(c) ? (Array.isArray(v) ? v : []) : v || null)

// Cierre de sesión por inactividad: en computadores compartidos del hospital una sesión abierta expone
// datos personales y de auditoría. La marca de actividad se comparte entre pestañas.
export const MINUTOS_INACTIVIDAD = 30
const CLAVE_ACTIVIDAD = 'halla-ultima-actividad'
const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'scroll', 'touchstart']

function marcarActividad() {
  try {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, String(Date.now()))
  } catch {
    // almacenamiento no disponible: la sesión se rige solo por la expiración del JWT
  }
}
function ultimaActividad() {
  try {
    return Number(window.localStorage.getItem(CLAVE_ACTIVIDAD)) || Date.now()
  } catch {
    return Date.now()
  }
}

/**
 * Sesión de Supabase Auth y perfil del auditor.
 * Si el trigger handle_new_user no creó el perfil, lo crea desde el cliente con los metadatos del
 * registro (fallback del §7.1) y conserva el error real para mostrarlo en español.
 */
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(Boolean(supabase))
  const [errorPerfil, setErrorPerfil] = useState('')
  const [enRecuperacion, setEnRecuperacion] = useState(false)
  const [cerradaPorInactividad, setCerradaPorInactividad] = useState(false)

  const cargarPerfil = useCallback(async (usuario) => {
    if (!usuario) {
      setPerfil(null)
      return null
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', usuario.id).maybeSingle()
    if (error) {
      console.error('Lectura del perfil:', error)
      setErrorPerfil(mensajeError(error))
      return null
    }
    if (data) {
      setPerfil(data)
      setErrorPerfil('')
      return data
    }

    // Fallback: el trigger no creó el perfil. Se intenta desde el cliente con los metadatos del registro.
    const meta = usuario.user_metadata ?? {}
    if (!meta.nombre_completo) {
      setPerfil(null)
      return null
    }
    const fila = Object.fromEntries(CAMPOS_PERFIL.map((c) => [c, valorPerfil(c, meta[c])]))
    // La fecha real de la autorización la fija el servidor; sin autorización, el perfil no se crea
    if (meta.acepto_tratamiento_datos === 'true') fila.acepto_tratamiento_datos_en = new Date().toISOString()
    const { data: creado, error: errCrear } = await supabase.from('profiles').insert({ id: usuario.id, ...fila }).select().single()
    if (errCrear) {
      console.error('El trigger no creó el perfil y el fallback falló:', errCrear)
      setErrorPerfil(mensajeError(errCrear))
      setPerfil(null)
      return null
    }
    setPerfil(creado)
    setErrorPerfil('')
    return creado
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let activo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return
      setSesion(data.session)
      await cargarPerfil(data.session?.user)
      if (activo) setCargando(false)
    })
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
      setSesion(nuevaSesion)
      if (evento === 'PASSWORD_RECOVERY') setEnRecuperacion(true)
      if (evento === 'SIGNED_OUT') {
        setPerfil(null)
        setErrorPerfil('')
      }
      // No se espera dentro del callback (la documentación de Supabase advierte bloqueos):
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') setTimeout(() => cargarPerfil(nuevaSesion?.user), 0)
    })
    return () => {
      activo = false
      suscripcion.subscription.unsubscribe()
    }
  }, [cargarPerfil])

  // Cierre por inactividad
  useEffect(() => {
    if (!sesion) return undefined
    marcarActividad()
    let ultimaMarca = 0
    const alActuar = () => {
      // como mucho una escritura cada 15 s
      if (Date.now() - ultimaMarca > 15_000) {
        ultimaMarca = Date.now()
        marcarActividad()
      }
    }
    EVENTOS_ACTIVIDAD.forEach((e) => window.addEventListener(e, alActuar, { passive: true }))
    const revisar = setInterval(() => {
      if (Date.now() - ultimaActividad() > MINUTOS_INACTIVIDAD * 60_000) {
        setCerradaPorInactividad(true)
        supabase.auth.signOut()
      }
    }, 30_000)
    return () => {
      EVENTOS_ACTIVIDAD.forEach((e) => window.removeEventListener(e, alActuar))
      clearInterval(revisar)
    }
  }, [sesion])

  const registrar = useCallback(async ({ email, password, acepto_tratamiento_datos, ...datos }) => {
    const metadatos = Object.fromEntries(CAMPOS_PERFIL.map((c) => [c, LISTAS_PERFIL.has(c) ? valorPerfil(c, datos[c]) : datos[c] ?? '']))
    metadatos.acepto_tratamiento_datos = acepto_tratamiento_datos === true ? 'true' : 'false'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadatos, emailRedirectTo: `${window.location.origin}/ingresar` },
    })
    if (error) return { error: mensajeError(error) }
    // Si el correo ya existía, Supabase devuelve identities = []. No se le dice al visitante (evita la
    // enumeración de cuentas): ve el mismo mensaje de «revisa tu correo» que un registro nuevo.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { confirmarCorreo: true }
    }
    if (data.session) {
      const creado = await cargarPerfil(data.session.user)
      return { sesion: true, perfil: creado }
    }
    return { confirmarCorreo: true }
  }, [cargarPerfil])

  const ingresar = useCallback(async (email, password) => {
    setCerradaPorInactividad(false)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? { error: mensajeError(error) } : {}
  }, [])

  const reenviarConfirmacion = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/ingresar` },
    })
    return error ? { error: mensajeError(error) } : {}
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const solicitarRecuperacion = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/recuperar` })
    return error ? { error: mensajeError(error) } : {}
  }, [])

  const cambiarClave = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setEnRecuperacion(false)
    return error ? { error: mensajeError(error) } : {}
  }, [])

  const guardarPerfil = useCallback(async (datos) => {
    const usuario = sesion?.user
    if (!usuario) return { error: 'No hay sesión activa.' }
    const fila = Object.fromEntries(CAMPOS_PERFIL.map((c) => [c, valorPerfil(c, datos[c])]))
    if (!perfil && datos.acepto_tratamiento_datos === true) fila.acepto_tratamiento_datos_en = new Date().toISOString()
    const consulta = perfil
      ? supabase.from('profiles').update(fila).eq('id', usuario.id)
      : supabase.from('profiles').insert({ id: usuario.id, ...fila })
    const { data, error } = await consulta.select().single()
    if (error) return { error: mensajeError(error) }
    setPerfil(data)
    setErrorPerfil('')
    return { perfil: data }
  }, [sesion, perfil])

  const valor = useMemo(
    () => ({
      sesion, usuario: sesion?.user ?? null, perfil, cargando, errorPerfil, enRecuperacion, cerradaPorInactividad,
      registrar, ingresar, reenviarConfirmacion, salir, solicitarRecuperacion, cambiarClave, guardarPerfil,
      recargarPerfil: () => cargarPerfil(sesion?.user),
    }),
    [sesion, perfil, cargando, errorPerfil, enRecuperacion, cerradaPorInactividad, registrar, ingresar, reenviarConfirmacion, salir, solicitarRecuperacion, cambiarClave, guardarPerfil, cargarPerfil],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
