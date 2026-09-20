import { isDialogueOpen } from './dialogue'
import { CROPS, CROP_IDS, type CropId } from './data/crops'
import { STONE_PRICE, TOOLS, TOOL_IDS, WOOD_PRICE, type ToolId } from './data/tools'
import { state, save, reset } from './state'

const root = document.getElementById('ui') as HTMLDivElement

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

const coins = el('div', 'panel coins', '<span class="coin-dot"></span><span id="coin-n">0</span>')
const place = el('div', 'panel place', '')
const hotbar = el('div', 'panel hotbar')
const bagBtn = el('button', 'panel bagbtn', '<img src="/sprites/prop/sacks.png" alt="Inventory" /><span class="badge"></span>')
const prompt = el('div', 'panel prompt')
const toastEl = el('div', 'panel toast')
const hint = el('div', 'hint')
const labelLayer = el('div', 'labels')
prompt.style.display = 'none'
toastEl.style.display = 'none'
bagBtn.onclick = () => { if (!modalOpen() && !isDialogueOpen()) openInventory() }
root.append(labelLayer, place, coins, hint, prompt, hotbar, bagBtn, toastEl)

export const canAfford = (price: number) => state.unlimited || state.coins >= price
export const pay = (price: number) => { if (!state.unlimited) state.coins -= price }
const purse = () => (state.unlimited ? 'Unlimited coins (test mode)' : `You have ${state.coins} coins`)

export type MapLabel = {
  id: string
  text: string
  x: number
  y: number
  near: boolean
  /** Present only while `near` — clicking/tapping the label then does the same thing as E. */
  onClick?: () => void
}
const labelEls = new Map<string, HTMLElement>()

export function setMapLabels(items: MapLabel[] | null) {
  if (!items) {
    if (labelEls.size) { labelEls.forEach((e) => e.remove()); labelEls.clear() }
    return
  }
  const seen = new Set<string>()
  for (const it of items) {
    seen.add(it.id)
    let e = labelEls.get(it.id)
    if (!e) {
      e = el('div', 'maplabel')
      labelLayer.append(e)
      labelEls.set(it.id, e)
    }
    if (e.textContent !== it.text) e.textContent = it.text
    const cls = it.near ? 'maplabel near' : 'maplabel'
    if (e.className !== cls) e.className = cls
    e.style.transform = `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px) translate(-50%, -100%)`
    e.onclick = it.onClick ?? null
  }
  for (const [id, e] of labelEls) if (!seen.has(id)) { e.remove(); labelEls.delete(id) }
}

export type UiHooks = {
  selectTool: (t: ToolId) => void
  cycleSeed: () => void
  onReset: () => void
}
let hooks: UiHooks

export let seedIndex = 0
export function setSeedIndex(i: number) { seedIndex = i }
export function currentSeed(): CropId { return CROP_IDS[seedIndex] }

export function initUi(h: UiHooks) {
  hooks = h
  buildHotbar()
  hint.innerHTML = 'WASD / arrows to move &middot; <b>E</b> or <b>Enter</b> to interact<br>1&ndash;5 pick a tool &middot; <b>Q</b> cycles seeds'
  setTimeout(() => hint.remove(), 14_000)
}

function buildHotbar() {
  hotbar.innerHTML = ''
  TOOL_IDS.forEach((id, i) => {
    const d = TOOLS[id]
    const s = el('div', 'slot')
    s.innerHTML = `<b>${d.short}</b><i>${i + 1}</i>`
    s.onclick = () => hooks.selectTool(id)
    hotbar.append(s)
  })
  const s = el('div', 'slot')
  s.id = 'seed-slot'
  s.innerHTML = '<b>Seed</b><i>Q</i>'
  s.onclick = () => hooks.cycleSeed()
  hotbar.append(s)
}

