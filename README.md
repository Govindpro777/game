# Village Farm

A browser farming game built with Vite + TypeScript + Canvas2D. No game engine, no backend.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| `Shift` or the RUN button | Run |
| `E` or `Enter` | Interact with whatever you're standing next to |
| `1`–`5` | Select hoe / watering can / axe / pickaxe / shovel |
| `Q` | Cycle through the seeds you own |
| `Esc` | Close a shop panel, or walk away from a conversation |

A village landmark's floating label (Home, Seed shop, Tool shop, Farm) also lights up
and becomes clickable/tappable once you're close enough — clicking it does the same
thing as pressing `E`, which is meant for touch and mouse players who'd rather click
the thing they want than remember a key.

On touch devices the on-screen stick, `E` and RUN buttons work instead. All three are
independent, fully-multitouch controls — each tracks its own finger by pointer id, so
you can hold the stick to walk toward something and tap `E` (or RUN) with another
finger without either interrupting the other.

## Display

The canvas fills the whole window at any aspect ratio — no letterboxing. Zoom is
picked per scene: it scales a ~960×600 world box to fit, then increases if needed
so the scene always covers the viewport, snapped to quarter steps to keep the
pixel art from shimmering. Wide windows therefore show a bigger picture rather
than black bars, and the HUD reflows below 620px wide.

Page gestures that a web page *can* intercept are suppressed, so they reach the
game instead of the document: pinch-zoom, ctrl+wheel zoom, two-finger drag,
overscroll, text selection, image drag and the long-press/right-click menu.

**Ctrl +/- and Ctrl+0 cannot be blocked.** Those are browser chrome shortcuts and
`preventDefault` on keydown does nothing for them outside an embedded webview.
Instead, browser zoom is made harmless: the canvas is sized entirely by CSS and the
render target is re-matched to its real measured box every frame, so the game
re-fits exactly at any zoom level with no gap or letterbox.

`#app` is `position: fixed`, which pins to the *layout* viewport — but on mobile the
*visual* viewport (what's actually on screen) can scroll or shrink independently of
it, e.g. while the address bar animates away during a touch-drag near the screen
edge, or a keyboard opens. A fixed element doesn't follow that on its own, so the
game (and the character with it) can visibly drift away from the controls. `resize()`
explicitly sizes and offsets `#app` to `window.visualViewport` on every resize/scroll
of it, which keeps the game pinned under your thumb regardless of what the browser
chrome is doing.

## The loop

Buy seeds at the market → till a plot with the hoe → plant → water →
crops grow **only while the soil is wet** → harvest → sell → upgrade tools → repeat.

Trees and rocks on the farm give wood and stone with the axe and pickaxe, and
respawn after 75 seconds. Sell them at Ted's tools. They're the income floor
that stops you softlocking with no coins and no seeds.

Progress autosaves to `localStorage`, including crop growth while the tab is closed.
"Start over" in the tool shop wipes it.

**Unlimited coins is ON by default** so everything can be tested without grinding:
purchases and upgrades succeed for free and the coin counter reads `∞`. Turn it off
under *Testing* in the tool shop to play the real economy.

The sack icon under the coin counter opens your **Inventory** — a read-only summary
of every seed, harvested crop, tool (with level) and material you're carrying. Its
badge shows a running total so you can tell at a glance whether you're holding
anything without opening it. Shop screens also show how many of each seed you
already own, right under the price, so a purchase there is never a guess.

## Scenes

- **Willowbrook village** — the hub, with floating labels over each landmark that
  light up gold when you're close enough to press `E`. **You can only walk on the
  roads** — see below. A shopkeeper stands permanently at the seed shop's gate —
  purely decorative, she doesn't move or interact.
- **Ted's tools** — buy and upgrade the five tools, sell wood and stone.
- **Seed & produce market** is two scenes, not one, neither of them a
  procedurally-built room — both are painted flat backgrounds with the walkable floor
  and solid shapes carved out by hand:
  - Walking through the village door leads to an outdoor plaza (Faye standing in it as
    a sprite), where **talking to her starts the moment you arrive** (see below).
  - Saying yes sends you on into the shop's interior (Faye painted in at the counter
    this time). Step up to the counter and press `E`/`Enter` to buy or sell; walk to
    the door mat to leave, straight back to the village.
- **Your farm** — a 6×4 plot grid, plus trees and rocks.

Every scene change — walking into a building, leaving one, resetting your save —
plays a brief cloud-wipe transition (`goto()` in `src/main.ts`). It's purely cosmetic:
input is held during the ~0.8s it takes, then resumes exactly where it left off.

## Talking to Faye

The village door doesn't lead straight into the shop — it leads to the plaza outside
it. You spawn well back from Faye, and the conversation only starts once you've
actually walked up to her or the door — not the moment the plaza loads. **Walking on
into the shop's interior is the conversation's outcome**, not something you do
yourself: she shows you in, or she doesn't.

The script she plays depends on how many times you've visited:

