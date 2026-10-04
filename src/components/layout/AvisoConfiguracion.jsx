import { Marca } from './Marca'

/** Se muestra cuando faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el build. */
export function AvisoConfiguracion() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <Marca />
      <div className="mt-8 rounded-lg border border-obs-borde bg-obs-bg p-5 text-sm text-obs-texto" role="alert">
        <h1 className="text-base font-semibold">La aplicación aún no está conectada a su base de datos</h1>
        <p className="mt-2">
          Faltan las variables <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>. En desarrollo, cópialas en{' '}
          <code className="font-mono">.env.local</code>; en GitHub Pages, configúralas como variables del repositorio.
          Los pasos están en <code className="font-mono">docs/DESPLIEGUE.md</code>.
        </p>
      </div>
    </main>
  )
}
