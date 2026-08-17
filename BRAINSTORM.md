# Baby Coloring Website — Brainstorm Session

**Date:** 2026-08-17
**Mode:** Solo thought-partner
**Goal:** Simple online coloring app for a 1-4yr-old. Kawaii/cute cartoon line art. Vercel-hosted. No persistence, no ads, no accounts. Tap-to-fill regions defined by the drawing's lines. Every visitor gets an isolated in-session painting.

---

## Final Decisions

| Decision | Choice | Why |
|---|---|---|
| Fill method | **Region-map bitmap** (not raw SVG, not naive flood fill) | Crisp, leak-proof, tap-anywhere, static-hostable |
| Art source | **AI-generated kawaii line art** | Infinite cheap designs from prompts |
| Region prep | **Offline preprocess script**, run once per image | Tames AI's broken lines uniformly |
| Persistence | **None** — pure in-session React state | Every visitor isolated by default, zero backend |
| Audience | **1-4yr, tablet + phone touch** | Fat-finger, no-text, no-fail UI |
| Interaction | **Bucket-only** (tap a region → fill) | Toddlers can't do precise strokes; also can't make it ugly |

---

## Concepts Named This Session

- **The moved bottleneck** — Choosing crisp fills pushes the work from the kid's finger to *your* art pipeline. The whole design exists to make YOUR per-image prep near-zero.
- **The label-map trick** — Pretty line-art PNG shown on top; a hidden flat-color "region map" PNG underneath. A tap reads the hidden pixel's color to identify the region, then floods that region on a middle canvas layer.
- **AI-line-art-is-always-slightly-broken** — Models emit raster PNG with tiny stroke gaps and anti-alias fuzz. Naive flood fill leaks through the gaps. A morphological-close preprocess step is the cure.
- **No-lose sandbox** — No fail states, no dead ends, no timers, nothing to lose. Bucket-only means the baby physically cannot make it ugly.
- **The parent-gate reframe** — A safety gate protects against ads/purchases/links/data. This app has none of those, so a safety gate is theater. The only real (mild) risk is the baby fat-fingering "home" mid-drawing → repurpose the gate as a *keep-on-task* hold, not a safety gate.
- **Constraints that are secretly features** — Bucket-only + no custom colors + no scroll = fewer ways to fail, simpler code, happier toddler.

---

## Architecture

```
/public/designs/unicorn-1/
   line.png        (display layer: black lines, transparent fill)
   regions.png     (hidden label map: each area a flat unique color, id encoded in pixels)
   meta.json       (region count, name, tinyMergedCount)

Runtime layer stack (canvas):
   [ fill canvas ]   middle — where taps paint color
   under
   [ line.png ]      top — crisp lines, always on top
   regions.png       held in memory offscreen, never displayed — used for hit-testing

State: React useState only. Nothing persisted. New tab / refresh = fresh page.
Stack: Next.js static export + Canvas API. Zero backend. Vercel free tier.
```

### Per-image pipeline (your workflow per new design)
```
prompt AI for kawaii line art  →  preprocess.js  →  30sec QA eyeball  →  drop folder in /public/designs
```

---

## Preprocess Script — `preprocess.js` (offline, once per design)

Input: AI line-art PNG. Output: `regions.png` + `meta.json` + a debug tint PNG.

```
1. LOAD png → ImageData (RGBA)
2. GRAYSCALE + THRESHOLD
     pixel darker than ~128 → LINE (black)
     else → FILLABLE (white)
     (kills anti-alias fuzz; everything becomes 1-bit)
3. MORPHOLOGICAL CLOSE on the line mask
     dilate lines ~2px then erode ~2px
     → seals hairline gaps the AI leaves open (the leak enemy)
     radius is the one tunable: bigger seals more gaps but eats thin detail
4. CONNECTED-COMPONENTS on white pixels (4-connectivity scan)
     each enclosed pocket → integer id 1,2,3...
     big outer background = its own id, marked "not colorable" (or allow fill)
5. DROP TINY REGIONS
     area < ~40px → merge into neighbor or treat as line (kills speckle)
6. WRITE regions.png
     encode id in pixel: R = id & 255, G = (id >> 8) & 255, B = 0
     supports 65k regions (far more than needed)
7. WRITE meta.json { count, filename, tinyMergedCount }
8. WRITE debug.png — each region a random bright tint, for the QA glance
```

Libraries: `sharp` (load/threshold/morphology) + ~40-line connected-components pass (or `image-js` / `ndarray`). Runs <1s per image.

**QA loop:** open `debug.png`. If two areas that should be separate got merged → a gap slipped through → bump close-radius OR hand-paint a black line across the leak in the source PNG, re-run. If over-split → lower radius / raise tiny-region threshold.

**Sharpest residual risk:** close-radius is per-art-*style*. If all designs share one AI prompt/style, one radius setting covers the whole library. Wildly varying styles may need per-image tuning.

---

## Runtime Hit-Test (in-browser, zero backend)

