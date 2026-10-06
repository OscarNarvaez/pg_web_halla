import { AlertTriangle } from 'lucide-react'
import logo from '../../assets/logo-hila.webp'
import { cx } from '../../lib/cx'
import {
  LISTAS_HALLAZGOS, TEXTOS_FORMATO, lineaGenerado, parrafos, personaFicha, seccionesFormato, tituloAuditoria,
} from '../../lib/formato-informe'

// Tipografías de la plantilla (Trebuchet MS en el cuerpo, Arial en la tabla y el encabezado), con equivalentes libres
const CUERPO = { fontFamily: '"Trebuchet MS", "Liberation Sans", Arial, sans-serif' }
const TABLA = { fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif' }
const ENSANCHADO = { transform: 'scaleX(1.15)', transformOrigin: 'left', display: 'inline-block' }

function Titulo({ children, estilo = 'subrayado' }) {
  return (
    <h2 className={cx('mt-4 font-bold', estilo === 'centrado' ? 'text-center' : 'underline underline-offset-2')}>
      {children}
    </h2>
  )
}

function Celda({ etiqueta, children, ancho = 1, className }) {
  return etiqueta ? (
    <th scope="row" colSpan={ancho} className={cx('border border-[#cccccc] bg-[#efefef] px-2 py-1 text-center font-bold', className)}>{children}</th>
  ) : (
    <td colSpan={ancho} className={cx('border border-[#cccccc] px-2 py-1', className)}>{children}</td>
  )
}

/**
 * Informe final con el formato oficial del hospital (src/formato_de_informe_final/Auditoria_interna.odt): portada,
 * Ficha Técnica, listas de hallazgos y las secciones de Objetivo a Recomendaciones, en el orden de la plantilla.
 */
export function VistaInforme({ informe }) {
  const c = informe.contenido
  const f = c.ficha
  return (
    <div className="space-y-3">
      {c.avisos?.length > 0 && (
        <ul className="no-imprimir mx-auto max-w-4xl space-y-2">
          {c.avisos.map((a) => (
            <li key={a} className="flex gap-2 rounded-md border border-obs-borde bg-obs-bg px-3 py-2 text-sm text-obs-texto">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{a}
            </li>
          ))}
        </ul>
      )}

      <article
        aria-label="Informe final de auditoría"
        className="mx-auto max-w-4xl rounded-lg border border-tinta-100 bg-white px-5 py-6 text-[13px] leading-snug text-black shadow-sm sm:px-10"
        style={CUERPO}
      >
        {/* Encabezado de la plantilla */}
        <header className="flex justify-between gap-6 text-[11px] text-[#767676]" style={TABLA}>
          <span>{TEXTOS_FORMATO.institucion}</span>
          <span className="text-right">{tituloAuditoria(c)}</span>
        </header>

        {/* Portada */}
        <section aria-label="Portada" className="border-b border-dashed border-tinta-100 py-10 text-center font-bold">
          <img src={logo} alt={`Logo del ${c.identificacion.institucion}`} width="168" height="168" className="mx-auto mb-6 size-40" />
          <p style={{ ...ENSANCHADO, transformOrigin: 'center' }}>{TEXTOS_FORMATO.institucion}</p>
          <p>{tituloAuditoria(c)}</p>
          <p>{c.encabezado.evaluador}</p>
          <p className="mt-3">{c.encabezado.anio}</p>
          <p>{TEXTOS_FORMATO.programa}</p>
        </section>

        {/* Ficha Técnica */}
        <table className="mt-6 w-full table-fixed border-collapse break-words text-[12px]" style={TABLA}>
          <caption className="sr-only">{TEXTOS_FORMATO.fichaTecnica}</caption>
          <tbody>
            <tr><Celda etiqueta ancho={4}>{TEXTOS_FORMATO.fichaTecnica}</Celda></tr>
            <tr>
              <Celda etiqueta>{TEXTOS_FORMATO.fechaInicioPlaneada}</Celda><Celda className="text-center">{f.inicio_planeada}</Celda>
              <Celda etiqueta>{TEXTOS_FORMATO.fechaFinPlaneada}</Celda><Celda className="text-center">{f.fin_planeada}</Celda>
            </tr>
            <tr>
              <Celda etiqueta>{TEXTOS_FORMATO.fechaInicioReal}</Celda><Celda className="text-center">{f.inicio_real}</Celda>
              <Celda etiqueta>{TEXTOS_FORMATO.fechaFinReal}</Celda><Celda className="text-center">{f.fin_real}</Celda>
            </tr>
            <tr><Celda etiqueta>{TEXTOS_FORMATO.sistemaReferencia}</Celda><Celda ancho={3}>{f.sistema_referencia}</Celda></tr>
            <tr><Celda etiqueta>{TEXTOS_FORMATO.evaluador}</Celda><Celda ancho={3}>{f.evaluador}</Celda></tr>
            <tr><Celda etiqueta ancho={4}>{TEXTOS_FORMATO.equipoAuditor}</Celda></tr>
            {(f.equipo.length ? f.equipo : [{}]).map((p, i) => (
              <tr key={`${p.nombre}-${i}`}><Celda etiqueta>{TEXTOS_FORMATO.equipoAuditor}</Celda><Celda ancho={3}>{personaFicha(p)}</Celda></tr>
            ))}
            <tr><Celda etiqueta>{TEXTOS_FORMATO.liderEquipo}</Celda><Celda ancho={3}>{personaFicha(f.lider)}</Celda></tr>
            <tr><Celda etiqueta ancho={4}>{TEXTOS_FORMATO.archivosAdjuntos}</Celda></tr>
            {[...f.adjuntos, '', '', ''].slice(0, Math.max(3, f.adjuntos.length)).map((archivo, i) => (
              <tr key={`${archivo}-${i}`} className="h-6"><Celda ancho={4}>{archivo}</Celda></tr>
            ))}
          </tbody>
        </table>

        {/* Hallazgos */}
        <Titulo>{TEXTOS_FORMATO.programa}</Titulo>
        {LISTAS_HALLAZGOS.map((lista) => {
          const items = c.hallazgos.find((g) => g.clasificacion === lista.clasificacion)?.items ?? []
          return (
            <section key={lista.clasificacion} aria-label={lista.titulo} className="mb-5">
              <p className="mt-3" style={ENSANCHADO}>{lista.titulo}</p>
              {items.length ? (
                <ul className="mt-1 space-y-1.5">
                  {items.map((h) => <li key={h.id} className="pl-3 -indent-3">• {h.texto}</li>)}
                </ul>
              ) : <p className="mt-1">{lista.vacio}</p>}
            </section>
          )
        })}

        {/* Secciones de Objetivo a Conclusiones */}
        {seccionesFormato(c).map((s) => {
          const contenido = Array.isArray(s.contenido) ? s.contenido : parrafos(s.contenido)
          const vinetas = s.vinetas ?? []
          return (
            <section key={s.titulo} aria-label={s.titulo} className="mb-4">
              <Titulo estilo={s.estiloTitulo}>{s.titulo}</Titulo>
              {s.antes && <p className="mt-2">{s.antes}</p>}
              {vinetas.length > 0 && (
                <ul className="mt-2 space-y-1">{vinetas.map((t) => <li key={t} className="pl-3 -indent-3">• {t}</li>)}</ul>
              )}
              {!contenido.length && !vinetas.length && <p className="mt-2">No informado.</p>}
              {s.tipo === 'parrafo' && contenido.map((t) => <p key={t} className="mt-2 text-justify">{t}</p>)}
              {s.tipo === 'vinetas' && (
                <ul className="mt-2 space-y-1">{contenido.map((t) => <li key={t} className="pl-3 -indent-3">• {t}</li>)}</ul>
              )}
            </section>
          )
        })}

        {/* Pie de la plantilla */}
        <footer className="mt-8 border-t border-tinta-100 pt-2 text-[11px] text-[#767676]" style={TABLA}>{lineaGenerado(c)}</footer>
      </article>
    </div>
  )
}
