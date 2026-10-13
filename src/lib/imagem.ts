/**
 * Reduz a foto e converte para JPEG. Redesenhar a imagem num canvas
 * também apaga os metadados (EXIF), que podem conter a localização de
 * onde a foto foi tirada e o modelo do celular.
 */
export async function prepararFoto(arquivo: File, ladoMaximo = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a foto.'))), 'image/jpeg', 0.8),
  )
}
