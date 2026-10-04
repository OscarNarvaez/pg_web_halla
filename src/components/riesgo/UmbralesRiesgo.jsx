import { useState } from 'react'
import { Save } from 'lucide-react'
import { Boton, Campo } from '../ui'

/**
 * Umbrales de nivel de la auditoría (puntaje máximo de Bajo, Moderado y Alto). Son valores de referencia
 * editables: el PR13_GQ no fija los cortes numéricos, los define la matriz institucional en Almera.
 * @param {object} props
 * @param {{ bajo: number, moderado: number, alto: number }} props.umbrales
 * @param {(nuevos: { bajo: number, moderado: number, alto: number }) => Promise<string>} props.alGuardar Devuelve el error o ''.
 * @param {boolean} [props.deshabilitado]
 */
export function UmbralesRiesgo({ umbrales, alGuardar, deshabilitado = false }) {
  const [borrador, setBorrador] = useState({ ...umbrales })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const valores = { bajo: Number(borrador.bajo), moderado: Number(borrador.moderado), alto: Number(borrador.alto) }
  const validos = Object.values(valores).every(Number.isInteger) && valores.bajo >= 1 && valores.bajo < valores.moderado && valores.moderado < valores.alto && valores.alto <= 24
  const cambio = valores.bajo !== umbrales.bajo || valores.moderado !== umbrales.moderado || valores.alto !== umbrales.alto

  const guardar = async () => {
    if (!validos) return
    setGuardando(true)
    const err = await alGuardar(valores)
    setGuardando(false)
    setError(err)
  }

  const campo = (clave, etiqueta) => (
    <Campo
      etiqueta={etiqueta}
      type="number"
      inputMode="numeric"
      min={1}
      max={24}
      value={borrador[clave]}
      onChange={(e) => setBorrador((b) => ({ ...b, [clave]: e.target.value }))}
      disabled={deshabilitado || guardando}
    />
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-tinta-500">
        Puntaje máximo de cada nivel. Son valores de referencia: ajústalos si la matriz de riesgos institucional usa otros cortes.
        Por encima del último valor el nivel es Extremo.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {campo('bajo', 'Bajo hasta')}
        {campo('moderado', 'Moderado hasta')}
        {campo('alto', 'Alto hasta')}
      </div>
      {!validos && <p role="alert" className="text-xs text-nc-texto">Deben ser enteros en orden creciente (Bajo &lt; Moderado &lt; Alto ≤ 24).</p>}
      {error && <p role="alert" className="text-xs text-nc-texto">{error}</p>}
      <Boton variante="secundario" tamano="sm" icono={Save} onClick={guardar} cargando={guardando} disabled={deshabilitado || !validos || !cambio}>
        Guardar escala
      </Boton>
    </div>
  )
}
