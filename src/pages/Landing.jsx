import { INSTITUCION } from '../lib/catalogos'

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-halla-700">
        {INSTITUCION.nombre} · {INSTITUCION.ciudad}
      </p>
      <h1 className="mt-3 font-serif text-5xl font-semibold text-tinta-900">halla</h1>
      <p className="mt-4 text-lg text-tinta-700">
        Sistema experto de clasificación y redacción de hallazgos de auditoría interna.
      </p>
    </main>
  )
}
