import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SeletorFolha from '../components/SeletorFolha'
import { avisar } from '../lib/avisos'
import { distanciaEmMetros, formatarDistancia, linkComoChegar } from '../lib/distancia'
import { ehValidador, useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import type { Folha, ItemObrigacao, Obrigacao, Ponto } from '../lib/tipos'
import { formatarData } from './Obrigacoes'

type PontoSimples = Pick<Ponto, 'id' | 'folha_id' | 'lat' | 'lng'>

export default function ObrigacaoDetalhe() {
  const { id } = useParams()
  const { perfil } = useSessao()
  const navegar = useNavigate()
  const [obrigacao, setObrigacao] = useState<Obrigacao | null>(null)
  const [itens, setItens] = useState<ItemObrigacao[]>([])
  const [pontos, setPontos] = useState<PontoSimples[]>([])
  const [folhas, setFolhas] = useState<Pick<Folha, 'id' | 'nome_popular' | 'status' | 'nome_cientifico' | 'outros_nomes'>[]>([])
  const [eu, setEu] = useState<[number, number] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregarItens = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('obrigacao_itens')
      .select('*, folhas(nome_popular, nome_ritual, toxica, alerta)')
      .eq('obrigacao_id', id)
      .order('created_at')
    setItens((data ?? []) as ItemObrigacao[])
  }, [id])

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('obrigacoes').select('*').eq('id', id).maybeSingle(),
      supabase.from('pontos').select('id, folha_id, lat, lng').eq('status', 'validado'),
      supabase.from('folhas').select('id, nome_popular, status, nome_cientifico, outros_nomes').neq('status', 'recusada').order('nome_popular'),
      carregarItens(),
    ]).then(([o, p, f]) => {
      setObrigacao(o.data as Obrigacao | null)
      setPontos((p.data ?? []) as PontoSimples[])
      setFolhas(f.data ?? [])
      setCarregando(false)
    })
    navigator.geolocation?.getCurrentPosition(
      (pos) => setEu([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 10000 },
    )
  }, [id, carregarItens])

  /** Para cada folha, o ponto mais perto (ou o primeiro, se não houver GPS). */
  const maisPerto = useMemo(() => {
    const resultado = new Map<string, { ponto: PontoSimples; metros: number | null; total: number }>()
    for (const p of pontos) {
      const metros = eu ? distanciaEmMetros(eu, [p.lat, p.lng]) : null
      const atual = resultado.get(p.folha_id)
      const total = (atual?.total ?? 0) + 1
      if (!atual || (metros !== null && atual.metros !== null && metros < atual.metros)) {
        resultado.set(p.folha_id, { ponto: p, metros, total })
      } else {
        atual.total = total
      }
    }
    return resultado
  }, [pontos, eu])

  if (carregando) return <div className="pagina"><p className="sutil">Carregando…</p></div>
  if (!obrigacao) return <div className="pagina"><p>Obrigação não encontrada.</p><Link to="/obrigacoes">Voltar</Link></div>

  const podeEditar =
    obrigacao.criado_por === perfil?.id || (obrigacao.visibilidade === 'terreiro' && ehValidador(perfil))
  const colhidas = itens.filter((i) => i.colhida).length
  const idsFolhas = [...new Set(itens.map((i) => i.folha_id))]

  async function marcar(item: ItemObrigacao) {
    setItens((lista) => lista.map((i) => (i.id === item.id ? { ...i, colhida: !i.colhida } : i)))
    const { error } = await supabase.from('obrigacao_itens').update({ colhida: !item.colhida }).eq('id', item.id)
    if (error) {
      setErro(mensagemDeErro(error))
      carregarItens()
    }
  }

  async function remover(item: ItemObrigacao) {
    const { error } = await supabase.from('obrigacao_itens').delete().eq('id', item.id)
    if (error) return setErro(mensagemDeErro(error))
    setItens((lista) => lista.filter((i) => i.id !== item.id))
  }

  async function apagarObrigacao() {
    if (!confirm(`Apagar a obrigação "${obrigacao!.nome}"?`)) return
    const { error } = await supabase.from('obrigacoes').delete().eq('id', obrigacao!.id)
    if (error) return setErro(mensagemDeErro(error))
    navegar('/obrigacoes', { replace: true })
  }

  return (
    <div className="pagina">
      <button className="link" onClick={() => navegar('/obrigacoes')}>← Obrigações</button>
      <h1>{obrigacao.nome}</h1>
      <p className="sutil">
        {obrigacao.data && `${formatarData(obrigacao.data)} · `}
        {obrigacao.visibilidade === 'terreiro' ? (perfil?.terreiros?.nome ?? 'Meu terreiro') : 'Só eu'}
      </p>
      {obrigacao.observacao && <p>{obrigacao.observacao}</p>}

      {itens.length > 0 && (
        <div className="progresso" aria-label={`${colhidas} de ${itens.length} folhas colhidas`}>
          <div className="progresso-barra" style={{ width: `${(colhidas / itens.length) * 100}%` }} />
          <span>{colhidas} de {itens.length} colhidas</span>
        </div>
      )}

      {idsFolhas.length > 0 && (
        <Link to={`/?folhas=${idsFolhas.join(',')}`} className="botao bloco">Ver todas no mapa</Link>
      )}
      {!eu && itens.length > 0 && (
        <p className="sutil">Permita a localização para ver qual ponto está mais perto de você.</p>
      )}
      {erro && <p className="erro">{erro}</p>}

      <ul className="lista">
        {itens.map((item) => {
          const perto = maisPerto.get(item.folha_id)
          return (
            <li key={item.id} className={`item-obrigacao ${item.colhida ? 'colhida' : ''}`}>
              <label className="marcador">
                <input type="checkbox" checked={item.colhida} onChange={() => marcar(item)} />
                <span>
                  <strong>{item.folhas?.nome_popular ?? 'Folha'}</strong>
                  {item.quantidade && <span className="sutil"> · {item.quantidade}</span>}
                </span>
              </label>
              {item.folhas?.toxica && <div className="alerta-toxica">⚠️ Tóxica{item.folhas.alerta ? `: ${item.folhas.alerta}` : ''}</div>}
              {!item.colhida && (
                <div className="onde">
                  {perto ? (
                    <>
                      <span className="sutil">
                        {perto.metros !== null ? `Mais perto: ${formatarDistancia(perto.metros)}` : 'Tem no mapa'}
                        {perto.total > 1 && ` · ${perto.total} lugares`}
                      </span>
                      <a href={linkComoChegar(perto.ponto.lat, perto.ponto.lng)} target="_blank" rel="noreferrer">Como chegar</a>
                      <Link to={`/?folha=${item.folha_id}`}>Mapa</Link>
                    </>
                  ) : (
                    <span className="sutil">Ainda ninguém marcou onde encontrar.</span>
                  )}
                  {podeEditar && <button className="link perigo" onClick={() => remover(item)}>Remover</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {podeEditar && (
        <AdicionarFolha
          obrigacaoId={obrigacao.id}
          folhas={folhas.filter((f) => !idsFolhas.includes(f.id))}
          aoAdicionar={carregarItens}
        />
      )}

      {podeEditar && (
        <button className="link perigo" onClick={apagarObrigacao}>Apagar obrigação</button>
      )}
    </div>
  )
}

function AdicionarFolha({ obrigacaoId, folhas, aoAdicionar }: {
  obrigacaoId: string
  folhas: Pick<Folha, 'id' | 'nome_popular' | 'status' | 'nome_cientifico' | 'outros_nomes'>[]
  aoAdicionar: () => Promise<void>
}) {
  const [folhaId, setFolhaId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [erro, setErro] = useState('')

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!folhaId) return setErro('Escolha a folha digitando o nome dela.')
    const nome = folhas.find((f) => f.id === folhaId)?.nome_popular
    const { error } = await supabase
      .from('obrigacao_itens')
      .insert({ obrigacao_id: obrigacaoId, folha_id: folhaId, quantidade: quantidade.trim() || null })
    if (error) return setErro(mensagemDeErro(error))
    setFolhaId('')
    setQuantidade('')
    setErro('')
    avisar(`${nome ?? 'Folha'} adicionada à lista.`)
    await aoAdicionar()
  }

  return (
    <form className="cartao formulario" onSubmit={adicionar}>
      <h2>Adicionar folha</h2>
      <SeletorFolha folhas={folhas} valor={folhaId} aoMudar={setFolhaId} linkNova={false} />
      <input value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Quantidade (ex.: 1 maço, 7 folhas)"
        maxLength={40} />
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={!folhaId}>Adicionar à lista</button>
      <Link to="/folhas/nova" className="link">A folha não está na lista? Cadastrar</Link>
    </form>
  )
}
