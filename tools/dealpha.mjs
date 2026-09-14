import sharp from 'sharp'

const src = process.argv[2]
const dst = process.argv[3]
const LUM = Number(process.argv[4] || 160)
const SAT = Number(process.argv[5] || 16)

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const px = Buffer.from(data)

const isBg = (o) => {
  const r = px[o], g = px[o + 1], b = px[o + 2]
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  return mx - mn <= SAT && (r + g + b) / 3 >= LUM
}

const clear = new Uint8Array(W * H)
const stack = []
for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1) }
for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y) }

while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  if (x < 0 || y < 0 || x >= W || y >= H) continue
  const i = y * W + x
  if (clear[i]) continue
  if (!isBg(i * C)) continue
  clear[i] = 1
  stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
}

const seen = new Uint8Array(W * H)
for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
  const si = sy * W + sx
  if (seen[si] || clear[si] || !isBg(si * C)) continue
  const comp = []
  const q = [sx, sy]
  seen[si] = 1
  while (q.length) {
    const y = q.pop(), x = q.pop()
    comp.push(y * W + x)
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const ni = ny * W + nx
      if (seen[ni] || clear[ni] || !isBg(ni * C)) continue
      seen[ni] = 1
      q.push(nx, ny)
    }
  }
  if (comp.length < 3200) for (const i of comp) clear[i] = 1
}

for (let pass = 0; pass < 2; pass++) {
  const add = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (clear[i]) continue
    const o = i * C
    const mx = Math.max(px[o], px[o + 1], px[o + 2]), mn = Math.min(px[o], px[o + 1], px[o + 2])
    if (mx - mn > SAT + 8 || (px[o] + px[o + 1] + px[o + 2]) / 3 < LUM - 25) continue
    if ((x > 0 && clear[i - 1]) || (x < W - 1 && clear[i + 1]) || (y > 0 && clear[i - W]) || (y < H - 1 && clear[i + W])) add.push(i)
  }
  for (const i of add) clear[i] = 1
  if (!add.length) break
}

let cleared = 0
for (let i = 0; i < W * H; i++) if (clear[i]) { px[i * C + 3] = 0; cleared++ }

await sharp(px, { raw: { width: W, height: H, channels: C } }).png().toFile(dst)
console.log(`${dst}  cleared ${(cleared / (W * H) * 100).toFixed(1)}% of pixels`)
