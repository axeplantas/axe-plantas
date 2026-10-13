import Foto from './Foto'

/** Todas as fotos de um ponto, lado a lado (rolando para o lado quando são várias). */
export default function Galeria({ caminhos, nome }: { caminhos: string[]; nome: string }) {
  if (caminhos.length === 0) return null
  if (caminhos.length === 1) return <Foto caminho={caminhos[0]} alt={nome} />
  return (
    <div className="galeria">
      {caminhos.map((c, i) => <Foto key={c} caminho={c} alt={`${nome}, foto ${i + 1}`} />)}
    </div>
  )
}
