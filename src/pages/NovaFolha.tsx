import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ehValidador, useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'

export default function NovaFolha() {
  const { perfil } = useSessao()
  const navegar = useNavigate()
  const [campos, setCampos] = useState({
    nome_popular: '',
    nome_ritual: '',
    outros_nomes: '',
    nome_cientifico: '',
    alerta: '',
  })
  const [toxica, setToxica] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const mudar = (campo: keyof typeof campos) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!perfil) return
    setSalvando(true)
    const limpo = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.trim() || null]))
    const { data, error } = await supabase
      .from('folhas')
      .insert({ ...limpo, toxica, terreiro_id: perfil.terreiro_id })
      .select('id')
      .single()
    if (error) {
      setErro(mensagemDeErro(error))
      setSalvando(false)
      return
    }
    navegar(`/folhas/${data.id}`, { replace: true })
  }

  return (
    <form className="pagina formulario" onSubmit={salvar}>
      <h1>Nova folha</h1>
      {!ehValidador(perfil) && (
        <p className="aviso">A folha aparece para todos depois que um validador do seu terreiro aprovar.</p>
      )}
      <label>
        Nome popular *
        <input value={campos.nome_popular} onChange={mudar('nome_popular')} required placeholder="Ex.: Aroeira" />
      </label>
      <label>
        Nome no Axé (Yorubá, Kikongo, Tupi…)
        <input value={campos.nome_ritual} onChange={mudar('nome_ritual')} placeholder="Como é chamada na sua casa" />
      </label>
      <label>
        Outros nomes da região
        <input value={campos.outros_nomes} onChange={mudar('outros_nomes')} placeholder="Separe por vírgula" />
      </label>
      <label>
        Nome científico
        <input value={campos.nome_cientifico} onChange={mudar('nome_cientifico')} placeholder="Ex.: Schinus terebinthifolia" />
      </label>
      <label className="opcao">
        <input type="checkbox" checked={toxica} onChange={(e) => setToxica(e.target.checked)} />
        Esta folha é tóxica ou pede cuidado
      </label>
      <label>
        Cuidados / não confundir com…
        <textarea value={campos.alerta} onChange={mudar('alerta')} rows={2} />
      </label>
      <p className="sutil">Orixás e usos são registrados depois, na página da folha, e ficam visíveis só para a sua casa.</p>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Cadastrar folha'}</button>
    </form>
  )
}
