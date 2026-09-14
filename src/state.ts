import { CROP_IDS, CROPS, type CropId } from './data/crops'
import { TOOL_IDS, type ToolId } from './data/tools'

export type SceneId = 'world' | 'farm' | 'toolshop' | 'seedshop'

export type Plot = {
  tilled: boolean
  crop: CropId | null
  progress: number
  wetUntil: number
}

export type Resource = { kind: 'tree' | 'rock'; x: number; y: number; readyAt: number }

export type Save = {
  coins: number
  levels: Record<ToolId, number>
  selected: ToolId
  seeds: Record<CropId, number>
  harvest: Record<CropId, number>
  wood: number
  stone: number
  plots: Plot[]
  resources: Resource[]
  unlimited: boolean
  savedAt: number
}

export const PLOT_COUNT = 24
const KEY = 'village-farm-save-1'

function emptyPlots(): Plot[] {
  return Array.from({ length: PLOT_COUNT }, () => ({ tilled: false, crop: null, progress: 0, wetUntil: 0 }))
}

function zero<T extends string>(ids: readonly T[]): Record<T, number> {
  return Object.fromEntries(ids.map((i) => [i, 0])) as Record<T, number>
}

export function freshSave(): Save {
  return {
    coins: 100,
    levels: { ...zero(TOOL_IDS), hoe: 0, can: 0, axe: 0, pickaxe: 0, shovel: 0 },
    selected: 'hoe',
    seeds: zero(CROP_IDS),
    harvest: zero(CROP_IDS),
    wood: 0,
    stone: 0,
    plots: emptyPlots(),
    resources: [],
    unlimited: true,
    savedAt: Date.now(),
  }
}

export const state: Save = load()

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshSave()
    const s = { ...freshSave(), ...(JSON.parse(raw) as Save) }
    if (!Array.isArray(s.plots) || s.plots.length !== PLOT_COUNT) s.plots = emptyPlots()
    const away = Math.max(0, Date.now() - (s.savedAt || Date.now()))
    for (const p of s.plots) {
      if (!p.crop) continue
      const wet = Math.max(0, Math.min(away, p.wetUntil - s.savedAt))
      p.progress = Math.min(CROPS[p.crop].growMs, p.progress + wet)
      p.wetUntil = 0
    }
    return s
  } catch {
    return freshSave()
  }
}

let pending = 0
export function save() {
  clearTimeout(pending)
  pending = setTimeout(() => {
    state.savedAt = Date.now()
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
  }, 400) as unknown as number
}

export function reset() {
  Object.assign(state, freshSave())
  try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
}

export function owns(t: ToolId) { return state.levels[t] > 0 }
export function power(t: ToolId, table: readonly number[]) {
  return table[Math.max(0, state.levels[t] - 1)] ?? table[0]
}

export function stageOf(p: Plot): number {
  if (!p.crop) return -1
  const ratio = p.progress / CROPS[p.crop].growMs
  if (ratio >= 1) return 3
  if (ratio >= 0.62) return 2
  if (ratio >= 0.28) return 1
  return 0
}
export const isRipe = (p: Plot) => stageOf(p) === 3
