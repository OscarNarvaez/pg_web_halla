import { Marca } from './Marca'
import { FondoFachada } from './FondoFachada'

/** Contenedor de las pantallas de acceso: la fachada del hospital de fondo, la marca arriba y una tarjeta centrada. */
export function LayoutPublico({ titulo, descripcion, children, ancho = 'max-w-md' }) {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center">
      {/* Fijos: en formularios largos (registro) el fondo no se desplaza ni se corta */}
      <FondoFachada className="fixed inset-0 -z-10" />
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-tinta-900/70" />
      <div className={`w-full ${ancho}`}>
        <Marca conInstitucion invertida className="mb-8" />
        <div className="rounded-lg border border-tinta-100 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-xl font-semibold text-tinta-900">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-tinta-500">{descripcion}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