```
On design load:
   - draw line.png to the visible top <canvas>
   - load regions.png into an OFFSCREEN canvas; keep its ImageData in memory (never shown)
   - build a region index ONCE: Map<id, Int32Array of pixel offsets>   // single pass
   - fillCanvas (middle layer) starts transparent

On pointerdown(x, y):
   1. read regions pixel at (x,y) → id = R + (G << 8)
   2. if id is background or 0 → ignore
   3. loop the precomputed pixel list for that id → set them to chosen palette color on fillCanvas
      (O(region size), no full-image scan → buttery on cheap tablets)
   4. repaint. line.png stays crisp on top.
   5. juice: soft pop sound + region scale-bounce
```

### Why this beats the alternatives (the fork we resolved)
- **Raw SVG:** AI can't reliably emit clean multi-region SVG. Dead on arrival.
- **Auto-trace PNG→SVG:** gives the outline *stroke* as one path, not fillable *areas*. Wrong primitive.
- **Label-map:** areas come from the pixels themselves, deterministically. Wins.

---

## Toddler Palette UX (1-4yr, tablet + phone)

### Colors: 12, not 18
The example site's 18 swatches suit 5-8yr. For 1-4yr → **12 max**, and they must all fit **one screen with no scroll** (toddlers can't scroll reliably). Named crayon-box colors they recognize:

```
red  orange  yellow  green
blue  purple  pink   brown
black  white  skin   sky-blue
```
- High saturation only. No subtle pairs (teal vs green confuses).
- **White doubles as eraser** (fill-to-white).
- No custom color picker — too fiddly.
- Optional delight: one **🌈 magic swatch** = random bright color. Toddlers love unpredictability.

### Sizes (fat-finger math)
- Swatch: **min 80px, target ~96px** square, rounded (adults need 44px; toddlers ~2x).
- **16px** gaps so a sloppy poke can't hit two.
- **Selected state must SHOUT:** `scale(1.3)` + lift shadow + ring. Not a thin border. The baby must SEE which color is loaded.

### Layout — no scroll, one screen

**Tablet landscape:**
```
┌─────────────────────────────┬────────┐
│                             │ 🔴 🟠  │
│                             │ 🟡 🟢  │
│      COLORING IMAGE         │ 🔵 🟣  │
│      (big, ~70% width)      │ 🩷 🟤  │
│                             │ ⚫ ⚪  │
│                             │ 🟫 🩵  │
├─────────────────────────────┴────────┤
│  ↩️ undo      🧹 clean      🏠 home   │
└──────────────────────────────────────┘
```

**Phone portrait:**
```
┌──────────────────┐
│   COLORING IMAGE │  ~62% height
│                  │
├──────────────────┤
│ 🔴🟠🟡🟢🔵🟣     │  2 rows × 6
│ 🩷🟤⚫⚪🟫🩵     │
├──────────────────┤
│ ↩️undo 🧹clean 🏠 │
└──────────────────┘
```

### Undo + clean
State is tiny (`Map<regionId, color>`), so keep a full undo stack cheap:
- **↩️ Undo** — pops one fill. Multi-step, unlimited (memory is nothing).
- **🧹 Clean** — wipes all, but pushes prior state to the stack first so undo can rescue it. Make it a satisfying sweep animation (toddlers love clear-and-restart).
- **No redo** — too abstract for the age. Undo alone suffices.

### Parent gate (the reframe)
- **🏠 home = "hold 3 seconds"** ring that fills. Purpose is *keep-on-task*, not safety — stops the baby accidentally bailing mid-drawing. A toddler can't sustain a deliberate 3s hold; a parent can.
- Everything else (undo, clean, swatches): **instant, no gate.** Never make a toddler wait to color.

### Feedback / juice = mandatory, not polish
For this age the feedback *is* the product. Budget real time here.
- Every fill: soft **pop** + region `scale` bounce.
- Every swatch tap: **click** + grow.

---

## Toddler-UX Principles (reference)
- Fat-finger-proof — giant targets, no small buttons, no precise gestures.
- No reading — zero text UI, icons + sound only.
- No dead ends / no fail states — can't get stuck, nothing to lose, no timers.
- Instant juicy feedback on every poke.
- No scrolling anywhere — everything on one screen.
- Tablet-first, landscape, but responsive to phone portrait.

---

## Open / Next-Round Items
1. **Gallery screen design** — grid of design thumbnails (like the example's card grid), big tap targets, no text needed.
2. **The `preprocess.js` implementation** — the one piece with real engineering; connected-components + morphology.
3. **Sound assets** — pop / click / sweep. Keep tiny, preload.
4. **Free-scribble "crayon" mode** — deferred to v2 (bucket-only for v1).

---

## Build Order (when ready)
1. Scaffold Next.js static app + Vercel config.
2. `preprocess.js` — get one unicorn design fully processed end-to-end.
3. Coloring screen — 3-layer canvas + region hit-test + palette.
4. Undo/clean/home controls + juice.
5. Gallery screen linking designs.
6. Batch-process the rest of the design library.
