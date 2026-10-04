import { useState } from 'react'
import { BookOpenText, Search } from 'lucide-react'
import { supabase, mensajeError } from '../lib/supabase'
import { useConsulta } from '../hooks/useConsulta'
import { cx } from '../lib/cx'
import { Encabezado } from '../components/layout/Encabezado'
import { ModalCriterio } from '../components/hallazgos/ModalCriterio'
import { Boton, EstadoError, EstadoVacio, Skeleton, claseControl } from '../components/ui'

/** Pinta los términos encontrados (marcados por la BD entre ⟦ y ⟧) sin usar HTML crudo. */
function Resaltado({ texto }) {
  return (
    <>
      {String(texto).split(/(⟦[^⟧]*⟧)/g).map((parte, i) =>
        parte.startsWith('⟦') ? <mark key={i} className="rounded bg-obs-bg px-0.5 text-tinta-900">{parte.slice(1, -1)}</mark> : <span key={i}>{parte}</span>,
      )}
    </>
  )
}

const quitarOperadores = (q) => q.replace(/["()]/g, ' ').replace(/\s+-/g, ' ').trim()

export default function Normas() {
  const [consulta, setConsulta] = useState('')
  const [documento, setDocumento] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [modoO, setModoO] = useState(false)
  const [abierto, setAbierto] = useState(null)
  const documentos = useConsulta(() => supabase.rpc('resumen_documentos'), [], { inicial: [] })

  const buscar = async (q = consulta, doc = documento) => {
    const limpia = quitarOperadores(q)
    if (limpia.length < 3) return
    setBuscando(true)
    setError('')
    const filtro = doc ? [doc] : null
    // Primero todas las palabras; si no hay resultados, cualquiera de ellas
    let { data, error: err } = await supabase.rpc('explorar_criterios', { consulta: limpia, documentos: filtro, limite: 25 })
    let alterna = false
    if (!err && data?.length === 0 && limpia.includes(' ')) {
      alterna = true
      ;({ data, error: err } = await supabase.rpc('explorar_criterios', { consulta: limpia.split(/\s+/).join(' or '), documentos: filtro, limite: 25 }))
    }
    setBuscando(false)
    if (err) return setError(mensajeError(err))
    setModoO(alterna)
    setResultados(data)
  }

  return (
    <>
      <Encabezado
        titulo="Normas"
        descripcion="Consulta los requisitos que la IA puede citar. Son los únicos: si un numeral no está aquí, la IA no lo usa."
      />

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
        className="mb-6 flex flex-wrap gap-3"
      >
        <div className="relative min-w-0 flex-1 basis-64">
          <label htmlFor="buscar-normas" className="sr-only">Buscar en las normas</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-300" aria-hidden="true" />
          <input id="buscar-normas" type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)}
            placeholder="Por ejemplo: revisión por la dirección, información documentada…" className={cx(claseControl, 'pl-9')} />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="filtro-documento" className="sr-only">Documento</label>
          <select
            id="filtro-documento"
            value={documento}
            onChange={(e) => {
              setDocumento(e.target.value)
              if (resultados) buscar(consulta, e.target.value) // repite la búsqueda vigente con el nuevo filtro
            }}
            className={claseControl}
          >
            <option value="">Todos los documentos</option>
            {(documentos.datos ?? []).map((d) => (
              <option key={d.documento_codigo} value={d.documento_codigo}>{d.documento_codigo} ({d.fragmentos})</option>
            ))}
          </select>
        </div>
        <Boton type="submit" icono={Search} cargando={buscando} disabled={quitarOperadores(consulta).length < 3}>Buscar</Boton>
      </form>

      {documentos.error && <EstadoError mensaje={documentos.error} alReintentar={documentos.recargar} className="mb-4" />}
      {!documentos.cargando && !documentos.error && (documentos.datos ?? []).length === 0 && (
        <EstadoVacio icono={BookOpenText} titulo="La base normativa está vacía" descripcion="Aún no se han cargado los documentos normativos. El administrador debe ejecutar la ingesta (pnpm ingest)." className="mb-6" />
      )}

      <section aria-live="polite" aria-busy={buscando}>
        {error && <EstadoError mensaje={error} />}
        {buscando && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
        {!buscando && resultados === null && (documentos.datos ?? []).length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Documentos cargados">
            {documentos.datos.map((d) => (
              <li key={d.documento_codigo} className="rounded-lg border border-tinta-100 bg-white p-4">
                <p className="font-semibold text-tinta-900">{d.documento_codigo}</p>
                <p className="text-xs text-tinta-500">{d.documento_titulo}</p>
                <p className="mt-2 text-xs text-tinta-500">
                  {d.numerales} numerales · {d.fragmentos} fragmentos{d.idioma === 'en' ? ' · en inglés' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!buscando && resultados?.length === 0 && (
          <EstadoVacio titulo="Sin resultados" descripcion="Prueba con otras palabras o con el término que usa la norma (por ejemplo, «información documentada» en lugar de «registro»)." />
        )}
        {!buscando && resultados?.length > 0 && (
          <>
            <p className="mb-3 text-sm text-tinta-500">
              {resultados.length} resultado{resultados.length === 1 ? '' : 's'}{modoO ? ' con alguna de las palabras (ninguno las contenía todas)' : ''}.
            </p>
            <ul className="space-y-3">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setAbierto(r.id)}
                    className="block w-full rounded-lg border border-tinta-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-halla-400">
                    <p className="text-xs font-semibold text-halla-700">{r.documento_codigo}{r.numeral ? ` · numeral ${r.numeral}` : ''}</p>
                    <p className="font-semibold text-tinta-900">{r.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-tinta-700"><Resaltado texto={r.extracto} /></p>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <ModalCriterio criterioId={abierto} alCerrar={() => setAbierto(null)} />
    </>
  )
}
