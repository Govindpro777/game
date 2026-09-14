import sharp from 'sharp'
const { data, info } = await sharp('public/scene/walkmask.png').removeAlpha().raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const road = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) road[i] = data[i * C] > 127 ? 1 : 0

const comp = new Int32Array(W * H).fill(-1)
const sizes = []
for (let s = 0; s < W * H; s++) {
  if (comp[s] !== -1 || !road[s]) continue
  const id = sizes.length
  let n = 0
  const st = [s]
  comp[s] = id
  while (st.length) {
    const i = st.pop(); n++
    const x = i % W, y = (i / W) | 0
    if (x > 0 && road[i - 1] && comp[i - 1] === -1) { comp[i - 1] = id; st.push(i - 1) }
    if (x < W - 1 && road[i + 1] && comp[i + 1] === -1) { comp[i + 1] = id; st.push(i + 1) }
    if (y > 0 && road[i - W] && comp[i - W] === -1) { comp[i - W] = id; st.push(i - W) }
    if (y < H - 1 && road[i + W] && comp[i + W] === -1) { comp[i + W] = id; st.push(i + W) }
  }
  sizes.push(n)
}
const order = sizes.map((n, i) => [i, n]).sort((a, b) => b[1] - a[1])
console.log('components (top 6):', order.slice(0, 6).map(([i, n]) => `#${i}:${n}px`).join(' '))

const SEEDC = comp[700 * W + 762]
const main = []
const others = new Map()
for (let i = 0; i < W * H; i++) {
  if (comp[i] === -1) continue
  if (comp[i] === SEEDC) main.push(i)
  else if (sizes[comp[i]] > 3000) {
    if (!others.has(comp[i])) others.set(comp[i], [])
    others.get(comp[i]).push(i)
  }
}
console.log(`main component #${SEEDC} = ${main.length}px; other large components: ${[...others.keys()].join(',')}`)

for (const [id, pts] of others) {
  let best = null
  for (const p of pts) {
    const px = p % W, py = (p / W) | 0
    for (const q of main) {
      const qx = q % W, qy = (q / W) | 0
      const d2 = (px - qx) ** 2 + (py - qy) ** 2
      if (d2 > 40000) continue
      if (!best || d2 < best.d2) best = { d2, from: [qx, qy], to: [px, py] }
    }
  }
  if (best) {
    console.log(`#${id} (${sizes[id]}px): closest gap ${Math.sqrt(best.d2).toFixed(0)}px  main${best.from} -> comp${best.to}`)
  } else {
    console.log(`#${id} (${sizes[id]}px): no point within 200px of the main network`)
  }
}
