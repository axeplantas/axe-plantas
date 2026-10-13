import { useState, type FormEvent } from 'react'
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
    else fimRecuperacao()
  }

  return (
    <main className="tela-central">
      <h1>Nova senha</h1>
      <form onSubmit={salvar} className="formulario">
        <label>
          Digite a nova senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
            autoComplete="new-password" />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>Salvar</button>
      </form>
    </main>
  )
}
