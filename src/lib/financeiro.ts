import type { Casa, Cobranca, FinanceiroCasa, SituacaoPagamento } from './tipos'

export type Situacao = SituacaoPagamento | 'aberto'

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  aberto: 'Em aberto',
  informado: 'Enviado, aguardando conferência',
  confirmado: 'Pago',
  recusado: 'Recusado',
  isento: 'Isento',
}

/** O que é preciso saber de um filho para calcular as cobranças dele. */
export type Pessoa = Pick<Casa, 'isento' | 'mensalidade_valor' | 'aprovado_em'> & { perfil_id: string; created_at?: string }

export function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A cobrança vale para esta pessoa? */
export function seAplica(c: Cobranca, p: Pessoa, config: FinanceiroCasa | null, alvos: Set<string>): boolean {
  if (c.tipo === 'contribuicao') return c.para_todos || alvos.has(`${c.id}:${p.perfil_id}`)
  if (!config?.cobra_mensalidade || p.isento || !c.competencia) return false
  const entrada = (p.aprovado_em ?? p.created_at ?? '').slice(0, 7)
  return !entrada || c.competencia.slice(0, 7) >= entrada
}

/** Quanto esta pessoa deve nesta cobrança. */
export function valorDe(c: Cobranca, p: Pessoa, config: FinanceiroCasa | null): number {
  if (c.tipo === 'contribuicao') return c.valor ?? 0
  return c.valor ?? p.mensalidade_valor ?? config?.valor_padrao ?? 0
}
