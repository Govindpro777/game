import sharp from 'sharp'
const [src, y0, y1, minGap, minW] = process.argv.slice(2)
const MG = Number(minGap || 4), MW = Number(minW || 6)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const top = Number(y0), bot = Math.min(Number(y1), H)
const colHas = new Array(W).fill(false)
for (let x = 0; x < W; x++) {
  for (let y = top; y < bot; y++) {
    if (data[(y * W + x) * C + 3] > 24) { colHas[x] = true; break }
  }
}
const runs = []
let s = -1, gap = 0
for (let x = 0; x < W; x++) {
  if (colHas[x]) { if (s < 0) s = x; gap = 0 }
  else if (s >= 0) { gap++; if (gap >= MG) { runs.push([s, x - gap]); s = -1; gap = 0 } }
}
if (s >= 0) runs.push([s, W - 1])
const out = []
for (const [x0, x1] of runs) {
  if (x1 - x0 + 1 < MW) continue
  let ty = -1, by = -1
  for (let y = top; y < bot; y++) {
    let has = false
    for (let x = x0; x <= x1; x++) if (data[(y * W + x) * C + 3] > 24) { has = true; break }
    if (has) { if (ty < 0) ty = y; by = y }
  }
  out.push({ x: x0, y: ty, w: x1 - x0 + 1, h: by - ty + 1 })
}
console.log(JSON.stringify(out))
console.log('count=' + out.length)
