import { useMemo } from 'react'
import { ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useConsulta } from '../hooks/useConsulta'
import { mensajeError, supabase } from '../lib/supabase'
import { objetoAuditado } from '../lib/catalogos'
import { fechaCorta, formatearCedula } from '../lib/formato'
import { Encabezado } from '../components/layout/Encabezado'
import { Badge, Boton, EstadoError, EstadoVacio, Skeleton, Tabla, Tarjeta } from '../components/ui'

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Auditor' },
  { clave: 'alcance', titulo: 'Proceso o sistema' },
  { clave: 'registro', titulo: 'Registro' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'accion', titulo: 'Acción', className: 'text-right' },
]

/**
 * Aprobación de cuentas (solo administradores). La autorización real la hace la base de datos:
 * la función aprobar_auditor rechaza a quien no sea admin aprobado.
 */
export default function AdminAuditores() {
  const { perfil } = useAuth()
  const { notificar } = useToast()
  const perfiles = useConsulta(
    () =>
      supabase
        .from('profiles')
        .select('id, nombre_completo, cedula, cargos, alcance, proceso, sistema, rol, aprobado, aprobado_en, creado_en, acepto_tratamiento_datos_en')
        .order('creado_en', { ascending: false }),
    [],
    { inicial: [] },
  )

  const ordenados = useMemo(
    () => [...(perfiles.datos ?? [])].sort((a, b) => Number(a.aprobado) - Number(b.aprobado)),
    [perfiles.datos],
  )
  const pendientes = ordenados.filter((p) => !p.aprobado).length

  if (perfil.rol !== 'admin') {
    return <EstadoVacio icono={ShieldCheck} titulo="Solo para administradores" descripcion="Esta sección permite aprobar las cuentas de los auditores." />
  }

  const cambiar = async (p, aprobado) => {
    const { error } = await supabase.rpc('aprobar_auditor', { p_id: p.id, p_aprobado: aprobado })
    if (error) return notificar(mensajeError(error), 'error')
    perfiles.setDatos((lista) => lista.map((x) => (x.id === p.id ? { ...x, aprobado, aprobado_en: aprobado ? new Date().toISOString() : null } : x)))
    notificar(aprobado ? `Cuenta de ${p.nombre_completo} aprobada` : `Cuenta de ${p.nombre_completo} desactivada`, 'exito')
  }

  return (
    <>
      <Encabezado
        titulo="Auditores"
        descripcion="Nadie accede a la plataforma hasta que un administrador aprueba su cuenta. Verifica la identidad antes de aprobar."
      />
      {perfiles.error && <EstadoError mensaje={perfiles.error} alReintentar={perfiles.recargar} className="mb-4" />}
      <Tarjeta sinRelleno titulo={pendientes ? `${pendientes} cuenta${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'}` : 'Todas las cuentas están revisadas'}>
        {perfiles.cargando ? (
          <div className="space-y-2 p-5" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Tabla
            descripcion="Cuentas de auditores"
            columnas={COLUMNAS}
            filas={ordenados}
            celda={(p, col) => {
              if (col.clave === 'nombre') return (
                <div>
                  <p className="font-medium text-tinta-900">{p.nombre_completo}</p>
                  <p className="text-xs text-tinta-500">C.C. {formatearCedula(p.cedula)}{p.cargos?.length ? ` · ${p.cargos.join(', ')}` : ''}</p>
                </div>
              )
              if (col.clave === 'alcance') return <span className="text-tinta-700">{objetoAuditado(p)}</span>
              if (col.clave === 'registro') return <span className="whitespace-nowrap text-tinta-500">{fechaCorta(p.creado_en)}</span>
              if (col.clave === 'estado') return (
                <div className="flex flex-wrap gap-1">
                  <Badge tono={p.aprobado ? 'fort' : 'obs'}>{p.aprobado ? 'Aprobada' : 'Pendiente'}</Badge>
                  {p.rol === 'admin' && <Badge tono="marca">Admin</Badge>}
                </div>
              )
              if (p.id === perfil.id) return <span className="text-xs text-tinta-500">Tu cuenta</span>
              return p.aprobado ? (
                <Boton variante="peligro" tamano="sm" icono={UserX} onClick={() => cambiar(p, false)}>Desactivar</Boton>
              ) : (
                <Boton tamano="sm" icono={UserCheck} onClick={() => cambiar(p, true)}>Aprobar</Boton>
              )
            }}
          />
        )}
      </Tarjeta>
    </>
  )
}
