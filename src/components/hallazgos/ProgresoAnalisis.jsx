import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cx } from '../../lib/cx'
import { Skeleton, SkeletonTexto } from '../ui/Skeleton'

const PASOS = [
  { desde: 0, texto: 'Buscando criterios aplicables…' },
  { desde: 1500, texto: 'Analizando evidencia…' },
  { desde: 4000, texto: 'Redactando hallazgo…' },
]

/** Pasos visibles mientras la IA trabaja. La espera real es de 3 a 8 s, a veces más. */
export function ProgresoAnalisis() {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const inicio = Date.now()
    const t = setInterval(() => setMs(Date.now() - inicio), 250)
    return () => clearInterval(t)
  }, [])
  const actual = PASOS.reduce((i, p, k) => (ms >= p.desde ? k : i), 0)

  return (
    <div className="rounded-lg border border-tinta-100 bg-white p-5 shadow-sm" aria-busy="true">
      <ol className="space-y-2" aria-label="Progreso del análisis">
        {PASOS.map((p, i) => (
          <li key={p.texto} className={cx('flex items-center gap-2 text-sm', i <= actual ? 'text-tinta-900' : 'text-tinta-300')}>
            {i < actual ? (
              <Check className="size-4 text-fort-solido" aria-hidden="true" />
            ) : i === actual ? (
              <Loader2 className="size-4 animate-spin text-halla-600" aria-hidden="true" />
            ) : (
              <span className="size-4" aria-hidden="true" />
            )}
            {p.texto}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-tinta-500" role="status" aria-live="polite">
        {ms > 15000
          ? 'La IA está tardando más de lo normal; seguimos intentando, incluso con otro modelo si el principal está saturado.'
          : 'Esto suele tardar entre 3 y 8 segundos.'}
      </p>
      <div className="mt-5 space-y-4" aria-hidden="true">
        <Skeleton className="h-9 w-48 rounded-full" />
        <SkeletonTexto lineas={4} />
        <SkeletonTexto lineas={2} />
      </div>
    </div>
  )
}
