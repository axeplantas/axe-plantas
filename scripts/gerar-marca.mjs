// Gera todos os arquivos da marca Axé Plantas a partir de marca/simbolo.svg.
// Uso: npm run marca
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import opentype from 'opentype.js'
import sharp from 'sharp'

const VERDE = '#2F5D3A'
const CREME = '#F6F3EA'

const simbolo = readFileSync('marca/simbolo.svg', 'utf8')
const [, sw, sh] = simbolo.match(/viewBox="0 0 (\d+) (\d+)"/).map(Number)
const caminhoSimbolo = simbolo.match(/ d="([^"]+)"/)[1].replace(/\s+/g, ' ').trim()

const carregar = (arquivo) => {
  const b = readFileSync(arquivo)
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const serifada = carregar('node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff')
const semSerifa = carregar('node_modules/@fontsource/jost/files/jost-latin-500-normal.woff')

/** O símbolo posicionado e escalado, como um <path>. */
function pathSimbolo(x, y, altura, cor) {
  const e = altura / sh
  return `<path fill="${cor}" fill-rule="evenodd" transform="translate(${x} ${y}) scale(${e})" d="${caminhoSimbolo}"/>`
}

/** "Axé" + "PLANTAS" convertidos em desenho, com PLANTAS da mesma largura de Axé. */
function nome(tamanho) {
  const axe = serifada.getPath('Axé', 0, 0, tamanho)
  const caixaAxe = axe.getBoundingBox()
  const largura = caixaAxe.x2 - caixaAxe.x1

  const tamanhoPlantas = tamanho * 0.19
  const letras = [...'PLANTAS'].map((l) => ({ l, avanco: semSerifa.getAdvanceWidth(l, tamanhoPlantas) }))
  const ultima = semSerifa.getPath('S', 0, 0, tamanhoPlantas).getBoundingBox()
  const larguraSemEspaco = letras.slice(0, -1).reduce((s, l) => s + l.avanco, 0) + ultima.x2
  const espaco = (largura - larguraSemEspaco) / (letras.length - 1)

  const baseAxe = -caixaAxe.y1 // topo do acento em y = 0
  const basePlantas = baseAxe + tamanho * 0.36
  let x = 0
  const partesPlantas = letras.map(({ l, avanco }) => {
    const d = semSerifa.getPath(l, x, basePlantas, tamanhoPlantas).toPathData(2)
    x += avanco + espaco
    return d
  })
  const altura = basePlantas
  return {
    largura,
    altura,
    d: [serifada.getPath('Axé', -caixaAxe.x1, baseAxe, tamanho).toPathData(2), ...partesPlantas].join(' '),
  }
}

function svg(largura, altura, conteudo, fundo) {
  const bg = fundo ? `<rect width="${largura}" height="${altura}" fill="${fundo}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(largura)} ${Math.round(altura)}">${bg}${conteudo}</svg>\n`
}

function logoHorizontal(cor) {
  const altSimbolo = 620
  const texto = nome(400)
  const escalaTexto = (altSimbolo * 0.8) / texto.altura
  const larguraSimbolo = (sw / sh) * altSimbolo
  const gap = larguraSimbolo * 0.38
  const margem = 40
  const larg = margem * 2 + larguraSimbolo + gap + texto.largura * escalaTexto
  const alt = margem * 2 + altSimbolo
  const yTexto = margem + (altSimbolo - texto.altura * escalaTexto) / 2
  return svg(larg, alt,
    pathSimbolo(margem, margem, altSimbolo, cor) +
    `<path fill="${cor}" transform="translate(${margem + larguraSimbolo + gap} ${yTexto}) scale(${escalaTexto})" d="${texto.d}"/>`)
}

function logoVertical(cor) {
  const altSimbolo = 620
  const texto = nome(400)
  const escalaTexto = (sw / sh) * altSimbolo * 1.7 / texto.largura
  const larguraSimbolo = (sw / sh) * altSimbolo
  const larguraTexto = texto.largura * escalaTexto
  const margem = 40
  const larg = margem * 2 + Math.max(larguraSimbolo, larguraTexto)
  const alt = margem * 2 + altSimbolo + altSimbolo * 0.12 + texto.altura * escalaTexto
  return svg(larg, alt,
    pathSimbolo((larg - larguraSimbolo) / 2, margem, altSimbolo, cor) +
    `<path fill="${cor}" transform="translate(${(larg - larguraTexto) / 2} ${margem + altSimbolo * 1.12}) scale(${escalaTexto})" d="${texto.d}"/>`)
}

/** Ícone quadrado: fundo verde cheio e símbolo creme. `proporcao` = altura do símbolo / lado. */
function icone(proporcao, cantos = 0) {
  const lado = 1024
  const alt = lado * proporcao
  const larg = (sw / sh) * alt
  const fundo = cantos ? `<rect width="${lado}" height="${lado}" rx="${cantos}" fill="${VERDE}"/>` : `<rect width="${lado}" height="${lado}" fill="${VERDE}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}">${fundo}${pathSimbolo((lado - larg) / 2, (lado - alt) / 2, alt, CREME)}</svg>\n`
}

const png = (conteudo, arquivo, largura) => sharp(Buffer.from(conteudo), { density: 300 }).resize({ width: largura }).png().toFile(arquivo)

// ---- Arquivos da marca (para uso geral: WhatsApp, impressão, camisetas) ----
rmSync('marca/arquivos', { recursive: true, force: true })
mkdirSync('marca/arquivos', { recursive: true })
const arquivos = {
  'simbolo-verde': svg(sw, sh, pathSimbolo(0, 0, sh, VERDE)),
  'simbolo-creme': svg(sw, sh, pathSimbolo(0, 0, sh, CREME)),
  'logo-horizontal-verde': logoHorizontal(VERDE),
  'logo-horizontal-creme': logoHorizontal(CREME),
  'logo-vertical-verde': logoVertical(VERDE),
  'logo-vertical-creme': logoVertical(CREME),
  'icone-app': icone(0.56),
}
for (const [nomeArquivo, conteudo] of Object.entries(arquivos)) {
  writeFileSync(`marca/arquivos/${nomeArquivo}.svg`, conteudo)
  await png(conteudo, `marca/arquivos/${nomeArquivo}.png`, nomeArquivo.startsWith('logo') ? 2400 : 1024)
}

// ---- Arquivos usados pelo app ----
writeFileSync('public/logo.svg', arquivos['simbolo-verde'])
writeFileSync('public/logo-vertical.svg', arquivos['logo-vertical-verde'])
writeFileSync('public/favicon.svg', icone(0.62, 220))
const iconeCheio = icone(0.56)
const iconeSeguro = icone(0.42) // Android recorta em círculo: símbolo menor
await png(iconeCheio, 'public/pwa-64x64.png', 64)
await png(iconeCheio, 'public/pwa-192x192.png', 192)
await png(iconeCheio, 'public/pwa-512x512.png', 512)
await png(iconeSeguro, 'public/maskable-icon-512x512.png', 512)
await png(iconeCheio, 'public/apple-touch-icon-180x180.png', 180)
await png(icone(0.62, 220), 'public/favicon-32x32.png', 32)

console.log('Marca gerada em marca/arquivos e public/')
