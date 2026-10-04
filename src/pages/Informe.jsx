import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, FileDown, FileText, RefreshCw } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../contexts/ToastContext'
import { invocarFuncion, mensajeError, supabase } from '../lib/supabase'
import { fechaHora } from '../lib/formato'
import { esquemaFechasReales } from '../lib/esquemas'
import { esFormatoOficial } from '../lib/formato-informe'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { VistaInforme } from '../components/informe/VistaInforme'
import { Boton, Campo, EstadoError, EstadoVacio, Tarjeta, claseControl } from '../components/ui'

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

  const guardarFechas = async (cambios) => {
    const { data, error } = await supabase.from('auditorias').update(cambios).eq('id', id).select().single()
    if (error) {
      notificar(mensajeError(error), 'error')
      return false
    }
    auditoria.setDatos(data)
    notificar('Fechas reales guardadas. Genera una nueva versión para incluirlas en el informe.', 'exito')
    return true
  }
  const oficial = informe && esFormatoOficial(informe.contenido)

  return (
    <>
      <div className="no-imprimir">
        <Encabezado
          antetitulo={a.codigo}
          titulo="Informe de auditoría"
          descripcion="Informe final con el formato oficial del hospital. Los hallazgos, la Ficha Técnica y los indicadores los llena el sistema; la IA redacta las secciones narrativas."
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
        <FechasReales key={a.id} auditoria={a} alGuardar={guardarFechas} />
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
