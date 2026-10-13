import { useState, type FormEvent } from 'react'
import { mensagemDeErro, modoDemo, supabase, VERSAO_TERMOS } from '../lib/supabase'

type Modo = 'entrar' | 'cadastrar' | 'esqueci'

export default function Entrar() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [apelido, setApelido] = useState('')
  const [codigo, setCodigo] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const enderecoDoApp = window.location.origin + window.location.pathname

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setAviso('')
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else if (modo === 'cadastrar') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: { apelido, codigo_convite: codigo, consentimento: aceite, versao_termos: VERSAO_TERMOS },
            emailRedirectTo: enderecoDoApp,
          },
        })
        if (error) throw error
        if (!data.session) setAviso('Cadastro feito! Confira seu e-mail para confirmar a conta.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: enderecoDoApp })
        if (error) throw error
        setAviso('Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.')
      }
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="tela-central">
      <img src="logo-vertical.svg" alt="Axé Plantas" className="logo" />
      <p className="sutil">Kosi ewe, kosi Orisa</p>
      {modoDemo && (
        <p className="aviso">
          <strong>Modo demonstração.</strong> Digite qualquer e-mail e senha (mín. 6 letras). Nada é salvo.
        </p>
      )}

      <div className="abas">
        <button className={modo === 'entrar' ? 'ativa' : ''} onClick={() => setModo('entrar')} type="button">
          Entrar
        </button>
        <button className={modo === 'cadastrar' ? 'ativa' : ''} onClick={() => setModo('cadastrar')} type="button">
          Criar conta
        </button>
      </div>

      <form onSubmit={enviar} className="formulario">
        {modo === 'cadastrar' && (
          <>
            <label>
              Como quer ser chamado(a)
              <input value={apelido} onChange={(e) => setApelido(e.target.value)} required maxLength={40}
                placeholder="Apelido ou nome de santo" />
            </label>
            <label>
              Código do terreiro
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoCapitalize="characters"
                placeholder="Peça ao seu zelador" />
            </label>
          </>
        )}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {modo !== 'esqueci' && (
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
          </label>
        )}

        {modo === 'cadastrar' && (
          <label className="opcao aceite">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
            <span>
              Tenho 18 anos ou mais, li e aceito os <a href="termos.html" target="_blank">Termos de Uso</a> e a{' '}
              <a href="privacidade.html" target="_blank">Política de Privacidade</a>, e autorizo o uso da informação
              de que participo de um terreiro para o funcionamento do app.
            </span>
          </label>
        )}

        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="aviso">{aviso}</p>}

        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Enviar link'}
        </button>
      </form>

      {modo === 'entrar' && (
        <button type="button" className="link" onClick={() => setModo('esqueci')}>
          Esqueci minha senha
        </button>
      )}
      {modo === 'esqueci' && (
        <button type="button" className="link" onClick={() => setModo('entrar')}>
          Voltar
        </button>
      )}

      <p className="rodape-legal">
        <a href="termos.html" target="_blank">Termos de Uso</a> · <a href="privacidade.html" target="_blank">Privacidade</a>
      </p>
    </main>
  )
}
