import { img, prop, decal, npc } from "./core/assets";
import type { SceneId } from "./state";

export type Rect = { x: number; y: number; w: number; h: number };
export type Zone = Rect & {
  id: string;
  label: string;
  to?: SceneId;
  /** Optional world-space anchor for the map label, when the walkable zone sits away from the landmark. */
  lx?: number;
  ly?: number;
  /** Overrides the default interact radius (REACH in main.ts) for just this zone. */
  reach?: number;
};
export type Decor = {
  src: HTMLImageElement;
  x: number;
  y: number;
  s: number;
  /**
   * Depth-sort key override, in world pixels. Defaults to the sprite's own bottom
   * edge (y + drawn height), which is wrong for a sprite whose art extends well
   * past its solid footprint -- e.g. the shop building's image includes a raised
   * porch/mound reaching far past the actual wall, so sorting by its true bottom
   * edge draws the whole building over the player the moment they're close enough
   * to interact with the door, no matter how far in front of the wall they stand.
   * Set this to where the solid structure actually ends instead.
   */
  sortY?: number;
  /** Draw mirrored left-to-right, e.g. so an NPC faces the way the player walks up from. */
  flip?: boolean;
};

export type Scene = {
  id: SceneId;
  name: string;
  w: number;
  h: number;
  cache: boolean;
  /** Path to a 1-bit walkable mask; white = walkable. Replaces `blocked` when set. */
  mask?: string;
  /** Sprite scale for the player in this scene; the village is drawn further out. */
  playerScale?: number;
  /** Multiplies the player's move speed in this scene; omit for the normal speed. */
  speedMul?: number;
  /**
   * Caps how far `sceneZoom()` will push past the minimum needed to cover the
   * viewport (never below that minimum -- coverage always wins, so this only ever
   * zooms a scene out further, never in). For a short scene on a very wide window,
   * the usual "fit a 960x600 box" zoom can be more than the scene's own height can
   * afford without clamping the camera to the bottom and cropping whatever's near
   * the top; capping it here keeps more of the room in frame instead.
   */
  maxZoom?: number;
  /** Multiplies the normal zoom (whatever sceneZoom() would otherwise pick) to push
   * the camera in closer on a scene that should read tighter/more intimate than the
   * "fit a 960x600 box, then cover" default gives it. Omit for the normal zoom. */
  zoomBoost?: number;
  /**
   * Canvas fill colour behind the scene, before anything is drawn -- only matters
   * where the scene doesn't fully cover the viewport (normally nowhere, but a
   * `maxZoom`-capped scene can show a sliver on the sides; see sceneZoom() in
   * main.ts). Defaults to a dark green that suits outdoor scenes.
   */
  bg?: string;
  spawn: { x: number; y: number };
  ground: (c: CanvasRenderingContext2D) => void;
  decor: Decor[];
  blocked: Rect[];
  zones: Zone[];
};

const rng = (seed: number) => {
  let s = (seed * 2654435761) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};

function scatter(
  c: CanvasRenderingContext2D,
  r: Rect,
  seed: number,
  n: number,
  avoid?: Rect,
) {
  const rand = rng(seed);
  const kinds = [
    decal("flower_a"),
    decal("flower_a"),
    decal("flower_b"),
    decal("flower_b"),
    decal("flower_a"),
    decal("rock_b"),
    decal("rock_a"),
  ];
  for (let i = 0; i < n; i++) {
    const im = kinds[Math.floor(rand() * kinds.length)];
    if (!im.width) continue;
    const s = 0.7 + rand() * 0.7;
    const x = r.x + rand() * r.w;
    const y = r.y + rand() * r.h;
    if (
      avoid &&
      x > avoid.x - 20 &&
      x < avoid.x + avoid.w + 20 &&
      y > avoid.y - 20 &&
      y < avoid.y + avoid.h + 20
    )
      continue;
    c.save();
    if (rand() > 0.5) {
      c.translate(x + im.width * s, y);
      c.scale(-1, 1);
      c.drawImage(im, 0, 0, im.width * s, im.height * s);
    } else {
      c.drawImage(im, x, y, im.width * s, im.height * s);
    }
    c.restore();
  }
}

const GRASS = [
  "#5d6d3b",
  "#6a783d",
  "#556a3e",
  "#4a6242",
  "#71803f",
  "#617141",
  "#4f6640",
];
const TUFT = ["#41583a", "#7a8a46"];

