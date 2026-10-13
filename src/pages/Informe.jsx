import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, FileDown, FileText, Plus, RefreshCw, Save, Trash2, UserCheck, Users } from 'lucide-react'
import { useAuditoria } from '../hooks/useAuditorias'
import { useConsulta } from '../hooks/useConsulta'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { invocarFuncion, mensajeError, supabase } from '../lib/supabase'
import { fechaHora } from '../lib/formato'
import {
  MAX_INDICADORES, MAX_NOMBRE_INDICADOR, equipoInicial, esquemaEquipoAuditoria, esquemaFechasInforme, esquemaIndicadores, esquemaLiderAuditoria, indicadorVacio,
  liderInicial,
} from '../lib/esquemas'
import { esFormatoOficial, lineaIndicadores } from '../lib/formato-informe'
import { Encabezado } from '../components/layout/Encabezado'
import { PantallaCarga } from '../components/layout/PantallaCarga'
import { VistaInforme } from '../components/informe/VistaInforme'
import { CamposEquipo, CamposLider } from '../components/perfil/CamposPerfil'
import { BarraFija, Boton, Campo, EstadoError, EstadoVacio, Tarjeta, claseControl } from '../components/ui'

/**
 * «Fecha Auditoría» y «Fecha Creación del Informe» (plantilla del 12/10/2026, 0018): van en la Ficha Técnica. Sin fecha
 * de creación, el informe toma la del día en que se genera.
 */
function FechasInforme({ auditoria, alGuardar }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaFechasInforme),
    defaultValues: { fecha_auditoria: auditoria.fecha_auditoria ?? '', fecha_informe: auditoria.fecha_informe ?? '' },
  })
  const enviar = async (d) => {
    const ok = await alGuardar({ fecha_auditoria: d.fecha_auditoria || null, fecha_informe: d.fecha_informe || null })
    if (ok) reset(d)
  }
  return (
    <Tarjeta titulo="Fechas del informe" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-wrap items-end gap-4">
        <p className="w-full text-sm text-tinta-500">
          Van en la Ficha Técnica del informe. Si dejas vacía la fecha de creación, se usa la del día en que generes el informe.
        </p>
        <Campo etiqueta="Fecha Auditoría" type="date" className="w-full sm:w-52" error={errors.fecha_auditoria?.message} {...register('fecha_auditoria')} />
        <Campo etiqueta="Fecha Creación del Informe" type="date" className="w-full sm:w-60" error={errors.fecha_informe?.message} {...register('fecha_informe')} />
        <Boton type="submit" variante="secundario" icono={CalendarCheck} cargando={isSubmitting} disabled={!isDirty}>Guardar fechas</Boton>
      </form>
    </Tarjeta>
  )
}

/**
 * Líder del equipo auditor de esta auditoría (0017, decisión del dueño, 12/10/2026): el «Líder equipo» de la Ficha
 * Técnica. Se escribe a mano y empieza vacío: no se toma del perfil, porque el líder no siempre es el dueño de la cuenta.
 */
function LiderAuditoria({ auditoria, alGuardar }) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaLiderAuditoria),
    defaultValues: { lider_auditor: liderInicial(auditoria) },
  })
  const enviar = async (d) => {
    if (await alGuardar({ lider_auditor: d.lider_auditor })) reset(d)
  }
  return (
    <Tarjeta titulo="Líder del equipo auditor" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
        <p className="text-sm text-tinta-500">
          Quien lideró esta auditoría: va como «Líder equipo» en la Ficha Técnica del informe, con sus cargos. Escribe su
          nombre aunque seas tú: no se toma de tu perfil.
          {!auditoria.lider_auditor && ' Aún no está registrado: hay que registrarlo para generar el informe.'}
        </p>
        <CamposLider register={register} errors={errors} control={control} />
        <Boton type="submit" variante="secundario" icono={UserCheck} cargando={isSubmitting} disabled={!isDirty}>Guardar líder</Boton>
      </form>
    </Tarjeta>
  )
}

