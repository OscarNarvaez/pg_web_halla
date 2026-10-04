import { Link } from 'react-router-dom'
import { Marca } from '../components/layout/Marca'

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Marca />
      <h1 className="mt-8 text-2xl font-semibold text-tinta-900">No encontramos esa página</h1>
      <p className="mt-2 text-sm text-tinta-500">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
      <Link to="/" className="enlace mt-6 text-sm">Volver al inicio</Link>
    </main>
  )
}
