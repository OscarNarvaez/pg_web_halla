import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

// Protección contra clickjacking: GitHub Pages no permite la cabecera frame-ancestors, así que la
// aplicación se niega a mostrarse dentro de un iframe de otro sitio.
const enMarcoAjeno = (() => {
  try {
    return window.top !== window.self
  } catch {
    return true
  }
})()

if (enMarcoAjeno) {
  const aviso = document.createElement('p')
  aviso.textContent =
    'Por seguridad, halla no se puede mostrar dentro de otro sitio. Ábrela directamente en https://halla.ink'
  aviso.style.cssText = 'font-family:sans-serif;padding:2rem'
  document.getElementById('root').replaceChildren(aviso)
} else {
  renderizar()
}

function renderizar() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
