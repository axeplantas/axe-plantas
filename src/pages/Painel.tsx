import { useCallback, useEffect, useState } from 'react'
import Foto from '../components/Foto'
import { useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { ROTULO_PAPEL, ROTULO_VISIBILIDADE, type Folha, type Papel, type Perfil, type Ponto } from '../lib/tipos'

export default function Painel() {
  const { perfil } = useSessao()
  const souZelador = perfil?.papel === 'zelador'
  const [membros, setMembros] = useState<Perfil[]>([])
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!perfil) return
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
  }, [perfil, souZelador])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function executar(acao: PromiseLike<{ error: unknown }>) {
    setErro('')
    const { error } = await acao
    if (error) setErro(mensagemDeErro(error))
    await carregar()
  }

  const pendentes = membros.filter((m) => !m.aprovado)
  const aprovados = membros.filter((m) => m.aprovado)

  return (
    <div className="pagina">
      <h1>Validar</h1>
      {erro && <p className="erro">{erro}</p>}

      {souZelador && (
        <section>
          <h2>Pedidos de entrada ({pendentes.length})</h2>
          {pendentes.length === 0 && <p className="sutil">Nenhum pedido.</p>}
          {pendentes.map((m) => (
            <div key={m.id} className="cartao">
              <strong>{m.apelido}</strong>
              <div className="sutil">Pediu em {new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
              <div className="linha">
                <button className="primario"
                  onClick={() => executar(supabase.rpc('gerenciar_membro', { p_usuario: m.id, p_aprovado: true, p_papel: 'membro' }))}>
                  Aprovar
                </button>
                <button className="link perigo"
                  onClick={() => confirm(`Recusar e apagar o cadastro de ${m.apelido}?`) &&
                    executar(supabase.rpc('remover_membro', { p_usuario: m.id }))}>
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Folhas para validar ({folhas.length})</h2>
        {folhas.length === 0 && <p className="sutil">Nada pendente.</p>}
        {folhas.map((f) => (
          <div key={f.id} className="cartao">
            <strong>{f.nome_popular}</strong>
            {f.nome_ritual && <span className="sutil"> · {f.nome_ritual}</span>}
            {f.nome_cientifico && <div className="cientifico">{f.nome_cientifico}</div>}
            {f.outros_nomes && <div className="sutil">Outros nomes: {f.outros_nomes}</div>}
            {(f.toxica || f.alerta) && <div className="alerta-toxica">{f.toxica ? '⚠️ Tóxica. ' : ''}{f.alerta}</div>}
            <div className="linha">
              <button className="primario" onClick={() => executar(supabase.from('folhas').update({ status: 'validada' }).eq('id', f.id))}>
                Validar
              </button>
              <button className="link perigo" onClick={() => executar(supabase.from('folhas').update({ status: 'recusada' }).eq('id', f.id))}>
                Recusar
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Pontos para validar ({pontos.length})</h2>
        {pontos.length === 0 && <p className="sutil">Nada pendente.</p>}
        {pontos.map((p) => (
          <div key={p.id} className="cartao">
            <strong>{p.folhas?.nome_popular ?? 'Folha em validação'}</strong>
            <div className="sutil">{ROTULO_VISIBILIDADE[p.visibilidade]}</div>
            {p.foto_path && <Foto caminho={p.foto_path} alt={p.folhas?.nome_popular ?? 'Foto'} />}
            {p.observacao && <p>{p.observacao}</p>}
            <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer">
              Ver local
            </a>
            <div className="linha">
              <button className="primario" onClick={() => executar(supabase.from('pontos').update({ status: 'validado' }).eq('id', p.id))}>
                Validar
              </button>
              <button className="link perigo" onClick={() => executar(supabase.from('pontos').update({ status: 'recusado' }).eq('id', p.id))}>
                Recusar
              </button>
            </div>
          </div>
        ))}
      </section>

      {souZelador && (
        <section>
          <h2>Membros da casa ({aprovados.length})</h2>
          <p className="sutil">Validadores podem aprovar folhas e pontos. Zeladores também aprovam membros.</p>
          {aprovados.map((m) => (
            <div key={m.id} className="cartao linha">
              <strong className="cresce">{m.apelido}</strong>
              <select
                value={m.papel}
                onChange={(e) =>
                  executar(supabase.rpc('gerenciar_membro', { p_usuario: m.id, p_aprovado: true, p_papel: e.target.value as Papel }))
                }
              >
                {(Object.keys(ROTULO_PAPEL) as Papel[]).map((papel) => (
                  <option key={papel} value={papel}>{ROTULO_PAPEL[papel]}</option>
                ))}
              </select>
              <button className="link perigo"
                onClick={() => confirm(`Remover ${m.apelido} do aplicativo?`) &&
                  executar(supabase.rpc('remover_membro', { p_usuario: m.id }))}>
                Remover
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
