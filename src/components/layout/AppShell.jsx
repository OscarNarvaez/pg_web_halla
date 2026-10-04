import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpenText, ClipboardList, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cx } from '../../lib/cx'
import { objetoAuditado } from '../../lib/catalogos'
import { Marca } from './Marca'

const NAVEGACION = [
  { a: '/app', etiqueta: 'Panel', icono: LayoutDashboard, exacto: true },
  { a: '/app/auditorias', etiqueta: 'Auditorías', icono: ClipboardList },
  { a: '/app/normas', etiqueta: 'Normas', icono: BookOpenText },
  { a: '/app/perfil', etiqueta: 'Mi perfil', icono: UserRound },
]

function Navegacion({ alNavegar }) {
  return (
    <nav aria-label="Navegación principal" className="space-y-1">
      {NAVEGACION.map(({ a, etiqueta, icono: Icono, exacto }) => (
        <NavLink
          key={a}
          to={a}
          end={exacto}
          onClick={alNavegar}
          className={({ isActive }) =>
            cx(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-halla-700 text-white' : 'text-tinta-100 hover:bg-tinta-700 hover:text-white',
            )
          }
        >
          <Icono className="size-4 shrink-0" aria-hidden="true" />
          {etiqueta}
        </NavLink>
      ))}
    </nav>
  )
}

function PieUsuario() {
  const { perfil, salir } = useAuth()
  return (
    <div className="border-t border-tinta-700 pt-4">
      <p className="truncate text-sm font-medium text-white">{perfil?.nombre_completo}</p>
      <p className="truncate text-xs text-tinta-300">{perfil ? objetoAuditado(perfil) : ''}</p>
      <button
        type="button"
        onClick={salir}
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm text-tinta-100 hover:bg-tinta-700 hover:text-white"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Salir
      </button>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  // El cajón móvil queda abierto solo en la ruta donde se abrió: al navegar se cierra solo
  const [abiertoEn, setAbiertoEn] = useState(null)
  const menuAbierto = abiertoEn === location.pathname
  const setMenuAbierto = (abrir) => setAbiertoEn(abrir ? location.pathname : null)

  // Cierra el cajón con la tecla Escape
  useEffect(() => {
    if (!menuAbierto) return undefined
    const alTeclear = (e) => e.key === 'Escape' && setAbiertoEn(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menuAbierto])

  return (
    <div className="min-h-screen lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">
        Saltar al contenido
      </a>

      {/* Barra lateral de escritorio */}
      <aside className="no-imprimir hidden w-64 shrink-0 flex-col bg-tinta-900 p-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Marca a="/app" invertida conInstitucion />
        <div className="mt-8 flex-1">
          <Navegacion />
        </div>
        <PieUsuario />
      </aside>

      {/* Barra superior móvil */}
      <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between bg-tinta-900 px-4 py-3 lg:hidden">
        <Marca a="/app" invertida />
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          className="rounded-md p-2 text-white hover:bg-tinta-700"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          aria-controls="menu-movil"
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>
      </header>

      {menuAbierto && (
        <div className="no-imprimir fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-tinta-900/60" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" />
          <div id="menu-movil" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-tinta-900 p-5">
            <div className="flex items-center justify-between">
              <Marca a="/app" invertida conInstitucion />
              <button type="button" onClick={() => setMenuAbierto(false)} className="rounded-md p-2 text-white hover:bg-tinta-700" aria-label="Cerrar menú">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-8 flex-1">
              <Navegacion alNavegar={() => setMenuAbierto(false)} />
            </div>
            <PieUsuario />
          </div>
        </div>
      )}

      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
