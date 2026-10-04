import { defineConfig, loadEnv } from 'vite'
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

/**
 * Content Security Policy como <meta>, porque GitHub Pages no permite cabeceras HTTP propias.
 * Solo se permiten scripts del propio sitio y conexiones al proyecto Supabase configurado: si una
 * inyección de HTML llegara a ocurrir, no podría cargar código ni enviar la sesión a otro servidor.
 * Solo en el build: el servidor de desarrollo de Vite inyecta scripts en línea.
 */
function seguridadHtml(supabaseUrl) {
  const supabase = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl ?? '') ? supabaseUrl : ''
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    // 'unsafe-inline' solo para estilos: React y Recharts usan atributos style
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${supabase ? ` ${supabase} ${supabase.replace('https://', 'wss://')}` : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join('; ')
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
  return {
    base: '/',
    plugins: [react(), spa404(), seguridadHtml(env.VITE_SUPABASE_URL)],
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
