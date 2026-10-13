/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaEmMetros(a: [number, number], b: [number, number]): number {
  const raio = 6371000
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * raio * Math.asin(Math.sqrt(h))
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`
  return `${(metros / 1000).toFixed(metros < 10000 ? 1 : 0).replace('.', ',')} km`
}

export function linkComoChegar(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
