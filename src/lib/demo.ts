/**
 * Modo demonstração: imita o Supabase com dados de exemplo guardados só
 * na memória do navegador. Nada é enviado para a internet nem fica salvo.
 * Ative com `npm run demo`.
 */

type Linha = Record<string, any>

const EU = 'demo-zelador'
const T1 = 'demo-t1'
const T2 = 'demo-t2'
const T3 = 'demo-t3'

let centro: [number, number] = [-23.5874, -46.6576] // Parque Ibirapuera (SP)
let semeado = false

const banco: Record<string, Linha[]> = {
  terreiros: [
    { id: T1, nome: 'Terreiro Exemplo 1', nacao: 'Candomblé de Ketu' },
    { id: T2, nome: 'Terreiro Exemplo 2', nacao: 'Umbanda / Jurema / Quimbanda' },
    { id: T3, nome: 'Terreiro Exemplo 3', nacao: 'Umbanda' },
  ],
  perfis: [
    { ...perfil(EU, 'Você (administrador)', T1, 'zelador', true), admin: true },
    perfil('demo-m1', 'Ana de Oxum', T1, 'membro', true),
    perfil('demo-m2', 'Carlos', T1, 'validador', true),
    perfil('demo-m3', 'Joana', T1, 'membro', false),
    perfil('demo-m4', 'Pedro de Ogum', T1, 'membro', false),
  ],
  folhas: [
    folha('f1', 'Aroeira', 'Schinus terebinthifolia', 'aroeira-vermelha, aroeira-pimenteira'),
    folha('f2', 'Arruda', 'Ruta graveolens', null, true, 'Pode causar queimaduras na pele exposta ao sol. Não usar na gravidez.'),
    folha('f3', 'Guiné', 'Petiveria alliacea', 'tipi, erva-pipi', true, 'Não ingerir.'),
    folha('f4', 'Espada-de-São-Jorge', 'Dracaena trifasciata', 'espada-de-Ogum', true, 'Não ingerir (pessoas e animais).'),
    folha('f5', 'Alecrim', 'Salvia rosmarinus'),
    folha('f6', 'Manjericão', 'Ocimum basilicum', 'alfavaca'),
    folha('f7', 'Boldo', 'Plectranthus barbatus', 'boldo-brasileiro, tapete-de-Oxalá'),
    folha('f8', 'Comigo-ninguém-pode', 'Dieffenbachia seguine', null, true, 'Muito tóxica: a seiva queima boca e garganta.'),
    folha('f9', 'Peregun', 'Dracaena fragrans', 'pau-d’água'),
    folha('f10', 'Erva-cidreira', 'Lippia alba', 'cidreira-de-arbusto', false, null, 'pendente', 'demo-m1'),
  ],
  fundamentos: [],
  pontos: [],
  convites: [],
  membros: [],
  financeiro_casa: [],
  cobrancas: [],
  pagamentos: [],
  eventos: [],
  materiais: [],
  movimentos_material: [],
  obrigacoes: [
    {
      id: 'o1', nome: 'Obrigação de exemplo', data: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
      observacao: 'Lista de exemplo para ver como funciona.', visibilidade: 'terreiro', terreiro_id: T1,
      criado_por: EU, created_at: new Date().toISOString(),
    },
  ],
  obrigacao_itens: [
    item('i1', 'f1', '1 maço', true),
    item('i2', 'f3', '3 galhos'),
    item('i3', 'f5', '1 maço'),
    item('i4', 'f6', '2 maços'),
    item('i5', 'f9', '7 folhas'),
  ],
}

function item(id: string, folhaId: string, quantidade: string, colhida = false): Linha {
  return { id, obrigacao_id: 'o1', folha_id: folhaId, quantidade, colhida, created_at: new Date().toISOString() }
}

// Na demonstração, os vínculos (membros) espelham os perfis de exemplo.
queueMicrotask(() => {
  banco.membros = banco.perfis.map((p) => ({
    perfil_id: p.id, terreiro_id: p.terreiro_id, papel: p.papel, aprovado: p.aprovado, contador: false,
    isento: p.papel === 'zelador', mensalidade_valor: null, aprovado_em: p.created_at, created_at: p.created_at,
  }))
})

