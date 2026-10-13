import { createStore, del, get, keys, set } from 'idb-keyval'
import { BUCKET_FOTOS, supabase } from './supabase'
import type { Visibilidade } from './tipos'

/** Ponto guardado no próprio celular, esperando internet para ser enviado. */
export interface PontoGuardado {
  id: string
  folhaId: string
  folhaNome: string
  lat: number
  lng: number
  observacao: string | null
  visibilidade: Visibilidade
  fotos: Blob[]
  criadoEm: string
}

const loja = createStore('axe-plantas', 'pontos-guardados')

function avisarMudanca() {
  window.dispatchEvent(new Event('axe-fila'))
}

export async function guardarPonto(ponto: PontoGuardado) {
  await set(ponto.id, ponto, loja)
  avisarMudanca()
}

export async function pontosGuardados(): Promise<PontoGuardado[]> {
  const ids = await keys(loja)
  const todos = await Promise.all(ids.map((id) => get<PontoGuardado>(id, loja)))
  return todos.filter((p): p is PontoGuardado => Boolean(p)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}

export async function descartarPonto(id: string) {
  await del(id, loja)
  avisarMudanca()
}

/** Envia um ponto (fotos + dados). Usado tanto na hora quanto pela fila. */
export async function enviarPonto(ponto: Omit<PontoGuardado, 'id' | 'criadoEm' | 'folhaNome'>, perfilId: string, terreiroId: string | null) {
  const caminhos: string[] = []
  try {
    for (const foto of ponto.fotos) {
      const caminho = `${perfilId}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, foto, { contentType: 'image/jpeg' })
      if (error) throw error
      caminhos.push(caminho)
    }
    const { error } = await supabase.from('pontos').insert({
      folha_id: ponto.folhaId,
      lat: ponto.lat,
      lng: ponto.lng,
      foto_path: caminhos[0] ?? null,
      fotos: caminhos,
      observacao: ponto.observacao,
      visibilidade: ponto.visibilidade,
      terreiro_id: terreiroId,
    })
    if (error) throw error
  } catch (erro) {
    if (caminhos.length) await supabase.storage.from(BUCKET_FOTOS).remove(caminhos)
    throw erro
  }
}

let enviando = false

/** Tenta enviar tudo o que está guardado. Devolve quantos foram enviados. */
export async function enviarGuardados(perfilId: string, terreiroId: string | null): Promise<{ enviados: number; restantes: number }> {
  if (enviando || !navigator.onLine) return { enviados: 0, restantes: (await keys(loja)).length }
  enviando = true
  let enviados = 0
  try {
    for (const ponto of await pontosGuardados()) {
      try {
        await enviarPonto(ponto, perfilId, terreiroId)
        await del(ponto.id, loja)
        enviados++
      } catch {
        break // Sem internet de novo: tenta mais tarde.
      }
    }
  } finally {
    enviando = false
    avisarMudanca()
  }
  return { enviados, restantes: (await keys(loja)).length }
}

/** Erros de rede (sem sinal), diferentes de erros de validação. */
export function ehErroDeRede(erro: unknown): boolean {
  const msg = String((erro as { message?: string })?.message ?? erro)
  return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(msg)
}
