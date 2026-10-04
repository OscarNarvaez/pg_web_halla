import { Link, Navigate } from 'react-router-dom'
import { BookCheck, FileText, PenLine, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { CLASIFICACIONES, DOCUMENTOS, ESTRUCTURAS, INSTITUCION, MARCADOR_PENDIENTE, TONOS } from '../lib/catalogos'
import { Marca } from '../components/layout/Marca'
import { FondoFachada } from '../components/layout/FondoFachada'

const PASOS = [
  { icono: PenLine, titulo: 'Describe lo que observaste', texto: 'En tus palabras: qué revisaste, cuántos registros, qué encontraste y dónde.' },
  { icono: Sparkles, titulo: 'La IA clasifica y redacta', texto: 'Decide si es no conformidad, observación, oportunidad de mejora o fortaleza, y reescribe el hallazgo con la estructura técnica de esa categoría.' },
  { icono: BookCheck, titulo: 'Verifica contra las normas', texto: 'Cada requisito citado se comprueba contra los documentos cargados. Si no hay uno verificable, lo dice.' },
  { icono: FileText, titulo: 'Genera el informe', texto: 'Consolida los hallazgos en un informe con la estructura de ISO 19011, exportable a PDF y Word.' },
]

const ORDEN = ['NO_CONFORMIDAD', 'OBSERVACION', 'OPORTUNIDAD_DE_MEJORA', 'FORTALEZA']

export default function Landing() {
  const { sesion, cargando } = useAuth()
  if (!cargando && sesion) return <Navigate to="/app" replace />

  return (
    <div className="bg-white">
      <header className="border-b border-tinta-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Marca conInstitucion />
          <nav aria-label="Acceso" className="flex items-center gap-2">
            <Link to="/ingresar" className="rounded-lg px-3 py-2 text-sm font-semibold text-tinta-700 hover:bg-tinta-50">Ingresar</Link>
            <Link to="/registro" className="rounded-lg bg-halla-700 px-4 py-2 text-sm font-semibold text-white hover:bg-halla-600">Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-tinta-900 text-white">
          <FondoFachada className="absolute inset-0 -z-10" />
          {/* Velo: el texto queda sobre al menos 75 % de tinta-900, así el contraste es AA aun sobre las nubes blancas */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-tinta-900/75 lg:bg-transparent lg:bg-gradient-to-r lg:from-tinta-900/90 lg:via-tinta-900/75 lg:via-70% lg:to-tinta-900/25"
          />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 lg:py-32">
            <p className="text-sm font-semibold uppercase tracking-widest text-halla-100">Auditoría interna · {INSTITUCION.nombre}</p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Halla. Sistema Auditor
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-tinta-100">
              La inteligencia artificial ayuda a los auditores internos a redactar hallazgos con la estructura técnica de cada categoría, verificando cada requisito citado normativamente.
            </p>

            <p className="mt-6 max-w-2xl text-lg text-tinta-100">
              Sistema experto. Facilitando el trabajo auditador .
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/registro" className="rounded-lg bg-halla-500 px-5 py-3 text-sm font-semibold text-white hover:bg-halla-400">Crear cuenta de auditor</Link>
              <Link to="/ingresar" className="rounded-lg border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Ya tengo cuenta</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-2xl font-semibold text-tinta-900">Cómo funciona</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className="rounded-lg border border-tinta-100 p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-halla-50 text-sm font-semibold text-halla-700">{i + 1}</span>
                  <Icono className="size-5 text-halla-600" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-semibold text-tinta-900">{titulo}</h3>
                <p className="mt-1 text-sm text-tinta-500">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-tinta-50" aria-labelledby="categorias">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 id="categorias" className="text-2xl font-semibold text-tinta-900">Cuatro categorías, cuatro fórmulas de redacción</h2>
            <p className="mt-2 max-w-3xl text-sm text-tinta-500">
              La clasificación no la eliges tú: la determina el sistema con un orden de decisión explícito, del incumplimiento a la oportunidad de optimizar.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {ORDEN.map((clave) => {
                const c = CLASIFICACIONES[clave]
                return (
                  <article key={clave} className="rounded-lg border border-tinta-100 bg-white p-5" style={{ borderLeft: `4px solid ${TONOS[c.tono].solido}` }}>
                    <h3 className="font-semibold text-tinta-900">{c.etiqueta}</h3>
                    <p className="mt-1 text-sm font-medium text-tinta-700">{ESTRUCTURAS[clave].formula}</p>
                    <p className="mt-3 font-serif text-[15px] leading-relaxed text-tinta-500">«{ESTRUCTURAS[clave].ejemplo}»</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="fuente">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="fuente" className="text-2xl font-semibold text-tinta-900">Una sola fuente normativa</h2>
              <p className="mt-3 text-sm text-tinta-500">
                La IA solo puede citar requisitos de los documentos cargados en la plataforma. Cada numeral citado se verifica
                en el servidor; si no hay un requisito verificable, el hallazgo lo indica literalmente:
              </p>
              <p className="mt-3 rounded-md bg-tinta-50 px-3 py-2 font-mono text-xs text-tinta-700">{MARCADOR_PENDIENTE}</p>
              <p className="mt-4 flex items-start gap-2 text-sm text-tinta-500">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-halla-600" aria-hidden="true" />
                El texto original del auditor nunca se sobrescribe: cada hallazgo conserva la entrada, la respuesta de la IA y el modelo usado.
              </p>
            </div>
            <ul className="space-y-3">
              {DOCUMENTOS.map((d) => (
                <li key={d.codigo} className="rounded-lg border border-tinta-100 px-4 py-3">
                  <p className="text-sm font-semibold text-tinta-900">{d.codigo}</p>
                  <p className="text-xs text-tinta-500">{d.titulo}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-tinta-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-tinta-500">
          <span>halla.ink · {INSTITUCION.nombre}, {INSTITUCION.ciudad}</span>
          <span>Herramienta de apoyo: el juicio profesional sigue siendo del auditor.</span>
        </div>
      </footer>
    </div>
  )
}
