import { NavLink, Outlet } from 'react-router-dom'
import { ehValidador, useSessao } from '../lib/sessao'
import InstalarApp from './InstalarApp'

export default function Layout() {
  const { perfil } = useSessao()

  return (
    <div className="app">
      <main className="conteudo">
        <Outlet />
      </main>
      <InstalarApp />
      <nav className="menu">
        <NavLink to="/" end>
          <span aria-hidden>🗺️</span>Mapa
        </NavLink>
        <NavLink to="/folhas">
          <span aria-hidden>🌿</span>Folhas
        </NavLink>
        <NavLink to="/obrigacoes">
          <span aria-hidden>📋</span>Obrigação
        </NavLink>
        <NavLink to="/marcar" className="menu-destaque">
          <span aria-hidden>＋</span>Marcar
        </NavLink>
        {ehValidador(perfil) && (
          <NavLink to="/painel">
            <span aria-hidden>✔️</span>Validar
          </NavLink>
        )}
        <NavLink to="/perfil">
          <span aria-hidden>👤</span>Perfil
        </NavLink>
      </nav>
    </div>
  )
}
