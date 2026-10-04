import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'
import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        tinta: {
          50: '#f4f6f8',
          100: '#e6eaee',
          300: '#9fb0bf',
          500: '#4a6072',
          700: '#2b3b49',
          900: '#16222c',
        },
        halla: {
          50: '#eef6f5',
          100: '#d5eceb',
          400: '#4fb3aa',
          500: '#2f9189',
          600: '#237a73',
          700: '#1b5f5a',
        },
        // Colores semánticos por clasificación — úsalos SIEMPRE consistentes
        nc: { bg: '#fef2f2', borde: '#fca5a5', texto: '#991b1b', solido: '#b42318' }, // NO CONFORMIDAD
        obs: { bg: '#fffbeb', borde: '#fcd34d', texto: '#92400e', solido: '#94620a' }, // OBSERVACIÓN
        fort: { bg: '#f0fdf4', borde: '#86efac', texto: '#166534', solido: '#1b7a4b' }, // FORTALEZA
        om: { bg: '#eff6ff', borde: '#93c5fd', texto: '#1e40af', solido: '#1f5fa8' }, // OPORTUNIDAD DE MEJORA
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['"Source Serif 4"', ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [forms, typography],
}
