// Los 7 pasos del registro de un hallazgo y el paso en que se muestra cada aviso de la validación.

export const PASOS = [
  { n: 1, titulo: 'Evidencia', descripcion: 'Escribe lo que encontraste o carga un PDF con tus hallazgos.' },
  { n: 2, titulo: 'Requisito', descripcion: 'La norma, el numeral y el requisito que aplican, verificados en los documentos cargados.' },
  { n: 3, titulo: 'Clasificación', descripcion: 'La categoría que determinó la IA y por qué.' },
  { n: 4, titulo: 'Redacción', descripcion: 'El hallazgo reescrito con la estructura técnica de su categoría.' },
  { n: 5, titulo: 'Riesgo', descripcion: 'Identificación, evaluación y mapa de calor según el PR13_GQ.' },
  { n: 6, titulo: 'Controles', descripcion: 'Recomendaciones de controles: marca las que adoptas o agrega las tuyas.' },
  { n: 7, titulo: 'Matriz', descripcion: 'Revisa el resumen y envía todo a la matriz consolidada.' },
]

// Cada aviso de la validación se muestra en el paso al que se refiere
export const AVISOS_DEL_PASO = {
  requisito: /requisito verificable|referencias normativas/,
  redaccion: /^Revisa la redacción|fechas o cifras/,
  riesgo: /^Completa el riesgo/,
  controles: /^La IA no propuso controles/,
}
