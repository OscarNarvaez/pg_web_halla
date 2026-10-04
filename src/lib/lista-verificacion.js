// Lista de verificación de la auditoría (formato entregado por el dueño, migración 0011). Es la hoja de trabajo del
// auditor antes y durante la visita: no pasa por la IA ni alimenta los hallazgos, la matriz o el informe.
import { objetoAuditado } from './catalogos'

// Textos del formato, tal como aparecen en él
export const TEXTOS_LISTA = {
  auditoriaNo: 'Auditoría No',
  fecha: 'Fecha',
  informacionGeneral: 'INFORMACION GENERAL',
  listaVerificacion: 'LISTA DE VERIFICACIÓN',
  leyenda: 'O = Oportunidad   NC = No Conforme   OB = Observación   F= Fortalezas',
}

// Filas de «INFORMACION GENERAL», con su clave en el encabezado guardado
export const CAMPOS_INFORMACION = [
  { clave: 'elaborada_por', etiqueta: 'ELABORADA POR:' },
  { clave: 'proceso', etiqueta: 'PROCESO A AUDITAR' },
  { clave: 'auditados', etiqueta: 'CARGO Y NOMBRE DE LOS AUDITADOS:' },
  { clave: 'fecha_ejecucion', etiqueta: 'FECHA DE EJECUCIÓN:', tipo: 'date' },
  { clave: 'lugar', etiqueta: 'LUGAR DE EJECUCIÓN:' },
]

// Columnas de la lista; las de marca (NC, O, OB, F) van entre «Documentos – evidencia» y las anotaciones
export const COLUMNAS_LISTA = {
  requisito: 'Normatividad/requisito/ componente por auditar',
  pregunta: 'Pregunta',
  documentos: 'Documentos – evidencia',
  anotaciones: 'Hallazgos o anotaciones',
}

export const FILAS_INICIALES = 5
export const MAX_FILAS = 200
export const MAX_SECCIONES = 30

export const filaVacia = () => ({ requisito: '', pregunta: '', documentos: '', marca: null, anotaciones: '' })
export const seccionVacia = (titulo = '') => ({ titulo, filas: Array.from({ length: FILAS_INICIALES }, filaVacia) })

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

/** Lista nueva con los datos que ya se conocen de la auditoría y del auditor. */
export function listaInicial(auditoria, perfil) {
  return {
    encabezado: {
      fecha: hoy(),
      elaborada_por: perfil?.nombre_completo ?? '',
      proceso: objetoAuditado(auditoria) ?? '',
      auditados: [auditoria.auditado_cargo, auditoria.auditado_nombre].filter(Boolean).join(' - '),
      fecha_ejecucion: auditoria.fecha_inicio_real || auditoria.fecha_inicio || '',
      lugar: auditoria.area_auditada ?? '',
    },
    secciones: [seccionVacia((objetoAuditado(auditoria) ?? '').toUpperCase())],
  }
}

/** «2026-10-04» → { dia: '04', mes: '10', anio: '2026' }, para las tres casillas de «Fecha» del formato. */
export function partesFecha(iso) {
  const [anio = '', mes = '', dia = ''] = String(iso ?? '').split('-')
  return { dia, mes, anio }
}

/** Lista_verificacion_<codigo>_<AAAAMMDD>.pdf */
export function nombreArchivoLista(codigo) {
  return `Lista_verificacion_${String(codigo).replace(/[^\w-]+/g, '-')}_${hoy().replaceAll('-', '')}.pdf`
}
