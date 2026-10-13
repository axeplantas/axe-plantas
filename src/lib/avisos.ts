/** Mostra um aviso rápido no rodapé da tela (some sozinho). */
export function avisar(mensagem: string, tipo: 'ok' | 'erro' = 'ok') {
  window.dispatchEvent(new CustomEvent('axe-aviso', { detail: { mensagem, tipo } }))
}
