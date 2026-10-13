import type { LatLngExpression } from 'leaflet'
import { useEffect, useState, type FormEvent } from 'react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'
import IdentificarFolha, { type FolhaResumo } from '../components/IdentificarFolha'
import SeletorFolha from '../components/SeletorFolha'
import { avisar } from '../lib/avisos'
import { prepararFoto } from '../lib/imagem'
import { ehValidador, useSessao } from '../lib/sessao'
import { BUCKET_FOTOS, mensagemDeErro, supabase } from '../lib/supabase'
import { ROTULO_VISIBILIDADE, type Visibilidade } from '../lib/tipos'

export default function NovoPonto() {
  const { perfil } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()

  const [folhas, setFolhas] = useState<FolhaResumo[]>([])
  const [folhaNova, setFolhaNova] = useState(false)
  const [folhaId, setFolhaId] = useState(params.get('folha') ?? '')
  const [posicao, setPosicao] = useState<[number, number] | null>(null)
  const [precisao, setPrecisao] = useState<number | null>(null)
  const [versaoGps, setVersaoGps] = useState(0)
  const [zoom, setZoom] = useState(18)
  const [erroGps, setErroGps] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [visibilidade, setVisibilidade] = useState<Visibilidade>('rede')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase
      .from('folhas')
      .select('id, nome_popular, nome_cientifico, outros_nomes, status')
      .neq('status', 'recusada')
      .order('nome_popular')
      .then(({ data }) => setFolhas(data ?? []))
    pegarLocalizacao()
  }, [])

  useEffect(() => {
    if (!foto) return setPrevia(null)
    const url = URL.createObjectURL(foto)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  function pegarLocalizacao() {
    setErroGps('')
    if (!navigator.geolocation) return setErroGps('Este celular não informa a localização.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosicao([pos.coords.latitude, pos.coords.longitude])
        setPrecisao(Math.round(pos.coords.accuracy))
        setVersaoGps((v) => v + 1)
        setZoom(18)
      },
      () => setErroGps('Não foi possível pegar a localização. Permita o acesso ao GPS ou arraste o mapa até o local.'),
      { enableHighAccuracy: true, timeout: 20000 },
    )
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!perfil) return
    if (!folhaId) return setErro('Falta escolher qual é a folha (passo 2).')
    if (!posicao) return setErro('Falta marcar onde está a folha (passo 3).')
    if (zoom < 15) return setErro('Aproxime o mapa (passo 3) até a mira ficar exatamente em cima da planta.')
    setErro('')
    setSalvando(true)

    let caminhoFoto: string | null = null
    try {
      if (foto) {
        const imagem = await prepararFoto(foto)
        caminhoFoto = `${perfil.id}/${crypto.randomUUID()}.jpg`
        const envio = await supabase.storage.from(BUCKET_FOTOS).upload(caminhoFoto, imagem, { contentType: 'image/jpeg' })
        if (envio.error) throw envio.error
      }

      const { error } = await supabase.from('pontos').insert({
        folha_id: folhaId,
        lat: posicao[0],
        lng: posicao[1],
        foto_path: caminhoFoto,
        observacao: observacao.trim() || null,
        visibilidade,
        terreiro_id: perfil.terreiro_id,
      })
      if (error) throw error
      avisar(
        visibilidade === 'privado' || ehValidador(perfil)
          ? 'Ponto salvo no mapa!'
          : 'Ponto enviado! Ele aparece para todos depois que um validador da sua casa aprovar.',
      )
      navegar(`/?folha=${folhaId}`)
    } catch (err) {
      if (caminhoFoto) await supabase.storage.from(BUCKET_FOTOS).remove([caminhoFoto])
      setErro(mensagemDeErro(err))
      setSalvando(false)
    }
  }

  return (
    <form className="pagina formulario" onSubmit={salvar}>
      <h1>Marcar uma folha</h1>

      <section>
        <h2>1. Foto</h2>
        <label className="botao-foto">
          {previa ? <img src={previa} alt="Prévia" className="foto" /> : '📷 Tirar ou escolher foto'}
          <input type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        {foto && (
          <IdentificarFolha key={previa} foto={foto} folhas={folhas}
            aoEscolher={(folha, nova) => {
              if (nova) setFolhas((lista) => [...lista, folha].sort((a, b) => a.nome_popular.localeCompare(b.nome_popular, 'pt-BR')))
              setFolhaId(folha.id)
              setFolhaNova(nova)
            }} />
        )}
      </section>

      <section>
        <h2>2. Qual folha?</h2>
        <SeletorFolha folhas={folhas} valor={folhaId} aoMudar={(id) => { setFolhaId(id); setFolhaNova(false) }} />
        {folhaNova && (
          <p className="aviso">Folha nova cadastrada a partir da foto. O validador da sua casa vai conferir o nome.</p>
        )}
      </section>

      <section>
        <h2>3. Onde está?</h2>
        <p className="sutil">Arraste o mapa até a mira ficar em cima da planta.</p>
        <div className="mapa-mira">
          {posicao ? (
            <MapContainer key={versaoGps} center={posicao as LatLngExpression} zoom={precisao === null ? 4 : 18}
              className="mapa">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <SeguirCentro aoMudar={(p, z) => { setPosicao(p); setZoom(z) }} />
            </MapContainer>
          ) : (
            <div className="mapa mapa-vazio">{erroGps || 'Procurando sua localização…'}</div>
          )}
          {posicao && <div className="mira" aria-hidden>✛</div>}
        </div>
        <div className="linha">
          {precisao !== null && (
            <span className={precisao > 50 ? 'aviso-pequeno' : 'sutil'}>
              {precisao > 50 ? `GPS impreciso (~${precisao} m): arraste o mapa até o lugar exato.` : `Precisão do GPS: ~${precisao} m`}
            </span>
          )}
          <button type="button" className="link" onClick={pegarLocalizacao}>Usar minha posição</button>
          {!posicao && erroGps && (
            <button type="button" className="link" onClick={() => { setPosicao([-14.235, -51.925]); setZoom(4) }}>
              Escolher no mapa
            </button>
          )}
        </div>
      </section>

      <section>
        <h2>4. Quem pode ver?</h2>
        <div className="opcoes">
          {(Object.keys(ROTULO_VISIBILIDADE) as Visibilidade[]).map((v) => (
            <label key={v} className="opcao">
              <input type="radio" name="visibilidade" checked={visibilidade === v} onChange={() => setVisibilidade(v)} />
              {ROTULO_VISIBILIDADE[v]}
            </label>
          ))}
        </div>
        <p className="sutil">
          {visibilidade === 'privado'
            ? 'Só você vê este ponto. Bom para quintais e lugares particulares.'
            : visibilidade === 'rede'
              ? 'Todos os terreiros vão ver. Não marque casas, quintais ou terreiros: para isso, use “Só eu”.'
              : 'Só os membros da sua casa vão ver.'}
          {visibilidade !== 'privado' && !ehValidador(perfil) && ' Aparece depois que um validador aprovar.'}
        </p>
      </section>

      <section>
        <h2>5. Observação (opcional)</h2>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} maxLength={500}
          placeholder="Ex.: atrás do banco da praça, florindo em outubro" />
      </section>

      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar no mapa'}</button>
    </form>
  )
}

function SeguirCentro({ aoMudar }: { aoMudar: (p: [number, number], zoom: number) => void }) {
  const mapa = useMapEvents({
    moveend: () => {
      const c = mapa.getCenter()
      aoMudar([c.lat, c.lng], mapa.getZoom())
    },
  })
  return null
}
