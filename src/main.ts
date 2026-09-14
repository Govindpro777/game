import { ALL, load, img, crop as cropImg, nature, ground as groundTex } from './core/assets'
import { axis, debugKeys, digitPressed, endFrame, initInput, justPressed, stick, touchRun } from './core/input'
import { CROPS, CROP_IDS } from './data/crops'
import { TOOLS, TOOL_IDS, type ToolId } from './data/tools'
import {
  FARM_ROCKS, FARM_TREES, PLOT_COLS, PLOT_ROWS, SCENES, plotRect,
  type Rect, type Scene,
} from './scenes'
import {
  isRipe, owns, power, save, stageOf, state, type Plot, type SceneId,
} from './state'
import {
  closeModal, currentSeed, initUi, modalOpen, openSeedShop, openToolShop,
  refreshHud, setMapLabels, setSeedIndex, showPrompt, toast,
} from './ui'

const VIEW = { w: 1000, h: 620 }
const PLAYER_S = 0.46
const FRAME_W = 72
const FRAME_H = 178
const REACH = 96
const RESPAWN_MS = 75_000

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

const player = {
  x: 0, y: 0,
  face: 'down' as 'down' | 'up' | 'left' | 'right',
  anim: 0,
  moving: false,
}

let scene: Scene = SCENES.world
let camX = 0
let camY = 0

const ANIM: Record<string, { idle: number; walk: number[] }> = {
  down: { idle: 4, walk: [3, 4, 0, 4] },
  up: { idle: 1, walk: [1, 2, 1, 2] },
  side: { idle: 8, walk: [5, 6, 7, 8] },
}

/* ---------------- setup ---------------- */

let canvasRect = { left: 0, top: 0, scale: 1 }

