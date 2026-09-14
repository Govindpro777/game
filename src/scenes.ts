import { img, prop, ground, decal, nature } from './core/assets'
import type { SceneId } from './state'

export type Rect = { x: number; y: number; w: number; h: number }
export type Zone = Rect & {
  id: string
  label: string
  to?: SceneId
  /** Optional world-space anchor for the map label, when the walkable zone sits away from the landmark. */
  lx?: number
  ly?: number
}
export type Decor = { src: HTMLImageElement; x: number; y: number; s: number }

export type Scene = {
  id: SceneId
  name: string
  w: number
  h: number
  cache: boolean
  spawn: { x: number; y: number }
  ground: (c: CanvasRenderingContext2D) => void
  decor: Decor[]
  blocked: Rect[]
  zones: Zone[]
}

const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Mirror-tiles a texture so neighbouring cells always share an identical edge: no seams. */
function mirror(c: CanvasRenderingContext2D, im: HTMLImageElement, r: Rect, scale = 1) {
  if (!im.width) return
  const cw = im.width * scale
  const ch = im.height * scale
  c.save()
  c.beginPath()
  c.rect(r.x, r.y, r.w, r.h)
  c.clip()
  for (let j = 0; j < Math.ceil(r.h / ch); j++) {
    for (let i = 0; i < Math.ceil(r.w / cw); i++) {
      const fx = i % 2 ? -1 : 1
      const fy = j % 2 ? -1 : 1
      c.save()
      c.translate(r.x + i * cw + (fx < 0 ? cw : 0), r.y + j * ch + (fy < 0 ? ch : 0))
      c.scale(fx, fy)
      c.drawImage(im, 0, 0, cw + 0.6, ch + 0.6)
      c.restore()
    }
  }
  c.restore()
}

function scatter(c: CanvasRenderingContext2D, r: Rect, seed: number, n: number, avoid?: Rect) {
  const rand = rng(seed)
  const kinds = [
    decal('flower_a'), decal('flower_a'), decal('flower_b'), decal('flower_b'),
    decal('flower_a'), decal('rock_b'), decal('rock_a'),
  ]
  for (let i = 0; i < n; i++) {
    const im = kinds[Math.floor(rand() * kinds.length)]
    if (!im.width) continue
    const s = 0.7 + rand() * 0.7
    const x = r.x + rand() * r.w
    const y = r.y + rand() * r.h
    if (avoid && x > avoid.x - 20 && x < avoid.x + avoid.w + 20 && y > avoid.y - 20 && y < avoid.y + avoid.h + 20) continue
    c.save()
    if (rand() > 0.5) {
      c.translate(x + im.width * s, y)
      c.scale(-1, 1)
      c.drawImage(im, 0, 0, im.width * s, im.height * s)
    } else {
      c.drawImage(im, x, y, im.width * s, im.height * s)
    }
    c.restore()
  }
}

const GRASS = ['#5d6d3b', '#6a783d', '#556a3e', '#4a6242', '#71803f', '#617141', '#4f6640']
const TUFT = ['#41583a', '#7a8a46']

/** Procedural pixel grass: seamless by construction, built from the sheet's own palette. */
function grassBase(
  c: CanvasRenderingContext2D, w: number, h: number, seed: number, decals = 60, avoid?: Rect,
) {
  const r = rng(seed)
  const px = 4
  c.fillStyle = '#586a3b'
  c.fillRect(0, 0, w, h)
  const cols = Math.ceil(w / px)
  const rows = Math.ceil(h / px)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (r() > 0.62) continue
      c.fillStyle = GRASS[Math.floor(r() * GRASS.length)]
      c.fillRect(i * px, j * px, px, px)
    }
  }
  const tufts = Math.floor((w * h) / 5200)
  for (let i = 0; i < tufts; i++) {
    const x = Math.floor((r() * w) / px) * px
    const y = Math.floor((r() * h) / px) * px
    c.fillStyle = TUFT[r() > 0.35 ? 0 : 1]
    for (let k = 0; k < 4; k++) {
      c.fillRect(x + (Math.floor(r() * 5) - 2) * px, y + (Math.floor(r() * 3) - 1) * px, px, px * 2)
    }
  }
  scatter(c, { x: 0, y: 0, w, h }, seed + 31, decals, avoid)
}

/** Native sprite sizes from the slicer; collision is derived from these. */
const RAIL = { w: 122, h: 64 }
const POST = { w: 18, h: 65 }
const FENCE_BAND = 18

/** Places a run of fence rails and the matching collision strip along its base. */
function fenceRow(
  out: Decor[], solid: Rect[], x0: number, y: number, count: number, step: number, s = 0.55,
) {
  for (let i = 0; i < count; i++) {
    out.push({ src: prop(i % 2 ? 'fence_rail' : 'fence_rail_b'), x: x0 + i * step, y, s })
  }
  const base = y + RAIL.h * s
  solid.push({ x: x0, y: base - FENCE_BAND, w: (count - 1) * step + RAIL.w * s, h: FENCE_BAND })
}

