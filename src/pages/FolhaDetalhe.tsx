import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ehValidador, useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import type { Folha, Fundamento } from '../lib/tipos'

export default function FolhaDetalhe() {
  const { id } = useParams()
  const { perfil } = useSessao()
  const navegar = useNavigate()
  const [folha, setFolha] = useState<Folha | null>(null)
  const [fundamento, setFundamento] = useState<Fundamento | null>(null)
  const [qtdPontos, setQtdPontos] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('folhas').select('*').eq('id', id).maybeSingle(),
      supabase.from('fundamentos').select('*').eq('folha_id', id).maybeSingle(),
      supabase.from('pontos').select('id', { count: 'exact', head: true }).eq('folha_id', id).neq('status', 'recusado'),
    ]).then(([f, fund, pontos]) => {
      setFolha(f.data as Folha | null)
      setFundamento(fund.data as Fundamento | null)
      setQtdPontos(pontos.count ?? 0)
      setCarregando(false)
    })
  }, [id])

  if (carregando) return <div className="pagina"><p className="sutil">Carregando…</p></div>
  if (!folha) return <div className="pagina"><p>Folha não encontrada.</p><Link to="/folhas">Voltar</Link></div>

  const podeEditar = ehValidador(perfil)
  const temFundamento = fundamento && (fundamento.orixas || fundamento.usos || fundamento.observacoes)

  return (
    <div className="pagina">
      <button className="link" onClick={() => navegar(-1)}>← Voltar</button>
      <h1>{folha.nome_popular}</h1>
      {folha.nome_ritual && <p className="destaque">{folha.nome_ritual}</p>}
      {folha.nome_cientifico && <p className="cientifico">{folha.nome_cientifico}</p>}
      {folha.outros_nomes && <p className="sutil">Também chamada: {folha.outros_nomes}</p>}
      {folha.status === 'pendente' && <p className="aviso">Esta folha ainda está em validação.</p>}

      {(folha.toxica || folha.alerta) && (
        <div className="caixa-alerta">
          {folha.toxica && <strong>⚠️ Tóxica ou pede cuidado.</strong>} {folha.alerta}
        </div>
      )}

      <div className="linha">
        <Link to={`/?folha=${folha.id}`} className="botao">Ver no mapa ({qtdPontos})</Link>
        <Link to={`/marcar?folha=${folha.id}`} className="botao">Marcar onde encontrei</Link>
      </div>

      <section className="cartao">
        <div className="cabecalho">
          <h2>Fundamento da casa</h2>
          {podeEditar && !editando && <button className="link" onClick={() => setEditando(true)}>Editar</button>}
        </div>
        <p className="sutil">Visível apenas para membros de {perfil?.terreiros?.nome ?? 'seu terreiro'}.</p>
        {editando ? (
          <EditarFundamento
            folhaId={folha.id}
            atual={fundamento}
            aoSalvar={(f) => {
              setFundamento(f)
              setEditando(false)
            }}
            aoCancelar={() => setEditando(false)}
          />
        ) : temFundamento ? (
          <dl>
            {fundamento.orixas && (<><dt>Orixás / Entidades</dt><dd>{fundamento.orixas}</dd></>)}
            {fundamento.usos && (<><dt>Usos</dt><dd>{fundamento.usos}</dd></>)}
            {fundamento.observacoes && (<><dt>Observações</dt><dd>{fundamento.observacoes}</dd></>)}
          </dl>
        ) : (
          <p className="sutil">Nada registrado ainda.</p>
        )}
      </section>
    </div>
  )
}

function EditarFundamento({ folhaId, atual, aoSalvar, aoCancelar }: {
  folhaId: string
  atual: Fundamento | null
  aoSalvar: (f: Fundamento) => void
  aoCancelar: () => void
}) {
  const { perfil } = useSessao()
  const [orixas, setOrixas] = useState(atual?.orixas ?? '')
  const [usos, setUsos] = useState(atual?.usos ?? '')
  const [observacoes, setObservacoes] = useState(atual?.observacoes ?? '')
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('fundamentos')
      .upsert({
        folha_id: folhaId,
        terreiro_id: perfil!.terreiro_id,
        orixas: orixas.trim() || null,
        usos: usos.trim() || null,
        observacoes: observacoes.trim() || null,
      })
      .select()
      .single()
    if (error) return setErro(mensagemDeErro(error))
    aoSalvar(data as Fundamento)
  }

  return (
    <form className="formulario" onSubmit={salvar}>
      <label>
        Orixás / Entidades
        <input value={orixas} onChange={(e) => setOrixas(e.target.value)} />
      </label>
      <label>
        Usos (banho, sacudimento, amaci, defumação, chá…)
        <textarea value={usos} onChange={(e) => setUsos(e.target.value)} rows={3} />
      </label>
      <label>
        Observações
        <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha">
        <button className="primario">Salvar</button>
        <button type="button" className="link" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
