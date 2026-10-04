import { useCallback, useEffect, useState } from 'react'
import { mensajeError } from '../lib/supabase'

/**
 * Ejecuta una consulta asíncrona y expone { datos, cargando, error, recargar, setDatos }.
 * `consulta` debe devolver { data, error } como supabase-js. Se re-ejecuta cuando cambian `deps`
 * (valores primitivos, p. ej. ids) o al llamar a `recargar`.
 *
 * El estado guarda la «clave» de la consulta que lo produjo: `cargando` se deriva de que esa clave
 * no coincida con la actual, así el efecto solo escribe estado cuando llega la respuesta.
 */
export function useConsulta(consulta, deps = [], { inicial = null } = {}) {
  const [recargas, setRecargas] = useState(0)
  const clave = JSON.stringify([...deps, recargas])
  const [estado, setEstado] = useState({ clave: null, datos: inicial, error: '' })

  useEffect(() => {
    let activo = true
    Promise.resolve()
      .then(() => consulta())
      .then(({ data, error }) => {
        if (!activo) return
        setEstado((previo) => ({
          clave,
          datos: error ? previo.datos : data,
          error: error ? mensajeError(error) : '',
        }))
      })
      .catch((e) => {
        if (activo) setEstado((previo) => ({ clave, datos: previo.datos, error: mensajeError(e) }))
      })
    return () => {
      activo = false
    }
    // `consulta` cambia de identidad en cada render: la consulta se identifica por `clave`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const recargar = useCallback(() => setRecargas((n) => n + 1), [])
  const setDatos = useCallback(
    (valor) => setEstado((previo) => ({ ...previo, datos: typeof valor === 'function' ? valor(previo.datos) : valor })),
    [],
  )

  const vigente = estado.clave === clave
  return {
    datos: estado.datos,
    setDatos,
    cargando: !vigente,
    error: vigente ? estado.error : '',
    recargar,
  }
}
