// Fuentes Unicode para los PDF (la Helvetica de jsPDF rompe tildes en algunos visores). Liberation Sans tiene
// licencia OFL y las mismas medidas de Arial, la fuente de los formatos del hospital.
const FUENTES = [
  { archivo: 'LiberationSans-Regular.ttf', familia: 'LiberationSans', estilo: 'normal' },
  { archivo: 'LiberationSans-Bold.ttf', familia: 'LiberationSans', estilo: 'bold' },
]
let fuentesCache = null

function aBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

/** Descarga (una sola vez) las fuentes. */
function cargarFuentes() {
  if (!fuentesCache) {
    fuentesCache = Promise.all(
      FUENTES.map(async (f) => {
        const r = await fetch(`/fonts/${f.archivo}`)
        if (!r.ok) throw new Error(`No se pudo cargar la fuente ${f.archivo}`)
        return { ...f, base64: aBase64(await r.arrayBuffer()) }
      }),
    ).catch((e) => {
      fuentesCache = null
      throw e
    })
  }
  return fuentesCache
}

/** Registra Liberation Sans (normal y negrita) en un documento de jsPDF. */
export async function registrarFuentes(doc) {
  for (const f of await cargarFuentes()) {
    doc.addFileToVFS(f.archivo, f.base64)
    doc.addFont(f.archivo, f.familia, f.estilo)
  }
}
