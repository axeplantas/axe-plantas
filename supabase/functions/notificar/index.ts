// Função do Supabase: envia as notificações da fila (tabela notificacoes) para
// os celulares inscritos. Também informa ao app a chave pública do Web Push.
// As chaves são geradas aqui mesmo na primeira vez e guardadas no banco.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function chaves(): Promise<{ chave_publica: string; chave_privada: string }> {
  const { data } = await banco.from('config_push').select('chave_publica, chave_privada').eq('id', 1).maybeSingle()
  if (data) return data
  const novas = webpush.generateVAPIDKeys()
  await banco.from('config_push').insert({ id: 1, chave_publica: novas.publicKey, chave_privada: novas.privateKey })
  const { data: salvas } = await banco.from('config_push').select('chave_publica, chave_privada').eq('id', 1).single()
  return salvas!
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { chave_publica, chave_privada } = await chaves()
    if (req.method === 'GET') return resposta({ chave: chave_publica })

    webpush.setVapidDetails('mailto:axeplantas@gmail.com', chave_publica, chave_privada)

    // "Reserva" as mensagens pendentes de uma vez, para não enviar em dobro.
    const { data: fila } = await banco
      .from('notificacoes')
      .update({ enviada: true })
      .eq('enviada', false)
      .select('id, perfil_id, titulo, corpo, url')
    if (!fila?.length) return resposta({ enviadas: 0 })

    const perfis = [...new Set(fila.map((n) => n.perfil_id))]
    const { data: inscricoes } = await banco.from('push_inscricoes').select('*').in('perfil_id', perfis)

    let enviadas = 0
    const vencidas: string[] = []
    for (const n of fila) {
      const destinos = (inscricoes ?? []).filter((i) => i.perfil_id === n.perfil_id)
      for (const i of destinos) {
        try {
          await webpush.sendNotification(
            { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
            JSON.stringify({ titulo: n.titulo, corpo: n.corpo, url: n.url }),
            { TTL: 60 * 60 * 24 },
          )
          enviadas++
        } catch (erro) {
          const status = (erro as { statusCode?: number }).statusCode
          // 404/410: o celular desativou ou desinstalou; remove a inscrição.
          if (status === 404 || status === 410) vencidas.push(i.id)
        }
      }
    }
    if (vencidas.length) await banco.from('push_inscricoes').delete().in('id', vencidas)

    return resposta({ enviadas })
  } catch (erro) {
    return resposta({ erro: String(erro) }, 500)
  }
})