export function refreshHud(sceneName: string) {
  ;(document.getElementById('coin-n') as HTMLElement).textContent = state.unlimited ? '∞' : String(state.coins)
  coins.className = 'panel coins' + (state.unlimited ? ' inf' : '')
  place.textContent = sceneName

  const slots = hotbar.children
  TOOL_IDS.forEach((id, i) => {
    const s = slots[i] as HTMLElement
    const lv = state.levels[id]
    s.className = 'slot' + (state.selected === id ? ' on' : '') + (lv === 0 ? ' locked' : '')
    s.innerHTML = `<b>${TOOLS[id].short}</b><i>${lv > 0 ? 'Lv ' + lv : i + 1}</i>`
  })
  const ss = slots[TOOL_IDS.length] as HTMLElement
  const cid = currentSeed()
  const n = state.seeds[cid]
  ss.className = 'slot' + (n > 0 ? '' : ' locked')
  ss.innerHTML = `<b>${CROPS[cid].name.slice(0, 6)}</b><i>${n} left</i>`

  const held = CROP_IDS.reduce((n, id) => n + state.seeds[id] + state.harvest[id], 0) + state.wood + state.stone
  ;(bagBtn.querySelector('.badge') as HTMLElement).textContent = held > 0 ? String(held) : ''
}

export function showPrompt(text: string | null) {
  if (!text) { prompt.style.display = 'none'; return }
  prompt.style.display = ''
  prompt.innerHTML = text
}

let toastT = 0
export function toast(msg: string, bad = false) {
  toastEl.className = 'panel toast' + (bad ? ' bad' : '')
  toastEl.textContent = msg
  toastEl.style.display = ''
  toastEl.style.opacity = '1'
  clearTimeout(toastT)
  toastT = setTimeout(() => {
    toastEl.style.opacity = '0'
    setTimeout(() => (toastEl.style.display = 'none'), 260)
  }, 1600) as unknown as number
}

/* ---------------- modals ---------------- */

let modal: HTMLElement | null = null
export const modalOpen = () => modal !== null

export function closeModal() {
  modal?.remove()
  modal = null
}

function openModal(title: string, sub: string, build: (body: HTMLElement) => void) {
  closeModal()
  const bg = el('div', 'modal-bg')
  const box = el('div', 'modal')
  const head = el('header')
  head.innerHTML = `<div><h2>${title}</h2><div class="sub">${sub}</div></div>`
  const x = el('button', 'x', '&times;')
  x.onclick = closeModal
  head.append(x)
  const body = el('div', 'body')
  build(body)
  box.append(head, body)
  bg.append(box)
  bg.onclick = (e) => { if (e.target === bg) closeModal() }
  root.append(bg)
  modal = bg
}

function itemRow(opts: {
  name: string
  desc: string
  icon?: string
  /** Small line under the description, e.g. "You have 4" -- keeps a purchase meaningful at a glance. */
  qty?: string
  buttons: { label: string; disabled?: boolean; onClick: () => void }[]
}) {
  const it = el('div', 'item')
  if (opts.icon) {
    const im = el('img')
    im.src = opts.icon
    it.append(im)
  }
  const qtyHtml = opts.qty ? `<span class="qty">${opts.qty}</span>` : ''
  it.append(el('div', 'info', `<div class="nm">${opts.name}</div><div class="ds">${opts.desc}</div>${qtyHtml}`))
  const wrap = el('div')
  for (const b of opts.buttons) {
    const btn = el('button', undefined, b.label)
    btn.disabled = !!b.disabled
    // Buy/sell/upgrade handlers rebuild the whole modal synchronously, which would
    // destroy this button before the animation ever got a frame to paint -- so the
    // real action is deferred just long enough (well under noticeable lag) for the
    // punch-and-flash to actually be seen first.
    btn.onclick = () => {
      if (btn.disabled) return
      btn.classList.add('pop')
      btn.disabled = true
      setTimeout(() => b.onClick(), 120)
    }
    wrap.append(btn)
  }
  it.append(wrap)
  return it
}