/** Procedural pixel grass: seamless by construction, built from the sheet's own palette. */
function grassBase(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  decals = 60,
  avoid?: Rect,
) {
  const r = rng(seed);
  const px = 4;
  c.fillStyle = "#586a3b";
  c.fillRect(0, 0, w, h);
  const cols = Math.ceil(w / px);
  const rows = Math.ceil(h / px);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (r() > 0.62) continue;
      c.fillStyle = GRASS[Math.floor(r() * GRASS.length)];
      c.fillRect(i * px, j * px, px, px);
    }
  }
  const tufts = Math.floor((w * h) / 5200);
  for (let i = 0; i < tufts; i++) {
    const x = Math.floor((r() * w) / px) * px;
    const y = Math.floor((r() * h) / px) * px;
    c.fillStyle = TUFT[r() > 0.35 ? 0 : 1];
    for (let k = 0; k < 4; k++) {
      c.fillRect(
        x + (Math.floor(r() * 5) - 2) * px,
        y + (Math.floor(r() * 3) - 1) * px,
        px,
        px * 2,
      );
    }
  }
  scatter(c, { x: 0, y: 0, w, h }, seed + 31, decals, avoid);
}

/** Native sprite sizes from the slicer; collision is derived from these. */
const RAIL = { w: 122, h: 64 };
const POST = { w: 18, h: 65 };
const FENCE_BAND = 18;

/** Places a run of fence rails and the matching collision strip along its base. */
function fenceRow(
  out: Decor[],
  solid: Rect[],
  x0: number,
  y: number,
  count: number,
  step: number,
  s = 0.55,
) {
  for (let i = 0; i < count; i++) {
    out.push({
      src: prop(i % 2 ? "fence_rail" : "fence_rail_b"),
      x: x0 + i * step,
      y,
      s,
    });
  }
  const base = y + RAIL.h * s;
  solid.push({
    x: x0,
    y: base - FENCE_BAND,
    w: (count - 1) * step + RAIL.w * s,
    h: FENCE_BAND,
  });
}

/** Places a column of fence posts and one continuous collision strip down its length. */
function fenceCol(
  out: Decor[],
  solid: Rect[],
  x: number,
  y0: number,
  count: number,
  step: number,
  s = 0.5,
) {
  for (let i = 0; i < count; i++) {
    out.push({
      src: prop(i % 2 ? "fence_post" : "fence_post_b"),
      x,
      y: y0 + i * step,
      s,
    });
  }
  solid.push({
    x,
    y: y0,
    w: Math.max(14, POST.w * s),
    h: (count - 1) * step + POST.h * s,
  });
}

/* ---------------- world ---------------- */

// The village is new-game-bg.png at its native size, so world coordinates are
// just that image's pixels -- the zone/NPC positions below were read straight off
// a coordinate grid over it, and walkmask.png (derived from the same art by
// tools/roadmask.mjs with tools/masks/village.json) lines up 1:1.
const MAP_W = 1536;
const MAP_H = 1024;

const world: Scene = {
  id: "world",
  name: "Greenville village",
  w: MAP_W,
  h: MAP_H,
  cache: false,
  mask: "/scene/walkmask.png",
  zoomBoost: 1.1, // a touch closer than the plain cover fit gives
  speedMul: 0.8, // the map reads large and the character small here, so full speed felt a bit too brisk
  // People are drawn smaller in this painting than the old one (a door is ~60px
  // tall here), so Bao is sized to stand about door height.
  playerScale: 0.32,
  spawn: { x: 535, y: 620 }, // on the open road in front of Home, clear of the fence corner
  ground: (c) => c.drawImage(img("/scene/village.png"), 0, 0, MAP_W, MAP_H),
  // Stand permanently at their shop's gate: decorative only, not a zone or NPC AI.
  // Positions are the sprite's own top-left draw corner, not its feet -- checked
  // against the art so the feet (x + w/2, y + h) land cleanly on open road, clear
  // of the bushes either shop is planted next to.
  decor: [
    { src: npc("seedshop_girl"), x: 720, y: 585, s: 0.12 }, // feet on the seed shop's doorstep
    { src: npc("toolshop_owner"), x: 1270, y: 820, s: 0.166 }, // on the road right in front of the tool shop's door
  ],
  blocked: [],
  zones: [
    // The blue-roofed cottage by the fountain; its front garden meets the road here.
    { x: 460, y: 555, w: 90, h: 52, id: "home", label: "Home" },
    // The doorstep of the big glasshouse ("SEEDER").
    {
      x: 650,
      y: 585,
      w: 96,
      h: 54,
      id: "seedshop",
      label: "Seed shop",
      to: "seedshop",
    },
    // The doorstep under the "TOOL SHOP" sign.
    {
      x: 1262,
      y: 825,
      w: 96,
      h: 54,
      id: "toolshop",
      label: "Tool shop",
      to: "toolshopcloseup",
    },
    // Where the cobbled road ends at the fields' own dirt paths, by the vegetable cart.
    {
      x: 430,
      y: 745,
      w: 90,
      h: 56,
      id: "farm",
      label: "Farm",
      to: "farm",
    },
  ],
};

