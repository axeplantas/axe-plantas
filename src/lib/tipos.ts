export type Papel = 'membro' | 'validador' | 'zelador'
export type Visibilidade = 'privado' | 'terreiro' | 'rede'

export interface Terreiro {
  id: string
  nome: string
  nacao: string
}

export interface Perfil {
  id: string
  apelido: string
  terreiro_id: string | null
  papel: Papel
  aprovado: boolean
  admin?: boolean
  consentimento_em?: string | null
  created_at: string
  terreiros?: Pick<Terreiro, 'nome' | 'nacao'> | null
}

export interface Folha {
  id: string
  nome_popular: string
  nome_ritual: string | null
  outros_nomes: string | null
  nome_cientifico: string | null
  toxica: boolean
  alerta: string | null
  status: 'pendente' | 'validada' | 'recusada'
  terreiro_id: string
  criado_por: string | null
  created_at: string
}

export interface Fundamento {
  folha_id: string
  terreiro_id: string
  orixas: string | null
  usos: string | null
  observacoes: string | null
}

export interface Ponto {
  id: string
  folha_id: string
  lat: number
  lng: number
  foto_path: string | null
  fotos: string[] | null
  observacao: string | null
  visibilidade: Visibilidade
  status: 'pendente' | 'validado' | 'recusado'
  terreiro_id: string
  criado_por: string | null
  created_at: string
  folhas: Pick<Folha, 'nome_popular' | 'nome_ritual' | 'toxica' | 'alerta'> | null
}

export const ROTULO_VISIBILIDADE: Record<Visibilidade, string> = {
  privado: 'Só eu',
  terreiro: 'Meu terreiro',
  rede: 'Os três terreiros',
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  membro: 'Membro',
  validador: 'Validador(a)',
  zelador: 'Zelador(a)',
}

export interface Obrigacao {
  id: string
  nome: string
  data: string | null
  observacao: string | null
  visibilidade: 'privado' | 'terreiro'
  terreiro_id: string
  criado_por: string | null
  created_at: string
}

export interface ItemObrigacao {
  id: string
  obrigacao_id: string
  folha_id: string
  quantidade: string | null
  colhida: boolean
  folhas: Pick<Folha, 'nome_popular' | 'nome_ritual' | 'toxica' | 'alerta'> | null
}

export type TipoConvite = 'admin' | 'zelador' | 'membro'

export interface Convite {
  id: string
  codigo: string
  tipo: TipoConvite
  terreiro_id: string | null
  usos: number
  usos_max: number | null
  expira_em: string | null
  ativo: boolean
  created_at: string
}

/** Parte da planta que aparece na foto (como o Pl@ntNet chama). */
export type Orgao = 'leaf' | 'flower' | 'fruit' | 'bark' | 'habit'

export const ROTULO_ORGAO: Record<Orgao, string> = {
  leaf: 'Folha',
  flower: 'Flor',
  fruit: 'Fruto',
  bark: 'Caule/casca',
  habit: 'Planta inteira',
}

/** Todas as fotos de um ponto (pontos antigos têm só foto_path). */
export function fotosDoPonto(p: Pick<Ponto, 'fotos' | 'foto_path'>): string[] {
  if (p.fotos && p.fotos.length > 0) return p.fotos
  return p.foto_path ? [p.foto_path] : []
}
