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

/** O vínculo de uma pessoa com uma casa (uma pessoa pode estar em várias). */
export interface Casa {
  terreiro_id: string
  papel: Papel
  aprovado: boolean
  contador: boolean
  isento: boolean
  mensalidade_valor: number | null
  aprovado_em: string | null
  terreiros: Pick<Terreiro, 'nome' | 'nacao'> | null
}

export interface MembroDaCasa extends Omit<Casa, 'terreiros'> {
  perfil_id: string
  created_at: string
  perfis: { apelido: string } | null
}

export interface FinanceiroCasa {
  terreiro_id: string
  cobra_mensalidade: boolean
  valor_padrao: number
  dia_vencimento: number
  instrucoes: string | null
  inicio: string
}

export interface Cobranca {
  id: string
  terreiro_id: string
  tipo: 'mensalidade' | 'contribuicao'
  titulo: string
  descricao: string | null
  competencia: string | null
  vencimento: string
  valor: number | null
  para_todos: boolean
  created_at: string
}

export type SituacaoPagamento = 'informado' | 'confirmado' | 'recusado' | 'isento'

export interface Pagamento {
  id: string
  cobranca_id: string
  terreiro_id: string
  perfil_id: string
  valor: number | null
  status: SituacaoPagamento
  comprovante: string | null
  observacao: string | null
  motivo: string | null
  informado_em: string | null
  conferido_em: string | null
}

export type TipoEvento = 'festa' | 'gira' | 'obrigacao' | 'reuniao' | 'mutirao' | 'outro'

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  festa: '🎉 Festa',
  gira: '🥁 Gira',
  obrigacao: '🕯️ Obrigação',
  reuniao: '🗣️ Reunião',
  mutirao: '🧹 Mutirão',
  outro: '📌 Outro',
}

export interface Evento {
  id: string
  terreiro_id: string
  titulo: string
  tipo: TipoEvento
  data: string
  hora: string | null
  hora_fim: string | null
  local: string | null
  descricao: string | null
}

export type CategoriaMaterial = 'folha' | 'animal' | 'vela' | 'louca' | 'bebida' | 'alimento' | 'tecido' | 'ferramenta' | 'outro'

export const ROTULO_CATEGORIA: Record<CategoriaMaterial, string> = {
  folha: '🌿 Folhas e ervas',
  animal: '🐓 Animais',
  vela: '🕯️ Velas',
  louca: '🏺 Louças e alguidares',
  bebida: '🍶 Bebidas',
  alimento: '🍚 Alimentos e grãos',
  tecido: '🧵 Tecidos e roupas',
  ferramenta: '🔱 Ferramentas e fios',
  outro: '📦 Outros',
}

export const UNIDADES = ['unidade', 'maço', 'cabeça', 'kg', 'g', 'litro', 'ml', 'metro', 'pacote', 'caixa', 'dúzia']

export interface Material {
  id: string
  terreiro_id: string
  nome: string
  categoria: CategoriaMaterial
  unidade: string
  quantidade: number
  minimo: number | null
  observacao: string | null
  folha_id: string | null
  atualizado_em: string
}

export interface Movimento {
  id: string
  material_id: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  motivo: string | null
  perfil_id: string | null
  created_at: string
  perfis: { apelido: string } | null
}

export function formatarReais(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarDataCurta(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
