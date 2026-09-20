/**
 * The conversation overlay: a portrait, a name plate and a line of dialogue over
 * the live scene, advanced with Enter/E or a click, plus Yes/No answer buttons
 * when the script branches. Scripts themselves live in data/dialogue.ts.
 */

import { SPEAKERS, type Choice, type DialogueEnd, type DialogueNode, type DialogueScript } from './data/dialogue'

const root = document.getElementById('ui') as HTMLDivElement

const el = document.createElement('div')
el.className = 'dlg'
el.hidden = true
el.innerHTML = `
  <div class="dlg-box">
    <img class="dlg-portrait" alt="" />
    <div class="dlg-body">
      <div class="dlg-plate">
        <svg class="dlg-leaf" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 4c0 9-6 14-12 14-2 0-4-1-4-1s1-9 8-11c3-1 8-2 8-2z" fill="#7cb342"/>
          <path d="M4 20c4-6 8-9 13-12" stroke="#4a7c1f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        </svg>
        <span class="dlg-names"><span class="dlg-role"></span><span class="dlg-name"></span></span>
      </div>
      <p class="dlg-line"></p>
      <div class="dlg-choices" hidden></div>
    </div>
    <span class="dlg-next" aria-hidden="true">▼</span>
  </div>
`
root.append(el)

const box = el.querySelector('.dlg-box') as HTMLDivElement
const portraitEl = el.querySelector('.dlg-portrait') as HTMLImageElement
const plate = el.querySelector('.dlg-plate') as HTMLDivElement
const nameEl = el.querySelector('.dlg-name') as HTMLElement
const roleEl = el.querySelector('.dlg-role') as HTMLElement
const lineEl = el.querySelector('.dlg-line') as HTMLElement
const choicesEl = el.querySelector('.dlg-choices') as HTMLDivElement
const nextEl = el.querySelector('.dlg-next') as HTMLElement

let script: DialogueScript = {}
let key = 'start'
let onEnd: ((outcome: DialogueEnd | null, flags: Set<string>) => void) | null = null
/** Which answer the keyboard has highlighted; -1 when the line has no choices. */
let focused = -1
/** Every node's `flag` seen so far this conversation, handed to `onEnd` -- lets the
 * caller know which branch was taken without the script needing to touch game state. */
let flags = new Set<string>()

const node = (): DialogueNode | undefined => script[key]

function render() {
  const n = node()
  if (!n) return closeDialogue(null)
  if (n.flag) flags.add(n.flag)

  if (n.who) {
    const s = SPEAKERS[n.who]
    portraitEl.src = s.portrait
    portraitEl.hidden = false
    nameEl.textContent = s.name
    roleEl.textContent = s.role ?? ''
    roleEl.hidden = !s.role
    plate.hidden = false
    box.classList.remove('narration')
  } else {
    // Narration ("Faye walks inside the store.") gets no portrait or name plate.
    portraitEl.hidden = true
    plate.hidden = true
    box.classList.add('narration')
  }
  lineEl.textContent = n.text

  choicesEl.innerHTML = ''
  const choices = n.choices ?? []
  focused = choices.length ? 0 : -1
  for (const [i, c] of choices.entries()) {
    const b = document.createElement('button')
    b.className = 'dlg-choice'
    b.textContent = c.label
    b.onclick = (e) => { e.stopPropagation(); pick(c) }
    b.onmouseenter = () => { focused = i; paintFocus() }
    choicesEl.append(b)
  }
  choicesEl.hidden = !choices.length
  nextEl.hidden = !!choices.length
  paintFocus()
}

function paintFocus() {
  ;[...choicesEl.children].forEach((c, i) => c.classList.toggle('on', i === focused))
}

function pick(c: Choice) {
  if (c.end) return closeDialogue(c.end)
  key = c.to ?? ''
  render()
}

export const isDialogueOpen = () => !el.hidden

export function openDialogue(s: DialogueScript, done: (outcome: DialogueEnd | null, flags: Set<string>) => void) {
  script = s
  key = 'start'
  onEnd = done
  flags = new Set()
  el.hidden = false
  root.classList.add('dialogue')
  render()
}

/** Enter/E or a click: advances the line, or picks the highlighted answer. */
export function dialogueInteract() {
  if (el.hidden) return
  const n = node()
  if (!n) return closeDialogue(null)
  if (n.choices?.length) {
    const c = n.choices[focused] ?? n.choices[0]
    return pick(c)
  }
  if (n.end) return closeDialogue(n.end)
  if (!n.next) return closeDialogue(null)
  key = n.next
  render()
}

/** Moves the highlight between answers; a no-op on a line without choices. */
export function dialogueMove(delta: number) {
  const n = node()
  const count = n?.choices?.length ?? 0
  if (count < 2) return
  focused = (focused + delta + count) % count
  paintFocus()
}

/** Ends the conversation. `outcome` is null when it was skipped rather than finished. */
export function closeDialogue(outcome: DialogueEnd | null = null) {
  if (el.hidden) return
  el.hidden = true
  root.classList.remove('dialogue')
  const done = onEnd
  onEnd = null
  done?.(outcome, flags)
}

// Clicking the box advances it, the same as pressing Enter -- but clicks that land
// on an answer button are handled by that button instead.
box.addEventListener('click', () => dialogueInteract())
