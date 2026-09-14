import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/scenes.ts', 'utf8')
const world = src.slice(src.indexOf('const world: Scene'), src.indexOf('shop scenes'))
const zIdx = world.indexOf('zones: [')
const RECT = /R\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g
const rects = [...world.slice(0, zIdx).matchAll(RECT)].map((m) => m.slice(1).map(Number))
const sp = world.match(/spawn:\s*\{\s*x:\s*(\d+)\s*\*\s*WS,\s*y:\s*(\d+)\s*\*\s*WS/)
const spawn = [Number(sp[1]), Number(sp[2])]
const WS = Number(src.match(/const WS = ([\d.]+)/)[1])

const meta = await sharp('public/scene/village.png').metadata()
const MW = meta.width, MH = meta.height
const MX = 14 / WS, MY = 7 / WS          // player half-extents, in image pixels
const STEP = 4

const blocked = (x, y) => {
  for (const [rx, ry, rw, rh] of rects) {
    if (x > rx - MX && x < rx + rw + MX && y > ry - MY && y < ry + rh + MY) return true
  }
  return x < 24 / WS || y < 46 / WS || x > MW - 24 / WS || y > MH - 12 / WS
}

const cols = Math.ceil(MW / STEP), rows = Math.ceil(MH / STEP)
const seen = new Uint8Array(cols * rows)
const sx = Math.round(spawn[0] / STEP), sy = Math.round(spawn[1] / STEP)
const stack = [sx, sy]
seen[sy * cols + sx] = 1
while (stack.length) {
  const y = stack.pop(), x = stack.pop()
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
    const i = ny * cols + nx
    if (seen[i] || blocked(nx * STEP, ny * STEP)) continue
    seen[i] = 1
    stack.push(nx, ny)
  }
}

const px = Buffer.alloc(MW * MH * 4, 0)
let n = 0
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    if (!seen[y * cols + x]) continue
    n++
    for (let j = 0; j < STEP; j++) {
      for (let i = 0; i < STEP; i++) {
        const px0 = x * STEP + i, py0 = y * STEP + j
        if (px0 >= MW || py0 >= MH) continue
        const o = (py0 * MW + px0) * 4
        px[o] = 0; px[o + 1] = 255; px[o + 2] = 90; px[o + 3] = 120
      }
    }
  }
}
const zblock = world.slice(zIdx)
const zoneRects = [...zblock.matchAll(RECT)].map((m) => m.slice(1).map(Number))
const zoneIds = [...zblock.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1])
const report = {}
zoneRects.forEach(([zx, zy, zw, zh], i) => {
  const cx = zx + zw / 2, cy = zy + zh / 2
  let ok = false
  for (let ox = -40; ox <= 40 && !ok; ox += STEP) {
    for (let oy = -40; oy <= 40 && !ok; oy += STEP) {
      const gx = Math.round((cx + ox) / STEP), gy = Math.round((cy + oy) / STEP)
      if (gx >= 0 && gy >= 0 && gx < cols && gy < rows && seen[gy * cols + gx]) ok = true
    }
  }
  report[zoneIds[i] ?? i] = ok
})
console.log('zones reachable:', JSON.stringify(report))
if (Object.values(report).some((v) => !v)) console.log('*** SOME ZONE UNREACHABLE ***')

const overlay = await sharp(px, { raw: { width: MW, height: MH, channels: 4 } }).png().toBuffer()
await sharp('public/scene/village.png').composite([{ input: overlay }]).png().toFile(process.argv[2])
console.log(`reachable cells=${n} spawn=${spawn} step=${STEP}`)
