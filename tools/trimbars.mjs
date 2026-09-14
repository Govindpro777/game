import sharp from 'sharp'
const [src, th] = process.argv.slice(2)
const TH = Number(th || 22)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, C = info.channels
const dark = (y) => {
  let sum = 0
  for (let x = 0; x < W; x += 4) {
    const o = (y * W + x) * C
    sum += (data[o] + data[o + 1] + data[o + 2]) / 3
  }
  return sum / Math.ceil(W / 4)
}
let top = 0, bot = H - 1
while (top < H && dark(top) < TH) top++
while (bot > top && dark(bot) < TH) bot--
const darkCol = (x) => {
  let sum = 0
  for (let y = top; y <= bot; y += 4) {
    const o = (y * W + x) * C
    sum += (data[o] + data[o + 1] + data[o + 2]) / 3
  }
  return sum / Math.ceil((bot - top) / 4)
}
let left = 0, right = W - 1
while (left < W && darkCol(left) < TH) left++
while (right > left && darkCol(right) < TH) right--
console.log(JSON.stringify({ left, top, width: right - left + 1, height: bot - top + 1, from: W + 'x' + H }))
