import { Marca } from './Marca'

/** Contenedor de las pantallas de acceso: marca arriba y una tarjeta centrada. */
export function LayoutPublico({ titulo, descripcion, children, ancho = 'max-w-md' }) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center">
      <div className={`w-full ${ancho}`}>
        <Marca conInstitucion className="mb-8" />
        <div className="rounded-lg border border-tinta-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-tinta-900">{titulo}</h1>
          {descripcion && <p className="mt-1 text-sm text-tinta-500">{descripcion}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
