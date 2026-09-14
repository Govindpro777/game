export type ToolId = 'hoe' | 'can' | 'axe' | 'pickaxe' | 'shovel'

export type ToolDef = {
  id: ToolId
  name: string
  short: string
  verb: string
  prices: [number, number, number]
  tiers: string[]
  power: [number, number, number]
  powerLabel: (p: number) => string
}

export const TOOLS: Record<ToolId, ToolDef> = {
  hoe: {
    id: 'hoe', name: 'Hoe', short: 'Hoe', verb: 'Till soil',
    prices: [60, 150, 340], tiers: ['Basic hoe', 'Iron hoe', 'Advanced hoe'],
    power: [1, 3, 5], powerLabel: (p) => `tills ${p} plot${p > 1 ? 's' : ''} at once`,
  },
  can: {
    id: 'can', name: 'Watering can', short: 'Can', verb: 'Water crops',
    prices: [50, 130, 300], tiers: ['Basic can', 'Iron can', 'Advanced can'],
    power: [25, 45, 75], powerLabel: (p) => `keeps soil wet ${p}s`,
  },
  axe: {
    id: 'axe', name: 'Axe', short: 'Axe', verb: 'Chop trees',
    prices: [80, 190, 420], tiers: ['Basic axe', 'Iron axe', 'Advanced axe'],
    power: [1, 2, 4], powerLabel: (p) => `${p} wood per tree`,
  },
  pickaxe: {
    id: 'pickaxe', name: 'Pickaxe', short: 'Pick', verb: 'Break rocks',
    prices: [95, 220, 480], tiers: ['Basic pickaxe', 'Iron pickaxe', 'Advanced pickaxe'],
    power: [1, 2, 4], powerLabel: (p) => `${p} stone per rock`,
  },
  shovel: {
    id: 'shovel', name: 'Shovel', short: 'Shovel', verb: 'Clear soil',
    prices: [40, 100, 220], tiers: ['Basic shovel', 'Iron shovel', 'Advanced shovel'],
    power: [1, 3, 5], powerLabel: (p) => `clears ${p} plot${p > 1 ? 's' : ''} at once`,
  },
}

export const TOOL_IDS: ToolId[] = ['hoe', 'can', 'axe', 'pickaxe', 'shovel']

export const WOOD_PRICE = 9
export const STONE_PRICE = 13
