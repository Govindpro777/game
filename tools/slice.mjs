/**
 * Rebuilds everything in public/ from the source art in assets/.
 *
 *   assets/sprite-sheet.png       -> ~60 named sprites in public/sprites/
 *   assets/tool-shop-building.png -> public/scene/toolshop.png
 *   assets/game-bg.jpeg           -> public/scene/village.png + walkmask.png (roads)
 *   assets/village-map-old.png    -> the tree sprite (cut from the old painting)
 *   assets/seed-shop-girl.png     -> the seed shop's standing NPC (a 5x2 turnaround
 *                                    sheet; column 4, row 0's 3/4 pose, mirrored to face left)
 *   assets/girl-profile.png       -> public/portrait/faye.png, her dialogue portrait
 *   assets/boy-profile.png        -> public/portrait/bao.png, the player's dialogue portrait
 *   assets/close-up-seed-shop.JPG -> public/scene/seedshop-closeup.jpg, the outdoor plaza
 *                                    the player walks into first; talking to Faye there
 *                                    is what leads inside
 *   assets/seed-shop.png          -> public/scene/seedshop-interior.png, the walkable
 *                                    interior the conversation can send you into --
 *                                    Faye is baked into this art too (see scenes.ts)
 *   assets/leaf.png               -> public/icon/leaf.png, the little leaf icon used
 *                                    on Faye's dialogue name-plate
 *   assets/main-character.png    -> the player's 9 walk-cycle frames (a single side-view
 *                                    walk cycle, sliced left to right into player/f0..f8,
 *                                    replacing the old sheet's front/back/side frames --
 *                                    see the last step)
 *
 * The two Gemini sheets have their "transparent" checkerboard painted in as real
 * pixels, so every source image goes through dealpha.mjs first to recover alpha.
 */
import sharp from 'sharp'
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const GEN = 'assets/generated'
const OUT = 'public/sprites'
const SHEET = `${GEN}/sprite-sheet-alpha.png`
const BUILDING = `${GEN}/tool-shop-alpha.png`

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

/** Blob index in the sheet -> sprite path. Indices come from blobs.mjs (top-left to bottom-right). */
const NAMES = {
  0: 'prop/well',
  1: 'tile/grass_rocks_a', 2: 'tile/grass_rocks_b',
  3: 'tile/grass_a', 4: 'tile/grass_b', 5: 'tile/grass_c',
  9: 'tile/grass_d', 10: 'tile/grass_e', 11: 'tile/grass_f',
  13: 'tile/grass_edge', 14: 'tile/dirt', 15: 'tile/soil_rows',
  25: 'tile/stone_path', 26: 'tile/dirt_stone', 27: 'tile/grass_path',
  6: 'prop/crate', 7: 'prop/logs_big', 8: 'prop/barrels',
  12: 'prop/crates_produce', 16: 'prop/barrel_produce', 17: 'prop/sacks',
  18: 'prop/logs_small', 19: 'prop/fence_post', 20: 'prop/fence_rail',
  21: 'prop/fence_gate', 22: 'prop/fence_post_b', 23: 'prop/fence_post_c',
  24: 'prop/lantern', 28: 'prop/fence_rail_b', 29: 'prop/lantern_b',
  30: 'prop/cart',
  39: 'crop/carrot_1', 36: 'crop/carrot_2', 32: 'crop/carrot_3',
  34: 'crop/wheat_1', 35: 'crop/wheat_2', 33: 'crop/wheat_3', 31: 'crop/wheat_4',
  50: 'crop/tomato_1', 48: 'crop/tomato_2', 45: 'crop/tomato_3',
  41: 'crop/pumpkin_2', 49: 'crop/pumpkin_3',
  47: 'crop/corn_1', 43: 'crop/corn_2', 40: 'crop/corn_3',
  38: 'seed/carrot', 37: 'seed/wheat', 46: 'seed/tomato',
  44: 'seed/pumpkin', 42: 'seed/corn',
  // Player frames (55, 56, 53, 52, 54, 57, 58, 59, 60) no longer come from this
  // sheet -- see step 6, which slices them from main-character.png instead.
}

/* 1. recover real alpha from the painted checkerboards */
mkdirSync(GEN, { recursive: true })
run(`node tools/dealpha.mjs "assets/sprite-sheet.png" "${SHEET}"`)
run(`node tools/dealpha.mjs "assets/tool-shop-building.png" "${BUILDING}"`)

