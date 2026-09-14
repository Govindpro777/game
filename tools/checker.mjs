import sharp from 'sharp'
const src = process.argv[2]
const row = Number(process.argv[3] || 810)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, C = info.channels
let runs = [], prev = null, start = 0
for (let x = 0; x < 320; x++) {
  const o = (row * W + x) * C
  const lum = Math.round((data[o] + data[o+1] + data[o+2]) / 3)
  const tone = lum > 225 ? 'L' : (lum > 170 ? 'D' : '?')
  if (tone !== prev) { if (prev !== null) runs.push(prev + ':' + (x - start)); prev = tone; start = x }
}
console.log('row', row, runs.slice(0, 14).join(' '))
const tones = new Map()
for (let y = 800; y < 1024; y += 3) for (let x = 0; x < 60; x += 3) {
  const o = (y * W + x) * C
  const k = `${data[o]},${data[o+1]},${data[o+2]}`
  tones.set(k, (tones.get(k) || 0) + 1)
}
console.log('top tones:', [...tones].sort((a,b)=>b[1]-a[1]).slice(0,6).map(t=>t[0]+' x'+t[1]).join(' | '))
