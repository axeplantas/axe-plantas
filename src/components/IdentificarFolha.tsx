import { useState } from 'react'
import { prepararFoto } from '../lib/imagem'
import { useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import type { Folha } from '../lib/tipos'

export type FolhaResumo = Pick<Folha, 'id' | 'nome_popular' | 'nome_cientifico' | 'status'>

interface Sugestao {
  cientifico: string
  familia: string | null
  nomes: string[]
  confianca: number
}

/** "Schinus terebinthifolia Raddi" → "schinus terebinthifolia" (gênero + espécie). */
function especie(nome: string | null): string {
  return (nome ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Envia a foto ao Pl@ntNet (pela função do Supabase) e deixa escolher a sugestão certa. */
export default function IdentificarFolha({ foto, folhas, aoEscolher }: {
  foto: File
  folhas: FolhaResumo[]
  aoEscolher: (folha: FolhaResumo, nova: boolean) => void
}) {
  const { perfil } = useSessao()
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const noCatalogo = (s: Sugestao) => folhas.find((f) => especie(f.nome_cientifico) === especie(s.cientifico))

  async function identificar() {
    setErro('')
    setBuscando(true)
    try {
      const imagem = await prepararFoto(foto, 1280)
      const corpo = new FormData()
      corpo.append('foto', imagem, 'foto.jpg')
      const { data, error } = await supabase.functions.invoke('identificar', { body: corpo })
      if (error) {
        const detalhe = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detalhe?.erro ?? 'Não foi possível identificar agora. Tente de novo.')
      }
      setSugestoes((data?.sugestoes ?? []) as Sugestao[])
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setBuscando(false)
    }
  }

  async function escolher(s: Sugestao) {
    const existente = noCatalogo(s)
    if (existente) return aoEscolher(existente, false)
    if (!perfil) return
    setSalvando(s.cientifico)
    setErro('')
    const { data, error } = await supabase
      .from('folhas')
      .insert({
        nome_popular: capitalizar(s.nomes[0] ?? s.cientifico),
        outros_nomes: s.nomes.slice(1, 5).join(', ') || null,
        nome_cientifico: s.cientifico,
        terreiro_id: perfil.terreiro_id,
      })
      .select('id, nome_popular, nome_cientifico, status')
      .single()
    setSalvando(null)
    if (error) return setErro(mensagemDeErro(error))
    aoEscolher(data as FolhaResumo, true)
  }

  if (!sugestoes) {
    return (
      <div className="identificar">
        <button type="button" className="botao bloco" onClick={identificar} disabled={buscando}>
          {buscando ? 'Identificando…' : '🔍 Identificar a planta pela foto'}
        </button>
        {erro && <p className="erro">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="identificar">
      {sugestoes.length === 0 ? (
        <p className="aviso">Não reconheci nenhuma planta. Tente uma foto mais de perto, de uma folha ou flor, com boa luz.</p>
      ) : (
        <>
          <p className="sutil">
            Toque na planta certa. <strong>É só uma sugestão:</strong> confira antes, porque algumas plantas tóxicas são
            parecidas com outras.
          </p>
          <ul className="sugestoes">
            {sugestoes.map((s) => {
              const existente = noCatalogo(s)
              return (
                <li key={s.cientifico}>
                  <button type="button" className="sugestao" onClick={() => escolher(s)} disabled={salvando !== null}>
                    <span className="sugestao-nome">
                      <strong>{existente?.nome_popular ?? capitalizar(s.nomes[0] ?? s.cientifico)}</strong>
                      <em>{s.cientifico}</em>
                      <span className="sutil">
                        {existente ? 'Já está no catálogo' : 'Folha nova: será cadastrada'}
                        {s.confianca < 20 && ' · pouca certeza'}
                      </span>
                    </span>
                    <span className="sugestao-certeza">{salvando === s.cientifico ? '…' : `${s.confianca}%`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {erro && <p className="erro">{erro}</p>}
      <button type="button" className="link" onClick={() => setSugestoes(null)}>Tentar de novo</button>
    </div>
  )
}
