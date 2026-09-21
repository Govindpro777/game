# Source art

Everything in `public/` is generated from these files. Run `npm run slice` from the
project root to rebuild it all; nothing here is edited by the game.

## In use

| File | What it is | Where it ends up |
|---|---|---|
| `game-bg.jpeg` | The village map, 1575×998 | World background, plus the road mask the player walks on |
| `sprite-sheet.png` | Ground tiles, props, 5 crops × growth stages | ~50 sprites under `public/sprites/` (no longer the player -- see `main-character.png`) |
| `tool-shop-building.png` | The isolated shop building | Tool shop scene, and recoloured red for the seed shop |
| `village-map-old.png` | An earlier village painting | Still the source for the tree sprite and the cobble ground texture |
| `seed-shop-girl.png` | A 5x2 character turnaround sheet | The 3/4 pose (col 4, row 0), mirrored to face left, cut out as the seed shop's standing NPC |
| `seed-shop.png` | The seed shop's interior: counter, Faye, shelves, a drawn exit door | `seedshopinterior` scene's walkable background, copied as-is to `public/scene/seedshop-interior.png`. Faye is part of this art, not a separate sprite |
| `close-up-seed-shop.JPG` | An outdoor close-up of the shop's front | `seedshop` scene's walkable background (the plaza players land in first), copied as-is to `public/scene/seedshop-closeup.jpg` |
| `girl-profile.png` | Faye's portrait, painted inside an ornate frame | Her conversation portrait, downscaled to `public/portrait/faye.png` |
| `boy-profile.png` | Bao's portrait, framed to match | The player's conversation portrait, downscaled to `public/portrait/bao.png` |
| `main-character.png` | A 9-frame side-view walk cycle, 2170×725 | Sliced left to right into `public/sprites/player/f0..f8.png` -- the player's only sprite, every direction |

## Not used yet

| File | What it is | Why it's unused |
|---|---|---|
| `seed-shop-interior.png` | An earlier walkable shop-room concept, a different room with a different shopkeeper | Has no exit drawn anywhere in it (it's an open-fronted cutaway with a solid black background, not a checkerboard), so `seed-shop.png` is in use instead -- its door is what the exit zone needs |
| `cloud.png` | A seamless cloud-sky texture | Was the scene-transition wipe; the transition is a pure-CSS fade to black now, so nothing reads this |
| `tool-shop-interior.jpg` | A shop-UI mockup: inventory grid, stock list, repair/upgrade | Front-facing perspective, so a player sprite has no floor to stand on. Better used as artwork behind the shop panel, or as a design target for reskinning it |

## Reference only

| File | What it is |
|---|---|
| `ref-village-street.jpg` | "Ted's Tools" street scene — style and mood reference |
| `ref-contact-sheet.png` | A 2×2 contact sheet of the other images, downscaled |
| `village-map.png` | The previous village map, replaced by `game-bg.jpeg` |

## `generated/`

Intermediates written by `npm run slice`, safe to delete:

- `sprite-sheet-alpha.png` — `sprite-sheet.png` with the painted checkerboard keyed out to real alpha
- `tool-shop-alpha.png` — same treatment for the building
- `main-character-alpha.png` — same treatment for the walk-cycle sheet

`public/scene/walkmask.png` is also generated: a black-and-white image of the
village's roads, which is what the player's movement is tested against.

## The checkerboard problem

`sprite-sheet.png`, `tool-shop-building.png` and `main-character.png` look like they
have transparent backgrounds, but the grey-and-white checkerboard is **painted pixels, not alpha**.
(`seed-shop-girl.png` has real alpha already and skips this step.)
`tools/dealpha.mjs` flood-fills it away, including gaps fully enclosed by artwork
such as the space between fence rails. Skipping that step welds every sprite to a
chequered square.