/** Read-only summary of everything the player owns: seeds, harvest, tools, materials. */
export function openInventory() {
  openModal('Inventory', purse(), (body) => {
    body.append(el('div', 'sec', 'Seeds'))
    const seeds = CROP_IDS.filter((id) => state.seeds[id] > 0)
    if (!seeds.length) {
      body.append(el('div', 'item', '<div class="info"><div class="ds">No seeds yet — buy some at the seed market.</div></div>'))
    }
    for (const id of seeds) {
      const c = CROPS[id]
      body.append(itemRow({
        name: `${c.name} seed × ${state.seeds[id]}`,
        icon: `/sprites/seed/${id}.png`,
        desc: `${c.seedPrice} coins to buy more · grows in ${Math.round(c.growMs / 1000)}s`,
        buttons: [],
      }))
    }

    body.append(el('div', 'sec', 'Harvest'))
    const harvest = CROP_IDS.filter((id) => state.harvest[id] > 0)
    if (!harvest.length) {
      body.append(el('div', 'item', '<div class="info"><div class="ds">Nothing harvested yet.</div></div>'))
    }
    for (const id of harvest) {
      const c = CROPS[id]
      body.append(itemRow({
        name: `${c.name} × ${state.harvest[id]}`,
        icon: `/sprites/crop/${c.stages[3]}.png`,
        desc: `Sells for ${c.sellPrice} each · ${state.harvest[id] * c.sellPrice} total at the market`,
        buttons: [],
      }))
    }

    body.append(el('div', 'sec', 'Tools'))
    for (const id of TOOL_IDS) {
      const d = TOOLS[id]
      const lv = state.levels[id]
      body.append(itemRow({
        name: d.name,
        desc: lv === 0 ? 'Not bought yet — visit Ted’s tools' : `${d.tiers[lv - 1]} — ${d.powerLabel(d.power[lv - 1])}`,
        qty: lv > 0 ? `Level ${lv} of 3` : undefined,
        buttons: [],
      }))
    }

    body.append(el('div', 'sec', 'Materials'))
    if (state.wood === 0 && state.stone === 0) {
      body.append(el('div', 'item', '<div class="info"><div class="ds">No wood or stone yet — chop trees or break rocks on the farm.</div></div>'))
    }
    if (state.wood > 0) {
      body.append(itemRow({ name: `Wood × ${state.wood}`, desc: `${WOOD_PRICE} coins each at Ted’s tools`, buttons: [] }))
    }
    if (state.stone > 0) {
      body.append(itemRow({ name: `Stone × ${state.stone}`, desc: `${STONE_PRICE} coins each at Ted’s tools`, buttons: [] }))
    }
  })
}

export function openToolShop(after: () => void) {
  const rebuild = () => openToolShop(after)
  openModal('Ted’s tools', purse(), (body) => {
    body.append(el('div', 'sec', 'Tools'))
    for (const id of TOOL_IDS) {
      const d = TOOLS[id]
      const lv = state.levels[id]
      const next = lv
      const maxed = lv >= 3
      const price = maxed ? 0 : d.prices[next]
      const label = lv === 0 ? `Buy · ${price}` : maxed ? 'Maxed' : `Upgrade · ${price}`
      const cur = lv === 0 ? d.verb : `${d.tiers[lv - 1]} — ${d.powerLabel(d.power[lv - 1])}`
      body.append(
        itemRow({
          name: d.name + (lv ? ` · Lv ${lv}` : ''),
          desc: cur,
          buttons: [{
            label,
            disabled: maxed || !canAfford(price),
            onClick: () => {
              if (!canAfford(price)) return toast('Not enough coins', true)
              pay(price)
              state.levels[id] = lv + 1
              if (lv === 0) state.selected = id
              save()
              toast(lv === 0 ? `Bought ${d.name}` : `${d.name} upgraded to Lv ${lv + 1}`)
              after()
              rebuild()
            },
          }],
        }),
      )
    }
    body.append(el('div', 'sec', 'Sell materials'))
    body.append(itemRow({
      name: 'Wood',
      desc: `${state.wood} in bag · ${WOOD_PRICE} coins each`,
      buttons: [{
        label: 'Sell all',
        disabled: state.wood === 0,
        onClick: () => {
          state.coins += state.wood * WOOD_PRICE
          toast(`Sold ${state.wood} wood`)
          state.wood = 0
          save(); after(); rebuild()
        },
      }],
    }))
    body.append(itemRow({
      name: 'Stone',
      desc: `${state.stone} in bag · ${STONE_PRICE} coins each`,
      buttons: [{
        label: 'Sell all',
        disabled: state.stone === 0,
        onClick: () => {
          state.coins += state.stone * STONE_PRICE
          toast(`Sold ${state.stone} stone`)
          state.stone = 0
          save(); after(); rebuild()
        },
      }],
    }))
    body.append(el('div', 'sec', 'Testing'))
    body.append(itemRow({
      name: 'Unlimited coins',
      desc: state.unlimited
        ? 'On — everything is free, nothing is deducted'
        : 'Off — normal economy, purchases cost coins',
      buttons: [{
        label: state.unlimited ? 'Turn off' : 'Turn on',
        onClick: () => {
          state.unlimited = !state.unlimited
          if (!state.unlimited && state.coins < 100) state.coins = 100
          save(); toast(state.unlimited ? 'Unlimited coins on' : 'Unlimited coins off')
          after(); rebuild()
        },
      }],
    }))
    body.append(el('div', 'sec', 'Save'))
    body.append(itemRow({
      name: 'Start over',
      desc: 'Wipes coins, tools, crops and saved progress',
      buttons: [{ label: 'Reset', onClick: () => { reset(); closeModal(); hooks.onReset(); after() } }],
    }))
  })
}

