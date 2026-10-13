import { useState } from 'react'

/** Campo de senha com botão para mostrar o que foi digitado (evita erros de digitação). */
export default function CampoSenha({ valor, aoMudar, novaSenha = false, rotulo = 'Senha' }: {
  valor: string
  aoMudar: (v: string) => void
  novaSenha?: boolean
  rotulo?: string
}) {
  const [visivel, setVisivel] = useState(false)
  return (
    <label>
      {rotulo}
      <span className="campo-senha">
        <input type={visivel ? 'text' : 'password'} value={valor} onChange={(e) => aoMudar(e.target.value)} required
          minLength={6} autoComplete={novaSenha ? 'new-password' : 'current-password'} autoCapitalize="none"
          autoCorrect="off" spellCheck={false} />
        <button type="button" className="mostrar-senha" onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}>
          {visivel ? 'Esconder' : 'Mostrar'}
        </button>
      </span>
      {novaSenha && <span className="dica">Pelo menos 6 letras ou números.</span>}
    </label>
  )
}
