import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Convites from '../components/Convites'
import AtivarNotificacoes from '../components/AtivarNotificacoes'
import Galeria from '../components/Galeria'
import { avisar } from '../lib/avisos'
import { linkComoChegar } from '../lib/distancia'
import { useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { fotosDoPonto, ROTULO_PAPEL, ROTULO_VISIBILIDADE, type Folha, type Papel, type Perfil, type Ponto } from '../lib/tipos'

const EXPLICA_PAPEL: Record<Papel, string> = {
  membro: 'marca folhas e pontos',
  validador: 'também aprova folhas e pontos da casa',
  zelador: 'também aprova e remove membros e escolhe validadores',
}

export default function Painel() {
  const { perfil } = useSessao()
  const souZelador = perfil?.papel === 'zelador'
  const [membros, setMembros] = useState<Perfil[]>([])
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [carregado, setCarregado] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!perfil?.terreiro_id) return
    const [f, p, m] = await Promise.all([
      supabase.from('folhas').select('*').eq('status', 'pendente').eq('terreiro_id', perfil.terreiro_id).order('created_at'),
      supabase
        .from('pontos')
        .select('*, folhas(nome_popular, nome_ritual, toxica, alerta)')
        .eq('status', 'pendente')
        .eq('terreiro_id', perfil.terreiro_id)
        .neq('visibilidade', 'privado')
        .order('created_at'),
      souZelador
        ? supabase.from('perfis').select('*').eq('terreiro_id', perfil.terreiro_id).neq('id', perfil.id).order('created_at')
        : Promise.resolve({ data: [] }),
    ])
    setFolhas((f.data ?? []) as Folha[])
    setPontos((p.data ?? []) as Ponto[])
    setMembros((m.data ?? []) as Perfil[])
    setCarregado(true)
  }, [perfil, souZelador])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function executar(id: string, acao: PromiseLike<{ error: unknown }>, sucesso: string) {
    setOcupado(id)
    const { error } = await acao
    setOcupado(null)
    if (error) avisar(mensagemDeErro(error), 'erro')
    else avisar(sucesso)
    await carregar()
  }

  function mudarPapel(m: Perfil, papel: Papel) {
    if (papel === 'zelador' && !confirm(`Tornar ${m.apelido} zelador(a)? Zeladores podem aprovar e remover membros da casa.`)) {
      return carregar()
    }
    executar(m.id, supabase.rpc('gerenciar_membro', { p_usuario: m.id, p_aprovado: true, p_papel: papel }),
      `${m.apelido} agora é ${ROTULO_PAPEL[papel].toLowerCase()}.`)
  }

  const pendentes = membros.filter((m) => !m.aprovado)
  const aprovados = membros.filter((m) => m.aprovado)
  const nadaPendente = carregado && pendentes.length === 0 && folhas.length === 0 && pontos.length === 0

  return (
    <div className="pagina">
      <h1>Validar</h1>
      <AtivarNotificacoes discreto
        motivo="Receba um aviso no celular quando alguém pedir para entrar ou marcar uma folha nova na sua casa." />
      {!carregado && <p className="sutil">Carregando…</p>}
      {nadaPendente && (
        <div className="cartao tudo-em-dia">
          <strong>✔ Tudo em dia!</strong>
          <span className="sutil">Nenhum pedido, folha ou ponto esperando você.</span>
        </div>
      )}

      {souZelador && pendentes.length > 0 && (
        <section>
          <h2>Pedidos de entrada ({pendentes.length})</h2>
          <p className="sutil">Só aprove quem você conhece e é da casa.</p>
          {pendentes.map((m) => (
            <div key={m.id} className="cartao">
              <strong>{m.apelido}</strong>
              <div className="sutil">Pediu em {new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
              <div className="linha">
                <button className="primario" disabled={ocupado === m.id}
                  onClick={() => executar(m.id, supabase.rpc('gerenciar_membro', { p_usuario: m.id, p_aprovado: true, p_papel: 'membro' }),
                    `${m.apelido} foi aprovado(a).`)}>
                  Aprovar
                </button>
                <button className="link perigo" disabled={ocupado === m.id}
                  onClick={() => confirm(`Recusar o pedido de ${m.apelido}? O cadastro será apagado.`) &&
                    executar(m.id, supabase.rpc('remover_membro', { p_usuario: m.id }), 'Pedido recusado.')}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {folhas.length > 0 && (
        <section>
          <h2>Folhas novas para conferir ({folhas.length})</h2>
          <p className="sutil">Confira se o nome está certo. Se precisar corrigir, abra a folha e toque em “Editar”.</p>
          {folhas.map((f) => (
            <div key={f.id} className="cartao">
              <Link to={`/folhas/${f.id}`}><strong>{f.nome_popular}</strong></Link>
              {f.nome_ritual && <span className="sutil"> · {f.nome_ritual}</span>}
              {f.nome_cientifico && <div className="cientifico">{f.nome_cientifico}</div>}
              {f.outros_nomes && <div className="sutil">Outros nomes: {f.outros_nomes}</div>}
              {(f.toxica || f.alerta) && <div className="alerta-toxica">{f.toxica ? '⚠️ Tóxica. ' : ''}{f.alerta}</div>}
              <div className="linha">
                <button className="primario" disabled={ocupado === f.id}
                  onClick={() => executar(f.id, supabase.from('folhas').update({ status: 'validada' }).eq('id', f.id),
                    `${f.nome_popular} validada.`)}>
                  Validar
                </button>
                <button className="link perigo" disabled={ocupado === f.id}
                  onClick={() => confirm(`Recusar a folha “${f.nome_popular}”? Ela some da lista de folhas.`) &&
                    executar(f.id, supabase.from('folhas').update({ status: 'recusada' }).eq('id', f.id), 'Folha recusada.')}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {pontos.length > 0 && (
        <section>
          <h2>Pontos para conferir ({pontos.length})</h2>
          <p className="sutil">Confira a foto e o local. Recuse se for casa, terreiro ou lugar particular marcado como público.</p>
          {pontos.map((p) => (
            <div key={p.id} className="cartao">
              <strong>{p.folhas?.nome_popular ?? 'Folha em validação'}</strong>
              <div className="sutil">Visível para: {ROTULO_VISIBILIDADE[p.visibilidade]}</div>
              <Galeria caminhos={fotosDoPonto(p)} nome={p.folhas?.nome_popular ?? 'Folha'} />
              {p.observacao && <p>{p.observacao}</p>}
              <a href={linkComoChegar(p.lat, p.lng)} target="_blank" rel="noreferrer">Ver o local no mapa</a>
              <div className="linha">
                <button className="primario" disabled={ocupado === p.id}
                  onClick={() => executar(p.id, supabase.from('pontos').update({ status: 'validado' }).eq('id', p.id), 'Ponto validado.')}>
                  Validar
                </button>
                <button className="link perigo" disabled={ocupado === p.id}
                  onClick={() => confirm('Recusar este ponto? Ele sai do mapa.') &&
                    executar(p.id, supabase.from('pontos').update({ status: 'recusado' }).eq('id', p.id), 'Ponto recusado.')}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {souZelador && perfil?.terreiro_id && (
        <section className="cartao">
          <Convites terreiroId={perfil.terreiro_id} tipo="membro"
            titulo="👥 Convidar filhos da casa"
            explicacao="Envie este link no grupo da casa. Várias pessoas podem usar; os pedidos aparecem no topo desta tela para você aprovar. Vale por 30 dias." />
        </section>
      )}

      {souZelador && (
        <section>
          <h2>Membros da casa ({aprovados.length})</h2>
          <p className="sutil">
            <strong>Membro</strong> {EXPLICA_PAPEL.membro}; <strong>validador</strong> {EXPLICA_PAPEL.validador};{' '}
            <strong>zelador</strong> {EXPLICA_PAPEL.zelador}.
          </p>
          {aprovados.length === 0 && <p className="sutil">Ninguém além de você ainda. Envie o link de convite acima.</p>}
          {aprovados.map((m) => (
            <div key={m.id} className="cartao linha">
              <strong className="cresce">{m.apelido}</strong>
              <select value={m.papel} disabled={ocupado === m.id} aria-label={`Papel de ${m.apelido}`}
                onChange={(e) => mudarPapel(m, e.target.value as Papel)}>
                {(Object.keys(ROTULO_PAPEL) as Papel[]).map((papel) => (
                  <option key={papel} value={papel}>{ROTULO_PAPEL[papel]}</option>
                ))}
              </select>
              <button className="link perigo" disabled={ocupado === m.id}
                onClick={() => confirm(`Remover ${m.apelido} do aplicativo? A conta dela será apagada.`) &&
                  executar(m.id, supabase.rpc('remover_membro', { p_usuario: m.id }), `${m.apelido} foi removido(a).`)}>
                Remover
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
