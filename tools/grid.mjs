import sharp from 'sharp'
const [src, out, step] = process.argv.slice(2)
const S = Number(step || 128)
const m = await sharp(src).metadata()
const W = m.width, H = m.height
let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
for (let x = 0; x <= W; x += S) {
  svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#00ffff" stroke-width="1.5" opacity="0.8"/>`
  for (let y = 0; y <= H; y += S) svg += `<text x="${x + 3}" y="${y + 14}" font-family="monospace" font-size="15" fill="#ff2bd1" stroke="#000" stroke-width="0.5">${x},${y}</text>`
}
for (let y = 0; y <= H; y += S) svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#00ffff" stroke-width="1.5" opacity="0.8"/>`
svg += `</svg>`
await sharp(src).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out)
console.log('ok', W + 'x' + H)