/**
 * The tool shop is two scenes, not one -- the same pattern as the seed shop below.
 * Walking through the village door leads to `toolshopcloseup`, the street outside
 * (one flat painting, Ted standing on his doorstep as a sprite); talking to him
 * only starts once you've actually walked up to him (see the proximity check in
 * main.ts). Saying yes sends you on into `toolshop` -- a second flat painting,
 * this time the shop's interior, Ted baked into the art behind his billing desk --
 * where you actually buy and upgrade tools and can walk back out to the village
 * through its door.
 */
// new-tool-shop-closeup.png at its native size. Walking is confined to the roads
// by a mask derived from the art itself (tools/masks/toolshop-closeup.json), the
// same way the village is -- the roads here are curved and full of props, which
// hand-placed rectangles can't follow.
const TOOLSHOP_CLOSEUP_W = 1200;
const TOOLSHOP_CLOSEUP_H = 607;

const toolshopcloseup: Scene = {
  id: "toolshopcloseup",
  name: "Ted’s tools",
  w: TOOLSHOP_CLOSEUP_W,
  h: TOOLSHOP_CLOSEUP_H,
  cache: true,
  mask: "/scene/toolshop-closeup-walkmask.png",
  // The shop door is ~60px tall in this painting; this puts Bao a bit taller than
  // door height, which reads better up close than true-to-scale did.
  playerScale: 0.5,
  zoomBoost: 1.2, // tighter, more intimate framing of the street than the plain cover fit gives
  spawn: { x: 400, y: 420 }, // the crossroads, well back from Ted -- walking up to him is what starts the chat
  ground: (c) =>
    c.drawImage(
      img("/scene/toolshop-closeup.jpg"),
      0,
      0,
      TOOLSHOP_CLOSEUP_W,
      TOOLSHOP_CLOSEUP_H,
    ),
  // This painting has no Ted in it, unlike the old one -- he stands on the
  // doorstep as a sprite, mirrored to face the road the player walks up.
  decor: [{ src: npc("toolshop_owner"), x: 769, y: 366, s: 0.27 }],
  blocked: [],
  zones: [],
};

const TOOLSHOP_INTERIOR_W = 1600;
const TOOLSHOP_INTERIOR_H = 877;

const toolshop: Scene = {
  id: "toolshop",
  name: "Ted’s tools",
  w: TOOLSHOP_INTERIOR_W,
  h: TOOLSHOP_INTERIOR_H,
  cache: true,
  playerScale: 1.3,
  // This room's floor is much deeper than the original interior's, so the crop is
  // far less severe -- but standing right at Ted's desk on a very wide window can
  // still push the top of his billing desk to the very edge of the frame. Same
  // cap, same reasoning as before: never zoom in past what full coverage needs.
  maxZoom: 1,
  bg: "#190d06", // sampled from the art's own dark corners, so any sliver of background shown on the sides blends in
  spawn: { x: 900, y: 760 }, // open floor in the middle of the room -- Ted's billing desk is off to the left, the door off to the right
  ground: (c) =>
    c.drawImage(
      img("/scene/toolshop-interior.jpg"),
      0,
      0,
      TOOLSHOP_INTERIOR_W,
      TOOLSHOP_INTERIOR_H,
    ),
  decor: [],
  // Measured directly off a coordinate-grid overlay of the actual art (see the
  // second interior's own note in git history for why: a guessed cut here ran
  // past where the furniture actually ends and read as movement just stopping
  // partway across a clear-looking room). This art's floor is much deeper than
  // the original interior's, so the global edge clamp in main.ts is enough on
  // its own -- no dedicated "past the edge of the floor" rect needed.
  blocked: [
    { x: 0, y: 0, w: 470, h: 600 }, // the price list, fireplace and Ted's billing desk
    { x: 470, y: 0, w: 520, h: 560 }, // the wall, hanging tools, anvil, window and workbench
    { x: 1015, y: 0, w: 300, h: 340 }, // shelves, boxes and baskets
    { x: 1225, y: 230, w: 160, h: 180 }, // the barrel with the cat
    // The door panel itself only runs to about y=400 (checked against a
    // close-up crop of the art) -- the previous y:520 cut was 120px too tall,
    // squeezing the actual floor in front of the door down to a sliver barely
    // wide enough to stand in, which is why the exit was so hard to trigger
    // no matter how generous its zone/reach was.
    { x: 1385, y: 0, w: 215, h: 400 }, // the door frame and wall beside it
    { x: 1480, y: 560, w: 120, h: 100 }, // the little table and lantern, bottom-right corner
    { x: 0, y: 0, w: 14, h: TOOLSHOP_INTERIOR_H },
    { x: TOOLSHOP_INTERIOR_W - 14, y: 0, w: 14, h: TOOLSHOP_INTERIOR_H },
  ],
  zones: [
    // Bigger than the norm and with its own longer reach, so browsing the stock
    // doesn't need lining up right against the desk -- most of the open floor in
    // front of it works.
    { x: 180, y: 520, w: 220, h: 80, id: "counter", label: "Billing counter", reach: 150 },
    // The door's own floor threshold runs wide (the whole gap between the barrel
    // and the right wall), and standing anywhere near it -- not lined up on one
    // exact spot -- should trigger the exit. findTarget() in main.ts caps a zone's
    // effective reach at max(w,h)/2+56 regardless of `reach`, so this needs to be
    // genuinely large, not just given a big `reach` on top of a small box.
    { x: 1280, y: 380, w: 300, h: 200, id: "exit", label: "Village", to: "world", reach: 260 },
  ],
};

