import { useEffect, useState } from 'react'

interface Aviso {
  id: number
  mensagem: string
  tipo: 'ok' | 'erro'
}

export default function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  useEffect(() => {
    function receber(e: Event) {
      const { mensagem, tipo } = (e as CustomEvent<{ mensagem: string; tipo: 'ok' | 'erro' }>).detail
      const id = Date.now() + Math.random()
      setAvisos((lista) => [...lista, { id, mensagem, tipo }])
      setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), tipo === 'erro' ? 6000 : 4000)
    }
    window.addEventListener('axe-aviso', receber)
    return () => window.removeEventListener('axe-aviso', receber)
  }, [])

  if (avisos.length === 0) return null
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso-flutuante ${a.tipo}`}>{a.mensagem}</div>
      ))}
    </div>
  )
}
