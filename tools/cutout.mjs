import sharp from 'sharp'

const [src, X, Y, W, H, out, mode] = process.argv.slice(2)
const { data, info } = await sharp(src)
  .extract({ left: +X, top: +Y, width: +W, height: +H })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const w = info.width, h = info.height, C = info.channels
const px = Buffer.from(data)

const keep = (o) => {
  const r = px[o], g = px[o + 1], b = px[o + 2]
  if (mode === 'green') return g > r + 8 && g > b + 4
  if (mode === 'tree') return (g > r + 8 && g > b + 4) || (r > b + 14 && r > g + 4 && r < 165)
  if (mode === 'notgreen') return !(g > r + 6 && g > b + 2)
  if (mode === 'gray') {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    return mx - mn < 26 && mx > 70
  }
  return true
}

const clear = new Uint8Array(w * h)
const st = []
for (let x = 0; x < w; x++) st.push(x, 0, x, h - 1)
for (let y = 0; y < h; y++) st.push(0, y, w - 1, y)
while (st.length) {
  const y = st.pop(), x = st.pop()
  if (x < 0 || y < 0 || x >= w || y >= h) continue
  const i = y * w + x
  if (clear[i] || keep(i * C)) continue
  clear[i] = 1
  st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
}

const EL = process.argv[9] !== 'noellipse'
const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (!EL) continue
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    if (d > 1) clear[i] = 1
    else if (d > 0.86) px[i * C + 3] = Math.round(px[i * C + 3] * (1 - (d - 0.86) / 0.14))
  }
}
for (let i = 0; i < w * h; i++) if (clear[i]) px[i * C + 3] = 0

await sharp(px, { raw: { width: w, height: h, channels: C } })
  .trim({ threshold: 1 }).png().toFile(out)
const m = await sharp(out).metadata()
console.log(out, m.width + 'x' + m.height)
