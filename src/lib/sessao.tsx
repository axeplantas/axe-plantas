import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Casa, Perfil } from './tipos'

interface Sessao {
  sessao: Session | null
  perfil: Perfil | null
  /** Todas as casas da pessoa (aprovadas ou aguardando). */
  casas: Casa[]
  /** O vínculo com a casa escolhida no momento. */
  casaAtiva: Casa | null
  carregando: boolean
  recuperandoSenha: boolean
  fimRecuperacao: () => void
  recarregarPerfil: () => Promise<void>
  trocarCasa: (terreiroId: string) => Promise<void>
  sair: () => Promise<void>
}

const ContextoSessao = createContext<Sessao | null>(null)

const CHAVE_PERFIL = 'axe-plantas:perfil'

interface Guardado {
  perfil: Perfil
  casas: Casa[]
}

function guardar(dados: Guardado | null) {
  try {
    if (dados) localStorage.setItem(CHAVE_PERFIL, JSON.stringify(dados))
    else localStorage.removeItem(CHAVE_PERFIL)
  } catch {
    // Sem armazenamento disponível: segue sem cópia local.
  }
}

function lerGuardado(usuarioId: string): Guardado | null {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_PERFIL) ?? 'null') as Guardado | Perfil | null
    if (!dados) return null
    // Formato antigo guardava só o perfil.
    const normalizado = 'perfil' in dados ? dados : { perfil: dados, casas: [] }
    return normalizado.perfil?.id === usuarioId ? normalizado : null
  } catch {
    return null
  }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [casas, setCasas] = useState<Casa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  const buscarPerfil = useCallback(async (usuarioId: string | undefined) => {
    if (!usuarioId) {
      setPerfil(null)
      setCasas([])
      return
    }
    const [resPerfil, resCasas] = await Promise.all([
      supabase.from('perfis').select('*, terreiros(nome, nacao)').eq('id', usuarioId).maybeSingle(),
      supabase
        .from('membros')
        .select('terreiro_id, papel, aprovado, contador, isento, mensalidade_valor, aprovado_em, terreiros(nome, nacao)')
        .eq('perfil_id', usuarioId),
    ])
    if (resPerfil.error) {
      // Sem internet: usa o cadastro guardado no celular para o app continuar abrindo.
      const guardado = lerGuardado(usuarioId)
      if (guardado) {
        setPerfil(guardado.perfil)
        setCasas(guardado.casas)
      }
      return
    }
    const novoPerfil = resPerfil.data as Perfil | null
    const novasCasas = ((resCasas.data ?? []) as unknown as Casa[]).sort((a, b) =>
      (a.terreiros?.nome ?? '').localeCompare(b.terreiros?.nome ?? '', 'pt-BR'),
    )
    guardar(novoPerfil ? { perfil: novoPerfil, casas: novasCasas } : null)
    setPerfil(novoPerfil)
    setCasas(novasCasas)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session)
      await buscarPerfil(data.session?.user.id)
      setCarregando(false)
    })

    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      setSessao(novaSessao)
      // Fora do callback para não travar o cliente do Supabase.
      setTimeout(() => buscarPerfil(novaSessao?.user.id), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [buscarPerfil])

  const recarregarPerfil = useCallback(() => buscarPerfil(sessao?.user.id), [buscarPerfil, sessao?.user.id])

  const trocarCasa = useCallback(async (terreiroId: string) => {
    const { error } = await supabase.rpc('trocar_casa', { p_terreiro: terreiroId })
    if (error) throw error
    await recarregarPerfil()
  }, [recarregarPerfil])

  const valor: Sessao = {
    sessao,
    perfil,
    casas,
    casaAtiva: casas.find((c) => c.terreiro_id === perfil?.terreiro_id) ?? null,
    carregando,
    recuperandoSenha,
    fimRecuperacao: () => setRecuperandoSenha(false),
    recarregarPerfil,
    trocarCasa,
    sair: async () => {
      await supabase.auth.signOut()
      guardar(null)
      setPerfil(null)
      setCasas([])
    },
  }

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

export function useSessao(): Sessao {
  const contexto = useContext(ContextoSessao)
  if (!contexto) throw new Error('useSessao fora do ProvedorSessao')
  return contexto
}

export function ehAdmin(perfil: Perfil | null): boolean {
  return perfil?.aprovado === true && perfil.admin === true
}

export function ehValidador(perfil: Perfil | null): boolean {
  return perfil?.aprovado === true && (perfil.papel === 'validador' || perfil.papel === 'zelador')
}

export function ehZelador(casa: Casa | null): boolean {
  return casa?.aprovado === true && casa.papel === 'zelador'
}

/** Zelador ou contador: confere mensalidades e contribuições. */
export function ehGestorFinanceiro(casa: Casa | null): boolean {
  return casa?.aprovado === true && (casa.papel === 'zelador' || casa.contador)
}

/** Zelador ou validador: cuida do calendário. */
export function ehEquipe(casa: Casa | null): boolean {
  return casa?.aprovado === true && (casa.papel === 'zelador' || casa.papel === 'validador')
}
