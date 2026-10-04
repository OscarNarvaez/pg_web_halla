import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizarUrlSupabase, politicaCsp } from './vite.csp.js'

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

/**
 * Content Security Policy como <meta>, porque GitHub Pages no permite cabeceras HTTP propias.
 * Solo en el build: el servidor de desarrollo de Vite inyecta scripts en línea.
 */
function seguridadHtml(origenSupabase) {
  const politica = politicaCsp(origenSupabase)
  return {
    name: 'seguridad-html',
    apply: 'build',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: politica }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin' }, injectTo: 'head-prepend' },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Falla aquí, con un mensaje claro, si la variable existe pero está mal escrita
  const origenSupabase = normalizarUrlSupabase(env.VITE_SUPABASE_URL)
  return {
    base: '/',
    plugins: [react(), spa404(), seguridadHtml(origenSupabase)],
    server: { port: 5173, strictPort: true },
    build: {
      sourcemap: false,
      // Librerías en chunks propios: el navegador las cachea entre despliegues y ninguno pasa de 500 kB
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('@supabase')) return 'supabase'
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
            if (/[\\/](zod|react-hook-form|@hookform)[\\/]/.test(id)) return 'formularios'
            return undefined
          },
        },
      },
    },
  }
})
