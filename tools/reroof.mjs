import sharp from 'sharp'
const [src, out] = process.argv.slice(2)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width, h = info.height, C = info.channels
const px = Buffer.from(data)
for (let i = 0; i < w * h; i++) {
  const o = i * C
  if (px[o + 3] === 0) continue
  const r = px[o], g = px[o + 1], b = px[o + 2]
  const mx = Math.max(r, g, b)
  if (b >= r + 4 && mx < 175) {
    px[o] = Math.min(255, Math.round(b * 1.32 + 24))
    px[o + 1] = Math.round(g * 0.66 + 8)
    px[o + 2] = Math.round(r * 0.5)
  }
}
await sharp(px, { raw: { width: w, height: h, channels: C } }).png().toFile(out)
console.log('ok', out)
