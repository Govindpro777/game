import sharp from 'sharp'
import { readdirSync } from 'node:fs'
const dir = process.argv[2], out = process.argv[3], cell = Number(process.argv[4] || 150)
const files = readdirSync(dir).filter(f => f.endsWith('.png')).sort()
const cols = Math.ceil(Math.sqrt(files.length))
const rows = Math.ceil(files.length / cols)
const W = cols * cell, H = rows * (cell + 18)
const comps = []
let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
for (let i = 0; i < files.length; i++) {
  const cx = (i % cols) * cell, cy = Math.floor(i / cols) * (cell + 18)
  const buf = await sharp(`${dir}/${files[i]}`).resize({ width: cell - 8, height: cell - 8, fit: 'inside', kernel: 'nearest' }).png().toBuffer()
  comps.push({ input: buf, left: cx + 4, top: cy + 4 })
  svg += `<text x="${cx + 4}" y="${cy + cell + 13}" font-family="monospace" font-size="12" fill="#fff">${files[i].replace('.png','')}</text>`
}
svg += `</svg>`
await sharp({ create: { width: W, height: H, channels: 4, background: '#2a2a2a' } })
  .composite([...comps, { input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out)
console.log('ok', files.length)
