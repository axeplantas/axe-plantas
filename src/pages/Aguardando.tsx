import { useEffect, useState } from 'react'
import AtivarNotificacoes from '../components/AtivarNotificacoes'
import { useSessao } from '../lib/sessao'

function ehIphone(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function jaInstalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function Aguardando() {
  const { perfil, recarregarPerfil, sair } = useSessao()
  const [verificando, setVerificando] = useState(false)

  // Confere sozinho de tempos em tempos e sempre que a pessoa volta para o app.
  useEffect(() => {
    const intervalo = setInterval(recarregarPerfil, 30000)
    const aoVoltar = () => document.visibilityState === 'visible' && recarregarPerfil()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [recarregarPerfil])

  async function verificar() {
    setVerificando(true)
    await recarregarPerfil()
    setTimeout(() => setVerificando(false), 800)
  }

  return (
    <main className="tela-central">
      <img src="logo.svg" alt="" className="logo-pequeno" />
      <h1>Pedido enviado!</h1>
      <p>
        Olá, <strong>{perfil?.apelido}</strong>! Seu pedido para entrar em{' '}
        <strong>{perfil?.terreiros?.nome ?? 'seu terreiro'}</strong> foi enviado ao zelador ou à zeladora.
      </p>
      <p className="sutil">
        Assim que aprovarem, esta tela muda sozinha. Se estiver demorando, avise seu zelador que você já se cadastrou.
      </p>
      <button className="primario" onClick={verificar} disabled={verificando}>
        {verificando ? 'Verificando…' : 'Já fui aprovado? Verificar'}
      </button>

      <AtivarNotificacoes discreto motivo="Ative para receber um aviso no celular assim que você for aprovado(a)." />

      {!jaInstalado() && (
        <section className="cartao texto-esquerda">
          <h2>Enquanto isso, instale o app</h2>
          {ehIphone() ? (
            <>
              <p>No <strong>Safari</strong>, toque em <strong>Compartilhar</strong> (□↑) e depois em <strong>“Adicionar à Tela de Início”</strong>.</p>
              <p className="sutil">Depois de instalar, abra pelo ícone novo e <strong>entre com o mesmo e-mail e senha</strong>.</p>
            </>
          ) : (
            <>
              <p>No <strong>Chrome</strong>, toque nos três pontinhos (⋮) e depois em <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.</p>
              <p className="sutil">Se pedir, entre de novo com o mesmo e-mail e senha.</p>
            </>
          )}
        </section>
      )}

      <button className="link" onClick={sair}>Sair</button>
    </main>
  )
}
