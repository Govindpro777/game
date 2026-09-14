/**
 * Checks the village against its road mask: is the spawn on road, is every zone
 * on road, and is every zone reachable on foot from the spawn? Writes an overlay
 * showing the reachable road in green, unreachable road in red, zones in cyan.
 *
 *   node tools/maskcheck.mjs [previewOut]
 */
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/scenes.ts', 'utf8')
const world = src.slice(src.indexOf('const world: Scene'), src.indexOf('shop scenes'))
const sp = world.match(/spawn:\s*\{\s*x:\s*(\d+)\s*,\s*y:\s*(\d+)\s*\}/)
const spawn = [Number(sp[1]), Number(sp[2])]
const zones = [...world.matchAll(
  /\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+),\s*id:\s*'(\w+)'/g,
)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], id: m[5] }))

const { data, info } = await sharp('public/scene/walkmask.png').removeAlpha().raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const road = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) road[i] = data[i * C] > 127 ? 1 : 0

const BODY = Number(process.env.BODY ?? 3)
const walkable = (x, y) => {
  for (const dx of [-BODY, 0, BODY]) {
    const mx = Math.round(x + dx), my = Math.round(y)
    if (mx < 0 || my < 0 || mx >= W || my >= H || !road[my * W + mx]) return false
  }
  return true
}

const seen = new Uint8Array(W * H)
const si = spawn[1] * W + spawn[0]
const spawnOk = walkable(spawn[0], spawn[1])
const stack = spawnOk ? [spawn[0], spawn[1]] : []
if (spawnOk) seen[si] = 1
while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    const i = ny * W + nx
    if (seen[i] || !walkable(nx, ny)) continue
    seen[i] = 1
    stack.push(nx, ny)
  }
}

let reach = 0
for (let i = 0; i < W * H; i++) if (seen[i]) reach++

const report = {}
for (const z of zones) {
  const cx = Math.round(z.x + z.w / 2), cy = Math.round(z.y + z.h / 2)
  let ok = false
  for (let oy = -30; oy <= 30 && !ok; oy += 3) {
    for (let ox = -30; ox <= 30 && !ok; ox += 3) {
      const gx = cx + ox, gy = cy + oy
      if (gx >= 0 && gy >= 0 && gx < W && gy < H && seen[gy * W + gx]) ok = true
    }
  }
  report[z.id] = ok
}

console.log(`BODY=${BODY} spawn ${spawn} onRoad=${spawnOk}  reachable=${reach} px (${(reach / (W * H) * 100).toFixed(1)}%)`)
console.log('zones reachable:', JSON.stringify(report))
if (!spawnOk || Object.values(report).some((v) => !v)) console.log('*** PROBLEM ***')

const out = process.argv[2]
if (out) {
  const px = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    if (seen[i]) { px[i * 4 + 1] = 255; px[i * 4 + 3] = 115 }
    else if (road[i]) { px[i * 4] = 255; px[i * 4 + 3] = 150 }
  }
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
  for (const z of zones) {
    svg += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="#00ffff" fill-opacity="0.6" stroke="#00ffff" stroke-width="3"/>`
    svg += `<text x="${z.x}" y="${z.y - 6}" font-family="monospace" font-size="20" fill="#00ffff" stroke="#000" stroke-width="0.8">${z.id}</text>`
  }
  svg += `<circle cx="${spawn[0]}" cy="${spawn[1]}" r="12" fill="#ffee00" stroke="#000" stroke-width="3"/></svg>`
  const overlay = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  await sharp('public/scene/village.png')
    .composite([{ input: overlay }, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png().toFile(out)
}