/**
 * Equipo auditor de esta auditoría (0016, decisión del dueño, 12/10/2026): el que nombra la Ficha Técnica. Empieza con
 * el de la auditoría o, si no tiene, con el habitual del perfil. Cambiarlo no toca el perfil ni otras auditorías.
 */
function EquipoAuditoria({ auditoria, perfil, alGuardar }) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaEquipoAuditoria),
    defaultValues: { equipo_auditor: equipoInicial(auditoria, perfil) },
  })
  const enviar = async (d) => {
    if (await alGuardar({ equipo_auditor: d.equipo_auditor })) reset(d)
  }
  return (
    <Tarjeta titulo="Equipo auditor de esta auditoría" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
        <p className="text-sm text-tinta-500">
          Quienes participaron en esta auditoría: van en la Ficha Técnica del informe, con sus cargos.
          {!auditoria.equipo_auditor?.length && ' Por ahora se usa tu equipo habitual (el de tu perfil).'} Cambiarlo aquí no modifica
          tu perfil ni otras auditorías.
        </p>
        <CamposEquipo register={register} errors={errors} control={control} leyendaOculta
          descripcion="Al menos una persona y hasta 10, cada una con sus cargos." />
        <Boton type="submit" variante="secundario" icono={Users} cargando={isSubmitting} disabled={!isDirty}>Guardar equipo</Boton>
      </form>
    </Tarjeta>
  )
}

/**
 * Indicadores priorizados del proceso (0013, 0015): el auditor escribe solo el nombre corto de cada uno. En el informe
 * van después del texto de la plantilla, separados por comas y con «y» antes del último. No pasan por la IA.
 */
function IndicadoresRevisados({ auditoria, alGuardar }) {
  const guardados = auditoria.indicadores_revisados ?? []
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(esquemaIndicadores),
    defaultValues: { indicadores: guardados.length ? guardados.map(({ nombre }) => ({ nombre })) : [indicadorVacio()] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'indicadores' })
  const escritos = useWatch({ control, name: 'indicadores' })
  const vista = lineaIndicadores({ indicadores: { revisados: (escritos ?? []).map((x) => x?.nombre?.trim().replace(/\.+$/, '')).filter(Boolean) } })
  const enviar = async (d) => {
    const indicadores = d.indicadores.filter((x) => x.nombre)
    if (await alGuardar({ indicadores_revisados: indicadores })) reset({ indicadores: indicadores.length ? indicadores : [indicadorVacio()] })
  }
  return (
    <Tarjeta titulo="Indicadores priorizados del proceso" className="mb-6">
      <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-4">
        <p className="text-sm text-tinta-500">
          Escribe solo el nombre corto de cada indicador que revisaste.
        </p>
        <ol className="space-y-3">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-start gap-2">
              <Campo
                etiqueta={`Indicador ${i + 1}`}
                className="min-w-0 flex-1"
                maxLength={MAX_NOMBRE_INDICADOR}
                placeholder={['oportunidad en triage', 'reingresos', 'satisfacción del usuario'][i] ?? 'nombre corto del indicador'}
                error={errors.indicadores?.[i]?.nombre?.message}
                {...register(`indicadores.${i}.nombre`)}
              />
              <Boton variante="fantasma" icono={Trash2} onClick={() => (fields.length > 1 ? remove(i) : reset({ indicadores: [indicadorVacio()] }, { keepDefaultValues: true }))}
                aria-label={`Quitar el indicador ${i + 1}`} className="mt-6 shrink-0" />
            </li>
          ))}
        </ol>
        <div className="rounded-md border border-tinta-100 bg-tinta-50 px-3 py-2 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-tinta-500">Así quedará en el informe</span>
          <span className="mt-1 block text-tinta-900" aria-live="polite">{vista}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={Plus} onClick={() => append(indicadorVacio())} disabled={fields.length >= MAX_INDICADORES}>Agregar otro indicador</Boton>
          <Boton type="submit" variante="secundario" icono={Save} cargando={isSubmitting} disabled={!isDirty}>Guardar indicadores</Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

