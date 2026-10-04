import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Toast } from '../components/ui/Toast'

const ToastContext = createContext(null)

/** Proveedor de notificaciones. Uso: `const { notificar } = useToast(); notificar('Guardado', 'exito')`. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const contador = useRef(0)

  const cerrar = useCallback((id) => setToasts((lista) => lista.filter((t) => t.id !== id)), [])

  const notificar = useCallback(
    (mensaje, tipo = 'info', duracion = 5000) => {
      const id = ++contador.current
      setToasts((lista) => [...lista.slice(-3), { id, mensaje, tipo }])
      if (duracion) setTimeout(() => cerrar(id), duracion)
      return id
    },
    [cerrar],
  )

  const valor = useMemo(() => ({ notificar, cerrar }), [notificar, cerrar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="no-imprimir pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((t) => (
          <Toast key={t.id} tipo={t.tipo} mensaje={t.mensaje} alCerrar={() => cerrar(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
