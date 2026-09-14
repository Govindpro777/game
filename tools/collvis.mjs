import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/scenes.ts', 'utf8')
const world = src.slice(src.indexOf('const world: Scene'), src.indexOf('shop scenes'))
const zIdx = world.indexOf('zones: [')

const RECT = /R\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g
const rects = [...world.slice(0, zIdx).matchAll(RECT)].map((m) => m.slice(1).map(Number))
const zones = [...world.slice(zIdx).matchAll(RECT)].map((m) => m.slice(1).map(Number))
const zoneIds = [...world.slice(zIdx).matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1])
const sp = world.match(/spawn:\s*\{\s*x:\s*(\d+)\s*\*\s*WS,\s*y:\s*(\d+)\s*\*\s*WS/)
const spawn = sp ? [Number(sp[1]), Number(sp[2])] : null

const meta = await sharp('public/scene/village.png').metadata()
const MW = meta.width, MH = meta.height
let svg = `<svg width="${MW}" height="${MH}" xmlns="http://www.w3.org/2000/svg">`
for (const [x, y, w, h] of rects) {
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ff0000" fill-opacity="0.34" stroke="#ff0000" stroke-width="2"/>`
}
zones.forEach(([x, y, w, h], i) => {
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#00ff66" fill-opacity="0.55" stroke="#00ff66" stroke-width="3"/>`
  svg += `<text x="${x + 2}" y="${y - 6}" font-family="monospace" font-size="18" fill="#00ff66" stroke="#000" stroke-width="0.8">${zoneIds[i] ?? i}</text>`
})
if (spawn) svg += `<circle cx="${spawn[0]}" cy="${spawn[1]}" r="14" fill="#00ccff" stroke="#000" stroke-width="2"/>`
for (let x = 0; x <= MW; x += 100) {
  svg += `<line x1="${x}" y1="0" x2="${x}" y2="${MH}" stroke="#fff" stroke-width="1" opacity="0.5"/>`
  svg += `<text x="${x + 2}" y="15" font-family="monospace" font-size="14" fill="#fff" stroke="#000" stroke-width="0.6">${x}</text>`
}
for (let y = 0; y <= MH; y += 100) {
  svg += `<line x1="0" y1="${y}" x2="${MW}" y2="${y}" stroke="#fff" stroke-width="1" opacity="0.5"/>`
  svg += `<text x="2" y="${y + 15}" font-family="monospace" font-size="14" fill="#fff" stroke="#000" stroke-width="0.6">${y}</text>`
}
svg += '</svg>'

await sharp('public/scene/village.png')
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .png()
  .toFile(process.argv[2])
console.log(`rects=${rects.length} zones=${zones.length} ids=${zoneIds} spawn=${spawn}`)
