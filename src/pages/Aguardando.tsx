import { useSessao } from '../lib/sessao'

export default function Aguardando() {
  const { perfil, recarregarPerfil, sair } = useSessao()

  return (
    <main className="tela-central">
      <img src="logo.svg" alt="" className="logo-pequeno" />
      <h1>Aguardando aprovação</h1>
      <p>
        Olá, <strong>{perfil?.apelido}</strong>! Seu pedido para entrar em{' '}
        <strong>{perfil?.terreiros?.nome ?? 'seu terreiro'}</strong> foi enviado.
      </p>
      <p className="sutil">Assim que o zelador ou a zeladora aprovar, o mapa fica liberado.</p>
      <button className="primario" onClick={recarregarPerfil}>Verificar de novo</button>
      <button className="link" onClick={sair}>Sair</button>
    </main>
  )
}