1. **The first time ever**, she introduces herself, points you at Ted for tools, and
   takes you in for seeds. Remembered in your save; never repeats.
2. **Every visit after that**, she asks whether you've met Ted and whether you need
   seeds today, until you've confirmed "yes, met Ted" **twice** across separate
   visits — simply walking in and out doesn't count, only that specific answer does.
3. **From then on, permanently**, she asks instead how the farm's coming along and
   whether you want more seeds — the "have you met Ted" onboarding script never
   plays again.

Every script answers with the `Yes`/`No` buttons, `←`/`→` plus `Enter`, or a tap. In
scripts 2 and 3, saying no to seeds sends her inside with a last *Enter the Seed
Store?* — answer `No` there, or escape out of any conversation early, and you're sent
straight back to the village rather than left standing alone in the plaza.

The overlay itself is `src/dialogue.ts`; the scripts it plays are data in
`src/data/dialogue.ts` (`FIRST_VISIT`, `RETURN_VISIT`, `RETURN_VISIT_STEADY`), so
rewording a line or adding a branch means editing that table, not the engine. A
node's optional `flag` is how the script tells `talkToFaye()` in `main.ts` which
branch was taken (e.g. `met_ted`'s `flag: 'metTedYes'` is what advances the counter
that eventually retires script 2) without the data file needing to import game state.

## Walking the village

Movement in the village is not bounded by hand-placed rectangles. The road network
is derived from the artwork itself by `tools/roadmask.mjs`, which classifies every
pixel: roads are warm and desaturated (red leads, then green, then blue), while
grass and trees invert that, water and sky lead blue, and roofs are too dark.

Two thresholds are used, not one. A strict test finds clean, well-lit road; a loose
test also admits road lying in shadow, but timber walls satisfy it too — so the
loose set is never used alone, only grown into from the strict set by a bounded
number of steps. A shadow across a road is a few pixels wide and gets bridged; a
wall is tens of pixels tall and cannot be climbed within the budget.

The result is cleaned up, eroded, then reduced to the single connected component
reachable from a seed point, so there is never road you can see but not reach.
`tools/maskcheck.mjs` verifies that and reports whether each landmark is still
reachable on foot:

```bash
node tools/maskcheck.mjs preview.png
```

## Crops

| Crop | Seed | Sells | Grow time (watered) |
|---|---|---|---|
| Carrot | 8 | 20 | 45s |
| Wheat | 12 | 30 | 62s |
| Tomato | 20 | 54 | 84s |
| Corn | 26 | 70 | 105s |
| Pumpkin | 34 | 98 | 132s |

Each tool has three levels. The hoe and shovel work on more plots at once,
the watering can keeps soil wet longer and covers more plots, and the axe and
pickaxe yield more per swing.

## Source layout

```
src/
  main.ts          game loop, player, camera, rendering, interaction
  scenes.ts        the four scenes: ground, decor, collision, zones
  state.ts         save/load, plots, inventory
  ui.ts            HUD and shop panels (DOM overlay, not canvas)
  dialogue.ts      the conversation overlay: portrait, name plate, answer buttons
  core/            asset loading, keyboard + touch input
  data/            crop, tool and conversation tables — tune balance and script here
```

## Assets

The source art lives in `assets/` — see [assets/README.md](assets/README.md) for what
each file is and which are still unused. Names describe the content, so
`village-map.png` is the map and `sprite-sheet.png` is the sheet.

One command rebuilds every generated file:

```bash
npm run slice
```

It keys the painted checkerboard out of the Gemini sheets, finds each sprite by
connected-component labelling, cuts and names ~60 of them, builds the scene
backgrounds, and derives the seamless ground textures. `public/` is entirely
generated — delete it and re-run.

The helper scripts it orchestrates:

- `dealpha.mjs` — flood-fills the painted checkerboard to real alpha, including
  enclosed gaps (e.g. between fence rails)
- `blobs.mjs` — connected-component labelling to find each sprite's bounding box
- `cutout.mjs` — cuts trees, rocks and flowers out of painted scenes by colour
- `annotate.mjs`, `collvis.mjs`, `reachvis.mjs`, `grid.mjs`, `sheetview.mjs` — visual
  debugging aids. `collvis.mjs` draws the village collision boxes and zones over the
  map; `reachvis.mjs` flood-fills from spawn and shades every tile the player can
  actually stand on, which is the reliable way to spot a fence or building you can
  walk through, and it reports whether each zone is still reachable

## Known gaps

- **The player only has a side-view walk cycle.** `main-character.png` is 9 frames
  of one side-view walk cycle, with no distinct front or back pose. Walking up or
  down reuses the same side frames as walking sideways, so the character is always
  shown in profile regardless of which way they're actually facing.
- **The seed shop is the tool shop with a recoloured roof.** There is only one
  building asset.
- Ground grass is generated procedurally from the sheet's own palette, because
  every grass tile in the sheet has decals baked in and tiles visibly.