function measure() {
  const r = canvas.getBoundingClientRect()
  canvasRect = { left: r.left, top: r.top, scale: r.width / VIEW.w }
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = VIEW.w * dpr
  canvas.height = VIEW.h * dpr
  const s = Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h)
  canvas.style.width = `${VIEW.w * s}px`
  canvas.style.height = `${VIEW.h * s}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  measure()
}

function ensureResources() {
  if (state.resources.length) return
  state.resources = [
    ...FARM_TREES.map((t) => ({ kind: 'tree' as const, x: t.x, y: t.y, readyAt: 0 })),
    ...FARM_ROCKS.map((r) => ({ kind: 'rock' as const, x: r.x, y: r.y, readyAt: 0 })),
  ]
}

function goto(id: SceneId) {
  scene = SCENES[id]
  player.x = scene.spawn.x
  player.y = scene.spawn.y
  closeModal()
}

/* ---------------- collision ---------------- */

const hits = (r: Rect, x: number, y: number) =>
  x > r.x - 14 && x < r.x + r.w + 14 && y > r.y - 7 && y < r.y + r.h + 7

function blockedAt(x: number, y: number) {
  for (const r of scene.blocked) if (hits(r, x, y)) return true
  if (scene.id === 'farm') {
    for (const res of state.resources) {
      if (res.readyAt > Date.now()) continue
      if (Math.abs(res.x - x) < 34 && Math.abs(res.y - y) < 18) return true
    }
  }
  return false
}

function move(dt: number) {
  const a = axis()
  const speed = (a.run ? 305 : 185) * dt
  player.moving = a.x !== 0 || a.y !== 0

  if (Math.abs(a.x) > Math.abs(a.y)) player.face = a.x > 0 ? 'right' : 'left'
  else if (a.y !== 0) player.face = a.y > 0 ? 'down' : 'up'

  const nx = player.x + a.x * speed
  if (!blockedAt(nx, player.y)) player.x = nx
  const ny = player.y + a.y * speed
  if (!blockedAt(player.x, ny)) player.y = ny

  player.x = Math.max(24, Math.min(scene.w - 24, player.x))
  player.y = Math.max(46, Math.min(scene.h - 12, player.y))

  player.anim = player.moving ? player.anim + dt * 7.5 : 0
}

/* ---------------- interaction ---------------- */

type Target = { text: string; press: boolean; act: () => void }

const dist = (x: number, y: number) => Math.hypot(x - player.x, y - player.y)
const a = (w: string) => ('aeiou'.includes(w[0]) ? 'an ' : 'a ') + w

function plotAction(i: number): { text: string; press: boolean; run: () => void } {
  const p = state.plots[i]
  const sel = state.selected
  if (p.crop && isRipe(p)) {
    const c = CROPS[p.crop]
    return {
      text: `harvest ${c.name.toLowerCase()}`,
      press: true,
      run: () => {
        state.harvest[p.crop!] += 1
        toast(`Harvested ${c.name.toLowerCase()}`)
        p.crop = null
        p.progress = 0
        p.wetUntil = 0
        save()
      },
    }
  }
  if (p.crop) {
    const c = CROPS[p.crop]
    const pct = Math.floor((p.progress / c.growMs) * 100)
    if (sel === 'can' && owns('can')) {
      if (p.wetUntil > Date.now()) {
        return { text: `${c.name} is watered — ${pct}% grown`, press: false, run: () => {} }
      }
      return { text: 'water crop', press: true, run: () => waterAround(i) }
    }
    const dry = p.wetUntil <= Date.now()
    return {
      text: dry
        ? `${c.name} needs water — ${pct}% grown`
        : `${c.name} is growing — ${pct}%`,
      press: false,
      run: () => {},
    }
  }
  if (!p.tilled) {
    if (sel === 'hoe' && owns('hoe')) return { text: 'till soil', press: true, run: () => tillAround(i) }
    return {
      text: owns('hoe') ? 'Select the hoe to till this plot' : 'Buy a hoe at Ted’s tools to till',
      press: false,
      run: () => {},
    }
  }
  const sid = currentSeed()
  if (state.seeds[sid] > 0) {
    return {
      text: `plant ${CROPS[sid].name.toLowerCase()}`,
      press: true,
      run: () => {
        state.seeds[sid] -= 1
        p.crop = sid
        p.progress = 0
        p.wetUntil = 0
        save()
      },
    }
  }
  if (sel === 'shovel' && owns('shovel')) return { text: 'clear soil', press: true, run: () => clearAround(i) }
  return { text: 'No seeds — buy some at the seed market', press: false, run: () => {} }
}

function nearestPlots(i: number, n: number, ok: (p: Plot) => boolean) {
  const base = plotRect(i)
  return state.plots
    .map((p, idx) => ({ p, idx, d: Math.hypot(plotRect(idx).x - base.x, plotRect(idx).y - base.y) }))
    .filter((e) => ok(e.p))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
}

function tillAround(i: number) {
  const n = power('hoe', TOOLS.hoe.power)
  const list = nearestPlots(i, n, (p) => !p.tilled)
  for (const e of list) e.p.tilled = true
  toast(list.length > 1 ? `Tilled ${list.length} plots` : 'Tilled the soil')
  save()
}

const CAN_TILES = [1, 3, 5]

function waterAround(i: number) {
  const secs = power('can', TOOLS.can.power)
  const n = CAN_TILES[state.levels.can - 1] ?? 1
  const list = nearestPlots(i, n, (p) => !!p.crop && !isRipe(p))
  const until = Date.now() + secs * 1000
  for (const e of list) e.p.wetUntil = until
  toast(list.length > 1 ? `Watered ${list.length} crops` : 'Watered the crop')
  save()
}

function clearAround(i: number) {
  const n = power('shovel', TOOLS.shovel.power)
  const list = nearestPlots(i, n, (p) => p.tilled && !p.crop)
  for (const e of list) e.p.tilled = false
  toast(list.length > 1 ? `Cleared ${list.length} plots` : 'Cleared the soil')
  save()
}

function findTarget(): Target | null {
  let best: Target | null = null
  let bestD = REACH

  for (const z of scene.zones) {
    const cx = z.x + z.w / 2
    const cy = z.y + z.h / 2
    const d = dist(cx, cy)
    if (d > Math.max(z.w, z.h) / 2 + 56 || d > bestD) continue
    bestD = d
    if (z.to) {
      const to = z.to
      best = { text: `enter ${SCENES[to].name}`, press: true, act: () => goto(to) }
    } else if (z.id === 'counter') {
      const isTools = scene.id === 'toolshop'
      best = {
        text: isTools ? 'browse tools' : 'browse seeds & sell crops',
        press: true,
        act: () => (isTools ? openToolShop(update) : openSeedShop(update)),
      }
    } else if (z.id === 'home') {
      best = { text: 'rest at home (saves progress)', press: true, act: () => { save(); toast('Progress saved') } }
    }
  }

  if (scene.id === 'farm') {
    for (let i = 0; i < state.plots.length; i++) {
      const r = plotRect(i)
      const d = dist(r.x + r.w / 2, r.y + r.h / 2)
      if (d > bestD) continue
      const a = plotAction(i)
      bestD = d
      best = { text: a.text, press: a.press, act: a.run }
    }
    for (const res of state.resources) {
      if (res.readyAt > Date.now()) continue
      const d = dist(res.x, res.y)
      if (d > bestD) continue
      const isTree = res.kind === 'tree'
      const need: ToolId = isTree ? 'axe' : 'pickaxe'
      bestD = d
      if (state.selected !== need || !owns(need)) {
        const t = TOOLS[need].name.toLowerCase()
        best = {
          text: owns(need) ? `Select the ${t} to ${isTree ? 'chop' : 'break'} this ${res.kind}` : `Buy ${a(t)} at Ted’s tools`,
          press: false,
          act: () => {},
        }
      } else {
        best = {
          text: isTree ? 'chop tree' : 'break rock',
          press: true,
          act: () => {
            const amt = power(need, TOOLS[need].power)
            if (isTree) state.wood += amt
            else state.stone += amt
            res.readyAt = Date.now() + RESPAWN_MS
            toast(`+${amt} ${isTree ? 'wood' : 'stone'}`)
            save()
          },
        }
      }
    }
  }
  return best
}

/* ---------------- growth ---------------- */

function grow(dtMs: number) {
  const now = Date.now()
  let dirty = false
  for (const p of state.plots) {
    if (!p.crop || p.wetUntil <= now) continue
    const max = CROPS[p.crop].growMs
    if (p.progress >= max) continue
    p.progress = Math.min(max, p.progress + dtMs)
    dirty = true
  }
  if (dirty) save()
}

/* ---------------- render ---------------- */

type Item = { y: number; draw: () => void }

const groundCache = new Map<SceneId, HTMLCanvasElement>()

function groundOf(s: Scene) {
  let c = groundCache.get(s.id)
  if (!c) {
    c = document.createElement('canvas')
    c.width = Math.ceil(s.w)
    c.height = Math.ceil(s.h)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    s.ground(g)
    groundCache.set(s.id, c)
  }
  return c
}

function drawScene() {
  ctx.fillStyle = '#1b2416'
  ctx.fillRect(0, 0, VIEW.w, VIEW.h)

  camX = Math.round(Math.max(0, Math.min(scene.w - VIEW.w, player.x - VIEW.w / 2)))
  camY = Math.round(Math.max(0, Math.min(scene.h - VIEW.h, player.y - VIEW.h / 2)))
  if (scene.w < VIEW.w) camX = -Math.round((VIEW.w - scene.w) / 2)
  if (scene.h < VIEW.h) camY = -Math.round((VIEW.h - scene.h) / 2)

  ctx.save()
  ctx.translate(-camX, -camY)
  if (scene.cache) ctx.drawImage(groundOf(scene), 0, 0)
  else scene.ground(ctx)

  const items: Item[] = []

  if (scene.id === 'farm') {
    for (let i = 0; i < state.plots.length; i++) {
      const p = state.plots[i]
      const r = plotRect(i)
      if (!p.tilled) {
        ctx.save()
        ctx.globalAlpha = 0.16
        ctx.fillStyle = '#3b2a17'
        ctx.fillRect(r.x, r.y, r.w, r.h)
        ctx.globalAlpha = 0.4
        ctx.strokeStyle = '#2d2114'
        ctx.setLineDash([7, 7])
        ctx.lineWidth = 2
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
        ctx.restore()
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(r.x, r.y, r.w, r.h)
      ctx.clip()
      ctx.drawImage(groundTex('soil'), r.x - 3, r.y - 3, r.w + 6, r.h + 6)
      ctx.restore()
      if (p.wetUntil > Date.now()) {
        ctx.save()
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#16263f'
        ctx.fillRect(r.x, r.y, r.w, r.h)
        ctx.restore()
      }
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#241a0f'
      ctx.lineWidth = 3
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3)
      ctx.restore()

      if (p.crop) {
        const def = CROPS[p.crop]
        const st = stageOf(p)
        const sp = cropImg(def.stages[st])
        const s = def.scale * (0.6 + st * 0.14)
        items.push({
          y: r.y + r.h - 6,
          draw: () => {
            const w = sp.width * s
            const h = sp.height * s
            ctx.drawImage(sp, r.x + r.w / 2 - w / 2, r.y + r.h - 10 - h, w, h)
            if (isRipe(p)) {
              ctx.save()
              ctx.globalAlpha = 0.85
              ctx.fillStyle = '#f0cd6b'
              ctx.beginPath()
              ctx.arc(r.x + r.w - 14, r.y + 14, 5, 0, Math.PI * 2)
              ctx.fill()
              ctx.restore()
            }
          },
        })
      }
    }
    for (const res of state.resources) {
      if (res.readyAt > Date.now()) continue
      const sp = res.kind === 'tree' ? nature('tree_a') : nature('rock_a')
      const s = res.kind === 'tree' ? 0.86 : 1.5
      items.push({
        y: res.y,
        draw: () => ctx.drawImage(sp, res.x - (sp.width * s) / 2, res.y - sp.height * s, sp.width * s, sp.height * s),
      })
    }
  }

  for (const d of scene.decor) {
    const w = d.src.width * d.s
    const h = d.src.height * d.s
    items.push({ y: d.y + h, draw: () => ctx.drawImage(d.src, d.x, d.y, w, h) })
  }

  items.push({ y: player.y, draw: drawPlayer })
  items.sort((a, b) => a.y - b.y)
  for (const it of items) it.draw()

  ctx.restore()
}

function drawPlayer() {
  const set = player.face === 'left' || player.face === 'right' ? ANIM.side : ANIM[player.face]
  const idx = player.moving ? set.walk[Math.floor(player.anim) % set.walk.length] : set.idle
  const sp = img(`/sprites/player/f${idx}.png`)
  const w = FRAME_W * PLAYER_S
  const h = FRAME_H * PLAYER_S

  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(player.x, player.y - 3, w * 0.36, w * 0.17, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  if (player.face === 'left') {
    ctx.translate(player.x, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(sp, -w / 2, player.y - h, w, h)
  } else {
    ctx.drawImage(sp, player.x - w / 2, player.y - h, w, h)
  }
  ctx.restore()
}

/* ---------------- loop ---------------- */

let last = performance.now()
let target: Target | null = null

function update() {
  refreshHud(scene.name)
}

/** Floating map labels for the village hub, positioned in CSS pixels over the canvas. */
function updateLabels() {
  if (scene.id !== 'world') { setMapLabels(null); return }
  const { left, top, scale } = canvasRect
  setMapLabels(
    scene.zones.map((z) => ({
      id: z.id,
      text: z.label,
      x: left + ((z.lx ?? z.x + z.w / 2) - camX) * scale,
      y: top + ((z.ly ?? z.y) - camY) * scale - 8,
      near: dist(z.x + z.w / 2, z.y + z.h / 2) < REACH,
    })),
  )
}

function frame(now: number) {
  const dtMs = Math.min(64, now - last)
  last = now
  const dt = dtMs / 1000

  if (!modalOpen()) {
    move(dt)
    const d = digitPressed()
    if (d && d <= TOOL_IDS.length) selectTool(TOOL_IDS[d - 1])
    if (justPressed('keyq')) cycleSeed()
    target = findTarget()
    if (justPressed('keye') && target) target.act()
  } else if (justPressed('escape')) {
    closeModal()
  }

  grow(dtMs)
  drawScene()
  updateLabels()
  showPrompt(
    modalOpen() || !target ? null
      : target.press ? `Press <kbd>E</kbd> to ${target.text}` : target.text,
  )
  refreshHud(scene.name)
  endFrame()
  requestAnimationFrame(frame)
}

function selectTool(t: ToolId) {
  if (!owns(t)) { toast(`Buy the ${TOOLS[t].name.toLowerCase()} at Ted’s tools first`, true); return }
  state.selected = t
  save()
}

function cycleSeed() {
  const owned = CROP_IDS.filter((c) => state.seeds[c] > 0)
  if (!owned.length) { toast('No seeds yet — buy some at the market', true); return }
  const cur = currentSeed()
  const i = owned.indexOf(cur)
  setSeedIndex(CROP_IDS.indexOf(owned[(i + 1) % owned.length]))
}

/* ---------------- touch controls ---------------- */

function buildTouch() {
  const ui = document.getElementById('ui')!
  const pad = document.createElement('div')
  pad.className = 'stick'
  const nub = document.createElement('div')
  nub.className = 'nub'
  pad.append(nub)
  const run = document.createElement('button')
  run.className = 'runbtn'
  run.textContent = 'RUN'
  ui.append(pad, run)

  let id: number | null = null
  const R = 40
  const set = (e: PointerEvent) => {
    const b = pad.getBoundingClientRect()
    let dx = e.clientX - (b.left + b.width / 2)
    let dy = e.clientY - (b.top + b.height / 2)
    const len = Math.hypot(dx, dy) || 1
    const cl = Math.min(len, R)
    dx = (dx / len) * cl
    dy = (dy / len) * cl
    nub.style.transform = `translate(${dx}px, ${dy}px)`
    stick.x = dx / R
    stick.y = dy / R
    stick.active = true
  }
  pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(e.pointerId); set(e) })
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e) })
  const end = () => { id = null; stick.x = 0; stick.y = 0; stick.active = false; nub.style.transform = '' }
  pad.addEventListener('pointerup', end)
  pad.addEventListener('pointercancel', end)

  const toggle = () => { touchRun.on = !touchRun.on; run.classList.toggle('on', touchRun.on) }
  run.addEventListener('click', toggle)
}

/* ---------------- boot ---------------- */

async function boot() {
  resize()
  addEventListener('resize', resize)
  initInput()
  initUi({ selectTool, cycleSeed, onReset: () => { ensureResources(); goto('world') } })
  buildTouch()
  await load(ALL)
  ensureResources()
  if (state.plots.length !== PLOT_COLS * PLOT_ROWS) state.plots.length = PLOT_COLS * PLOT_ROWS
  goto('world')
  setSeedIndex(0)
  document.getElementById('boot')!.classList.add('hidden')
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__dev = {
      goto,
      player,
      state,
      scenes: SCENES,
      blockedAt,
      axis,
      debugKeys,
      warp: (x: number, y: number) => { player.x = x; player.y = y },
    }
  }
  requestAnimationFrame(frame)
}

boot()
