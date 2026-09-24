export type Axis = { x: number; y: number; run: boolean }

const keys = new Set<string>()
const pressed = new Set<string>()
export const stick = { x: 0, y: 0, active: false }
export const touchRun = { on: false }

const MOVE: Record<string, [number, number]> = {
  keyw: [0, -1], arrowup: [0, -1],
  keys: [0, 1], arrowdown: [0, 1],
  keya: [-1, 0], arrowleft: [-1, 0],
  keyd: [1, 0], arrowright: [1, 0],
}

function clearKeys() {
  keys.clear()
}

export function initInput() {
  addEventListener('keydown', (e) => {
    const k = e.code.toLowerCase()
    if (
      k in MOVE || k === 'keye' || k === 'enter' || k === 'numpadenter' ||
      k === 'space' || k === 'shiftleft' || /^digit[1-9]$/.test(k)
    ) e.preventDefault()
    if (!keys.has(k)) pressed.add(k)
    keys.add(k)
  })
  addEventListener('keyup', (e) => {
    const k = e.code.toLowerCase()
    keys.delete(k)
  })
  addEventListener('blur', clearKeys)
  // Covers focus being silently stolen and returned (e.g. a screen-recorder
  // start/stop hotkey), which can eat the keyup blur alone would catch.
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys() })
}

export function axis(): Axis {
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
/** `E` and `Enter` (either the main key or numpad) are equivalent everywhere. */
export function interactPressed() {
  return pressed.has('keye') || pressed.has('enter') || pressed.has('numpadenter')
}
export function debugKeys() { return { keys: [...keys], pressed: [...pressed] } }
export function endFrame() { pressed.clear() }
export function digitPressed(): number | null {
  for (let i = 1; i <= 9; i++) if (pressed.has('digit' + i)) return i
  return null
}
