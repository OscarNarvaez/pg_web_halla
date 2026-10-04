import { CLASIFICACIONES } from '../../lib/catalogos'
import { Badge } from '../ui/Badge'

/** Clasificación con su color semántico y SIEMPRE con texto (el color nunca es el único indicador). */
export function BadgeClasificacion({ clasificacion, tamano = 'sm', className }) {
  const c = CLASIFICACIONES[clasificacion]
  if (!c) return null
  return (
    <Badge tono={c.tono} tamano={tamano} className={className}>
      {c.etiqueta}
    </Badge>
  )
}
