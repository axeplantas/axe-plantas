import { useEffect, useState } from 'react'
import { urlDaFoto } from '../lib/supabase'

export default function Foto({ caminho, alt }: { caminho: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    urlDaFoto(caminho).then((u) => ativo && setUrl(u))
    return () => {
      ativo = false
    }
  }, [caminho])

  if (!url) return <div className="foto foto-carregando">Carregando foto…</div>
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img className="foto" src={url} alt={alt} />
    </a>
  )
}
