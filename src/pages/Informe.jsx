import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileDown, FileText, Printer, RefreshCw } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../contexts/ToastContext'
import { invocarFuncion, supabase } from '../lib/supabase'
import { fechaHora } from '../lib/formato'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { VistaInforme } from '../components/informe/VistaInforme'
import { Boton, EstadoError, EstadoVacio, claseControl } from '../components/ui'

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
      // jspdf y docx se cargan solo al exportar, cada uno por separado
      if (formato === 'pdf') await (await import('../lib/exportar-pdf')).exportarPdf(informe)
      else await (await import('../lib/exportar-docx')).exportarDocx(informe)
    } catch (e) {
      console.error(e)
      notificar(`No se pudo generar el archivo ${formato === 'pdf' ? 'PDF' : 'Word'}. Inténtalo de nuevo.`, 'error')
    } finally {
      setExportando('')
    }
  }

  return (
    <>
      <div className="no-imprimir">
        <Encabezado
          antetitulo={a.codigo}
          titulo="Informe de auditoría"
          descripcion="Consolida los hallazgos no descartados. Las cifras las calcula el sistema; la IA redacta solo el resumen, las conclusiones y las recomendaciones."
          volver={{ a: `/app/auditorias/${id}`, etiqueta: a.titulo }}
          acciones={
            <>
              <Boton icono={lista.length ? RefreshCw : FileText} onClick={generar} cargando={generando} disabled={!puedeGenerar}>
                {lista.length ? 'Generar nueva versión' : 'Generar informe'}
              </Boton>
              {informe && (
                <>
                  <Boton variante="secundario" icono={FileDown} onClick={() => exportar('pdf')} cargando={exportando === 'pdf'} disabled={Boolean(exportando)}>PDF</Boton>
                  <Boton variante="secundario" icono={FileDown} onClick={() => exportar('docx')} cargando={exportando === 'docx'} disabled={Boolean(exportando)}>Word</Boton>
                  <Boton variante="secundario" icono={Printer} onClick={() => window.print()}>Imprimir</Boton>
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
      </div>

      {generando && !informe && <PantallaCarga mensaje="Generando el informe: calculando estadísticas y redactando conclusiones…" />}
      {!informe && !generando && (
        <EstadoVacio
          icono={FileText}
          titulo="Aún no hay informe"
          descripcion="Genera el informe cuando hayas validado los hallazgos. Podrás generar nuevas versiones si los hallazgos cambian."
        />
      )}
      {informe && <VistaInforme informe={informe} />}
      {informe && (
        <p className="no-imprimir mt-3 text-center text-xs text-tinta-500">
          Versión {informe.version} · generada {fechaHora(informe.generado_en)}{informe.modelo_ia ? ` · narrativa: ${informe.modelo_ia}` : ' · narrativa: plantilla'}
        </p>
      )}
    </>
  )
}
