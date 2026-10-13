import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Folha } from '../lib/tipos'

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function Folhas() {
  const [folhas, setFolhas] = useState<Folha[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase
      .from('folhas')
      .select('*')
      .neq('status', 'recusada')
      .order('nome_popular')
      .then(({ data }) => {
        setFolhas((data ?? []) as Folha[])
        setCarregando(false)
      })
  }, [])

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim())
    if (!termo) return folhas
    return folhas.filter((f) =>
      semAcento([f.nome_popular, f.nome_ritual, f.outros_nomes, f.nome_cientifico].filter(Boolean).join(' ')).includes(termo),
    )
  }, [folhas, busca])

  return (
    <div className="pagina">
      <div className="cabecalho">
        <h1>Folhas</h1>
        <Link to="/folhas/nova" className="botao">+ Nova</Link>
      </div>
      <input type="search" placeholder="Buscar por qualquer nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />

      {carregando && <p className="sutil">Carregando…</p>}
      {!carregando && filtradas.length === 0 && (
        <p className="sutil">{busca ? 'Nenhuma folha encontrada.' : 'Nenhuma folha cadastrada ainda. Que tal a primeira?'}</p>
      )}

      <ul className="lista">
        {filtradas.map((f) => (
          <li key={f.id}>
            <Link to={`/folhas/${f.id}`} className="item">
              <div>
                <strong>{f.nome_popular}</strong>
                {f.nome_ritual && <span className="sutil"> · {f.nome_ritual}</span>}
                {f.nome_cientifico && <div className="cientifico">{f.nome_cientifico}</div>}
              </div>
              <div className="etiquetas">
                {f.toxica && <span className="etiqueta perigo">Tóxica</span>}
                {f.status === 'pendente' && <span className="etiqueta">Em validação</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
