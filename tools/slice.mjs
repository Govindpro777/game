/**
 * Rebuilds everything in public/ from the source art in assets/.
 *
 *   assets/sprite-sheet.png       -> ~60 named sprites in public/sprites/
 *   assets/tool-shop-building.png -> public/scene/toolshop.png
 *   assets/game-bg.jpeg           -> public/scene/village.png + walkmask.png (roads)
 *   assets/village-map-old.png    -> the tree sprite (cut from the old painting)
 *   assets/girl-seed-shop.png     -> the seed shop's standing NPC
 *   assets/cloud.png              -> public/scene/cloud.png, the scene-transition wipe
 *   assets/close-up-seed-shop.JPG -> public/scene/seedshop-closeup.jpg -- both the intro
 *                                    cutscene's establishing shot AND the seed shop's
 *                                    own walkable background (see scenes.ts)
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
const GIRL = `${GEN}/girl-seed-shop-alpha.png`

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
  55: 'player/f0', 56: 'player/f1', 53: 'player/f2', 52: 'player/f3',
  54: 'player/f4', 57: 'player/f5', 58: 'player/f6', 59: 'player/f7', 60: 'player/f8',
}

/* 1. recover real alpha from the painted checkerboards */
mkdirSync(GEN, { recursive: true })
run(`node tools/dealpha.mjs "assets/sprite-sheet.png" "${SHEET}"`)
run(`node tools/dealpha.mjs "assets/tool-shop-building.png" "${BUILDING}"`)
run(`node tools/dealpha.mjs "assets/girl-seed-shop.png" "${GIRL}"`)

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

/* 6. seed shop NPC: the front-facing pose (top-left of the sheet), cut to its own sprite */
mkdirSync(`${OUT}/npc`, { recursive: true })
const girlBoxes = JSON.parse(run(`node tools/blobs.mjs ${GIRL} 800`).split('\n')[0])
const gb = girlBoxes[0]
await sharp(GIRL).extract({ left: gb.x, top: gb.y, width: gb.w, height: gb.h })
  .png().toFile(`${OUT}/npc/seedshop_girl.png`)

/* 7. scene-transition and cutscene assets, used as-is */
await sharp('assets/cloud.png').png().toFile('public/scene/cloud.png')
await sharp('assets/close-up-seed-shop.JPG').jpeg({ quality: 90 }).toFile('public/scene/seedshop-closeup.jpg')

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(`sliced ${n} sprites -> ${OUT}`)
console.log('scenes, nature, ground, decals, npc and cutscene assets rebuilt')
