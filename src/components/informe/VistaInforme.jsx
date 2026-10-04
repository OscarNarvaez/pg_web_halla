import { AlertTriangle } from 'lucide-react'
import { CLASIFICACIONES, TONOS } from '../../lib/catalogos'
import { fechaLarga, formatearCedula } from '../../lib/formato'
import { GraficaClasificaciones } from './GraficaClasificaciones'
import { integrantesEquipo } from '../../lib/exportar-comun'
import logo from '../../assets/logo-hila.webp'

function Seccion({ n, titulo, children }) {
  return (
    <section className="break-inside-avoid-page" aria-labelledby={`seccion-${n}`}>
      <h2 id={`seccion-${n}`} className="mb-3 mt-10 border-b border-tinta-100 pb-1 font-sans text-base font-semibold uppercase tracking-wide text-halla-700">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[12rem_1fr]">
      <dt className="font-sans text-sm font-semibold text-tinta-500">{etiqueta}</dt>
      <dd className="text-tinta-900">{children || <span className="italic text-tinta-500">No informado</span>}</dd>
    </div>
  )
}

/** Informe de auditoría con la estructura obligatoria de 11 secciones (ISO 19011). */
export function VistaInforme({ informe }) {
  const c = informe.contenido
  const conteo = Object.fromEntries(c.resumen_resultados.por_clasificacion.map((x) => [x.clasificacion, x.total]))
  const periodo = c.alcance.periodo.inicio
    ? `${fechaLarga(c.alcance.periodo.inicio)}${c.alcance.periodo.fin ? ` a ${fechaLarga(c.alcance.periodo.fin)}` : ''}`
    : ''

  return (
    <article className="mx-auto max-w-4xl rounded-lg border border-tinta-100 bg-white px-5 py-8 font-serif text-[15px] leading-relaxed text-tinta-900 shadow-sm sm:px-12 sm:py-12 print:border-0 print:p-0 print:shadow-none">
      {c.avisos?.length > 0 && (
        <ul className="no-imprimir mb-8 space-y-2 font-sans">
          {c.avisos.map((a) => (
            <li key={a} className="flex gap-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{a}
            </li>
          ))}
        </ul>
      )}

      <header className="text-center">
        <img src={logo} alt={`Logo del ${c.identificacion.institucion}`} width="80" height="80" className="mx-auto mb-4 size-20" />
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-tinta-500">{c.identificacion.institucion} · {c.identificacion.ciudad}</p>
        <h1 className="mt-2 text-3xl font-semibold">Informe de auditoría interna</h1>
        <p className="mt-1 text-tinta-700">{c.identificacion.titulo}</p>
      </header>

      <section className="mt-8 rounded-md bg-tinta-50 p-5" aria-labelledby="resumen-ejecutivo">
        <h2 id="resumen-ejecutivo" className="font-sans text-sm font-semibold uppercase tracking-wide text-tinta-500">Resumen ejecutivo</h2>
        <p className="mt-2">{c.resumen_ejecutivo}</p>
      </section>

      <Seccion n={1} titulo="Identificación">
        <dl>
          <Dato etiqueta="Código">{c.identificacion.codigo}</Dato>
          <Dato etiqueta="Institución">{c.identificacion.institucion}</Dato>
          <Dato etiqueta="Fecha de emisión">{fechaLarga(c.identificacion.fecha_emision)}</Dato>
          <Dato etiqueta="Versión del informe">{c.identificacion.version}</Dato>
        </dl>
      </Seccion>

      <Seccion n={2} titulo="Objetivo de la auditoría">
        <p>{c.objetivo || <span className="italic text-tinta-500">No informado</span>}</p>
      </Seccion>

      <Seccion n={3} titulo="Alcance">
        <dl>
          <Dato etiqueta={c.alcance.tipo === 'SISTEMAS' ? 'Sistema auditado' : 'Proceso auditado'}>{c.alcance.objeto}</Dato>
          <Dato etiqueta="Área auditada">{c.alcance.area_auditada}</Dato>
          <Dato etiqueta="Periodo">{periodo}</Dato>
          <Dato etiqueta="Auditado">{[c.alcance.auditado.nombre, c.alcance.auditado.cargo].filter(Boolean).join(', ')}</Dato>
        </dl>
      </Seccion>

      <Seccion n={4} titulo="Criterios de auditoría">
        {c.criterios.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {c.criterios.map((cr) => (
              <li key={cr.documento}>
                {cr.documento}
                {cr.numerales.length > 0 && `: ${cr.numerales.length === 1 ? 'numeral' : 'numerales'} ${cr.numerales.join(', ')}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="italic text-tinta-500">Ningún hallazgo cita un requisito verificado de los documentos cargados.</p>
        )}
      </Seccion>

      <Seccion n={5} titulo="Equipo auditor">
        <dl>
          <Dato etiqueta="Auditor líder">{c.equipo_auditor.lider.nombre}, {c.equipo_auditor.lider.cargo}</Dato>
          <Dato etiqueta="Equipo auditor">
            <ul className="space-y-0.5">
              {integrantesEquipo(c).map((m, i) => <li key={`${m.nombre}-${i}`}>{m.nombre}, {m.cargo}</li>)}
            </ul>
          </Dato>
        </dl>
      </Seccion>

      <Seccion n={6} titulo="Metodología">
        <ul className="list-disc space-y-1 pl-5">{c.metodologia.map((m) => <li key={m}>{m}</li>)}</ul>
      </Seccion>

      <Seccion n={7} titulo="Resumen de resultados">
        <div className="grid gap-6 font-sans md:grid-cols-2 md:items-center">
          <table className="w-full text-sm">
            <caption className="sr-only">Hallazgos por clasificación</caption>
            <thead>
              <tr className="border-b border-tinta-300 text-left">
                <th scope="col" className="py-2 font-semibold">Clasificación</th>
                <th scope="col" className="py-2 text-right font-semibold">Hallazgos</th>
              </tr>
            </thead>
            <tbody>
              {c.resumen_resultados.por_clasificacion.map((x) => (
                <tr key={x.clasificacion} className="border-b border-tinta-100">
                  <th scope="row" className="py-2 text-left font-normal">
                    <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: TONOS[CLASIFICACIONES[x.clasificacion].tono].solido }} aria-hidden="true" />
                    {x.etiqueta}
                  </th>
                  <td className="py-2 text-right tabular-nums">{x.total}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 text-left">Total</th>
                <td className="py-2 text-right tabular-nums">{c.resumen_resultados.total}</td>
              </tr>
            </tbody>
          </table>
          <GraficaClasificaciones conteo={conteo} alto={200} animar={false} />
        </div>
      </Seccion>

      <Seccion n={8} titulo="Hallazgos en detalle">
        {c.hallazgos.map((grupo) => (
          <div key={grupo.clasificacion} className="mt-6 first:mt-0">
            <h3 className="font-sans text-sm font-semibold text-tinta-700">
              <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: TONOS[CLASIFICACIONES[grupo.clasificacion].tono].solido }} aria-hidden="true" />
              {grupo.etiqueta} ({grupo.items.length})
            </h3>
            {grupo.items.length === 0 ? (
              <p className="mt-2 text-sm italic text-tinta-500">No se registraron {grupo.etiqueta.toLowerCase()}.</p>
            ) : (
              <ol className="mt-3 space-y-4">
                {grupo.items.map((h) => (
                  <li key={h.id} className="break-inside-avoid rounded-md border border-tinta-100 p-4" style={{ borderLeft: `4px solid ${TONOS[CLASIFICACIONES[grupo.clasificacion].tono].solido}` }}>
                    <p className="font-sans text-xs font-semibold text-tinta-500">
                      Hallazgo H-{String(h.consecutivo).padStart(2, '0')}{h.severidad ? ` · severidad ${h.severidad}` : ''}
                    </p>
                    <p className="mt-1">{h.hallazgo_corregido}</p>
                    <p className="mt-2 text-sm"><span className="font-sans font-semibold text-tinta-500">Criterio: </span>{h.criterio_requisito}</p>
                    <p className="mt-1 text-sm"><span className="font-sans font-semibold text-tinta-500">Evidencia: </span>{h.evidencia}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </Seccion>

      <Seccion n={9} titulo="Conclusiones">
        {c.conclusiones.split(/\n\s*\n/).map((p) => <p key={p.slice(0, 40)} className="mb-3">{p}</p>)}
      </Seccion>

      <Seccion n={10} titulo="Recomendaciones">
        <ol className="list-decimal space-y-1 pl-5">{c.recomendaciones.map((r) => <li key={r}>{r}</li>)}</ol>
      </Seccion>

      <Seccion n={11} titulo="Firmas">
        <div className="mt-12 grid gap-12 font-sans text-sm sm:grid-cols-2">
          {c.firmas.map((f, i) => (
            <div key={`${f.rol}-${i}`} className="break-inside-avoid">
              <div className="border-t border-tinta-900 pt-2">
                <p className="font-semibold text-tinta-900">{f.nombre}</p>
                <p className="text-tinta-700">{f.cargo}</p>
                <p className="text-tinta-700">C.C. {f.cedula ? formatearCedula(f.cedula) : '______________________'}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-tinta-500">{f.rol}</p>
              </div>
            </div>
          ))}
        </div>
      </Seccion>
    </article>
  )
}
