import { useState } from 'react'

/** Mostra um link com botões para copiar e enviar pelo WhatsApp. */
export default function CompartilharLink({ link, mensagem }: { link: string; mensagem: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      prompt('Copie o link:', link)
    }
  }

  async function compartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Axé Plantas', text: mensagem, url: link })
        return
      } catch {
        // A pessoa cancelou: não faz nada.
        return
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${mensagem} ${link}`)}`, '_blank')
  }

  return (
    <div className="compartilhar">
      <code className="link-convite">{link}</code>
      <div className="linha">
        <button type="button" className="primario" onClick={compartilhar}>Enviar</button>
        <button type="button" className="botao" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar link'}</button>
        <a className="link" href={`https://wa.me/?text=${encodeURIComponent(`${mensagem} ${link}`)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  )
}