function perfil(id: string, apelido: string, terreiro: string, papel: string, aprovado: boolean): Linha {
  return { id, apelido, terreiro_id: terreiro, papel, aprovado, created_at: new Date(Date.now() - 86400000 * 3).toISOString() }
}

function folha(
  id: string, nome: string, cientifico: string, outros: string | null = null, toxica = false,
  alerta: string | null = null, status = 'validada', criadoPor = EU,
): Linha {
  return {
    id, nome_popular: nome, nome_ritual: null, outros_nomes: outros, nome_cientifico: cientifico,
    toxica, alerta, status, terreiro_id: T1, criado_por: criadoPor, created_at: new Date().toISOString(),
  }
}

/** Cria pontos de exemplo ao redor de onde a pessoa está. */
function semear() {
  if (semeado) return
  semeado = true
  const exemplos: [string, string, string, string | null, string][] = [
    // folha, visibilidade, status, observação, terreiro
    ['f1', 'rede', 'validado', 'Árvore grande na entrada da praça.', T1],
    ['f1', 'rede', 'validado', null, T2],
    ['f2', 'terreiro', 'validado', 'Canteiro ao lado da padaria.', T1],
    ['f3', 'rede', 'validado', 'Embaixo das árvores, perto do lago.', T3],
    ['f4', 'rede', 'validado', 'Vários vasos na calçada.', T2],
    ['f5', 'privado', 'validado', 'No meu quintal.', T1],
    ['f6', 'rede', 'validado', null, T3],
    ['f7', 'rede', 'validado', 'Pode colher, o dono autorizou.', T1],
    ['f8', 'rede', 'validado', 'Cuidado: perto do parquinho.', T2],
    ['f9', 'rede', 'validado', null, T1],
    ['f6', 'rede', 'pendente', 'Achei hoje, florindo.', T1],
    ['f10', 'terreiro', 'pendente', 'Touceira grande no terreno da escola.', T1],
  ]
  exemplos.forEach(([folhaId, visibilidade, status, observacao, terreiro], i) => {
    const angulo = (i / exemplos.length) * Math.PI * 2
    const raio = 0.002 + (i % 4) * 0.0015
    banco.pontos.push({
      id: `p${i}`,
      folha_id: folhaId,
      lat: centro[0] + Math.sin(angulo) * raio,
      lng: centro[1] + Math.cos(angulo) * raio,
      foto_path: null,
      observacao,
      visibilidade,
      status,
      terreiro_id: terreiro,
      criado_por: status === 'pendente' ? 'demo-m1' : EU,
      created_at: new Date().toISOString(),
    })
  })
}

export function definirCentroDemo(lat: number, lng: number) {
  if (!semeado) centro = [lat, lng]
}

// ---------------------------------------------------------------------
// Consultas (imita o "supabase.from(...)")
// ---------------------------------------------------------------------

