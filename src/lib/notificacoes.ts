import { SUPABASE_URL, supabase } from './supabase'

export type EstadoNotificacao = 'ativas' | 'desligadas' | 'bloqueadas' | 'instalar' | 'sem-suporte'

function ehIphone(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

function instalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function suportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Em que situação estão as notificações neste celular. */
export async function estadoNotificacoes(): Promise<EstadoNotificacao> {
  // No iPhone, a Apple só libera notificações para o app instalado na tela inicial.
  if (ehIphone() && !instalado()) return 'instalar'
  if (!suportado()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueadas'
  const registro = await navigator.serviceWorker.getRegistration()
  const inscricao = await registro?.pushManager.getSubscription()
  return inscricao && Notification.permission === 'granted' ? 'ativas' : 'desligadas'
}

function chaveParaBytes(base64: string): ArrayBuffer {
  const preenchido = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(preenchido), (c) => c.charCodeAt(0)).buffer
}

/** Pede permissão e inscreve este celular para receber notificações. */
export async function ativarNotificacoes(): Promise<void> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do celular.')

  const resposta = await fetch(`${SUPABASE_URL}/functions/v1/notificar`)
  const { chave } = await resposta.json()
  const registro = await navigator.serviceWorker.ready
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }))

  const dados = inscricao.toJSON()
  const { error } = await supabase.rpc('salvar_inscricao', {
    p_endpoint: dados.endpoint,
    p_p256dh: dados.keys?.p256dh,
    p_auth: dados.keys?.auth,
  })
  if (error) throw error
}

export async function desativarNotificacoes(): Promise<void> {
  const registro = await navigator.serviceWorker.getRegistration()
  const inscricao = await registro?.pushManager.getSubscription()
  if (!inscricao) return
  await supabase.rpc('remover_inscricao', { p_endpoint: inscricao.endpoint })
  await inscricao.unsubscribe()
}
