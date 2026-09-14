# Source art

Everything in `public/` is generated from these files. Run `npm run slice` from the
project root to rebuild it all; nothing here is edited by the game.

## In use

| File | What it is | Where it ends up |
|---|---|---|
| `village-map.png` | The wide village map, 1281×816 with letterbox bars | World background (bars trimmed to 1245×798) |
| `sprite-sheet.png` | Ground tiles, props, 5 crops × growth stages, 9 player frames | ~60 sprites under `public/sprites/` |
| `tool-shop-building.png` | The isolated shop building | Tool shop scene, and recoloured red for the seed shop |
| `village-map-old.png` | The previous, darker village painting | Still the source for the tree sprite and the cobble ground texture |

## Not used yet

| File | What it is | Why it's unused |
|---|---|---|
| `seed-shop-interior.png` | A walkable isometric shop room with a shopkeeper | Has a game UI painted into it (title chip, coin counter, joystick, run button) that would need removing first |
| `tool-shop-interior.jpg` | A shop-UI mockup: inventory grid, stock list, repair/upgrade | Front-facing perspective, so a player sprite has no floor to stand on. Better used as artwork behind the shop panel, or as a design target for reskinning it |

## Reference only

| File | What it is |
|---|---|
| `ref-village-street.jpg` | "Ted's Tools" street scene — style and mood reference |
| `ref-contact-sheet.png` | A 2×2 contact sheet of the other images, downscaled |

## `generated/`

Intermediates written by `npm run slice`, safe to delete:

- `sprite-sheet-alpha.png` — `sprite-sheet.png` with the painted checkerboard keyed out to real alpha
- `tool-shop-alpha.png` — same treatment for the building

## The checkerboard problem

`sprite-sheet.png` and `tool-shop-building.png` look like they have transparent
backgrounds, but the grey-and-white checkerboard is **painted pixels, not alpha**.
`tools/dealpha.mjs` flood-fills it away, including gaps fully enclosed by artwork
such as the space between fence rails. Skipping that step welds every sprite to a
chequered square.