class Consulta implements PromiseLike<any> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private filtros: ((l: Linha) => boolean)[] = []
  private ordem: string | null = null
  private dados: any = null
  private selecao = '*'
  private contar = false
  private unico: 'single' | 'maybe' | null = null
  private limite: number | null = null

  private tabela: string

  constructor(tabela: string) {
    this.tabela = tabela
  }

  select(selecao = '*', opcoes?: { count?: string; head?: boolean }) {
    this.selecao = selecao
    this.contar = Boolean(opcoes?.count)
    return this
  }
  insert(v: any) { this.op = 'insert'; this.dados = v; return this }
  update(v: any) { this.op = 'update'; this.dados = v; return this }
  upsert(v: any) { this.op = 'upsert'; this.dados = v; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.filtros.push((l) => l[c] === v); return this }
  in(c: string, v: any[]) { this.filtros.push((l) => v.includes(l[c])); return this }
  gte(c: string, v: any) { this.filtros.push((l) => l[c] >= v); return this }
  lte(c: string, v: any) { this.filtros.push((l) => l[c] <= v); return this }
  gt(c: string, v: any) { this.filtros.push((l) => l[c] > v); return this }
  lt(c: string, v: any) { this.filtros.push((l) => l[c] < v); return this }
  limit(n: number) { this.limite = n; return this }
  neq(c: string, v: any) { this.filtros.push((l) => l[c] !== v); return this }
  order(c: string) { this.ordem ??= c; return this }
  single() { this.unico = 'single'; return this }
  maybeSingle() { this.unico = 'maybe'; return this }

  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, falha?: ((e: any) => B | PromiseLike<B>) | null) {
    return new Promise((r) => setTimeout(r, 120)).then(() => this.executar()).then(ok, falha)
  }

  private executar() {
    if (this.tabela === 'pontos') semear()
    const tabela = (banco[this.tabela] ??= [])
    let linhas: Linha[]

    if (this.op === 'insert' || this.op === 'upsert') {
      const novo = { ...this.dados }
      const existente = this.op === 'upsert'
        ? tabela.find((l) => l.folha_id === novo.folha_id && l.terreiro_id === novo.terreiro_id)
        : undefined
      if (existente) {
        Object.assign(existente, novo)
        linhas = [existente]
      } else {
        Object.assign(novo, {
          id: novo.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          criado_por: EU,
          terreiro_id: T1,
        })
        if (this.tabela === 'folhas') novo.status = 'validada'
        if (this.tabela === 'pontos') novo.status = 'validado'
        tabela.push(novo)
        linhas = [novo]
      }
    } else {
      linhas = tabela.filter((l) => this.filtros.every((f) => f(l)))
      if (this.op === 'update') linhas.forEach((l) => Object.assign(l, this.dados))
      if (this.op === 'delete') banco[this.tabela] = tabela.filter((l) => !linhas.includes(l))
    }

    if (this.ordem) {
      const c = this.ordem
      linhas = [...linhas].sort((a, b) => String(a[c]).localeCompare(String(b[c]), 'pt-BR'))
    }

    const resultado = linhas.slice(0, this.limite ?? undefined).map((l) => this.juntar({ ...l }))
    if (this.unico) {
      const data = resultado[0] ?? null
      if (!data && this.unico === 'single') return { data: null, error: { message: 'Não encontrado' } }
      return { data, error: null }
    }
    return { data: resultado, error: null, count: this.contar ? resultado.length : null }
  }

  /** Imita os "relacionamentos" como folhas(...) e terreiros(...). */
  private juntar(l: Linha): Linha {
    if (this.selecao.includes('folhas(')) l.folhas = banco.folhas.find((f) => f.id === l.folha_id) ?? null
    if (this.selecao.includes('terreiros(')) l.terreiros = banco.terreiros.find((t) => t.id === l.terreiro_id) ?? null
    if (this.selecao.includes('perfis(')) l.perfis = banco.perfis.find((p) => p.id === l.perfil_id) ?? null
    return l
  }
}

// ---------------------------------------------------------------------
// Login, fotos e funções
// ---------------------------------------------------------------------

const ouvintes = new Set<(evento: string, sessao: any) => void>()
let sessao: any = null
const fotos = new Map<string, string>()

function avisar(evento: string) {
  ouvintes.forEach((f) => f(evento, sessao))
}

function entrar(email: string) {
  sessao = { user: { id: EU, email: email || 'demo@exemplo.com' } }
  setTimeout(() => avisar('SIGNED_IN'), 0)
  return { data: { session: sessao, user: sessao.user }, error: null }
}

