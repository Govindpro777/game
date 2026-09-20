const cache = new Map<string, HTMLImageElement>()

export function img(path: string): HTMLImageElement {
  const hit = cache.get(path)
  if (hit) return hit
  const el = new Image()
  el.src = path
  cache.set(path, el)
  return el
}

export function load(paths: string[]): Promise<void> {
  return Promise.all(
    paths.map(
      (p) =>
        new Promise<void>((res) => {
          const el = img(p)
          if (el.complete) return res()
          el.onload = () => res()
          el.onerror = () => res()
        }),
    ),
  ).then(() => undefined)
}

export const SPRITES = {
  player: Array.from({ length: 9 }, (_, i) => `/sprites/player/f${i}.png`),
  tiles: [
    'grass_a', 'grass_b', 'grass_c', 'grass_d', 'grass_e', 'grass_f',
    'grass_rocks_a', 'grass_rocks_b', 'grass_edge', 'dirt', 'soil_rows',
    'stone_path', 'dirt_stone', 'grass_path',
  ].map((n) => `/sprites/tile/${n}.png`),
  props: [
    'well', 'crate', 'logs_big', 'logs_small', 'barrels', 'crates_produce',
    'barrel_produce', 'sacks', 'fence_post', 'fence_post_b', 'fence_post_c',
    'fence_rail', 'fence_rail_b', 'fence_gate', 'lantern', 'lantern_b', 'cart',
  ].map((n) => `/sprites/prop/${n}.png`),
  crops: [
    'carrot_1', 'carrot_2', 'carrot_3',
    'wheat_1', 'wheat_2', 'wheat_3', 'wheat_4',
    'tomato_1', 'tomato_2', 'tomato_3',
    'pumpkin_2', 'pumpkin_3',
    'corn_1', 'corn_2', 'corn_3',
  ].map((n) => `/sprites/crop/${n}.png`),
  seeds: ['carrot', 'wheat', 'tomato', 'pumpkin', 'corn'].map((n) => `/sprites/seed/${n}.png`),
  nature: ['tree_a', 'rock_a', 'rock_b'].map((n) => `/sprites/nature/${n}.png`),
  ground: ['grass', 'cobble', 'soil'].map((n) => `/sprites/ground/${n}.png`),
  decals: ['rock_a', 'rock_b', 'flower_a', 'flower_b'].map((n) => `/sprites/decal/${n}.png`),
  npc: ['seedshop_girl'].map((n) => `/sprites/npc/${n}.png`),
  portraits: ['faye', 'bao'].map((n) => `/portrait/${n}.png`),
  scenes: [
    '/scene/village.png', '/scene/toolshop.png', '/scene/seedshop-closeup.jpg', '/scene/walkmask.png',
  ],
}

export const ALL = [
  ...SPRITES.player, ...SPRITES.tiles, ...SPRITES.props,
  ...SPRITES.crops, ...SPRITES.seeds, ...SPRITES.nature,
  ...SPRITES.ground, ...SPRITES.decals, ...SPRITES.npc, ...SPRITES.portraits,
  ...SPRITES.scenes,
]

export const tile = (n: string) => img(`/sprites/tile/${n}.png`)
export const prop = (n: string) => img(`/sprites/prop/${n}.png`)
export const crop = (n: string) => img(`/sprites/crop/${n}.png`)
export const seed = (n: string) => img(`/sprites/seed/${n}.png`)
export const nature = (n: string) => img(`/sprites/nature/${n}.png`)
export const ground = (n: string) => img(`/sprites/ground/${n}.png`)
export const decal = (n: string) => img(`/sprites/decal/${n}.png`)
export const npc = (n: string) => img(`/sprites/npc/${n}.png`)
export const portrait = (n: string) => img(`/portrait/${n}.png`)
