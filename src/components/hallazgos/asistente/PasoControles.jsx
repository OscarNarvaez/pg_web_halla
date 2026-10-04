import { useId, useState } from 'react'
import { BookOpenText, Plus, Sparkles, Trash2 } from 'lucide-react'
import { ETIQUETAS_CONTROL, TIPOS_CONTROL } from '../../../lib/catalogos'
import { requiereRiesgo } from '../../../lib/riesgo'
import { claseControl } from '../../ui/Campo'
import { Badge } from '../../ui/Badge'
import { Boton } from '../../ui/Boton'
import { AvisosHallazgo } from '../AvisosHallazgo'
import { AVISOS_DEL_PASO } from './pasos'
import { cx } from '../../../lib/cx'

const MINIMO = 10
const MAXIMO = 600

/** Control escrito por el auditor: se guarda al salir del campo (no en cada tecla). */
function ControlPropio({ control, numero, alGuardar, alEliminar, deshabilitado }) {
  const [borrador, setBorrador] = useState(control.descripcion)
  const id = useId()
  const corto = borrador.trim().length < MINIMO
  return (
    <li className="rounded-lg border border-tinta-100 bg-white p-3">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tinta-500">Control del auditor {numero}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          id={id}
          rows={2}
          value={borrador}
          maxLength={MAXIMO}
          disabled={deshabilitado}
          placeholder="Qué se hace, quién lo hace (cargo o área) y con qué frecuencia"
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={() => {
            const limpio = borrador.trim()
            if (limpio.length >= MINIMO && limpio !== control.descripcion) alGuardar({ ...control, descripcion: limpio })
          }}
          aria-invalid={(corto && borrador.length > 0) || undefined}
          className={cx(claseControl, 'flex-1 text-sm')}
        />
        <div className="flex gap-2 sm:flex-col">
          <select
            aria-label={`Tipo del control ${numero}`}
            value={control.tipo}
            disabled={deshabilitado}
            onChange={(e) => alGuardar({ ...control, descripcion: borrador.trim().length >= MINIMO ? borrador.trim() : control.descripcion, tipo: e.target.value })}
            className="rounded-md border-tinta-300 text-sm focus:border-halla-500 focus:ring-halla-500"
          >
            {TIPOS_CONTROL.map((t) => <option key={t} value={t}>{ETIQUETAS_CONTROL[t]}</option>)}
          </select>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={alEliminar} disabled={deshabilitado}>Eliminar</Boton>
        </div>
      </div>
      {corto && borrador.length > 0 && <p className="mt-1 text-xs text-nc-texto">Describe el control con al menos {MINIMO} caracteres.</p>}
    </li>
  )
}

/**
 * Paso 6: controles recomendados. Los de la IA se adoptan marcándolos (no se reescriben: si el auditor quiere
 * otro, lo agrega como propio); los del auditor se escriben, cambian y eliminan libremente.
 */
export function PasoControles({ hallazgo, alCambiar, deshabilitado = false }) {
  const [nuevo, setNuevo] = useState('')
  const [tipoNuevo, setTipoNuevo] = useState('CORRECTIVO')
  const idNuevo = useId()
  if (!requiereRiesgo(hallazgo)) {
    return (
      <p className="rounded-lg border border-fort-borde bg-fort-bg p-4 text-sm text-fort-texto">
        No aplica: una fortaleza no requiere controles.
      </p>
    )
  }
  const controles = hallazgo.controles ?? []
  const deIa = controles.map((c, i) => ({ c, i })).filter(({ c }) => c.origen === 'ia')
  const propios = controles.map((c, i) => ({ c, i })).filter(({ c }) => c.origen === 'auditor')
  const reemplazar = (indice, control) => alCambiar({ controles: controles.map((c, i) => (i === indice ? control : c)) })
  const agregar = () => {
    const limpio = nuevo.trim()
    if (limpio.length < MINIMO) return
    alCambiar({ controles: [...controles, { descripcion: limpio, tipo: tipoNuevo, origen: 'auditor', adoptado: true, criterio_id: null }] })
    setNuevo('')
  }

  return (
    <div className="space-y-5">
      <AvisosHallazgo avisos={hallazgo.avisos} filtro={AVISOS_DEL_PASO.controles} />
      <p className="text-sm text-tinta-700">
        Los controles solo pueden provenir de la IA (con base en el hallazgo y los criterios cargados) o del auditor.
        Marca los que deseas adoptar para este hallazgo.
      </p>

      {deIa.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-500">Propuestos por la IA</legend>
          {deIa.map(({ c, i }) => (
            <label key={`${i}-${c.descripcion}`} className={cx('flex cursor-pointer gap-3 rounded-lg border p-3 text-sm', c.adoptado ? 'border-halla-400 bg-halla-50' : 'border-tinta-100 bg-white')}>
              <input
                type="checkbox"
                checked={c.adoptado}
                disabled={deshabilitado}
                onChange={(e) => reemplazar(i, { ...c, adoptado: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 rounded border-tinta-300 text-halla-700 focus:ring-halla-500"
              />
              <span className="space-y-1.5">
                <span className="block text-tinta-900">{c.descripcion}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tono={c.tipo === 'PREVENTIVO' ? 'marca' : 'neutro'}>{ETIQUETAS_CONTROL[c.tipo]}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-halla-700"><Sparkles className="size-3" aria-hidden="true" />IA</span>
                  {c.documento && (
                    <span className="inline-flex items-center gap-1 text-xs text-tinta-500">
                      <BookOpenText className="size-3" aria-hidden="true" />{c.documento}{c.numeral ? ` · ${c.numeral}` : ''}
                    </span>
                  )}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {deIa.length === 0 && (
        <p className="rounded-md bg-tinta-50 px-3 py-2 text-sm text-tinta-700">La IA no propuso controles para este hallazgo. Agrega al menos uno propio.</p>
      )}

      {propios.length > 0 && (
        <ul className="space-y-2" aria-label="Controles del auditor">
          {propios.map(({ c, i }, n) => (
            <ControlPropio
              key={`${i}-${c.descripcion}`}
              control={c}
              numero={n + 1}
              deshabilitado={deshabilitado}
              alGuardar={(control) => reemplazar(i, control)}
              alEliminar={() => alCambiar({ controles: controles.filter((_, j) => j !== i) })}
            />
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-tinta-300 p-3">
        <label htmlFor={idNuevo} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tinta-500">Control o acción definida por el auditor</label>
        <textarea
          id={idNuevo}
          rows={2}
          value={nuevo}
          maxLength={MAXIMO}
          disabled={deshabilitado || controles.length >= 10}
          placeholder="Control recomendado por el auditor"
          onChange={(e) => setNuevo(e.target.value)}
          className={cx(claseControl, 'text-sm')}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Tipo del control nuevo"
            value={tipoNuevo}
            onChange={(e) => setTipoNuevo(e.target.value)}
            disabled={deshabilitado}
            className="rounded-md border-tinta-300 text-sm focus:border-halla-500 focus:ring-halla-500"
          >
            {TIPOS_CONTROL.map((t) => <option key={t} value={t}>{ETIQUETAS_CONTROL[t]}</option>)}
          </select>
          <Boton variante="secundario" tamano="sm" icono={Plus} onClick={agregar} disabled={deshabilitado || nuevo.trim().length < MINIMO || controles.length >= 10}>
            Agregar control
          </Boton>
          {controles.length >= 10 && <span className="text-xs text-tinta-500">Máximo 10 controles por hallazgo.</span>}
        </div>
      </div>
    </div>
  )
}
