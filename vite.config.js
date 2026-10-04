import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'

// GitHub Pages solo sirve archivos estáticos: copiar index.html a 404.html hace que las rutas
// profundas (halla.ink/app/auditorias/<id>) carguen la SPA en lugar de un 404.
function spa404() {
  let salida = 'dist'
  return {
    name: 'spa-404',
    apply: 'build',
    configResolved(config) {
      salida = config.build.outDir
    },
    closeBundle() {
      copyFileSync(join(salida, 'index.html'), join(salida, '404.html'))
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), spa404()],
  server: { port: 5173, strictPort: true },
})
