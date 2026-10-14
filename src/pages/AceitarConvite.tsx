import { useEffect, useState } from 'react'
import { avisar } from '../lib/avisos'
import { useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'

interface InfoConvite {
  tipo: 'admin' | 'zelador' | 'membro'
  terreiro: string | null
  nacao: string | null
}

function limparLink() {
  window.history.replaceState(null, '', window.location.origin + window.location.pathname)
}

/** Quem já tem conta abriu um link de convite: entra em mais uma casa com a mesma conta. */
export default function AceitarConvite({ codigo, aoTerminar }: { codigo: string; aoTerminar: () => void }) {
  const { perfil, casas, recarregarPerfil } = useSessao()
  const [info, setInfo] = useState<InfoConvite | null | undefined>(undefined)
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.rpc('info_convite', { p_codigo: codigo }).then(({ data }) => setInfo((data as InfoConvite[] | null)?.[0] ?? null))
  }, [codigo])

  const jaSou = info?.terreiro ? casas.some((c) => c.terreiros?.nome === info.terreiro) : false

  function fechar() {
    limparLink()
    aoTerminar()
  }

  async function entrar() {
    setEntrando(true)
    setErro('')
    const { data, error } = await supabase.rpc('aceitar_convite', { p_codigo: codigo })
    if (error) {
      setEntrando(false)
      const msg = mensagemDeErro(error)
      return setErro(msg.includes('ja_membro') ? 'Você já faz parte desta casa.' : msg)
    }
    await recarregarPerfil()
    avisar(info?.tipo === 'membro' ? `Pedido enviado para ${data}. Aguarde a aprovação do zelador.` : `Você entrou em ${data}!`)
    fechar()
  }

  return (
    <main className="tela-central">
      <img src="logo.svg" alt="" className="logo-pequeno" />
      {info === undefined && <p>Carregando o convite…</p>}

      {info === null && (
        <>
          <h1>Convite inválido</h1>
          <p>Este link já foi usado ou venceu. Peça um novo ao zelador da casa.</p>
          <button className="primario" onClick={fechar}>Continuar no app</button>
        </>
      )}

      {info && (
        <>
          <h1>{info.tipo === 'admin' ? 'Convite de administração' : `Entrar em ${info.terreiro}`}</h1>
          <p>
            Olá, <strong>{perfil?.apelido}</strong>!{' '}
            {info.tipo === 'admin' && 'Você foi convidado(a) para administrar o Axé Plantas.'}
            {info.tipo === 'zelador' && <>Você foi convidado(a) como <strong>zelador(a)</strong> de {info.terreiro}.</>}
            {info.tipo === 'membro' && <>Você foi convidado(a) para entrar em <strong>{info.terreiro}</strong>{info.nacao ? ` (${info.nacao})` : ''}.</>}
          </p>
          {casas.length > 0 && info.tipo !== 'admin' && (
            <p className="sutil">
              Você continua nas suas outras casas ({casas.map((c) => c.terreiros?.nome).join(', ')}) e pode trocar entre elas na aba Casa.
            </p>
          )}
          {jaSou ? (
            <>
              <p className="aviso">Você já faz parte desta casa.</p>
              <button className="primario" onClick={fechar}>Continuar</button>
            </>
          ) : (
            <>
              {erro && <p className="erro">{erro}</p>}
              <button className="primario" onClick={entrar} disabled={entrando}>
                {entrando ? 'Entrando…' : info.tipo === 'membro' ? 'Pedir para entrar' : 'Aceitar convite'}
              </button>
              <button className="link" onClick={fechar}>Agora não</button>
            </>
          )}
        </>
      )}
    </main>
  )
}
