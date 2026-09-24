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
  /**
   * Caps how far `sceneZoom()` will push past the minimum needed to cover the
   * viewport (never below that minimum -- coverage always wins, so this only ever
   * zooms a scene out further, never in). For a short scene on a very wide window,
   * the usual "fit a 960x600 box" zoom can be more than the scene's own height can
   * afford without clamping the camera to the bottom and cropping whatever's near
   * the top; capping it here keeps more of the room in frame instead.
   */
  maxZoom?: number;
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

const MAP_W = 1575;
const MAP_H = 998;

const world: Scene = {
  id: "world",
  name: "Greenville village",
  w: MAP_W,
  h: MAP_H,
  cache: false,
  mask: "/scene/walkmask.png",
  playerScale: 0.45,
  spawn: { x: 550, y: 628 }, // in front of Home
  ground: (c) => c.drawImage(img("/scene/village.png"), 0, 0, MAP_W, MAP_H),
  // Stand permanently at their shop's gate: decorative only, not a zone or NPC AI.
  decor: [
    { src: npc("seedshop_girl"), x: 745, y: 580, s: 0.18 },
    { src: npc("toolshop_owner"), x: 1285, y: 812, s: 0.22 }, // on the path right in front of the tool shop's door
  ],
  blocked: [],
  zones: [
    { x: 470, y: 548, w: 90, h: 52, id: "home", label: "Home" },
    {
      x: 646,
      y: 620,
      w: 96,
      h: 54,
      id: "seedshop",
      label: "Seed shop",
      to: "seedshop",
    },
    {
      x: 1204,
      y: 782,
      w: 96,
      h: 54,
      id: "toolshop",
      label: "Tool shop",
      to: "toolshopcloseup",
    },
    {
      x: 452,
      y: 664,
      w: 90,
      h: 56,
      id: "farm",
      label: "Farm",
      to: "farm",
      lx: 300,
      ly: 700,
    },
  ],
};

/**
 * The tool shop is two scenes, not one -- the same pattern as the seed shop below.
 * Walking through the village door leads to `toolshopcloseup`, the yard outside
 * (one flat painting with Ted baked into the art, standing by the door); talking to
 * him only starts once you've actually walked up to him (see the proximity check
 * in main.ts). Saying yes sends you on into `toolshop` -- a second flat painting,
 * this time the shop's interior, Ted baked into the art again behind the
 * workbench -- where you actually buy and upgrade tools and can walk back out to
 * the village through its door.
 */
// Downscaled well below the source art's native 1776x1104 (see slice.mjs) -- the
// camera's fixed world-space fit box shows a constant number of native pixels
// regardless of a scene's own resolution, so shrinking the art further zooms the
// camera out relative to the yard, and a smaller playerScale keeps Bao from
// towering over it.
// 960 wide, and its true proportional height (see slice.mjs) -- every blocked rect
// below was measured directly off a coordinate-grid overlay of this exact image, so
// they track real art features instead of drifting further with every resize.
const TOOLSHOP_CLOSEUP_W = 960;
const TOOLSHOP_CLOSEUP_H = 597;

const toolshopcloseup: Scene = {
  id: "toolshopcloseup",
  name: "Ted’s tools",
  w: TOOLSHOP_CLOSEUP_W,
  h: TOOLSHOP_CLOSEUP_H,
  cache: true,
  playerScale: 0.7,
  spawn: { x: 94, y: 384 }, // on the path by the lamppost, far from Ted -- walking up to him or the door is what starts the chat
  ground: (c) =>
    c.drawImage(
      img("/scene/toolshop-closeup.jpg"),
      0,
      0,
      TOOLSHOP_CLOSEUP_W,
      TOOLSHOP_CLOSEUP_H,
    ),
  decor: [],
  blocked: [
    { x: 0, y: 0, w: TOOLSHOP_CLOSEUP_W, h: 141 }, // garden stalls, the fence and the shop's roofline
    { x: 413, y: 0, w: 197, h: 112 }, // the river
    { x: 375, y: 178, w: 103, h: 103 }, // the bush beside the shop sign
    { x: 534, y: 141, w: 75, h: 253 }, // the wall left of the door
    { x: 722, y: 141, w: 122, h: 253 }, // the wall right of the door
    { x: 844, y: 0, w: 116, h: 394 }, // the chimney
    { x: 455, y: 253, w: 108, h: 141 }, // the tool rack leaning against the shop wall
    { x: 839, y: 366, w: 84, h: 84 }, // the barrel by the door
    { x: 0, y: TOOLSHOP_CLOSEUP_H - 14, w: TOOLSHOP_CLOSEUP_W, h: 14 },
    { x: 0, y: 0, w: 14, h: TOOLSHOP_CLOSEUP_H },
    { x: TOOLSHOP_CLOSEUP_W - 14, y: 0, w: 14, h: TOOLSHOP_CLOSEUP_H },
  ],
  zones: [],
};

const TOOLSHOP_INTERIOR_W = 1280;
const TOOLSHOP_INTERIOR_H = 720;

const toolshop: Scene = {
  id: "toolshop",
  name: "Ted’s tools",
  w: TOOLSHOP_INTERIOR_W,
  h: TOOLSHOP_INTERIOR_H,
  cache: true,
  playerScale: 2,
  // The room is short (1280x720) and every stick of furniture in it -- fireplace,
  // workbench, shelves -- blocks the floor down to about y=490-590, so there's no
  // walkable ground anywhere above that; on a very wide window the normal "fit a
  // 960x600 box" zoom needs more vertical room than that leaves, clamping the
  // camera to the bottom and cropping the TOOLS sign off the top. Capped below so
  // this room only ever zooms to whatever a full-coverage fill actually needs.
  maxZoom: 1,
  bg: "#190d06", // sampled from the art's own dark corners, so any sliver of background shown on the sides blends in
  spawn: { x: 700, y: 640 }, // open floor in the middle of the room, clear of both the counter and the door
  ground: (c) =>
    c.drawImage(
      img("/scene/toolshop-interior.jpg"),
      0,
      0,
      TOOLSHOP_INTERIOR_W,
      TOOLSHOP_INTERIOR_H,
    ),
  decor: [],
  // Measured directly off a coordinate-grid overlay of the actual art -- the first
  // cut here (guessed, not measured) ran well past where the fireplace, workbench
  // and shelves actually end, eating into open floor the player should be able to
  // walk on; that read as movement just stopping partway across a clear-looking
  // room. There's no drawn wall at the bottom of this image either (unlike the
  // seed shop interior), so the floor relies on the global edge clamp in main.ts
  // rather than a dedicated blocked rect.
  blocked: [
    { x: 0, y: 0, w: 335, h: 565 }, // the fireplace, anvil and stool
    { x: 335, y: 0, w: 520, h: 590 }, // the wall, hanging tools, the workbench and Ted behind it
    { x: 855, y: 0, w: 230, h: 490 }, // shelves, baskets and the barrel with the cat
    { x: 0, y: 0, w: 14, h: TOOLSHOP_INTERIOR_H },
    { x: TOOLSHOP_INTERIOR_W - 14, y: 0, w: 14, h: TOOLSHOP_INTERIOR_H },
  ],
  zones: [
    // Bigger than the norm and with its own longer reach, so browsing the stock
    // doesn't need lining up right against the desk -- most of the open floor in
    // front of it works.
    { x: 430, y: 480, w: 340, h: 90, id: "counter", label: "Tool counter", reach: 150 },
    { x: 1140, y: 480, w: 140, h: 140, id: "exit", label: "Village", to: "world" }, // the door
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
