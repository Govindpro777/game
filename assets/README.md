# Source art

Everything in `public/` is generated from these files. Run `npm run slice` from the
project root to rebuild it all; nothing here is edited by the game.

## In use

| File | What it is | Where it ends up |
|---|---|---|
| `new-game-bg.png` | The village map, 1536×1024 | World background (`public/scene/village.png`), plus the road mask the player walks on (`walkmask.png`, from `tools/masks/village.json`) |
| `sprite-sheet.png` | Ground tiles, props, 5 crops × growth stages | ~50 sprites under `public/sprites/` (no longer the player -- see `main-character.png`) |
| `village-map-old.png` | An earlier village painting | Still the source for the tree sprite and the cobble ground texture |
| `seed-shop-girl.png` | A 5x2 character turnaround sheet | The 3/4 pose (col 4, row 0), mirrored to face left, cut out as the seed shop's standing NPC |
| `seed-shop.png` | The seed shop's interior: counter, Faye, shelves, a drawn exit door | `seedshopinterior` scene's walkable background, copied as-is to `public/scene/seedshop-interior.png`. Faye is part of this art, not a separate sprite |
| `close-up-seed-shop.JPG` | An outdoor close-up of the shop's front | `seedshop` scene's walkable background (the plaza players land in first), copied as-is to `public/scene/seedshop-closeup.jpg` |
| `girl-profile.png` | Faye's portrait, painted inside an ornate frame | Her conversation portrait, downscaled to `public/portrait/faye.png` |
| `boy-profile.png` | Bao's portrait, framed to match | The player's conversation portrait, downscaled to `public/portrait/bao.png` |
| `main-character.png` | A 9-frame side-view walk cycle, 2170×725 | Sliced left to right into `public/sprites/player/f0..f8.png` -- the player's only sprite, every direction |
| `tool-shop-owner.png` | A 7x2 character turnaround sheet, Ted | The 3/4 pose (col 4, row 0), mirrored to face left, cut out as the tool shop's standing NPC -- same convention as `seed-shop-girl.png`, but this one has the painted-background problem (see below) |
| `tool-shop-avtar.png` | Ted's portrait, painted inside an ornate frame | His conversation portrait, downscaled to `public/portrait/ted.png` |
| `new-tool-shop-closeup.png` | The street outside the tool shop, 1200×607 -- no Ted in the art, so he stands on the doorstep as a sprite | `toolshopcloseup` scene's background (`public/scene/toolshop-closeup.jpg`), plus its road mask (`toolshop-closeup-walkmask.png`, from `tools/masks/toolshop-closeup.json`) |
| `farm-owner-guru.jpeg` | A character turnaround sheet of Guru, the farm owner, on a painted checkerboard | The 45° pose (third figure in the top row), keyed out and cut as `public/sprites/npc/farm_owner.png` (step 6c in `tools/slice.mjs`) -- Guru standing at the farm gate in the village and in the lane |
| `farm-close-up.png` | The lane outside the farm, 1264×843 -- Guru stands at the end of the road as a sprite | `farmcloseup` scene's background (`public/scene/farm-closeup.jpg`), plus its road mask (`farm-closeup-walkmask.png`, from `tools/masks/farm-closeup.json`) |
| `Tool-shop-interior-2.jpeg` | The tool shop's interior: a billing desk (Ted seated at it), a separate loose workbench, fireplace, shelves, a drawn exit door | `toolshop` scene's walkable background, copied as-is to `public/scene/toolshop-interior.jpg`. Ted is part of this art, not a separate sprite |

## Not used yet

| File | What it is | Why it's unused |
|---|---|---|
| `seed-shop-interior.png` | An earlier walkable shop-room concept, a different room with a different shopkeeper | Has no exit drawn anywhere in it (it's an open-fronted cutaway with a solid black background, not a checkerboard), so `seed-shop.png` is in use instead -- its door is what the exit zone needs |
| `cloud.png` | A seamless cloud-sky texture | Was the scene-transition wipe; the transition is a pure-CSS fade to black now, so nothing reads this |
| `tool-shop-interior.jpg` | A shop-UI mockup: inventory grid, stock list, repair/upgrade | Front-facing perspective, so a player sprite has no floor to stand on. Better used as artwork behind the shop panel, or as a design target for reskinning it |
| `tool-shop-building.png` | The isolated shop building, procedurally set in a hand-built yard | Replaced by `new-tool-shop-closeup.png`/`Tool-shop-interior-2.jpeg`, painted scenes matching the seed shop's two-scene pattern instead |
| `game-bg.jpeg` | The previous village map, 1575×998 | Replaced by `new-game-bg.png` |
| `Tool-shop-clodeup.jpeg` | The previous tool shop street close-up, Ted baked into the art | Replaced by `new-tool-shop-closeup.png` |
| `Tool-shop-interior.jpeg` | An earlier version of the shop's interior: Ted standing at a central workbench | Replaced by `Tool-shop-interior-2.jpeg`'s layout (a separate billing desk and workbench), which needed more open floor than this version had |

## Reference only

| File | What it is |
|---|---|
| `ref-village-street.jpg` | "Ted's Tools" street scene — style and mood reference |
| `ref-contact-sheet.png` | A 2×2 contact sheet of the other images, downscaled |
| `village-map.png` | An older village map, long since replaced |

## `generated/`

Intermediates written by `npm run slice`, safe to delete:

- `sprite-sheet-alpha.png` — `sprite-sheet.png` with the painted checkerboard keyed out to real alpha
- `main-character-alpha.png` — same treatment for the walk-cycle sheet
- `tool-shop-owner-alpha.png` — same treatment for Ted's turnaround sheet

**Portraits are hand-placed.** `public/portrait/*.png` (faye, bao, ted, guru) are not
reliably reproduced by `npm run slice` -- its portrait step writes small 400px versions
from the older source art and **will overwrite** the hand-placed ones (this happened to
`bao.png` and `faye.png`). Back up `public/portrait/` before running the full slice.

`public/scene/walkmask.png`, `toolshop-closeup-walkmask.png` and `farm-closeup-walkmask.png` are also generated:
black-and-white images of each scene's roads, which is what the player's movement is
tested against.

## The checkerboard problem

`sprite-sheet.png` and `main-character.png` look like they have transparent
backgrounds, but the grey-and-white checkerboard is **painted pixels, not alpha**.
`tool-shop-owner.png` has the same problem in a different shape -- an isometric grey
floor tile instead of a checkerboard, but it's light and desaturated enough that the
same near-grey heuristic keys it out too. (`seed-shop-girl.png` has real alpha
already and skips this step.) `tools/dealpha.mjs` flood-fills it away, including
gaps fully enclosed by artwork such as the space between fence rails. Skipping that
step welds every sprite to whatever background it was painted on.