export function criarClienteDemo(): any {
  return {
    from: (tabela: string) => new Consulta(tabela),
    rpc: async (nome: string, args: any) => {
      const novoConvite = (terreiro: string | null, tipo: string) => {
        const codigo = Math.random().toString(36).slice(2, 14)
        banco.convites.push({
          id: crypto.randomUUID(), codigo, tipo, terreiro_id: terreiro, usos: 0, usos_max: tipo === 'membro' ? null : 1,
          expira_em: new Date(Date.now() + 86400000 * (tipo === 'membro' ? 30 : 7)).toISOString(), ativo: true,
          created_at: new Date().toISOString(),
        })
        return codigo
      }
      if (nome === 'info_convite') return { data: [], error: null }
      if (nome === 'criar_convite') return { data: novoConvite(args.p_terreiro, args.p_tipo), error: null }
      if (nome === 'criar_terreiro') {
        const id = crypto.randomUUID()
        banco.terreiros.push({ id, nome: args.p_nome, nacao: args.p_nacao })
        return { data: novoConvite(id, 'zelador'), error: null }
      }
      if (nome === 'desativar_convite') {
        const c = banco.convites.find((x) => x.id === args.p_convite)
        if (c) c.ativo = false
        return { data: null, error: null }
      }
      if (nome === 'entrar_no_terreiro') {
        Object.assign(banco.perfis.find((x) => x.id === EU)!, { terreiro_id: args.p_terreiro, papel: args.p_papel })
        return { data: null, error: null }
      }
      if (nome === 'excluir_minha_conta') {
        alert('Demonstração: a conta seria excluída agora. Nada foi apagado.')
        return { data: null, error: null }
      }
      if (['garantir_mensalidades', 'trocar_casa', 'definir_acesso_materiais'].includes(nome)) return { data: null, error: null }
      if (nome === 'pode_ver_materiais' || nome === 'pode_editar_materiais') return { data: true, error: null }
      if (nome === 'atualizar_membro') {
        const v = banco.membros.find((x) => x.perfil_id === args.p_usuario && x.terreiro_id === args.p_terreiro)
        if (v) Object.assign(v, { aprovado: args.p_aprovado, papel: args.p_papel, contador: args.p_contador, isento: args.p_isento, mensalidade_valor: args.p_mensalidade })
        return { data: null, error: null }
      }
      if (nome === 'remover_da_casa') {
        banco.membros = banco.membros.filter((x) => !(x.perfil_id === args.p_usuario && x.terreiro_id === args.p_terreiro))
        return { data: null, error: null }
      }
      if (['informar_pagamento', 'conferir_pagamento', 'criar_contribuicao', 'apagar_cobranca', 'configurar_financeiro', 'aceitar_convite'].includes(nome)) {
        alert('Demonstração: esta ação funciona no app de verdade. Aqui nada é salvo.')
        return { data: null, error: null }
      }
      const p = banco.perfis.find((x) => x.id === args.p_usuario)
      if (!p) return { data: null, error: null }
      if (nome === 'gerenciar_membro') Object.assign(p, { aprovado: args.p_aprovado, papel: args.p_papel })
      if (nome === 'remover_membro') banco.perfis = banco.perfis.filter((x) => x !== p)
      return { data: null, error: null }
    },
    auth: {
      getSession: async () => ({ data: { session: sessao } }),
      onAuthStateChange: (f: (e: string, s: any) => void) => {
        ouvintes.add(f)
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(f) } } }
      },
      signInWithPassword: async ({ email }: { email: string }) => entrar(email),
      signUp: async ({ email }: { email: string }) => entrar(email),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      signOut: async () => {
        sessao = null
        avisar('SIGNED_OUT')
        return { error: null }
      },
    },
    functions: {
      invoke: async () => {
        await new Promise((r) => setTimeout(r, 900))
        return {
          data: {
            sugestoes: [
              { cientifico: 'Schinus terebinthifolia', familia: 'Anacardiaceae', nomes: ['aroeira', 'aroeira-vermelha'], confianca: 87, referencias: [] },
              { cientifico: 'Schinus molle', familia: 'Anacardiaceae', nomes: ['aroeira-salsa', 'pimenteira'], confianca: 6 },
              { cientifico: 'Lithraea molleoides', familia: 'Anacardiaceae', nomes: ['aroeira-branca'], confianca: 2 },
            ],
          },
          error: null,
        }
      },
    },
    storage: {
      from: () => ({
        upload: async (caminho: string, arquivo: Blob) => {
          fotos.set(caminho, URL.createObjectURL(arquivo))
          return { data: { path: caminho }, error: null }
        },
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (caminho: string) => ({ data: { signedUrl: fotos.get(caminho) ?? null } }),
        remove: async () => ({ error: null }),
      }),
    },
  }
}
