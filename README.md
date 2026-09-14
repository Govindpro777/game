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
| `E` | Interact with whatever you're standing next to |
| `1`–`5` | Select hoe / watering can / axe / pickaxe / shovel |
| `Q` | Cycle through the seeds you own |
| `Esc` | Close a shop panel |

On touch devices the on-screen stick and RUN button work instead.

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

## Scenes

- **Willowbrook village** — the hub, with floating labels over each landmark that
  light up gold when you're close enough to press `E`.
- **Ted's tools** — buy and upgrade the five tools, sell wood and stone.
- **Seed & produce market** — buy seeds, sell your harvest.
- **Your farm** — a 6×4 plot grid, plus trees and rocks.

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
  core/            asset loading, keyboard + touch input
  data/            crop and tool tables — tune balance here
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
- `reroof.mjs` — recolours the tool shop's slate roof to terracotta for the seed shop
- `cutout.mjs` — cuts trees, rocks and flowers out of painted scenes by colour
- `annotate.mjs`, `collvis.mjs`, `grid.mjs`, `sheetview.mjs` — visual debugging aids
  (`collvis.mjs` draws the village collision boxes and zones over the map, which is
  how the walkable routes were authored)

## Known gaps

- **No back-view player sprite.** The source sheet has five front-facing frames
  and four right-profile frames; there is no view from behind. Walking "up"
  reuses the three-quarter frames, so the character faces the camera.
- **The seed shop is the tool shop with a recoloured roof.** There is only one
  building asset.
- Ground grass is generated procedurally from the sheet's own palette, because
  every grass tile in the sheet has decals baked in and tiles visibly.
