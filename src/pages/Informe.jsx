import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, FileDown, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../contexts/ToastContext'
import { invocarFuncion, mensajeError, supabase } from '../lib/supabase'
import { fechaHora } from '../lib/formato'
import { MAX_INDICADORES, esquemaFechasReales, esquemaIndicadores, indicadorVacio } from '../lib/esquemas'
import { TEXTOS_FORMATO, esFormatoOficial } from '../lib/formato-informe'
import { objetoAuditado } from '../lib/catalogos'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { VistaInforme } from '../components/informe/VistaInforme'
import { AreaTexto, Boton, Campo, EstadoError, EstadoVacio, Tarjeta, claseControl } from '../components/ui'

/** Fechas reales de la auditoría: la Ficha Técnica del formato las pide junto a las planeadas. */
function FechasReales({ auditoria, alGuardar }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaFechasReales),
    defaultValues: { fecha_inicio_real: auditoria.fecha_inicio_real ?? '', fecha_fin_real: auditoria.fecha_fin_real ?? '' },
  })
  const enviar = async (d) => {
    const ok = await alGuardar({ fecha_inicio_real: d.fecha_inicio_real || null, fecha_fin_real: d.fecha_fin_real || null })
    if (ok) reset(d)
  }
  return (
    <Tarjeta titulo="Fechas reales de la auditoría" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-wrap items-end gap-4">
        <p className="w-full text-sm text-tinta-500">
          Van en la Ficha Técnica junto a las planeadas ({auditoria.fecha_inicio ?? 'sin fecha'} a {auditoria.fecha_fin ?? 'sin fecha'}).
          Regístralas antes de generar el informe.
        </p>
        <Campo etiqueta="Fecha inicio (real)" type="date" className="w-full sm:w-52" error={errors.fecha_inicio_real?.message} {...register('fecha_inicio_real')} />
        <Campo etiqueta="Fecha terminación (real)" type="date" className="w-full sm:w-52" error={errors.fecha_fin_real?.message} {...register('fecha_fin_real')} />
        <Boton type="submit" variante="secundario" icono={CalendarCheck} cargando={isSubmitting} disabled={!isDirty}>Guardar fechas</Boton>
      </form>
    </Tarjeta>
  )
}

/**
 * Indicadores priorizados del proceso que revisó el auditor (0013). La plantilla los pide bajo «Indicadores»:
 * «Revisión de indicadores priorizados en el proceso de (area auditada)». La IA redacta la revisión con estos datos.
 */
