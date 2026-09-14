import sharp from 'sharp'
const src = process.argv[2]
const MIN = Number(process.argv[3] || 300)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const seen = new Uint8Array(W * H)
const boxes = []
const stack = []
for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
  const si = sy * W + sx
  if (seen[si] || data[si * C + 3] <= 24) continue
  let x0 = sx, x1 = sx, y0 = sy, y1 = sy, n = 0
  stack.push(sx, sy); seen[si] = 1
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    n++
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const ni = ny * W + nx
      if (seen[ni] || data[ni * C + 3] <= 24) continue
      seen[ni] = 1; stack.push(nx, ny)
    }
  }
  if (n >= MIN) boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n })
}
boxes.sort((a, b) => (a.y - b.y) || (a.x - b.x))
console.log(JSON.stringify(boxes))
console.log('count=' + boxes.length)
