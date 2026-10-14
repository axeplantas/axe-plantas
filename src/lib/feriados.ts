export interface Feriado {
  data: string // AAAA-MM-DD
  nome: string
  facultativo: boolean
}

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function deslocar(base: Date, dias: number): string {
  const d = new Date(base.getTime() + dias * 86400000)
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** Feriados nacionais do Brasil (e os pontos facultativos nacionais mais conhecidos). */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano)
  const lista: Feriado[] = [
    { data: iso(ano, 1, 1), nome: 'Confraternização Universal', facultativo: false },
    { data: deslocar(p, -48), nome: 'Carnaval', facultativo: true },
    { data: deslocar(p, -47), nome: 'Carnaval', facultativo: true },
    { data: deslocar(p, -46), nome: 'Quarta-feira de Cinzas (até 14h)', facultativo: true },
    { data: deslocar(p, -2), nome: 'Sexta-feira Santa', facultativo: false },
    { data: iso(ano, 4, 21), nome: 'Tiradentes', facultativo: false },
    { data: iso(ano, 5, 1), nome: 'Dia do Trabalho', facultativo: false },
    { data: deslocar(p, 60), nome: 'Corpus Christi', facultativo: true },
    { data: iso(ano, 9, 7), nome: 'Independência do Brasil', facultativo: false },
    { data: iso(ano, 10, 12), nome: 'Nossa Senhora Aparecida', facultativo: false },
    { data: iso(ano, 11, 2), nome: 'Finados', facultativo: false },
    { data: iso(ano, 11, 15), nome: 'Proclamação da República', facultativo: false },
    { data: iso(ano, 12, 25), nome: 'Natal', facultativo: false },
  ]
  // Dia Nacional de Zumbi e da Consciência Negra: feriado nacional desde 2024 (Lei 14.759/2023).
  if (ano >= 2024) lista.push({ data: iso(ano, 11, 20), nome: 'Dia Nacional de Zumbi e da Consciência Negra', facultativo: false })
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}
