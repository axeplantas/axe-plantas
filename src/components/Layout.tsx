import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ehValidador, useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import Avisos from './Avisos'
import InstalarApp from './InstalarApp'
import PontosGuardados from './PontosGuardados'

/** Quantas coisas esperam o validador/zelador: pedidos de entrada, folhas e pontos. */
function usePendencias(): number {
  const { perfil } = useSessao()
  const local = useLocation()
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!perfil?.terreiro_id || !ehValidador(perfil)) return
    const terreiro = perfil.terreiro_id
    let ativo = true

    async function contar() {
      const consultas = [
        supabase.from('folhas').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('terreiro_id', terreiro),
        supabase.from('pontos').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
          .eq('terreiro_id', terreiro).neq('visibilidade', 'privado'),
      ]
      if (perfil?.papel === 'zelador') {
        consultas.push(
          supabase.from('perfis').select('id', { count: 'exact', head: true }).eq('aprovado', false).eq('terreiro_id', terreiro),
        )
      }
      const resultados = await Promise.all(consultas)
      if (ativo) setTotal(resultados.reduce((soma, r) => soma + (r.count ?? 0), 0))
    }

    contar()
    const aoVoltar = () => document.visibilityState === 'visible' && contar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [perfil, local.pathname])

  return total
}

export default function Layout() {
  const { perfil } = useSessao()
  const pendencias = usePendencias()

  return (
    <div className="app">
      <main className="conteudo">
        <PontosGuardados />
        <Outlet />
      </main>
      <InstalarApp />
      <Avisos />
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
          <NavLink to="/painel" aria-label={pendencias ? `Validar, ${pendencias} pendentes` : 'Validar'}>
            <span aria-hidden className="icone-com-selo">
              ✔️{pendencias > 0 && <b className="selo">{pendencias > 9 ? '9+' : pendencias}</b>}
            </span>
            Validar
          </NavLink>
        )}
        <NavLink to="/perfil">
          <span aria-hidden>👤</span>Perfil
        </NavLink>
      </nav>
    </div>
  )
}
