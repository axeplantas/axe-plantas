import type { LatLngExpression } from 'leaflet'
import { useEffect, useState, type FormEvent } from 'react'
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FotosDaPlanta, { type FotoPlanta } from '../components/FotosDaPlanta'
import IdentificarFolha, { type FolhaResumo } from '../components/IdentificarFolha'
import SeletorFolha from '../components/SeletorFolha'
import { avisar } from '../lib/avisos'
import { ehErroDeRede, enviarPonto, guardarPonto } from '../lib/fila'
import { prepararFoto } from '../lib/imagem'
import { ehValidador, useSessao } from '../lib/sessao'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { ROTULO_VISIBILIDADE, type Visibilidade } from '../lib/tipos'

const CHAVE_FOLHAS = 'axe-plantas:folhas'

/** Lista de folhas guardada no celular, para marcar pontos mesmo sem internet. */
function folhasGuardadas(): FolhaResumo[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FOLHAS) ?? '[]') as FolhaResumo[]
  } catch {
    return []
  }
}

export default function NovoPonto() {
  const { perfil } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()

  const [folhas, setFolhas] = useState<FolhaResumo[]>(folhasGuardadas)
  const [folhaNova, setFolhaNova] = useState(false)
  const [folhaId, setFolhaId] = useState(params.get('folha') ?? '')
  const [posicao, setPosicao] = useState<[number, number] | null>(null)
  const [precisao, setPrecisao] = useState<number | null>(null)
  const [versaoGps, setVersaoGps] = useState(0)
  const [zoom, setZoom] = useState(18)
  const [erroGps, setErroGps] = useState('')
  const [fotos, setFotos] = useState<FotoPlanta[]>([])
  const [semInternet, setSemInternet] = useState(!navigator.onLine)
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
      .then(({ data, error }) => {
        if (error || !data) return
        setFolhas(data)
        try {
          localStorage.setItem(CHAVE_FOLHAS, JSON.stringify(data))
        } catch {
          // Sem espaço: segue sem a cópia local.
        }
      })
    pegarLocalizacao()

    const mudou = () => setSemInternet(!navigator.onLine)
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => {
      window.removeEventListener('online', mudou)
      window.removeEventListener('offline', mudou)
    }
  }, [])

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

  function validar(): string | null {
    if (!folhaId) return 'Falta escolher qual é a folha (passo 2).'
    if (!posicao) return 'Falta marcar onde está a folha (passo 3).'
    if (zoom < 15) return 'Aproxime o mapa (passo 3) até a mira ficar exatamente em cima da planta.'
    return null
  }

  async function salvar(e: FormEvent, soGuardar = false) {
    e.preventDefault()
    if (!perfil) return
    const problema = validar()
    if (problema) return setErro(problema)
    setErro('')
    setSalvando(true)

    const blobs = await Promise.all(fotos.map((f) => prepararFoto(f.arquivo)))
    const ponto = {
      folhaId,
      lat: posicao![0],
      lng: posicao![1],
      observacao: observacao.trim() || null,
      visibilidade,
      fotos: blobs,
    }

    async function guardar(motivo: string) {
      await guardarPonto({
        ...ponto,
        id: crypto.randomUUID(),
        folhaNome: folhas.find((f) => f.id === folhaId)?.nome_popular ?? 'Folha',
        criadoEm: new Date().toISOString(),
      })
      avisar(motivo)
      navegar('/')
    }

    try {
      if (soGuardar || !navigator.onLine) {
        return await guardar('Guardado no celular. Será enviado sozinho quando houver internet.')
      }
      await enviarPonto(ponto, perfil.id, perfil.terreiro_id)
      avisar(
        visibilidade === 'privado' || ehValidador(perfil)
          ? 'Ponto salvo no mapa!'
          : 'Ponto enviado! Ele aparece para todos depois que um validador da sua casa aprovar.',
      )
      navegar(`/?folha=${folhaId}`)
    } catch (err) {
      if (ehErroDeRede(err)) {
        return await guardar('A internet caiu: guardei no celular e envio sozinho quando voltar.')
      }
      setErro(mensagemDeErro(err))
      setSalvando(false)
    }
  }

  return (
    <form className="pagina formulario" onSubmit={salvar}>
      <h1>Marcar uma folha</h1>
      {semInternet && (
        <p className="aviso">
          📵 Você está sem internet. Pode marcar normalmente: o ponto fica guardado no celular e é enviado sozinho quando o
          sinal voltar.
        </p>
      )}

      <section>
        <h2>1. Fotos</h2>
        <FotosDaPlanta fotos={fotos} aoMudar={setFotos} />
        {fotos.length > 0 && (
          <IdentificarFolha key={fotos.map((f) => f.id + f.orgao).join()} fotos={fotos} folhas={folhas}
            aoEscolher={(folha, nova) => {
              if (nova) setFolhas((lista) => [...lista, folha].sort((a, b) => a.nome_popular.localeCompare(b.nome_popular, 'pt-BR')))
              setFolhaId(folha.id)
              setFolhaNova(nova)
            }} />
        )}
        {fotos.length > 0 && <p className="sutil">As fotos ficam no ponto, para quem for procurar a folha saber como ela é.</p>}
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
      <button className="primario" disabled={salvando}>
        {salvando ? 'Salvando…' : semInternet ? 'Guardar no celular' : 'Salvar no mapa'}
      </button>
      {!semInternet && (
        <button type="button" className="botao" disabled={salvando} onClick={(e) => salvar(e as unknown as FormEvent, true)}>
          📦 Guardar no celular e enviar depois
        </button>
      )}
      {!semInternet && <p className="sutil centro">Use “guardar” quando o sinal estiver fraco: o app envia sozinho mais tarde.</p>}
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