export default function Informe() {
  const { id } = useParams()
  const { notificar } = useToast()
  const { perfil } = useAuth()
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
  // El líder se registra a mano en cada auditoría (0017): sin él la Ficha Técnica queda incompleta
  const sinLider = !a.lider_auditor?.nombre
  const puedeGenerar = confirmados.datos > 0 && !sinLider

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
      else await (await import('../lib/exportar-docx')).exportarDocx(informe)
    } catch (e) {
      console.error(e)
      notificar(e?.name === 'ErrorPlantilla' || /plantilla/i.test(e?.message ?? '') ? e.message
        : `No se pudo generar el archivo ${formato === 'pdf' ? 'PDF' : 'del documento'}. Inténtalo de nuevo.`, 'error')
    } finally {
      setExportando('')
    }
  }

  // Fechas, líder, equipo e indicadores se guardan en la auditoría; el informe los toma al generar una nueva versión
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
          descripcion="Informe final con el formato oficial del hospital. Los hallazgos, la Ficha Técnica y los indicadores que registres los llena el sistema; la IA redacta las secciones narrativas."
          volver={{ a: `/app/auditorias/${id}`, etiqueta: a.titulo }}
          acciones={!lista.length && (
            <Boton icono={FileText} onClick={generar} cargando={generando} disabled={!puedeGenerar}>Generar informe</Boton>
          )}
        />
        {!puedeGenerar && (
          <div className="mb-6 rounded-md border border-obs-borde bg-obs-bg px-4 py-3 text-sm text-obs-texto">
            {!confirmados.datos && <p>Para generar el informe necesitas al menos un hallazgo validado.</p>}
            {sinLider && <p>Para generar el informe registra el líder del equipo auditor (más abajo, en «Líder del equipo auditor»).</p>}
          </div>
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
        <FechasInforme key={a.id} auditoria={a} alGuardar={guardarAuditoria('Fechas del informe guardadas. Genera una nueva versión para incluirlas en el informe.')} />
        <LiderAuditoria key={`lider-${a.id}`} auditoria={a}
          alGuardar={guardarAuditoria('Líder del equipo guardado. Genera una nueva versión para incluirlo en el informe.')} />
        <EquipoAuditoria key={`equipo-${a.id}`} auditoria={a} perfil={perfil}
          alGuardar={guardarAuditoria('Equipo auditor guardado. Genera una nueva versión para incluirlo en el informe.')} />
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

      {/* Con el informe generado, sus acciones quedan siempre a la vista mientras se recorre la página */}
      {informe && (
        <BarraFija como="section" aria-label="Acciones del informe">
          <p className="text-xs text-tinta-500">
            Versión {informe.version} · generada {fechaHora(informe.generado_en)}{informe.modelo_ia ? ` · narrativa: ${informe.modelo_ia}` : ' · narrativa: plantilla'}
            {!oficial && ' · formato anterior: genera una nueva versión para descargarlo'}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Boton icono={RefreshCw} onClick={generar} cargando={generando} disabled={!puedeGenerar}>Generar nueva versión</Boton>
            <Boton variante="secundario" icono={FileDown} onClick={() => exportar('docx')} cargando={exportando === 'docx'} disabled={!oficial || generando || Boolean(exportando)}
              title="Documento de Word con la plantilla oficial: se abre y se edita en Word y en LibreOffice">
              Documento (editable)
            </Boton>
            <Boton variante="secundario" icono={FileDown} onClick={() => exportar('pdf')} cargando={exportando === 'pdf'} disabled={!oficial || generando || Boolean(exportando)}>PDF</Boton>
          </div>
        </BarraFija>
      )}
    </>
  )
}
