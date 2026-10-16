import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { configurado } from './lib/supabase'
import { ehAdmin, ehValidador, useSessao } from './lib/sessao'
import AceitarConvite from './pages/AceitarConvite'
import Admin from './pages/Admin'
import Aguardando from './pages/Aguardando'
import Calendario from './pages/Calendario'
import Casa from './pages/Casa'
import Entrar from './pages/Entrar'
import Financeiro from './pages/Financeiro'
import FolhaDetalhe from './pages/FolhaDetalhe'
import Gestao from './pages/Gestao'
import Folhas from './pages/Folhas'
import Mapa from './pages/Mapa'
import Materiais from './pages/Materiais'
import Membros from './pages/Membros'
import NovaFolha from './pages/NovaFolha'
import NovaSenha from './pages/NovaSenha'
import NovoPonto from './pages/NovoPonto'
import ObrigacaoDetalhe from './pages/ObrigacaoDetalhe'
import Obrigacoes from './pages/Obrigacoes'
import Painel from './pages/Painel'
import Perfil from './pages/Perfil'
import SemCasa from './pages/SemCasa'

export default function App() {
  const { sessao, perfil, carregando, recuperandoSenha, sair } = useSessao()
  // Link de convite aberto por quem já tem conta (entrar em mais uma casa).
  // Lido a cada renderização: o cadastro novo apaga o convite do endereço logo após usá-lo.
  const [, redesenhar] = useState(0)
  const convite = new URLSearchParams(window.location.search).get('convite')

  if (!configurado) {
    return (
      <main className="tela-central">
        <h1>Falta configurar</h1>
        <p>
          Crie o arquivo <code>.env.local</code> com os dados do Supabase (veja o <code>LEIA-ME.md</code>).
        </p>
      </main>
    )
  }

  if (carregando) {
    return (
      <main className="tela-central">
        <p>Carregando…</p>
      </main>
    )
  }

  if (recuperandoSenha) return <NovaSenha />
  if (!sessao) return <Entrar />

  if (!perfil) {
    return (
      <main className="tela-central">
        <p>Não encontramos o seu cadastro.</p>
        <button onClick={sair}>Sair</button>
      </main>
    )
  }

  if (convite) return <AceitarConvite codigo={convite} aoTerminar={() => redesenhar((n) => n + 1)} />

  if (!perfil.aprovado) return <Aguardando />

  const semCasa = !perfil.terreiro_id

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {ehAdmin(perfil) && <Route path="admin" element={<Admin />} />}
          {semCasa ? (
            <>
              <Route index element={<SemCasa />} />
              <Route path="marcar" element={<SemCasa />} />
              <Route path="folhas/*" element={<SemCasa />} />
              <Route path="obrigacoes/*" element={<SemCasa />} />
              <Route path="casa/*" element={<SemCasa />} />
            </>
          ) : (
            <>
              <Route index element={<Mapa />} />
              <Route path="marcar" element={<NovoPonto />} />
              <Route path="folhas" element={<Folhas />} />
              <Route path="folhas/nova" element={<NovaFolha />} />
              <Route path="folhas/:id" element={<FolhaDetalhe />} />
              <Route path="obrigacoes" element={<Obrigacoes />} />
              <Route path="obrigacoes/:id" element={<ObrigacaoDetalhe />} />
              <Route path="casa" element={<Casa />} />
              <Route path="casa/financeiro" element={<Financeiro />} />
              <Route path="casa/calendario" element={<Calendario />} />
              <Route path="casa/materiais" element={<Materiais />} />
              <Route path="casa/membros" element={<Membros />} />
              <Route path="casa/gestao" element={<Gestao />} />
            </>
          )}
          {ehValidador(perfil) && <Route path="painel" element={<Painel />} />}
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