/**
 * The seed shop is two scenes, not one. Walking through the village door leads to
 * `seedshop`, an outdoor plaza (one flat painting, Faye standing in it as a decor
 * sprite) spawning you well back from her -- talking to her only starts once you've
 * actually walked up to her or the door (see the proximity check in main.ts). Saying
 * yes sends you on into `seedshopinterior` -- a second flat painting, this time with
 * Faye baked into the art at the counter -- where you actually buy seeds and can
 * walk back out to the village through its door.
 */
const CLOSEUP_W = 1280;
const CLOSEUP_H = 757;

const seedshop: Scene = {
  id: "seedshop",
  name: "Seed & produce market",
  w: CLOSEUP_W,
  h: CLOSEUP_H,
  cache: true,
  playerScale: 0.62,
  spawn: { x: 160, y: 550 }, // far corner of the plaza -- walking up to the door or Faye is what starts the chat
  ground: (c) =>
    c.drawImage(
      img("/scene/seedshop-closeup.jpg"),
      0,
      0,
      CLOSEUP_W,
      CLOSEUP_H,
    ),
  decor: [{ src: npc("seedshop_girl"), x: 400, y: 390, s: 0.26 }],
  blocked: [
    { x: 255, y: 0, w: 660, h: 480 }, // the building itself, plus the stalls and barrels out front
    { x: 0, y: 60, w: 235, h: 220 }, // fountain
    { x: 950, y: 0, w: 330, h: CLOSEUP_H }, // garden racks, potted plants and the river beyond
    { x: 0, y: 585, w: 315, h: CLOSEUP_H - 585 }, // flower and tomato bed
  ],
  zones: [],
};

const INTERIOR_W = 1693;
const INTERIOR_H = 929;

const seedshopinterior: Scene = {
  id: "seedshopinterior",
  name: "Seed & produce market",
  w: INTERIOR_W,
  h: INTERIOR_H,
  cache: true,
  // Much bigger than the rest of the cast -- matches how large Bao reads standing
  // next to Faye at the counter in this art.
  playerScale: 1.4,
  spawn: { x: 260, y: 750 }, // open floor by the grain sacks, left of the little table
  ground: (c) =>
    c.drawImage(
      img("/scene/seedshop-interior.png"),
      0,
      0,
      INTERIOR_W,
      INTERIOR_H,
    ),
  decor: [],
  blocked: [
    // These two boxes stack vertically with only floor between them, and `hits()`
    // inflates every rect by 14px/7px for collision -- the first cut left just a
    // ~16px sliver between them once inflated, nowhere near enough for the player
    // to actually walk through, which read as "stuck" even though technically not
    // fully blocked. Widened the real gap here to something a body can fit in.
    { x: 0, y: 0, w: 660, h: 680 }, // left wall: shelves, jars, grain sacks, crates
    // The little display table (plant, folded cloth, price tag) sits well clear of
    // that block on the open floor -- it needs its own footprint, not just whatever
    // the sacks' box happens to cover, or the player walks straight through it.
    { x: 300, y: 810, w: 420, h: 119 },
    // Was cut 40px short of where the desk's lower shelf (bottles, seed packets)
    // actually ends -- that gap let the player walk right into the counter.
    { x: 680, y: 100, w: 550, h: 600 }, // the counter desk, Faye, and the grow-light shelf behind her
    { x: 1550, y: 380, w: INTERIOR_W - 1550, h: INTERIOR_H - 380 }, // potted-plant rack by the door
  ],
  zones: [
    // Bigger than the norm and with its own longer reach, so browsing the stock
    // doesn't need lining up right against the desk -- most of the open floor in
    // front of it works.
    { x: 750, y: 710, w: 350, h: 110, id: "counter", label: "Market stall", reach: 170 },
    { x: 1290, y: 650, w: 210, h: 110, id: "exit", label: "Village", to: "world" }, // the door mat
  ],
};

