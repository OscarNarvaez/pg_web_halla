import { createContext, useContext, useState } from 'react'
import { useLocation } from 'react-router-dom'

const RutaAnteriorContext = createContext(null)

/**
 * Recuerda la ruta anterior dentro de la aplicación. Sirve para distinguir cuando el auditor ENTRA a una auditoría
 * (desde el panel, la lista de auditorías u otra sección) de cuando VUELVE a ella desde una de sus páginas.
 * Al recargar el navegador no hay ruta anterior.
 */
export function RutaAnteriorProvider({ children }) {
  const { pathname } = useLocation()
  const [rutas, setRutas] = useState({ actual: pathname, anterior: null })
  // Estado derivado de la ruta: React vuelve a dibujar antes de pasar el valor a los hijos
  if (rutas.actual !== pathname) setRutas({ actual: pathname, anterior: rutas.actual })
  return <RutaAnteriorContext.Provider value={rutas.anterior}>{children}</RutaAnteriorContext.Provider>
}

/** Ruta desde la que se llegó a la página actual (null si se entró directo o se recargó). */
// eslint-disable-next-line react-refresh/only-export-components
export function useRutaAnterior() {
  return useContext(RutaAnteriorContext)
}