export function openSeedShop(after: () => void) {
  const rebuild = () => openSeedShop(after)
  openModal('Seed & produce market', purse(), (body) => {
    body.append(el('div', 'sec', 'Buy seeds'))
    for (const id of CROP_IDS) {
      const c = CROPS[id]
      body.append(itemRow({
        name: c.name,
        icon: `/sprites/seed/${id}.png`,
        desc: `${c.seedPrice} coins · grows in ${Math.round(c.growMs / 1000)}s · sells for ${c.sellPrice}`,
        qty: `You have ${state.seeds[id]} seed${state.seeds[id] === 1 ? '' : 's'}`,
        buttons: [
          {
            label: 'Buy 1',
            disabled: !canAfford(c.seedPrice),
            onClick: () => { buySeed(id, 1); after(); rebuild() },
          },
          {
            label: 'Buy 5',
            disabled: !canAfford(c.seedPrice * 5),
            onClick: () => { buySeed(id, 5); after(); rebuild() },
          },
        ],
      }))
    }
    body.append(el('div', 'sec', 'Sell harvest'))
    const any = CROP_IDS.some((id) => state.harvest[id] > 0)
    if (!any) {
      body.append(el('div', 'item', '<div class="info"><div class="ds">Your basket is empty. Harvest some crops first.</div></div>'))
    }
    for (const id of CROP_IDS) {
      const n = state.harvest[id]
      if (n === 0) continue
      const c = CROPS[id]
      body.append(itemRow({
        name: `${c.name} × ${n}`,
        icon: `/sprites/crop/${c.stages[3]}.png`,
        desc: `${c.sellPrice} coins each · ${n * c.sellPrice} total`,
        buttons: [{
          label: `Sell all · ${n * c.sellPrice}`,
          onClick: () => {
            state.coins += n * c.sellPrice
            state.harvest[id] = 0
            save()
            toast(`Sold ${n} ${c.name.toLowerCase()} for ${n * c.sellPrice}`)
            after(); rebuild()
          },
        }],
      }))
    }
  })
}

function buySeed(id: CropId, n: number) {
  const cost = CROPS[id].seedPrice * n
  if (!canAfford(cost)) return toast('Not enough coins', true)
  pay(cost)
  state.seeds[id] += n
  setSeedIndex(CROP_IDS.indexOf(id))
  save()
  toast(`Bought ${n} ${CROPS[id].name.toLowerCase()} seed${n > 1 ? 's' : ''}`)
}
