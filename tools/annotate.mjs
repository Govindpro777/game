import sharp from 'sharp'
import { execSync } from 'node:child_process'
const src = process.argv[2], out = process.argv[3], min = process.argv[4] || 700
const lines = execSync(`node tools/blobs.mjs ${src} ${min}`, { encoding: 'utf8' }).split('\n')
const boxes = JSON.parse(lines[0])
let svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">`
boxes.forEach((b, i) => {
  svg += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#ff0000" stroke-width="2"/>`
  svg += `<rect x="${b.x}" y="${b.y}" width="26" height="16" fill="#ff0000"/>`
  svg += `<text x="${b.x + 3}" y="${b.y + 13}" font-family="monospace" font-size="13" fill="#ffffff">${i}</text>`
})
svg += `</svg>`
await sharp(src).flatten({ background: '#202020' })
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out)
console.log('ok', boxes.length)
