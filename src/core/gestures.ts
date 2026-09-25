/**
 * Camera gestures on the game canvas: one pointer drags the map, two pinch-zoom
 * around their midpoint, and the mouse wheel (or a trackpad pinch, which browsers
 * report as ctrl+wheel) zooms around the cursor. Reports screen-space deltas only;
 * main.ts owns the camera and decides what they mean in world space.
 *
 * The joystick and buttons are separate elements that capture their own pointers,
 * so a thumb on the stick never reaches here -- a second finger on the map still
 * pans while the first one walks.
 */

export type GestureHandlers = {
  /** First pointer went down on the map. */
  start: () => void
  /** Screen-pixel movement of the gesture's midpoint since the last event. */
  pan: (dx: number, dy: number) => void
  /** Zoom by `factor` (>1 = in) about screen point (x, y). */
  zoom: (factor: number, x: number, y: number) => void
  /** Last pointer lifted; release velocity in screen px/s, for a fling. */
  end: (vx: number, vy: number) => void
}

type Point = { x: number; y: number }

/** A release this long after the last movement is a deliberate stop, not a fling. */
const FLING_STALE_MS = 80

export function initGestures(el: HTMLElement, h: GestureHandlers) {
  const pts = new Map<number, Point>()
  let last: { x: number; y: number; d: number } | null = null
  let vx = 0
  let vy = 0
  let lastT = 0

  const local = (e: PointerEvent | WheelEvent): Point => {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  /** Midpoint of every pointer down, and the spread between the first two. */
  const sample = () => {
    const list = [...pts.values()]
    let x = 0
    let y = 0
    for (const p of list) { x += p.x; y += p.y }
    x /= list.length
    y /= list.length
    const d = list.length >= 2 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0
    return { x, y, d }
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Throws if the pointer's already gone (e.g. a very fast tap) -- not worth losing the gesture over.
    try { el.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    if (!pts.size) h.start()
    pts.set(e.pointerId, local(e))
    // Rebaseline whenever the finger count changes, or the midpoint jumps.
    last = sample()
    vx = 0
    vy = 0
    lastT = performance.now()
  })

  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return
    pts.set(e.pointerId, local(e))
    const cur = sample()
    if (last) {
      const dx = cur.x - last.x
      const dy = cur.y - last.y
      if (dx || dy) h.pan(dx, dy)
      if (cur.d && last.d) h.zoom(cur.d / last.d, cur.x, cur.y)
      const now = performance.now()
      const span = Math.max(1, now - lastT)
      vx = vx * 0.6 + ((dx / span) * 1000) * 0.4
      vy = vy * 0.6 + ((dy / span) * 1000) * 0.4
      lastT = now
    }
    last = cur
  })

  const up = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return
    if (pts.size) {
      // One finger of a pinch lifted: carry on panning from the one left, no jump.
      last = sample()
      vx = 0
      vy = 0
      return
    }
    const stale = performance.now() - lastT > FLING_STALE_MS
    h.end(stale ? 0 : vx, stale ? 0 : vy)
    last = null
  }
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)

  el.addEventListener('wheel', (e) => {
    e.preventDefault()
    const p = local(e)
    // Trackpad pinches arrive as small ctrl+wheel deltas; mouse wheels as ~100 a notch.
    h.zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y)
  }, { passive: false })
}
