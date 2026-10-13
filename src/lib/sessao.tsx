import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Perfil } from './tipos'

interface Sessao {
  sessao: Session | null
  perfil: Perfil | null
  carregando: boolean
  recuperandoSenha: boolean
  fimRecuperacao: () => void
  recarregarPerfil: () => Promise<void>
  sair: () => Promise<void>
}

const ContextoSessao = createContext<Sessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  const buscarPerfil = useCallback(async (usuarioId: string | undefined) => {
    if (!usuarioId) {
      setPerfil(null)
      return
    }
    const { data } = await supabase
      .from('perfis')
      .select('*, terreiros(nome, nacao)')
      .eq('id', usuarioId)
      .maybeSingle()
    setPerfil(data as Perfil | null)
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

  const valor: Sessao = {
    sessao,
    perfil,
    carregando,
    recuperandoSenha,
    fimRecuperacao: () => setRecuperandoSenha(false),
    recarregarPerfil: () => buscarPerfil(sessao?.user.id),
    sair: async () => {
      await supabase.auth.signOut()
      setPerfil(null)
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
