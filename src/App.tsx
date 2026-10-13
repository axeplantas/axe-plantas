import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { configurado } from './lib/supabase'
import { ehAdmin, ehValidador, useSessao } from './lib/sessao'
import Admin from './pages/Admin'
import Aguardando from './pages/Aguardando'
import Entrar from './pages/Entrar'
import FolhaDetalhe from './pages/FolhaDetalhe'
import Folhas from './pages/Folhas'
import Mapa from './pages/Mapa'
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
