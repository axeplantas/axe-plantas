import { useState, type FormEvent } from 'react'
import CampoSenha from '../components/CampoSenha'
import { avisar } from '../lib/avisos'
import { useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'

export default function NovaSenha() {
  const { fimRecuperacao } = useSessao()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) setErro(mensagemDeErro(error))
    else {
      avisar('Senha alterada!')
      fimRecuperacao()
    }
  }

  return (
    <main className="tela-central">
      <h1>Nova senha</h1>
      <form onSubmit={salvar} className="formulario">
        <CampoSenha valor={senha} aoMudar={setSenha} novaSenha rotulo="Digite a nova senha" />
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>Salvar</button>
      </form>
    </main>
  )
}
