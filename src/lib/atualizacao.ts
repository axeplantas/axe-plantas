import { registerSW } from 'virtual:pwa-register'

declare global {
  const __VERSAO__: string
}

export const VERSAO = __VERSAO__

/**
 * Mantém o app sempre na versão mais nova. O app instalado no celular
 * (principalmente no iPhone) costuma ficar aberto em segundo plano por dias,
 * então procuramos atualização ao abrir e sempre que ele volta para a tela.
 * Quando há versão nova, ela é instalada e a página recarrega sozinha.
 */
export function manterAtualizado() {
  if (!('serviceWorker' in navigator)) return

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return
      const procurar = () => {
        if (navigator.onLine) registro.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') procurar()
      })
      window.addEventListener('focus', procurar)
      window.addEventListener('online', procurar)
    },
  })
}
