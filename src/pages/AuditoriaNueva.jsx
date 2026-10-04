import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { proponerCodigo } from '../hooks/useAuditorias'
import { aFilaAlcance, esquemaAuditoria } from '../lib/esquemas'
import { DOCUMENTOS, documentosParaAlcance } from '../lib/catalogos'
import { invocarFuncion, mensajeError, supabase } from '../lib/supabase'
import { Encabezado } from '../components/layout/Encabezado'
import { CamposAlcance } from '../components/perfil/CamposPerfil'
import { AreaTexto, Boton, Campo, Checkbox, Tarjeta } from '../components/ui'

const hoy = () => new Date().toISOString().slice(0, 10)

export default function AuditoriaNueva() {
  const { perfil, usuario } = useAuth()
  const navigate = useNavigate()
  const { notificar } = useToast()
  const [sugiriendo, setSugiriendo] = useState(false)
  const [avisoIa, setAvisoIa] = useState('')
  const [error, setError] = useState('')

  const { register, handleSubmit, control, setValue, getValues, formState: { errors, isSubmitting, dirtyFields } } = useForm({
    resolver: zodResolver(esquemaAuditoria),
    defaultValues: {
      codigo: '', titulo: '', alcance: perfil.alcance, proceso: perfil.proceso ?? '', sistema: perfil.sistema ?? '',
      objetivo: '', criterios: documentosParaAlcance(perfil), area_auditada: '', auditado_nombre: '', auditado_cargo: '',
      fecha_inicio: hoy(), fecha_fin: '', fecha_inicio_real: '', fecha_fin_real: '',
    },
  })

  // Código propuesto sin gastar cuota de IA: AI-<año>-<siguiente consecutivo>
  useEffect(() => {
    proponerCodigo().then((codigo) => {
      if (!getValues('codigo')) setValue('codigo', codigo)
    })
  }, [getValues, setValue])

  const [alcance, sistema, criterios] = useWatch({ control, name: ['alcance', 'sistema', 'criterios'] })
  // Al cambiar el alcance, se proponen las normas aplicables (si el auditor no las ha tocado)
  useEffect(() => {
    if (!dirtyFields.criterios) setValue('criterios', documentosParaAlcance({ alcance, sistema }))
  }, [alcance, sistema, dirtyFields.criterios, setValue])

  const sugerir = async () => {
    const v = getValues()
    const objeto = v.alcance === 'SISTEMAS' ? v.sistema : v.proceso
    if (!objeto) return setAvisoIa('Elige primero el proceso o sistema a auditar.')
    setSugiriendo(true)
    setAvisoIa('')
    const { data, error: err } = await invocarFuncion('completar-auditoria', {
      alcance: v.alcance, proceso: v.proceso || null, sistema: v.sistema || null,
      titulo: v.titulo || null, fecha_inicio: v.fecha_inicio || null, fecha_fin: v.fecha_fin || null,
    })
    setSugiriendo(false)
    if (err) return setAvisoIa(err.mensaje)
    const s = data.sugerencia
    setValue('objetivo', s.objetivo, { shouldDirty: true })
    setValue('criterios', s.criterios, { shouldDirty: true })
    if (!v.area_auditada) setValue('area_auditada', s.area_auditada, { shouldDirty: true })
    if (!dirtyFields.codigo) setValue('codigo', s.codigo)
    setAvisoIa(data.meta?.ia ? 'Propuesta de la IA: revísala y ajústala antes de guardar.' : data.meta?.aviso ?? 'Se propusieron valores básicos.')
  }

  const alternarCriterio = (codigo) => {
    const actual = getValues('criterios')
    setValue('criterios', actual.includes(codigo) ? actual.filter((c) => c !== codigo) : [...actual, codigo], { shouldDirty: true })
  }

  const enviar = async (d) => {
    setError('')
    const { data, error: err } = await supabase
      .from('auditorias')
      .insert({
        user_id: usuario.id,
        codigo: d.codigo,
        titulo: d.titulo,
        ...aFilaAlcance(d),
        objetivo: d.objetivo || null,
        criterios: d.criterios,
        area_auditada: d.area_auditada || null,
        auditado_nombre: d.auditado_nombre || null,
        auditado_cargo: d.auditado_cargo || null,
        fecha_inicio: d.fecha_inicio || null,
        fecha_fin: d.fecha_fin || null,
        fecha_inicio_real: d.fecha_inicio_real || null,
        fecha_fin_real: d.fecha_fin_real || null,
      })
      .select('id')
      .single()
    if (err) return setError(mensajeError(err))
    notificar('Auditoría creada', 'exito')
    navigate(`/app/auditorias/${data.id}`)
  }

  return (
    <>
      <Encabezado titulo="Nueva auditoría" descripcion="Define qué vas a auditar. La IA puede proponer el objetivo, el área y las normas aplicables." volver={{ a: '/app/auditorias', etiqueta: 'Auditorías' }} />
      <form onSubmit={handleSubmit(enviar)} noValidate className="max-w-3xl space-y-6">
        {error && <p role="alert" className="rounded-md border border-nc-borde bg-nc-bg px-3 py-2 text-sm text-nc-texto">{error}</p>}

        <Tarjeta titulo="Identificación">
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Código" required error={errors.codigo?.message} ayuda="Formato AI-año-consecutivo." {...register('codigo')} />
            <Campo etiqueta="Título" required error={errors.titulo?.message} className="sm:col-span-2" placeholder="Auditoría interna al proceso de Urgencias" {...register('titulo')} />
          </div>
          {/* La Ficha Técnica del informe pide fechas planeadas y reales; las reales se pueden completar después */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Fecha inicio (planeada)" type="date" error={errors.fecha_inicio?.message} {...register('fecha_inicio')} />
            <Campo etiqueta="Fecha terminación (planeada)" type="date" error={errors.fecha_fin?.message} {...register('fecha_fin')} />
            <Campo etiqueta="Fecha inicio (real)" type="date" ayuda="Opcional: puedes registrarla al generar el informe." error={errors.fecha_inicio_real?.message} {...register('fecha_inicio_real')} />
            <Campo etiqueta="Fecha terminación (real)" type="date" ayuda="Opcional: puedes registrarla al generar el informe." error={errors.fecha_fin_real?.message} {...register('fecha_fin_real')} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Alcance">
          <CamposAlcance register={register} errors={errors} control={control} setValue={setValue} nombreGrupo="alcance-auditoria" />
        </Tarjeta>

        <Tarjeta
          titulo="Planeación"
          descripcion="Campos que no necesitas redactar desde cero."
          acciones={<Boton variante="secundario" icono={Sparkles} cargando={sugiriendo} onClick={sugerir}>Sugerir con IA</Boton>}
        >
          {avisoIa && <p className="mb-4 rounded-md bg-om-bg px-3 py-2 text-sm text-om-texto" role="status">{avisoIa}</p>}
          <div className="space-y-4">
            <AreaTexto etiqueta="Objetivo de la auditoría" rows={3} error={errors.objetivo?.message} {...register('objetivo')} />
            <Campo etiqueta="Área o servicio auditado" error={errors.area_auditada?.message} {...register('area_auditada')} />
            <fieldset>
              <legend className="text-sm font-medium text-tinta-700">Criterios de auditoría (normas aplicables)</legend>
              <p className="mt-1 text-xs text-tinta-500">Solo los documentos cargados en la plataforma. El informe listará únicamente los numerales realmente citados.</p>
              <div className="mt-3 space-y-2">
                {DOCUMENTOS.map((d) => (
                  <Checkbox key={d.codigo} etiqueta={d.codigo} ayuda={d.titulo} checked={criterios.includes(d.codigo)} onChange={() => alternarCriterio(d.codigo)} />
                ))}
              </div>
            </fieldset>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Auditado" descripcion="Persona responsable del proceso o sistema auditado (opcional).">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" {...register('auditado_nombre')} />
            <Campo etiqueta="Cargo" {...register('auditado_cargo')} />
          </div>
        </Tarjeta>

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navigate('/app/auditorias')}>Cancelar</Boton>
          <Boton type="submit" cargando={isSubmitting}>Crear auditoría</Boton>
        </div>
      </form>
    </>
  )
}
