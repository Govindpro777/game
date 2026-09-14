import sharp from 'sharp'
const src = process.argv[2]
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, C = info.channels
let opaque = 0, transparent = 0
for (let i = 3; i < data.length; i += C) { if (data[i] > 24) opaque++; else transparent++ }
console.log('size', info.width + 'x' + info.height, 'channels', C)
console.log('opaque px', opaque, 'transparent px', transparent)
const pts = [[10,810],[20,820],[30,810],[40,820],[500,900],[512,512],[600,60]]
for (const [x,y] of pts) {
  const o = (y*W+x)*C
  console.log(`(${x},${y}) rgba=${data[o]},${data[o+1]},${data[o+2]},${data[o+3]}`)
}