/** Places a column of fence posts and one continuous collision strip down its length. */
function fenceCol(
  out: Decor[], solid: Rect[], x: number, y0: number, count: number, step: number, s = 0.5,
) {
  for (let i = 0; i < count; i++) {
    out.push({ src: prop(i % 2 ? 'fence_post' : 'fence_post_b'), x, y: y0 + i * step, s })
  }
  solid.push({ x, y: y0, w: Math.max(14, POST.w * s), h: (count - 1) * step + POST.h * s })
}

/* ---------------- world ---------------- */

const WS = 1.25
const MAP_W = 1245
const MAP_H = 798
const R = (x: number, y: number, w: number, h: number): Rect => ({ x: x * WS, y: y * WS, w: w * WS, h: h * WS })

const world: Scene = {
  id: 'world',
  name: 'Willowbrook village',
  w: MAP_W * WS,
  h: MAP_H * WS,
  cache: false,
  spawn: { x: 742 * WS, y: 648 * WS },
  ground: (c) => c.drawImage(img('/scene/village.png'), 0, 0, MAP_W * WS, MAP_H * WS),
  decor: [],
  blocked: [
    R(0, 0, 1245, 128),
    R(0, 128, 205, 312),
    R(225, 92, 372, 336),
    R(672, 172, 128, 104),
    R(788, 148, 94, 112),
    R(560, 270, 324, 252),
    R(676, 484, 198, 78),
    R(456, 446, 64, 76),
    R(0, 494, 202, 304),
    R(202, 510, 130, 288),
    R(332, 526, 118, 272),
    R(448, 594, 208, 204),
    R(826, 426, 236, 208),
    R(1070, 460, 175, 208),
    R(852, 128, 84, 172),
    R(876, 296, 122, 106),
    R(934, 398, 106, 114),
    R(960, 508, 88, 102),
    R(940, 598, 80, 62),
    R(1040, 128, 205, 332),
    R(1105, 706, 140, 92),
    R(0, 786, 1245, 12),
  ],
  zones: [
    { ...R(385, 432, 120, 62), id: 'home', label: 'Home' },
    { ...R(566, 526, 116, 60), id: 'seedshop', label: 'Seed shop', to: 'seedshop' },
    { ...R(994, 672, 106, 58), id: 'toolshop', label: 'Tool shop', to: 'toolshop' },
    { ...R(652, 640, 84, 78), id: 'farm', label: 'Farm', to: 'farm', lx: 516 * WS, ly: 598 * WS },
  ],
}

/* ---------------- shop scenes ---------------- */

const SHOP_W = 1000
const SHOP_H = 620
const BUILDING = { x: 272, y: 24, s: 0.5 }
const YARD: Rect = { x: 52, y: 386, w: 896, h: 214 }

function shopScene(
  id: 'toolshop' | 'seedshop',
  name: string,
  building: string,
  counterLabel: string,
  seed: number,
  extra: Decor[],
): Scene {
  const decor: Decor[] = [
    { src: img(building), x: BUILDING.x, y: BUILDING.y, s: BUILDING.s },
    { src: nature('tree_a'), x: 22, y: 92, s: 0.76 },
    { src: nature('tree_a'), x: 852, y: 84, s: 0.7 },
    { src: nature('tree_a'), x: 890, y: 208, s: 0.56 },
    ...extra,
  ]
  const solid: Rect[] = [
    { x: 318, y: 34, w: 358, h: 296 },
    { x: 0, y: 0, w: SHOP_W, h: 72 },
    { x: 0, y: 0, w: 20, h: SHOP_H },
    { x: SHOP_W - 20, y: 0, w: 20, h: SHOP_H },
    { x: 0, y: SHOP_H - 14, w: SHOP_W, h: 14 },
  ]
  fenceRow(decor, solid, 8, 62, 16, 64)
  fenceCol(decor, solid, 10, 96, 8, 40)
  fenceCol(decor, solid, SHOP_W - 20, 96, 8, 40)

  return {
    id,
    name,
    w: SHOP_W,
    h: SHOP_H,
    cache: true,
    spawn: { x: 500, y: 548 },
    ground: (c) => {
      grassBase(c, SHOP_W, SHOP_H, seed, 40, YARD)
      mirror(c, ground('cobble'), YARD, 1)
    },
    decor,
    blocked: solid,
    zones: [
      { x: 332, y: 342, w: 136, h: 62, id: 'counter', label: counterLabel },
      { x: 390, y: 562, w: 220, h: 46, id: 'exit', label: 'Village', to: 'world' },
    ],
  }
}

