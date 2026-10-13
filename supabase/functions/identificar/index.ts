// Função do Supabase: recebe a foto do app, consulta o Pl@ntNet e devolve
// as espécies mais prováveis. A chave do Pl@ntNet fica no cofre do Supabase
// (segredo PLANTNET_KEY) e nunca chega ao aplicativo.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Pergunta ao banco, com o login de quem chamou, se a pessoa é membro aprovado ou administrador. */
async function podeUsar(req: Request): Promise<boolean> {
  const cabecalhos = {
    apikey: req.headers.get('apikey') ?? '',
    Authorization: req.headers.get('Authorization') ?? '',
    'Content-Type': 'application/json',
  }
  const chamar = async (funcao: string) => {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/${funcao}`, {
      method: 'POST',
      headers: cabecalhos,
      body: '{}',
    })
    return r.ok ? await r.json() : null
  }
  const [terreiro, admin] = await Promise.all([chamar('meu_terreiro'), chamar('sou_admin')])
  return Boolean(terreiro) || admin === true
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Só membros aprovados (ou o administrador) podem usar a cota de identificações.
    if (!(await podeUsar(req))) return resposta({ erro: 'Acesso não autorizado.' }, 403)

    // Até 3 fotos da mesma planta, cada uma com a parte fotografada (folha, flor...).
    const entrada = await req.formData()
    const fotos = entrada.getAll('foto').filter((f): f is File => f instanceof File).slice(0, 3)
    const orgaos = entrada.getAll('orgao').map(String)
    if (fotos.length === 0) return resposta({ erro: 'Envie uma foto.' }, 400)
    if (fotos.some((f) => f.size > 5 * 1024 * 1024)) return resposta({ erro: 'Foto muito grande.' }, 400)

    const validos = ['leaf', 'flower', 'fruit', 'bark', 'habit', 'auto']
    const envio = new FormData()
    fotos.forEach((foto, i) => {
      envio.append('images', foto, `foto${i}.jpg`)
      envio.append('organs', validos.includes(orgaos[i]) ? orgaos[i] : 'auto')
    })

    const url = new URL('https://my-api.plantnet.org/v2/identify/all')
    url.searchParams.set('api-key', Deno.env.get('PLANTNET_KEY') ?? '')
    url.searchParams.set('lang', 'pt')
    url.searchParams.set('nb-results', '5')
    url.searchParams.set('include-related-images', 'true')

    const consulta = await fetch(url, { method: 'POST', body: envio })
    // O Pl@ntNet responde 404 quando não reconhece nenhuma planta na foto.
    if (consulta.status === 404) return resposta({ sugestoes: [] })
    if (!consulta.ok) return resposta({ erro: `O serviço de identificação respondeu ${consulta.status}.` }, 502)

    const dados = await consulta.json()
    const sugestoes = (dados.results ?? []).map((r: {
      score: number
      species: {
        scientificNameWithoutAuthor: string
        commonNames?: string[]
        family?: { scientificNameWithoutAuthor?: string }
      }
      images?: { url?: { s?: string; m?: string } }[]
    }) => ({
      cientifico: r.species.scientificNameWithoutAuthor,
      familia: r.species.family?.scientificNameWithoutAuthor ?? null,
      nomes: r.species.commonNames ?? [],
      confianca: Math.round(r.score * 100),
      // Fotos de referência da espécie, para comparar com a planta real.
      referencias: (r.images ?? []).map((img) => img.url?.s ?? img.url?.m).filter(Boolean).slice(0, 3),
    }))

    return resposta({ sugestoes, restantes: dados.remainingIdentificationRequests ?? null })
  } catch (erro) {
    return resposta({ erro: String(erro) }, 500)
  }
})