/* ---------------- farm ---------------- */

export const PLOT_COLS = 6;
export const PLOT_ROWS = 4;
export const PLOT_SIZE = 104;
export const PLOT_GAP = 16;
export const FARM_X = 176;
export const FARM_Y = 250;

export function plotRect(i: number): Rect {
  const cx = i % PLOT_COLS;
  const cy = Math.floor(i / PLOT_COLS);
  return {
    x: FARM_X + cx * (PLOT_SIZE + PLOT_GAP),
    y: FARM_Y + cy * (PLOT_SIZE + PLOT_GAP),
    w: PLOT_SIZE,
    h: PLOT_SIZE,
  };
}

const fieldW = PLOT_COLS * (PLOT_SIZE + PLOT_GAP) - PLOT_GAP;
const fieldH = PLOT_ROWS * (PLOT_SIZE + PLOT_GAP) - PLOT_GAP;
const farmW = FARM_X * 2 + fieldW;
const farmH = FARM_Y + fieldH + 290;

const farmDecor: Decor[] = [
  { src: prop("well"), x: 56, y: 660, s: 0.44 },
  { src: prop("barrels"), x: farmW - 150, y: 300, s: 0.46 },
  { src: prop("cart"), x: farmW - 210, y: 690, s: 0.48 },
  { src: prop("crate"), x: 66, y: 830, s: 0.4 },
  { src: prop("lantern"), x: farmW - 76, y: 540, s: 0.46 },
  { src: prop("sacks"), x: 70, y: 300, s: 0.44 },
  { src: prop("crates_produce"), x: farmW - 190, y: 848, s: 0.42 },
];
const farmBlocked: Rect[] = [
  { x: 0, y: 0, w: farmW, h: 160 },
  { x: 0, y: 0, w: 14, h: farmH },
  { x: farmW - 14, y: 0, w: 14, h: farmH },
  { x: 0, y: farmH - 14, w: farmW, h: 14 },
];
fenceRow(farmDecor, farmBlocked, 24, 176, 17, 64);
fenceRow(farmDecor, farmBlocked, 24, farmH - 74, 6, 64);
fenceRow(farmDecor, farmBlocked, farmW - 408, farmH - 74, 6, 64);
fenceCol(farmDecor, farmBlocked, 14, 212, 10, 68);
fenceCol(farmDecor, farmBlocked, farmW - 28, 212, 10, 68);

export const FARM_TREES = [
  { x: 92, y: 424 },
  { x: 96, y: 572 },
  { x: farmW - 96, y: 212 },
];
export const FARM_ROCKS = [
  { x: 210, y: 858 },
  { x: 386, y: 876 },
  { x: farmW - 300, y: 862 },
];

const farm: Scene = {
  id: "farm",
  name: "Your farm",
  w: farmW,
  h: farmH,
  cache: true,
  spawn: { x: farmW / 2, y: farmH - 150 },
  ground: (c) => {
    grassBase(c, farmW, farmH, 3, 58, {
      x: FARM_X - 40,
      y: FARM_Y - 40,
      w: fieldW + 80,
      h: fieldH + 80,
    });
  },
  decor: farmDecor,
  blocked: farmBlocked,
  zones: [
    {
      x: farmW / 2 - 110,
      y: farmH - 96,
      w: 220,
      h: 56,
      id: "exit",
      label: "Village",
      to: "world",
    },
  ],
};

export const SCENES: Record<SceneId, Scene> = {
  world,
  farm,
  toolshop,
  toolshopcloseup,
  seedshop,
  seedshopinterior,
};
