/**
 * Derives the walkable road network from a scene's artwork.
 *
 * Roads (cobble + packed dirt) are warm and desaturated: red leads, then green,
 * then blue. Grass and trees invert that (green >= red), water and sky lead blue,
 * and roofs/shadows are simply too dark. That classification is noisy on its own,
 * so it is cleaned up morphologically and then reduced to the single connected
 * component reachable from a seed point on the main road -- which discards stray
 * wooden walls and sunlit patches that happen to match the colour test.
 *
 *   node tools/roadmask.mjs <src> <maskOut> <previewOut> <config.json>
 *
 * Every image gets its own config (tools/masks/*.json) because the colour bands
 * that pick out road differ between paintings. See DEFAULTS for the fields.
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const [src, maskOut, previewOut, configPath] = process.argv.slice(2)

const DEFAULTS = {
  seed: [760, 700],
  /**
   * Two thresholds. `strong` is clean, well-lit road only. `weak` also admits road
   * in shadow, but walls often satisfy it too -- so `weak` is never used on its
   * own, only grown into from `strong` by `grow` steps. Road shadows are a few
   * pixels wide and get bridged; a wall is tens of pixels tall and cannot be
   * climbed in the budget.
   */
  strong: { lumMin: 96, lumMax: 210, satMin: 0, satMax: 78, grMin: -52, grMax: -2, brMin: -56, brMax: -16 },
  weak: { lumMin: 74, lumMax: 210, satMin: 0, satMax: 78, grMin: -52, grMax: -2, brMin: -105, brMax: -16 },
  grow: 14,
  /** [radius, keepAbove] majority-filter passes, in order. The last one erodes. */
  smooth: [[2, 0.40], [3, 0.52], [2, 0.30], [1, 0.80]],
  /**
   * Rectangles [x, y, w, h] forced walkable after cleanup: short stretches where
   * the art genuinely has road the classifier can't see (occluded, in shadow).
   * Keep these few and small.
   */
  bridges: [],
  /**
   * Rectangles [x, y, w, h] forced NOT walkable, applied last: things painted in
   * road colours that the connectivity pass can't separate from the road they
   * touch (a stone wall, a rock pile at the kerb). Keep these few and small too.
   */
  cuts: [],
}

const cfg = { ...DEFAULTS, ...(configPath ? JSON.parse(readFileSync(configPath, 'utf8')) : {}) }
const SEED = cfg.seed

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const N = W * H

const band = (o, t) => {
  const r = data[o], g = data[o + 1], b = data[o + 2]
  const lum = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return lum >= t.lumMin && lum <= t.lumMax && sat >= t.satMin && sat <= t.satMax &&
    g - r >= t.grMin && g - r <= t.grMax && b - r >= t.brMin && b - r <= t.brMax
}

let strong = new Uint8Array(N)
const weak = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  const o = i * C
  if (band(o, cfg.strong)) strong[i] = 1
  if (band(o, cfg.weak)) weak[i] = 1
}

for (let step = 0; step < cfg.grow; step++) {
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
// Erosion (the last pass) runs BEFORE the connectivity pass: eroding afterwards can
// pinch a junction shut and strand half the map behind road you can see but never reach.
for (const [radius, keepAbove] of cfg.smooth) mask = smooth(mask, radius, keepAbove)

const fill = (rects, v) => {
  for (const [bx, by, bw, bh] of rects) {
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = v
      }
    }
  }
}
fill(cfg.bridges, 1)
fill(cfg.cuts, 0)

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

let walk = 0
for (let i = 0; i < N; i++) if (keep[i]) walk++

const mpx = Buffer.alloc(N * 4)
const ppx = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  const on = keep[i]
  mpx[i * 4] = mpx[i * 4 + 1] = mpx[i * 4 + 2] = on ? 255 : 0
  mpx[i * 4 + 3] = 255
  if (on) { ppx[i * 4] = 255; ppx[i * 4 + 1] = 0; ppx[i * 4 + 2] = 200; ppx[i * 4 + 3] = 125 }
}

await sharp(mpx, { raw: { width: W, height: H, channels: 4 } })
  .png({ colours: 2, compressionLevel: 9 }).toFile(maskOut)
if (previewOut) {
  const overlay = await sharp(ppx, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  await sharp(src).removeAlpha().composite([{ input: overlay }]).png().toFile(previewOut)
}
let raw = 0
for (let i = 0; i < N; i++) if (rawCopy[i]) raw++
console.log(`${W}x${H} raw ${(raw / N * 100).toFixed(1)}% -> walkable ${(walk / N * 100).toFixed(1)}% seed=${SEED}`)