const toolshop = shopScene('toolshop', 'Ted’s tools', '/scene/toolshop.png', 'Tool counter', 7, [
  { src: prop('logs_big'), x: 82, y: 372, s: 0.46 },
  { src: prop('barrels'), x: 836, y: 352, s: 0.44 },
  { src: prop('crate'), x: 132, y: 480, s: 0.4 },
  { src: prop('sacks'), x: 828, y: 482, s: 0.42 },
  { src: prop('lantern'), x: 196, y: 296, s: 0.42 },
  { src: prop('cart'), x: 742, y: 540, s: 0.46 },
  { src: prop('logs_small'), x: 86, y: 548, s: 0.42 },
])

const seedshop = shopScene('seedshop', 'Seed & produce market', '/scene/seedshop.png', 'Market stall', 21, [
  { src: prop('crates_produce'), x: 792, y: 360, s: 0.44 },
  { src: prop('barrel_produce'), x: 118, y: 356, s: 0.46 },
  { src: prop('sacks'), x: 98, y: 486, s: 0.44 },
  { src: prop('cart'), x: 742, y: 534, s: 0.46 },
  { src: prop('lantern_b'), x: 200, y: 296, s: 0.42 },
  { src: prop('crate'), x: 836, y: 492, s: 0.4 },
])

/* ---------------- farm ---------------- */

export const PLOT_COLS = 6
export const PLOT_ROWS = 4
export const PLOT_SIZE = 104
export const PLOT_GAP = 16
export const FARM_X = 176
export const FARM_Y = 250

export function plotRect(i: number): Rect {
  const cx = i % PLOT_COLS
  const cy = Math.floor(i / PLOT_COLS)
  return {
    x: FARM_X + cx * (PLOT_SIZE + PLOT_GAP),
    y: FARM_Y + cy * (PLOT_SIZE + PLOT_GAP),
    w: PLOT_SIZE,
    h: PLOT_SIZE,
  }
}

const fieldW = PLOT_COLS * (PLOT_SIZE + PLOT_GAP) - PLOT_GAP
const fieldH = PLOT_ROWS * (PLOT_SIZE + PLOT_GAP) - PLOT_GAP
const farmW = FARM_X * 2 + fieldW
const farmH = FARM_Y + fieldH + 290

const farmDecor: Decor[] = [
  { src: prop('well'), x: 56, y: 660, s: 0.44 },
  { src: prop('barrels'), x: farmW - 150, y: 300, s: 0.46 },
  { src: prop('cart'), x: farmW - 210, y: 690, s: 0.48 },
  { src: prop('crate'), x: 66, y: 830, s: 0.4 },
  { src: prop('lantern'), x: farmW - 76, y: 540, s: 0.46 },
  { src: prop('sacks'), x: 70, y: 300, s: 0.44 },
  { src: prop('crates_produce'), x: farmW - 190, y: 848, s: 0.42 },
]
const farmBlocked: Rect[] = [
  { x: 0, y: 0, w: farmW, h: 160 },
  { x: 0, y: 0, w: 14, h: farmH },
  { x: farmW - 14, y: 0, w: 14, h: farmH },
  { x: 0, y: farmH - 14, w: farmW, h: 14 },
]
fenceRow(farmDecor, farmBlocked, 24, 176, 17, 64)
fenceRow(farmDecor, farmBlocked, 24, farmH - 74, 6, 64)
fenceRow(farmDecor, farmBlocked, farmW - 408, farmH - 74, 6, 64)
fenceCol(farmDecor, farmBlocked, 14, 212, 10, 68)
fenceCol(farmDecor, farmBlocked, farmW - 28, 212, 10, 68)

export const FARM_TREES = [
  { x: 92, y: 424 },
  { x: 96, y: 572 },
  { x: farmW - 96, y: 212 },
]
export const FARM_ROCKS = [
  { x: 210, y: 858 },
  { x: 386, y: 876 },
  { x: farmW - 300, y: 862 },
]

const farm: Scene = {
  id: 'farm',
  name: 'Your farm',
  w: farmW,
  h: farmH,
  cache: true,
  spawn: { x: farmW / 2, y: farmH - 150 },
  ground: (c) => {
    grassBase(c, farmW, farmH, 3, 58, {
      x: FARM_X - 40, y: FARM_Y - 40, w: fieldW + 80, h: fieldH + 80,
    })
  },
  decor: farmDecor,
  blocked: farmBlocked,
  zones: [
    { x: farmW / 2 - 110, y: farmH - 96, w: 220, h: 56, id: 'exit', label: 'Village', to: 'world' },
  ],
}

export const SCENES: Record<SceneId, Scene> = { world, farm, toolshop, seedshop }
