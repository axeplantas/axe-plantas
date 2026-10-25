export interface Leitura {
  lat: number
  lng: number
  /** Raio de incerteza, em metros. */
  precisao: number
}

/**
 * Escuta o GPS por alguns segundos e fica com a melhor leitura.
 * A primeira posição costuma vir do Wi-Fi ou da antena (50 m ou mais); o GPS de verdade
 * chega depois, quando o celular "enxerga" os satélites. Para sozinho ao atingir o alvo
 * ou o tempo limite. Devolve uma função que interrompe a escuta.
 */
export function buscarPosicaoPrecisa(
  aoMelhorar: (leitura: Leitura) => void,
  aoTerminar: (erro?: string) => void,
  { alvo = 8, limite = 30000 } = {},
): () => void {
  if (!navigator.geolocation) {
    aoTerminar('Este celular não informa a localização.')
    return () => {}
  }
  let melhor: Leitura | null = null
  let ativo = true

  const parar = (erro?: string) => {
    if (!ativo) return
    ativo = false
    navigator.geolocation.clearWatch(id)
    clearTimeout(relogio)
    aoTerminar(erro)
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      if (!ativo) return
      const leitura = { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: Math.round(pos.coords.accuracy) }
      if (!melhor || leitura.precisao <= melhor.precisao) {
        melhor = leitura
        aoMelhorar(leitura)
      }
      if (leitura.precisao <= alvo) parar()
    },
    (erro) => {
      // Sem permissão não adianta esperar; os outros erros podem passar sozinhos.
      if (erro.code === erro.PERMISSION_DENIED) {
        parar('Sem permissão para usar a localização. Libere o acesso nas configurações do celular ou arraste o mapa até o local.')
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: limite },
  )
  const relogio = setTimeout(
    () => parar(melhor ? undefined : 'Não foi possível pegar a localização. Arraste o mapa até o local.'),
    limite,
  )
  return () => parar()
}
