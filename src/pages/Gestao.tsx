import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { avisar } from '../lib/avisos'
import { hoje, seAplica, valorDe } from '../lib/financeiro'
import { ehZelador, useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import {
  formatarDataCurta, formatarReais, ROTULO_PAPEL,
  type Cobranca, type Evento, type FinanceiroCasa, type MembroDaCasa, type Pagamento,
} from '../lib/tipos'

interface Resumo {
  membros: MembroDaCasa[]
  pendentes: number
  conferir: number
  config: FinanceiroCasa | null
  mensalidade: Cobranca | null
  recebido: number
  esperado: number
  emAberto: number
  proximo: Evento | null
  acabando: number
  folhasPontos: number
}

/** Painel do zelador: números da casa e acesso a tudo o que ele administra. */
export default function Gestao() {
  const { casaAtiva, recarregarPerfil } = useSessao()
  const navegar = useNavigate()
  const terreiro = casaAtiva?.terreiro_id
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [editandoCasa, setEditandoCasa] = useState(false)

  const carregar = useCallback(async () => {
    if (!terreiro) return
    await supabase.rpc('garantir_mensalidades', { p_terreiro: terreiro })
    const mesAtual = `${hoje().slice(0, 7)}-01`
    const [m, conf, cob, pag, alv, ev, mat, fol, pon] = await Promise.all([
      supabase.from('membros').select('*, perfis(apelido)').eq('terreiro_id', terreiro),
      supabase.from('financeiro_casa').select('*').eq('terreiro_id', terreiro).maybeSingle(),
      supabase.from('cobrancas').select('*').eq('terreiro_id', terreiro).eq('tipo', 'mensalidade').eq('competencia', mesAtual).maybeSingle(),
      supabase.from('pagamentos').select('*').eq('terreiro_id', terreiro),
      supabase.from('cobranca_alvos').select('cobranca_id, perfil_id'),
      supabase.from('eventos').select('*').eq('terreiro_id', terreiro).gte('data', hoje()).order('data').limit(1),
      supabase.from('materiais').select('quantidade, minimo').eq('terreiro_id', terreiro),
      supabase.from('folhas').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('terreiro_id', terreiro),
      supabase.from('pontos').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('terreiro_id', terreiro).neq('visibilidade', 'privado'),
    ])
    const membros = (m.data ?? []) as unknown as MembroDaCasa[]
    const aprovados = membros.filter((x) => x.aprovado)
    const config = (conf.data as FinanceiroCasa | null) ?? null
    const mensalidade = (cob.data as Cobranca | null) ?? null
    const pagamentos = (pag.data ?? []) as Pagamento[]
    const alvos = new Set(((alv.data ?? []) as { cobranca_id: string; perfil_id: string }[]).map((a) => `${a.cobranca_id}:${a.perfil_id}`))

    let recebido = 0
    let esperado = 0
    let emAberto = 0
    if (mensalidade) {
      for (const p of aprovados.filter((x) => seAplica(mensalidade, x, config, alvos))) {
        const valor = valorDe(mensalidade, p, config)
        const pagamento = pagamentos.find((x) => x.cobranca_id === mensalidade.id && x.perfil_id === p.perfil_id)
        if (pagamento?.status === 'isento') continue
        esperado += valor
        if (pagamento?.status === 'confirmado') recebido += pagamento.valor ?? valor
        else emAberto++
      }
    }

    setResumo({
      membros,
      pendentes: membros.filter((x) => !x.aprovado).length,
      conferir: pagamentos.filter((x) => x.status === 'informado').length,
      config,
      mensalidade,
      recebido,
      esperado,
      emAberto,
      proximo: ((ev.data ?? []) as Evento[])[0] ?? null,
      acabando: ((mat.data ?? []) as { quantidade: number; minimo: number | null }[])
        .filter((x) => x.minimo !== null && Number(x.quantidade) <= Number(x.minimo)).length,
      folhasPontos: (fol.count ?? 0) + (pon.count ?? 0),
    })
  }, [terreiro])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!ehZelador(casaAtiva) || !terreiro) {
    return <div className="pagina"><p>Só o zelador da casa vê a gestão.</p></div>
  }

  const r = resumo
  const aprovados = r?.membros.filter((x) => x.aprovado) ?? []
  const contadores = aprovados.filter((x) => x.contador)
  const validadores = aprovados.filter((x) => x.papel === 'validador')

  return (
    <div className="pagina">
      <button className="link" onClick={() => navegar('/casa')}>← Casa</button>
      <h1>Gestão da casa</h1>

      {editandoCasa ? (
        <DadosDaCasa terreiro={terreiro} nome={casaAtiva?.terreiros?.nome ?? ''} nacao={casaAtiva?.terreiros?.nacao ?? ''}
          aoTerminar={async (ok) => { setEditandoCasa(false); if (ok) await recarregarPerfil() }} />
      ) : (
        <div className="casa-atual">
          <span className="casa-icone" aria-hidden>🏠</span>
          <span className="cresce">
            <strong>{casaAtiva?.terreiros?.nome}</strong>
            <div className="sutil">{casaAtiva?.terreiros?.nacao}</div>
          </span>
          <button className="link" onClick={() => setEditandoCasa(true)}>Editar</button>
        </div>
      )}

      {!r && <p className="sutil">Carregando os números da casa…</p>}

      {r && (
        <>
          {(r.pendentes > 0 || r.conferir > 0 || r.folhasPontos > 0) && (
            <section className="cartao atencao">
              <h2>Precisa da sua atenção</h2>
              {r.pendentes > 0 && <Link to="/casa/membros" className="linha-acao">👤 {r.pendentes} pedido(s) de entrada <span>›</span></Link>}
              {r.conferir > 0 && <Link to="/casa/financeiro" className="linha-acao">📎 {r.conferir} comprovante(s) para conferir <span>›</span></Link>}
              {r.folhasPontos > 0 && <Link to="/painel" className="linha-acao">🌿 {r.folhasPontos} folha(s) ou ponto(s) para validar <span>›</span></Link>}
            </section>
          )}

          <div className="indicadores">
            <Link to="/casa/membros" className="indicador">
              <span className="indicador-numero">{aprovados.length}</span>
              <span>filho(s) na casa</span>
            </Link>
            <Link to="/casa/financeiro" className="indicador">
              {r.mensalidade ? (
                <>
                  <span className="indicador-numero pequeno">{formatarReais(r.recebido)}</span>
                  <span>de {formatarReais(r.esperado)} no mês</span>
                  <div className="barra-progresso"><div style={{ width: `${r.esperado ? (r.recebido / r.esperado) * 100 : 0}%` }} /></div>
                </>
              ) : (
                <>
                  <span className="indicador-numero pequeno">—</span>
                  <span>{r.config ? 'sem mensalidade este mês' : 'configure a mensalidade'}</span>
                </>
              )}
            </Link>
            <Link to="/casa/calendario" className="indicador">
              {r.proximo ? (
                <>
                  <span className="indicador-numero pequeno">{formatarDataCurta(r.proximo.data).slice(0, 5)}</span>
                  <span>{r.proximo.titulo}</span>
                </>
              ) : (
                <>
                  <span className="indicador-numero pequeno">📅</span>
                  <span>nenhum evento marcado</span>
                </>
              )}
            </Link>
            <Link to="/casa/materiais" className={`indicador ${r.acabando > 0 ? 'alerta' : ''}`}>
              <span className="indicador-numero">{r.acabando}</span>
              <span>material(is) acabando</span>
            </Link>
          </div>

          <section>
            <h2>Administrar</h2>
            <div className="menu-gestao">
              <Link to="/casa/membros" className="linha-acao grande">
                <span>👥</span>
                <span className="cresce">
                  <strong>Filhos e funções</strong>
                  <span className="sutil">
                    Aprovar pedidos, escolher validadores ({validadores.length}) e contador ({contadores.length ? contadores.map((c) => c.perfis?.apelido).join(', ') : 'nenhum'}), valor de mensalidade de cada um.
                  </span>
                </span>
                <span>›</span>
              </Link>
              <Link to="/casa/membros#convites" className="linha-acao grande">
                <span>✉️</span>
                <span className="cresce">
                  <strong>Convidar filhos</strong>
                  <span className="sutil">Link para mandar no grupo da casa.</span>
                </span>
                <span>›</span>
              </Link>
              <Link to="/casa/financeiro" className="linha-acao grande">
                <span>💰</span>
                <span className="cresce">
                  <strong>Financeiro</strong>
                  <span className="sutil">
                    {r.config
                      ? `Mensalidade ${formatarReais(r.config.valor_padrao)}, vence dia ${r.config.dia_vencimento}. ${r.emAberto} em aberto neste mês. Contribuições, comprovantes e quem pagou.`
                      : 'Configure o valor e a chave Pix para começar a cobrar.'}
                  </span>
                </span>
                <span>›</span>
              </Link>
              <Link to="/casa/calendario" className="linha-acao grande">
                <span>📅</span>
                <span className="cresce">
                  <strong>Calendário oficial</strong>
                  <span className="sutil">Festas, giras e obrigações; a casa é avisada e lembrada na véspera.</span>
                </span>
                <span>›</span>
              </Link>
              <Link to="/casa/materiais" className="linha-acao grande">
                <span>📦</span>
                <span className="cresce">
                  <strong>Materiais de trabalho</strong>
                  <span className="sutil">Estoque, entradas e saídas, e quem pode ver.</span>
                </span>
                <span>›</span>
              </Link>
              <Link to="/painel" className="linha-acao grande">
                <span>✔️</span>
                <span className="cresce">
                  <strong>Validar folhas e pontos</strong>
                  <span className="sutil">Conferir o que os filhos marcaram no mapa.</span>
                </span>
                <span>›</span>
              </Link>
            </div>
          </section>

          <section>
            <h2>Quem é quem</h2>
            <div className="cartao">
              {aprovados.length === 0 && <p className="sutil">Ainda não há filhos aprovados.</p>}
              {aprovados
                .slice()
                .sort((a, b) => ['zelador', 'validador', 'membro'].indexOf(a.papel) - ['zelador', 'validador', 'membro'].indexOf(b.papel))
                .map((x) => (
                  <div key={x.perfil_id} className="linha item-situacao">
                    <span className="cresce">{x.perfis?.apelido}</span>
                    <span className="etiqueta">{ROTULO_PAPEL[x.papel]}</span>
                    {x.contador && <span className="etiqueta situacao-informado">Contador(a)</span>}
                  </div>
                ))}
              <Link to="/casa/membros" className="link">Mudar funções</Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function DadosDaCasa({ terreiro, nome, nacao, aoTerminar }: {
  terreiro: string
  nome: string
  nacao: string
  aoTerminar: (ok: boolean) => void
}) {
  const [novoNome, setNovoNome] = useState(nome)
  const [novaNacao, setNovaNacao] = useState(nacao)
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.rpc('atualizar_terreiro', { p_terreiro: terreiro, p_nome: novoNome, p_nacao: novaNacao })
    if (error) return setErro(mensagemDeErro(error))
    avisar('Dados da casa atualizados.')
    aoTerminar(true)
  }

  return (
    <form className="cartao formulario" onSubmit={salvar}>
      <h2>Dados da casa</h2>
      <label>
        Nome da casa
        <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Nação / linha
        <input value={novaNacao} onChange={(e) => setNovaNacao(e.target.value)} required maxLength={60} />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha">
        <button className="primario">Salvar</button>
        <button type="button" className="link" onClick={() => aoTerminar(false)}>Cancelar</button>
      </div>
    </form>
  )
}
