// Exportación de la matriz consolidada a Excel (write-excel-file). Se importa bajo demanda.
// Solo se llama con todos los hallazgos validados: la regla la aplica MatrizConsolidada.jsx.
import writeXlsxFile from 'write-excel-file/browser'
import { CLASIFICACIONES, INSTITUCION, UMBRALES_RIESGO } from './catalogos'
import { COLORES_ZONA, evaluarRiesgo } from './riesgo'
import { fechaArchivo, fechaLarga } from './formato'
import { COLUMNAS_MATRIZ, filasMatriz } from './matriz'

const ANCHOS = [8, 18, 28, 45, 45, 60, 30, 55, 14]
const BORDE = '#c9d2da'
// Texto de cada clasificación (los mismos *-texto de tailwind.config.js, con contraste AA sobre blanco)
const TEXTO_CLASE = { nc: '#991b1b', obs: '#92400e', fort: '#166534', om: '#1e40af' }

export async function exportarMatriz({ auditoria, hallazgos }) {
  const u = UMBRALES_RIESGO
  const celda = (value, extra = {}) => ({ value: value ?? '', type: String, wrap: true, alignVertical: 'top', borderColor: BORDE, borderStyle: 'thin', ...extra })
  const titulo = [
    [{ value: `Matriz consolidada de hallazgos · ${auditoria.codigo}`, type: String, fontWeight: 'bold', fontSize: 14, columnSpan: COLUMNAS_MATRIZ.length }],
    [{ value: `${auditoria.titulo} · ${INSTITUCION.nombre}, ${INSTITUCION.ciudad} · Descargada el ${fechaLarga(new Date().toISOString())}`, type: String, columnSpan: COLUMNAS_MATRIZ.length }],
    [{ value: `Riesgo inherente = probabilidad × impacto (PR13_GQ). Niveles: Bajo ≤ ${u.bajo}, Moderado ≤ ${u.moderado}, Alto ≤ ${u.alto}, Extremo > ${u.alto}.`, type: String, columnSpan: COLUMNAS_MATRIZ.length }],
    [],
  ]
  const encabezado = COLUMNAS_MATRIZ.map((c) => celda(c, { fontWeight: 'bold', backgroundColor: '#16222c', textColor: '#ffffff' }))
  const filas = filasMatriz(hallazgos).map((fila, n) => {
    const h = hallazgos[n]
    const zona = evaluarRiesgo(h)?.zona
    return fila.map((valor, i) => {
      if (i === 1) return celda(valor, { fontWeight: 'bold', textColor: TEXTO_CLASE[CLASIFICACIONES[h.clasificacion].tono] })
      if (i === 6 && zona) return celda(valor, { backgroundColor: COLORES_ZONA[zona].fondo, textColor: COLORES_ZONA[zona].texto })
      return celda(valor)
    })
  })
  await writeXlsxFile([...titulo, encabezado, ...filas], {
    sheet: 'Matriz consolidada',
    columns: ANCHOS.map((width) => ({ width })),
    stickyRowsCount: titulo.length + 1,
    orientation: 'landscape',
  }).toFile(`Matriz_${String(auditoria.codigo).replace(/[^\w-]+/g, '-')}_${fechaArchivo()}.xlsx`)
}
