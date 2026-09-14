import sharp from 'sharp'
const [src, x, y, w, h, out, scale] = process.argv.slice(2)
const s = Number(scale || 1)
let img = sharp(src).extract({ left: +x, top: +y, width: +w, height: +h })
if (s !== 1) img = img.resize({ width: Math.round(+w * s), kernel: 'nearest' })
await img.flatten({ background: '#ff00ff' }).png().toFile(out)
console.log('ok', out)
