import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import Foto from '../components/Foto'
import { useSessao } from '../lib/sessao'
import { BUCKET_FOTOS, mensagemDeErro, modoDemo, supabase } from '../lib/supabase'
import { ROTULO_VISIBILIDADE, type Folha, type Ponto } from '../lib/tipos'

const CENTRO_BRASIL: LatLngExpression = [-14.235, -51.925]

const COR_VISIBILIDADE = {
  rede: '#2f7d4a',
  terreiro: '#c98a1b',
  privado: '#6b6b6b',
}

export default function Mapa() {
  const { perfil } = useSessao()
  const [params, setParams] = useSearchParams()
  const filtroFolha = params.get('folha') ?? ''
  const filtroLista = useMemo(() => params.get('folhas')?.split(',').filter(Boolean) ?? [], [params])
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [folhas, setFolhas] = useState<Pick<Folha, 'id' | 'nome_popular'>[]>([])
  const [eu, setEu] = useState<[number, number] | null>(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    const [resPontos, resFolhas] = await Promise.all([
      supabase.from('pontos').select('*, folhas(nome_popular, nome_ritual, toxica, alerta)').neq('status', 'recusado'),
      supabase.from('folhas').select('id, nome_popular').eq('status', 'validada').order('nome_popular'),
    ])
    if (resPontos.error) setErro(mensagemDeErro(resPontos.error))
    setPontos((resPontos.data ?? []) as Ponto[])
    setFolhas(resFolhas.data ?? [])
  }

  useEffect(() => {
    carregar()
    navigator.geolocation?.getCurrentPosition(
      (pos) => setEu([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }, [])

  const visiveis = useMemo(() => {
    if (filtroLista.length > 0) return pontos.filter((p) => filtroLista.includes(p.folha_id))
    if (filtroFolha) return pontos.filter((p) => p.folha_id === filtroFolha)
    return pontos
  }, [pontos, filtroFolha, filtroLista])

  async function apagar(ponto: Ponto) {
    if (!confirm('Apagar este ponto do mapa?')) return
    const { error } = await supabase.from('pontos').delete().eq('id', ponto.id)
    if (error) return alert(mensagemDeErro(error))
    if (ponto.foto_path && ponto.criado_por === perfil?.id) {
      await supabase.storage.from(BUCKET_FOTOS).remove([ponto.foto_path])
    }
    setPontos((lista) => lista.filter((p) => p.id !== ponto.id))
  }

  return (
    <div className="mapa-tela">
      <div className="mapa-filtro">
        {filtroLista.length > 0 ? (
          <button className="filtro-ativo" onClick={() => setParams({})}>
            Folhas da obrigação ({visiveis.length} pontos) ✕
          </button>
        ) : (
        <select
          value={filtroFolha}
          onChange={(e) => setParams(e.target.value ? { folha: e.target.value } : {})}
          aria-label="Filtrar por folha"
        >
          <option value="">Todas as folhas ({pontos.length})</option>
          {folhas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome_popular}
            </option>
          ))}
        </select>
        )}
      </div>
      {erro && <p className="erro flutuante">{erro}</p>}

      <MapContainer center={CENTRO_BRASIL} zoom={4} className="mapa">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Enquadrar pontos={visiveis} eu={eu} />

        {eu && (
          <CircleMarker center={eu} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }}>
            <Popup>Você está aqui</Popup>
          </CircleMarker>
        )}

        {visiveis.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{
              color: p.folhas?.toxica ? '#b3261e' : '#fff',
              weight: p.folhas?.toxica ? 3 : 2,
              fillColor: COR_VISIBILIDADE[p.visibilidade],
              fillOpacity: p.status === 'pendente' ? 0.4 : 0.9,
              dashArray: p.status === 'pendente' ? '4 3' : undefined,
            }}
          >
            <Popup minWidth={220}>
              <div className="popup">
                <strong>{p.folhas?.nome_popular ?? 'Folha em validação'}</strong>
                {p.folhas?.nome_ritual && <div className="sutil">{p.folhas.nome_ritual}</div>}
                {p.folhas?.toxica && <div className="alerta-toxica">⚠️ Tóxica{p.folhas.alerta ? `: ${p.folhas.alerta}` : ''}</div>}
                {p.status === 'pendente' && <div className="etiqueta">Aguardando validação</div>}
                <div className="sutil">{ROTULO_VISIBILIDADE[p.visibilidade]}</div>
                {p.foto_path && <Foto caminho={p.foto_path} alt={p.folhas?.nome_popular ?? 'Foto'} />}
                {p.observacao && <p>{p.observacao}</p>}
                <div className="popup-acoes">
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                    Como chegar
                  </a>
                  <Link to={`/folhas/${p.folha_id}`}>Ver folha</Link>
                  {p.criado_por === perfil?.id && (
                    <button className="link perigo" onClick={() => apagar(p)}>
                      Apagar
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="legenda">
        <span><i style={{ background: COR_VISIBILIDADE.rede }} />Rede</span>
        <span><i style={{ background: COR_VISIBILIDADE.terreiro }} />Terreiro</span>
        <span><i style={{ background: COR_VISIBILIDADE.privado }} />Só eu</span>
        <span><i className="borda-toxica" />Tóxica</span>
        {modoDemo && <strong>DEMO</strong>}
      </div>
    </div>
  )
}

/** Ajusta o zoom do mapa para mostrar os pontos (ou a sua posição). */
function Enquadrar({ pontos, eu }: { pontos: Ponto[]; eu: [number, number] | null }) {
  const mapa = useMap()
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    if (pontos.length > 0) {
      const limites: LatLngBoundsExpression = pontos.map((p) => [p.lat, p.lng] as [number, number])
      mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 })
      setFeito(true)
    } else if (eu && !feito) {
      mapa.setView(eu, 15)
      setFeito(true)
    }
    // Reenquadra quando o filtro muda a lista de pontos.
  }, [pontos, eu === null])

  return null
}
