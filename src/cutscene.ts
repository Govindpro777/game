/**
 * A one-shot, full-screen intro sequence: a close-up establishing image, then a
 * short back-and-forth dialogue, advanced one step at a time with E/Enter (or a
 * tap on the dialogue box, for touch). Currently only used for the seed shop's
 * first-visit introduction, but written generically in case another building
 * wants one later.
 */

export type Step =
  | { kind: 'image'; src: string }
  | { kind: 'line'; speaker: string; portrait: string; text: string }

const root = document.getElementById('ui') as HTMLDivElement

const el = document.createElement('div')
el.className = 'cutscene'
el.hidden = true
el.innerHTML = `
  <div class="cs-image"></div>
  <div class="cs-box" hidden>
    <img class="cs-portrait" alt="" />
    <div class="cs-text"><b class="cs-speaker"></b><p class="cs-line"></p></div>
  </div>
  <div class="panel prompt cs-hint">Press <kbd>Enter</kbd> to continue</div>
`
root.append(el)

const image = el.querySelector('.cs-image') as HTMLDivElement
const box = el.querySelector('.cs-box') as HTMLDivElement
const portrait = el.querySelector('.cs-portrait') as HTMLImageElement
const speakerEl = el.querySelector('.cs-speaker') as HTMLElement
const lineEl = el.querySelector('.cs-line') as HTMLElement

let steps: Step[] = []
let i = 0
let onDone: (() => void) | null = null

function render() {
  const step = steps[i]
  if (!step) return
  if (step.kind === 'image') {
    image.style.backgroundImage = `url(${step.src})`
    box.hidden = true
  } else {
    portrait.src = step.portrait
    speakerEl.textContent = step.speaker
    lineEl.textContent = step.text
    box.hidden = false
  }
}

export function isCutsceneOpen() {
  return !el.hidden
}

export function openCutscene(seq: Step[], done: () => void) {
  steps = seq
  i = 0
  onDone = done
  el.hidden = false
  render()
}

/** Advances one step, or ends the sequence on the last one. Safe to call when closed. */
export function advanceCutscene() {
  if (el.hidden) return
  i += 1
  if (i >= steps.length) {
    closeCutscene()
    return
  }
  render()
}

/** Ends the sequence immediately without necessarily finishing it (e.g. Escape). */
export function closeCutscene() {
  if (el.hidden) return
  el.hidden = true
  const done = onDone
  onDone = null
  done?.()
}

el.addEventListener('click', advanceCutscene)