/* 2. cut the named sprites out of the sheet */
const boxes = JSON.parse(run(`node tools/blobs.mjs ${SHEET} 700`).split('\n')[0])
const manifest = {}
let n = 0
for (const [idx, name] of Object.entries(NAMES)) {
  const b = boxes[+idx]
  if (!b) { console.warn('missing blob', idx, name); continue }
  mkdirSync(`${OUT}/${name.split('/')[0]}`, { recursive: true })
  await sharp(SHEET).extract({ left: b.x, top: b.y, width: b.w, height: b.h })
    .png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`)
  manifest[name] = { w: b.w, h: b.h }
  n++
}

/* 3. scene backgrounds */
mkdirSync('public/scene', { recursive: true })
await sharp(BUILDING).trim({ threshold: 1 }).png().toFile('public/scene/toolshop.png')
await sharp('assets/game-bg.jpeg').png().toFile('public/scene/village.png')
// Walkable road network, derived from the artwork's own colours (see roadmask.mjs).
run('node tools/roadmask.mjs assets/game-bg.jpeg public/scene/walkmask.png "" 760 700')

/* 4. trees and rocks, cut from artwork rather than the sheet (it has neither) */
mkdirSync(`${OUT}/nature`, { recursive: true })
mkdirSync(`${OUT}/decal`, { recursive: true })
run(`node tools/cutout.mjs assets/village-map-old.png 650 778 152 152 ${OUT}/nature/tree_a.png green`)
run(`node tools/cutout.mjs ${OUT}/tile/grass_rocks_a.png 80 75 42 34 ${OUT}/nature/rock_a.png gray noellipse`)
run(`node tools/cutout.mjs ${OUT}/tile/grass_rocks_a.png 18 26 32 18 ${OUT}/nature/rock_b.png gray noellipse`)

/* 5. seamless ground bases + scatter decals */
mkdirSync(`${OUT}/ground`, { recursive: true })
await sharp(`${OUT}/tile/grass_b.png`).extract({ left: 2, top: 22, width: 32, height: 32 })
  .png().toFile(`${OUT}/ground/grass.png`)
// Cobble comes from the older village painting: it has a taller unbroken run of
// stones, which mirror-tiles far less visibly than anything on the current map.
await sharp('assets/village-map-old.png').extract({ left: 452, top: 906, width: 100, height: 56 })
  .png().toFile(`${OUT}/ground/cobble.png`)
await sharp(`${OUT}/tile/soil_rows.png`).extract({ left: 8, top: 8, width: 178, height: 114 })
  .png().toFile(`${OUT}/ground/soil.png`)
run(`node tools/cutout.mjs ${OUT}/tile/grass_d.png 30 4 26 26 ${OUT}/decal/flower_a.png notgreen noellipse`)
run(`node tools/cutout.mjs ${OUT}/tile/grass_d.png 6 28 26 26 ${OUT}/decal/flower_b.png notgreen noellipse`)
await sharp(`${OUT}/nature/rock_a.png`).toFile(`${OUT}/decal/rock_a.png`)
await sharp(`${OUT}/nature/rock_b.png`).toFile(`${OUT}/decal/rock_b.png`)

/* 6. seed shop NPC: a 3/4 pose, mirrored to face left (the sheet has real alpha
   already, no checkerboard to key out), trimmed to the sprite's own bounds */
mkdirSync(`${OUT}/npc`, { recursive: true })
{
  const GIRL_SHEET = 'assets/seed-shop-girl.png'
  const { width: SW } = await sharp(GIRL_SHEET).metadata()
  const cw = SW / 5
  // NOT a clean 50/50 split: row 0's standing poses (boots included) run to about
  // y=557, and row 1's walking poses start around y=598 -- cutting at height/2 (512)
  // sliced the boots off mid-calf. 580 sits in the gap between the two rows.
  const ROW0_H = 580
  const cell = await sharp(GIRL_SHEET)
    .extract({ left: Math.round(cw * 4), top: 0, width: Math.round(cw), height: ROW0_H })
    .flop() // mirror horizontally: sheet pose faces right, so this faces left instead
    .png().toBuffer()
  await sharp(cell).trim({ threshold: 10 }).toFile(`${OUT}/npc/seedshop_girl.png`)
}

/* 7. dialogue portraits: already painted inside ornate frames, so they go in whole,
   just downscaled to roughly 3x their on-screen size */
mkdirSync('public/portrait', { recursive: true })
for (const [src, name] of [['assets/girl-profile.png', 'faye'], ['assets/boy-profile.png', 'bao']]) {
  await sharp(src).resize({ width: 400 }).png({ compressionLevel: 9 }).toFile(`public/portrait/${name}.png`)
}

/* 8. the seed shop's two scenes, used as-is (the scene transition is a pure-CSS
   fade now, so there's no wipe texture to copy) */
await sharp('assets/close-up-seed-shop.JPG').jpeg({ quality: 90 }).toFile('public/scene/seedshop-closeup.jpg')
await sharp('assets/seed-shop.png').png({ compressionLevel: 9 }).toFile('public/scene/seedshop-interior.png')

/* 9. small UI icons, used as-is */
mkdirSync('public/icon', { recursive: true })
await sharp('assets/leaf.png').resize({ width: 64 }).png({ compressionLevel: 9 }).toFile('public/icon/leaf.png')

/* 10. player walk-cycle frames: one side-view walk cycle, 9 frames in a single row.
   Same painted checkerboard as the other Gemini sheets, so it goes through dealpha
   first; blobs.mjs finds the 9 frames but sorts top-to-bottom then left-to-right,
   and the character bobs a few pixels vertically across the cycle, so its result
   has to be re-sorted by x alone to land back in left-to-right (f0..f8) order. */
{
  mkdirSync(`${OUT}/player`, { recursive: true })
  const CHAR_SRC = 'assets/main-character.png'
  const CHAR_SHEET = `${GEN}/main-character-alpha.png`
  run(`node tools/dealpha.mjs "${CHAR_SRC}" "${CHAR_SHEET}"`)

  const frames = JSON.parse(run(`node tools/blobs.mjs ${CHAR_SHEET} 800`).split('\n')[0])
  frames.sort((a, b) => a.x - b.x)
  if (frames.length !== 9) console.warn(`expected 9 player frames, found ${frames.length}`)

  // dealpha's flood-fill has one false positive on this sheet: on at least one frame a
  // small white eye catchlight sits close enough to the checkerboard's colour that the
  // fill ate it, punching a transparent hole inside the (otherwise solid) face and
  // melting the eye into the hair shadow above it. Rather than hand-pick that one spot,
  // every frame gets scanned for the same shape of defect: a patch of near-transparent
  // pixels fully enclosed by opaque ones, which can only be a false-positive bite out of
  // the character (the real transparent background is one connected region reaching the
  // frame's own edge). Anywhere that turns up, the original fully-opaque source pixels
  // go back in -- restoring exactly what the checkerboard-keying should have left alone.
  const [rawDealpha, rawSrc] = await Promise.all([
    sharp(CHAR_SHEET).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(CHAR_SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ])
  const { data: dea, info } = rawDealpha
  const { data: src } = rawSrc
  const W = info.width, C = info.channels
  let holesPatched = 0
  for (const b of frames) {
    const PAD = 3 // a hair past the frame's own box, so a hole touching its edge still reads as "reaches outside"
    const x0 = Math.max(0, b.x - PAD), y0 = Math.max(0, b.y - PAD)
    const x1 = Math.min(info.width, b.x + b.w + PAD), y1 = Math.min(info.height, b.y + b.h + PAD)
    const bw = x1 - x0, bh = y1 - y0
    const outside = new Uint8Array(bw * bh) // reached from the box border while transparent
    const isBg = (x, y) => dea[(y * W + x) * C + 3] <= 24
    const stack = []
    for (let x = 0; x < bw; x++) { stack.push(x, 0); stack.push(x, bh - 1) }
    for (let y = 0; y < bh; y++) { stack.push(0, y); stack.push(bw - 1, y) }
    while (stack.length) {
      const ly = stack.pop(), lx = stack.pop()
      if (lx < 0 || ly < 0 || lx >= bw || ly >= bh) continue
      const li = ly * bw + lx
      if (outside[li]) continue
      if (!isBg(x0 + lx, y0 + ly)) continue
      outside[li] = 1
      stack.push(lx + 1, ly, lx - 1, ly, lx, ly + 1, lx, ly - 1)
    }
    for (let ly = 0; ly < bh; ly++) for (let lx = 0; lx < bw; lx++) {
      const gx = x0 + lx, gy = y0 + ly
      if (!isBg(gx, gy) || outside[ly * bw + lx]) continue
      const gi = (gy * W + gx) * C
      dea[gi] = src[gi]; dea[gi + 1] = src[gi + 1]; dea[gi + 2] = src[gi + 2]; dea[gi + 3] = 255
      holesPatched++
    }
  }
  if (holesPatched) console.log(`patched ${holesPatched} dealpha false-positive pixel(s) on the player sheet`)
  const fixedSheet = await sharp(dea, { raw: { width: info.width, height: info.height, channels: C } }).png().toBuffer()

  for (const [i, b] of frames.entries()) {
    await sharp(fixedSheet).extract({ left: b.x, top: b.y, width: b.w, height: b.h })
      .png({ compressionLevel: 9 }).toFile(`${OUT}/player/f${i}.png`)
  }
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`sliced ${n} sprites -> ${OUT}`)
console.log('scenes, nature, ground, decals, npc and cutscene assets rebuilt')
