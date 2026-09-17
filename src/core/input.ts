export type Axis = { x: number; y: number; run: boolean }

const keys = new Set<string>()
const pressed = new Set<string>()
/** Timestamp (ms) each key's last keydown was seen, so a dropped keyup can't stick a key forever. */
const lastSeen = new Map<string, number>()
export const stick = { x: 0, y: 0, active: false }
export const touchRun = { on: false }

const MOVE: Record<string, [number, number]> = {
  keyw: [0, -1], arrowup: [0, -1],
  keys: [0, 1], arrowdown: [0, 1],
  keya: [-1, 0], arrowleft: [-1, 0],
  keyd: [1, 0], arrowright: [1, 0],
}

/**
 * A genuinely held key re-fires 'keydown' via OS auto-repeat well under a second,
 * even at the slowest repeat-rate setting. If a key sits in `keys` for longer than
 * this with no fresh keydown, its keyup was almost certainly lost -- e.g. focus
 * silently stolen and returned by a screen-recorder hotkey, or a modifier
 * combo eating the keyup -- and the direction it's stuck contributing (fighting
 * whatever the player is actually pressing now, which is what makes movement look
 * like it randomly flips facing) is discarded rather than left stuck indefinitely.
 */
const STALE_MS = 1200

function clearKeys() {
  keys.clear()
  lastSeen.clear()
}

export function initInput() {
  addEventListener('keydown', (e) => {
    const k = e.code.toLowerCase()
    if (k in MOVE || k === 'keye' || k === 'space' || k === 'shiftleft' || /^digit[1-9]$/.test(k)) e.preventDefault()
    if (!keys.has(k)) pressed.add(k)
    keys.add(k)
    lastSeen.set(k, performance.now())
  })
  addEventListener('keyup', (e) => {
    const k = e.code.toLowerCase()
    keys.delete(k)
    lastSeen.delete(k)
  })
  addEventListener('blur', clearKeys)
  // Covers focus being silently stolen and returned (e.g. a screen-recorder
  // start/stop hotkey), which can eat the keyup blur alone would catch.
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys() })
}

export function axis(): Axis {
  const now = performance.now()
  for (const k of keys) {
    const seen = lastSeen.get(k)
    if (seen !== undefined && now - seen > STALE_MS) {
      keys.delete(k)
      lastSeen.delete(k)
    }
  }

  let x = 0, y = 0
  for (const k of keys) {
    const m = MOVE[k]
    if (m) { x += m[0]; y += m[1] }
  }
  if (stick.active) { x += stick.x; y += stick.y }
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return { x, y, run: keys.has('shiftleft') || keys.has('shiftright') || touchRun.on }
}

export function justPressed(code: string) { return pressed.has(code) }
export function debugKeys() { return { keys: [...keys], pressed: [...pressed] } }
export function endFrame() { pressed.clear() }
export function digitPressed(): number | null {
  for (let i = 1; i <= 9; i++) if (pressed.has('digit' + i)) return i
  return null
}
