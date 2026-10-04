import { Loader2 } from 'lucide-react'

export function PantallaCarga({ mensaje = 'Cargando…' }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="mr-2 size-5 animate-spin text-halla-600" aria-hidden="true" />
      <span className="text-sm text-tinta-500">{mensaje}</span>
    </div>
  )
}
