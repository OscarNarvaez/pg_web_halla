import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'

// GitHub Pages solo sirve archivos estáticos: copiar index.html a 404.html hace que las rutas
// profundas (halla.ink/app/auditorias/<id>) carguen la SPA en lugar de un 404.
const spa404 = {
  name: 'spa-404',
  apply: 'build',
  closeBundle() {
    copyFileSync('dist/index.html', 'dist/404.html')
  },
}

export default defineConfig({
  base: '/',
  plugins: [react(), spa404],
  server: { port: 5173, strictPort: true },
})
