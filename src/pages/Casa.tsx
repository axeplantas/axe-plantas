import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TrocarCasa from '../components/TrocarCasa'
import { feriadosNacionais } from '../lib/feriados'
import { ehEquipe, ehGestorFinanceiro, ehValidador, ehZelador, useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { formatarDataCurta, type Evento } from '../lib/tipos'

function hojeIso(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

/** Aba "Casa": tudo o que é da casa ativa, num só lugar. */
export default function Casa() {
  const { perfil, casaAtiva } = useSessao()
  const terreiro = casaAtiva?.terreiro_id
  const [proximo, setProximo] = useState<Evento | null>(null)
  const [paraConferir, setParaConferir] = useState(0)
  const [verMateriais, setVerMateriais] = useState(false)
  const [pendencias, setPendencias] = useState(0)

  useEffect(() => {
    if (!terreiro) return
    supabase.from('eventos').select('*').eq('terreiro_id', terreiro).gte('data', hojeIso()).order('data').limit(1)
      .then(({ data }) => setProximo(((data ?? []) as Evento[])[0] ?? null))
    supabase.rpc('pode_ver_materiais', { p_terreiro: terreiro }).then(({ data }) => setVerMateriais(data === true))
    if (ehGestorFinanceiro(casaAtiva)) {
      supabase.from('pagamentos').select('id', { count: 'exact', head: true }).eq('terreiro_id', terreiro).eq('status', 'informado')
        .then(({ count }) => setParaConferir(count ?? 0))
    }
    if (ehValidador(perfil)) {
      Promise.all([
        supabase.from('folhas').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('terreiro_id', terreiro),
        supabase.from('pontos').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('terreiro_id', terreiro).neq('visibilidade', 'privado'),
        ehZelador(casaAtiva)
          ? supabase.from('membros').select('perfil_id', { count: 'exact', head: true }).eq('terreiro_id', terreiro).eq('aprovado', false)
          : Promise.resolve({ count: 0 }),
      ]).then((r) => setPendencias(r.reduce((s, x) => s + (x.count ?? 0), 0)))
    }
  }, [terreiro, casaAtiva, perfil])

  const hoje = hojeIso()
  const proximoFeriado = feriadosNacionais(new Date().getFullYear())
    .concat(feriadosNacionais(new Date().getFullYear() + 1))
    .find((f) => f.data >= hoje)

  return (
    <div className="pagina">
      <h1>Casa</h1>
      <TrocarCasa />

      {ehZelador(casaAtiva) && (
        <Link to="/casa/gestao" className="cartao-gestao">
          <span className="cartao-casa-icone">⚙️</span>
          <span className="cresce">
            <strong>Gestão da casa</strong>
            <span className="sutil">Filhos e funções, financeiro, calendário, materiais e convites</span>
          </span>
          {pendencias + paraConferir > 0 && <b className="selo-cartao">{pendencias + paraConferir}</b>}
          <span aria-hidden>›</span>
        </Link>
      )}

      <div className="grade-casa">
        <Link to="/casa/calendario" className="cartao-casa">
          <span className="cartao-casa-icone">📅</span>
          <strong>Calendário</strong>
          <span className="sutil">
            {proximo
              ? `${formatarDataCurta(proximo.data).slice(0, 5)} · ${proximo.titulo}`
              : proximoFeriado
                ? `Feriado: ${formatarDataCurta(proximoFeriado.data).slice(0, 5)} · ${proximoFeriado.nome}`
                : 'Festas, giras e obrigações'}
          </span>
        </Link>

        <Link to="/casa/financeiro" className="cartao-casa">
          <span className="cartao-casa-icone">💰</span>
          <strong>Financeiro</strong>
          <span className="sutil">
            {ehGestorFinanceiro(casaAtiva) && paraConferir > 0
              ? `${paraConferir} comprovante(s) para conferir`
              : ehGestorFinanceiro(casaAtiva) ? 'Mensalidades, contribuições e comprovantes' : 'Minhas mensalidades e contribuições'}
          </span>
          {paraConferir > 0 && ehGestorFinanceiro(casaAtiva) && <b className="selo-cartao">{paraConferir}</b>}
        </Link>

        <Link to="/obrigacoes" className="cartao-casa">
          <span className="cartao-casa-icone">📋</span>
          <strong>Obrigações</strong>
          <span className="sutil">Listas de folhas para preparar</span>
        </Link>

        {verMateriais && (
          <Link to="/casa/materiais" className="cartao-casa">
            <span className="cartao-casa-icone">📦</span>
            <strong>Materiais</strong>
            <span className="sutil">Estoque da casa</span>
          </Link>
        )}

        {ehValidador(perfil) && (
          <Link to="/painel" className="cartao-casa">
            <span className="cartao-casa-icone">✔️</span>
            <strong>Validar</strong>
            <span className="sutil">{pendencias > 0 ? `${pendencias} esperando você` : 'Tudo em dia'}</span>
            {pendencias > 0 && <b className="selo-cartao">{pendencias}</b>}
          </Link>
        )}

      </div>

      {!ehEquipe(casaAtiva) && (
        <p className="sutil centro">É filho(a) de outra casa também? Peça o link de convite ao zelador de lá: você entra com esta mesma conta.</p>
      )}
    </div>
  )
}