function IndicadoresRevisados({ auditoria, alGuardar }) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaIndicadores),
    defaultValues: { indicadores: auditoria.indicadores_revisados ?? [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'indicadores' })
  const area = auditoria.area_auditada?.trim() || objetoAuditado(auditoria)
  const enviar = async (d) => {
    if (await alGuardar({ indicadores_revisados: d.indicadores })) reset(d)
  }
  const error = (i, campo) => errors.indicadores?.[i]?.[campo]?.message
  return (
    <Tarjeta titulo="Indicadores priorizados del proceso" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
        <p className="text-sm text-tinta-500">
          Van en la sección «Indicadores» del informe: «{TEXTOS_FORMATO.revisionIndicadores.replace(TEXTOS_FORMATO.marcadorArea, area)}».
          Registra los que revisaste con su meta y su resultado; la IA redacta la revisión comparándolos, sin inventar cifras.
        </p>
        {fields.map((f, i) => (
          <fieldset key={f.id} className="grid gap-3 rounded-lg border border-tinta-100 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-tinta-500">Indicador {i + 1}</legend>
            <Campo etiqueta="Nombre" required placeholder="Oportunidad en la atención de triage II" error={error(i, 'nombre')} {...register(`indicadores.${i}.nombre`)} />
            <Campo etiqueta="Meta" placeholder="≤ 30 minutos" error={error(i, 'meta')} {...register(`indicadores.${i}.meta`)} />
            <Campo etiqueta="Resultado" placeholder="42 minutos" error={error(i, 'resultado')} {...register(`indicadores.${i}.resultado`)} />
            <Boton variante="fantasma" icono={Trash2} onClick={() => remove(i)} aria-label={`Quitar el indicador ${i + 1}`} className="sm:mt-6">
              <span className="sm:sr-only">Quitar</span>
            </Boton>
            <AreaTexto etiqueta="Observación (opcional)" rows={2} className="sm:col-span-3" error={error(i, 'observacion')}
              placeholder="Por ejemplo: el resultado del último trimestre; se analizó con el líder del proceso." {...register(`indicadores.${i}.observacion`)} />
          </fieldset>
        ))}
        {!fields.length && <p className="text-sm italic text-tinta-500">Aún no registras indicadores: el informe dirá que no se registraron.</p>}
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={Plus} onClick={() => append(indicadorVacio())} disabled={fields.length >= MAX_INDICADORES}>Agregar indicador</Boton>
          <Boton type="submit" variante="secundario" icono={Save} cargando={isSubmitting} disabled={!isDirty}>Guardar indicadores</Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

export default function Informe() {
  const { id } = useParams()
  const { notificar } = useToast()
  const auditoria = useAuditoria(id)
  const informes = useConsulta(
    () => supabase.from('informes').select('*').eq('auditoria_id', id).order('version', { ascending: false }),
    [id],
    { inicial: [] },
  )
  const confirmados = useConsulta(
    () => supabase.from('hallazgos').select('id', { count: 'exact', head: true }).eq('auditoria_id', id).eq('estado', 'confirmado')
      .then(({ count, error }) => ({ data: count ?? 0, error })),
    [id],
    { inicial: 0 },
  )
  const [versionElegida, setVersionElegida] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [exportando, setExportando] = useState('')

  if (auditoria.cargando || informes.cargando) return <PantallaCarga />
  if (auditoria.error) return <EstadoError mensaje={auditoria.error} alReintentar={auditoria.recargar} />
  if (!auditoria.datos) return <EstadoVacio titulo="Auditoría no encontrada" />

  const a = auditoria.datos
  const lista = informes.datos ?? []
  const informe = lista.find((i) => i.version === versionElegida) ?? lista[0]
  const puedeGenerar = confirmados.datos > 0

  const generar = async () => {
    setGenerando(true)
    const { data, error } = await invocarFuncion('generar-informe', { auditoria_id: id })
    setGenerando(false)
    if (error) return notificar(error.mensaje, 'error')
    informes.setDatos([data.informe, ...lista])
    setVersionElegida(data.informe.version)
    notificar(data.meta?.ia ? `Informe versión ${data.informe.version} generado` : 'Informe generado con plantilla: la IA no estuvo disponible', data.meta?.ia ? 'exito' : 'aviso')
  }

  const exportar = async (formato) => {
    setExportando(formato)
    try {
      // La plantilla, jspdf y fflate se cargan solo al exportar
      if (formato === 'pdf') await (await import('../lib/exportar-pdf')).exportarPdf(informe)
      else await (await import('../lib/exportar-odt')).exportarOdt(informe)
    } catch (e) {
      console.error(e)
      notificar(e?.name === 'ErrorPlantilla' || /plantilla/i.test(e?.message ?? '') ? e.message
        : `No se pudo generar el archivo ${formato === 'pdf' ? 'PDF' : 'del documento'}. Inténtalo de nuevo.`, 'error')
    } finally {
      setExportando('')
    }
  }

  // Fechas reales e indicadores se guardan en la auditoría; el informe los toma al generar una nueva versión
  const guardarAuditoria = (mensaje) => async (cambios) => {
    const { data, error } = await supabase.from('auditorias').update(cambios).eq('id', id).select().single()
    if (error) {
      notificar(mensajeError(error), 'error')
      return false
    }
    auditoria.setDatos(data)
    notificar(mensaje, 'exito')
    return true
  }
  const oficial = informe && esFormatoOficial(informe.contenido)

  return (
    <>
      <div className="no-imprimir">
        <Encabezado
          antetitulo={a.codigo}
          titulo="Informe de auditoría"
          descripcion="Informe final con el formato oficial del hospital. Los hallazgos y la Ficha Técnica los llena el sistema; la IA redacta las secciones narrativas y la revisión de los indicadores que registres."
          volver={{ a: `/app/auditorias/${id}`, etiqueta: a.titulo }}
          acciones={
            <>
              <Boton icono={lista.length ? RefreshCw : FileText} onClick={generar} cargando={generando} disabled={!puedeGenerar}>
                {lista.length ? 'Generar nueva versión' : 'Generar informe'}
              </Boton>
              {oficial && (
                <>
                  <Boton variante="secundario" icono={FileDown} onClick={() => exportar('odt')} cargando={exportando === 'odt'} disabled={Boolean(exportando)}
                    title="Documento con la plantilla oficial; se abre en LibreOffice y en Word">
                    Documento (ODT)
                  </Boton>
                  <Boton variante="secundario" icono={FileDown} onClick={() => exportar('pdf')} cargando={exportando === 'pdf'} disabled={Boolean(exportando)}>PDF</Boton>
                </>
              )}
            </>
          }
        />
        {!puedeGenerar && (
          <p className="mb-6 rounded-md border border-obs-borde bg-obs-bg px-4 py-3 text-sm text-obs-texto">
            Para generar el informe necesitas al menos un hallazgo validado.
          </p>
        )}
        {lista.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="version-informe" className="text-sm text-tinta-500">Versión</label>
            <select id="version-informe" value={informe?.version} onChange={(e) => setVersionElegida(Number(e.target.value))} className={`${claseControl} w-auto`}>
              {lista.map((i) => <option key={i.id} value={i.version}>Versión {i.version} · {fechaHora(i.generado_en)}</option>)}
            </select>
          </div>
        )}
        {informes.error && <EstadoError mensaje={informes.error} alReintentar={informes.recargar} className="mb-4" />}
        <FechasReales key={a.id} auditoria={a} alGuardar={guardarAuditoria('Fechas reales guardadas. Genera una nueva versión para incluirlas en el informe.')} />
        <IndicadoresRevisados key={`indicadores-${a.id}`} auditoria={a}
          alGuardar={guardarAuditoria('Indicadores guardados. Genera una nueva versión para incluirlos en el informe.')} />
      </div>

      {generando && !informe && <PantallaCarga mensaje="Generando el informe: calculando estadísticas y redactando conclusiones…" />}
      {!informe && !generando && (
        <EstadoVacio
          icono={FileText}
          titulo="Aún no hay informe"
          descripcion="Genera el informe cuando hayas validado los hallazgos. Podrás generar nuevas versiones si los hallazgos cambian."
        />
      )}
      {informe && !oficial && (
        <EstadoVacio
          icono={FileText}
          titulo="Esta versión tiene el formato anterior"
          descripcion="Se generó antes de adoptar el formato oficial del hospital. Genera una nueva versión para obtener el informe con la plantilla oficial y descargarlo."
        />
      )}
      {oficial && <VistaInforme informe={informe} />}
      {informe && (
        <p className="no-imprimir mt-3 text-center text-xs text-tinta-500">
          Versión {informe.version} · generada {fechaHora(informe.generado_en)}{informe.modelo_ia ? ` · narrativa: ${informe.modelo_ia}` : ' · narrativa: plantilla'}
        </p>
      )}
    </>
  )
}
