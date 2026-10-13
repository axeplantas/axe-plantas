/** "Erva-Cidreira" → "erva-cidreira" sem acentos, para buscas. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

const DOMINIOS_COMUNS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com.br': 'yahoo.com.br',
  'yahoo.con.br': 'yahoo.com.br',
  'icloud.con': 'icloud.com',
}

/** Sugere a correção de erros comuns de digitação no e-mail (ex.: "gmial.com"). */
export function sugerirEmail(email: string): string | null {
  const [usuario, dominio] = email.trim().toLowerCase().split('@')
  if (!usuario || !dominio) return null
  const certo = DOMINIOS_COMUNS[dominio]
  return certo ? `${usuario}@${certo}` : null
}
