export type CropId = 'carrot' | 'wheat' | 'tomato' | 'corn' | 'pumpkin'

export type CropDef = {
  id: CropId
  name: string
  seedPrice: number
  sellPrice: number
  growMs: number
  stages: string[]
  scale: number
}

export const CROPS: Record<CropId, CropDef> = {
  carrot: {
    id: 'carrot', name: 'Carrot', seedPrice: 8, sellPrice: 20, growMs: 45_000,
    stages: ['carrot_1', 'carrot_1', 'carrot_2', 'carrot_3'], scale: 0.54,
  },
  wheat: {
    id: 'wheat', name: 'Wheat', seedPrice: 12, sellPrice: 30, growMs: 62_000,
    stages: ['wheat_1', 'wheat_2', 'wheat_3', 'wheat_4'], scale: 0.56,
  },
  tomato: {
    id: 'tomato', name: 'Tomato', seedPrice: 20, sellPrice: 54, growMs: 84_000,
    stages: ['carrot_1', 'tomato_1', 'tomato_2', 'tomato_3'], scale: 0.5,
  },
  corn: {
    id: 'corn', name: 'Corn', seedPrice: 26, sellPrice: 70, growMs: 105_000,
    stages: ['carrot_1', 'corn_1', 'corn_2', 'corn_3'], scale: 0.46,
  },
  pumpkin: {
    id: 'pumpkin', name: 'Pumpkin', seedPrice: 34, sellPrice: 98, growMs: 132_000,
    stages: ['carrot_1', 'carrot_2', 'pumpkin_2', 'pumpkin_3'], scale: 0.46,
  },
}

export const CROP_IDS = Object.keys(CROPS) as CropId[]
