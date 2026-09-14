/**
 * Derives the walkable road network from the village artwork.
 *
 * Roads (cobble + packed dirt) are warm and desaturated: red leads, then green,
 * then blue. Grass and trees invert that (green >= red), water and sky lead blue,
 * and roofs/shadows are simply too dark. That classification is noisy on its own,
 * so it is cleaned up morphologically and then reduced to the single connected
 * component reachable from a seed point on the main road -- which discards stray
 * wooden walls and sunlit patches that happen to match the colour test.
 *
 *   node tools/roadmask.mjs <src> <maskOut> <previewOut> [seedX] [seedY]
 */
import sharp from 'sharp'

const [src, maskOut, previewOut, sxArg, syArg] = process.argv.slice(2)
const SEED = [Number(sxArg ?? 760), Number(syArg ?? 700)]

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const N = W * H

/**
 * Two thresholds. STRONG is clean, well-lit road only: warm but not as warm as
 * timber walls, which is what separates cobble from a cottage. WEAK also admits
 * road in shadow, but walls satisfy it too -- so WEAK is never used on its own,
 * only grown into from STRONG by a bounded number of steps. Road shadows are a
 * few pixels wide and get bridged; a wall is tens of pixels tall and cannot be
 * climbed in the budget.
 */
const band = (o, lumMin, brMin) => {
  const r = data[o], g = data[o + 1], b = data[o + 2]
  const lum = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return lum >= lumMin && lum <= 210 && sat <= 78 &&
    g - r <= -2 && g - r >= -52 && b - r <= -16 && b - r >= brMin
}

const GROW = 14
let strong = new Uint8Array(N)
const weak = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  const o = i * C
  if (band(o, 96, -56)) strong[i] = 1
  if (band(o, 74, -105)) weak[i] = 1
}

for (let step = 0; step < GROW; step++) {
  const next = Uint8Array.from(strong)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (strong[i] || !weak[i]) continue
      if ((x > 0 && strong[i - 1]) || (x < W - 1 && strong[i + 1]) ||
          (y > 0 && strong[i - W]) || (y < H - 1 && strong[i + W])) next[i] = 1
    }
  }
  strong = next
}

let mask = strong

/** Majority filter: keeps solid road, erases speckle in grass and on rooftops. */
function smooth(src, radius, keepAbove) {
  const out = new Uint8Array(N)
  const area = (radius * 2 + 1) ** 2
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= W) continue
          n += src[yy * W + xx]
        }
      }
      out[y * W + x] = n / area >= keepAbove ? 1 : 0
    }
  }
  return out
}

const rawCopy = Uint8Array.from(mask)
mask = smooth(mask, 2, 0.40)   // close small gaps (lamp posts, carts, shadows)
mask = smooth(mask, 3, 0.52)   // drop speckle in grass and on rooftops
mask = smooth(mask, 2, 0.30)   // re-bridge anything the cleanup nicked
// Erode BEFORE the connectivity pass: eroding afterwards can pinch a junction shut
// and strand half the village behind road the player can see but never reach.
mask = smooth(mask, 1, 0.80)

/**
 * Bridges: short stretches where the art genuinely has road but the classifier
 * cannot see it -- here the lane behind the greenhouse, which is occluded by its
 * roof and thrown into shadow. Without this the whole northern half of the
 * village is visible but unreachable. Keep these few and small.
 */
const BRIDGES = [[770, 352, 62, 60]]
for (const [bx, by, bw, bh] of BRIDGES) {
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1
    }
  }
}

/* keep only the road network connected to the seed */
const keep = new Uint8Array(N)
const si = SEED[1] * W + SEED[0]
if (!mask[si]) console.warn('seed is not on road; widen thresholds or move the seed')
const stack = [SEED[0], SEED[1]]
keep[si] = 1
while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    const i = ny * W + nx
    if (keep[i] || !mask[i]) continue
    keep[i] = 1
    stack.push(nx, ny)
  }
}

const eroded = keep

let walk = 0
for (let i = 0; i < N; i++) if (eroded[i]) walk++

const mpx = Buffer.alloc(N * 4)
const ppx = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  const on = eroded[i]
  mpx[i * 4] = mpx[i * 4 + 1] = mpx[i * 4 + 2] = on ? 255 : 0
  mpx[i * 4 + 3] = 255
  if (on) { ppx[i * 4] = 255; ppx[i * 4 + 1] = 0; ppx[i * 4 + 2] = 200; ppx[i * 4 + 3] = 125 }
}

await sharp(mpx, { raw: { width: W, height: H, channels: 4 } })
  .png({ colours: 2, compressionLevel: 9 }).toFile(maskOut)
if (previewOut) {
  const overlay = await sharp(ppx, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  await sharp(src).composite([{ input: overlay }]).png().toFile(previewOut)
}
let raw = 0
for (let i = 0; i < N; i++) if (rawCopy[i]) raw++
if (process.env.RAW) {
  const rp = Buffer.alloc(N * 4)
  for (let i = 0; i < N; i++) if (rawCopy[i]) { rp[i*4] = 255; rp[i*4+2] = 200; rp[i*4+3] = 125 }
  const ov = await sharp(rp, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  await sharp(src).composite([{ input: ov }]).png().toFile(process.env.RAW)
}
console.log(`${W}x${H} raw ${(raw / N * 100).toFixed(1)}% -> walkable ${(walk / N * 100).toFixed(1)}% seed=${SEED}`)
