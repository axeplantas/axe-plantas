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
  terreiro_id: string
  papel: Papel
  aprovado: boolean
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
