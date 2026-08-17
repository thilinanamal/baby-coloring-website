# Making New Coloring Designs (Google Nano Banana Pro)

This app fills regions that are enclosed by **closed black outlines**. The whole
quality of the coloring experience depends on the line art following a few rules.
Follow this guide and each new design takes ~2 minutes end to end.

---

## 1. Generate the line art in Nano Banana Pro

**Prompt template** (replace `[SUBJECT]`):

```
Coloring page for toddlers, cute kawaii [SUBJECT], thick bold clean solid black
outlines, pure white background, large simple closed shapes, no shading, no
grayscale, no color, no fill, no texture, no gradient, minimal fine detail,
high contrast, every outline fully connected and closed, centered, white space
around the subject.
```

Example subjects: `baby unicorn`, `smiling cloud with rainbow`, `happy sun`,
`cute cat`, `little boat`, `friendly dinosaur`, `ice cream cone with a face`.

### Rules that keep the pipeline happy
- **Plain white background, no scenery.** This is the big one. Do NOT ask for sky,
  ground, grass, or a horizon line. A partial divider line (one that stops partway
  instead of reaching both image edges) does NOT separate the areas — sky and
  ground stay one connected region and fill with a single tap. Keep the character
  on empty white and this never happens.
- **Nothing bleeds off the edge.** The whole subject must sit inside the frame with
  a white margin. Cropped ears/tails touching the border cause open regions.
- **Closed outlines.** Every shape must be fully enclosed. Open gaps let color
  leak between areas (or merge two areas into one).
- **Thick lines.** Thin lines can vanish when the image is thresholded. Ask for
  "thick bold outlines."
- **Pure black on pure white.** No gray shading, no gradients, no colored fills.
  Those confuse region detection.
- **Few, large shapes.** Toddlers want big areas to tap. Fewer regions also means
  fewer QA surprises. Avoid busy fine detail.

> **Why sky + ground merged on the dog design:** its horizon line did not reach the
> image edges, so the background was actually one connected area. A bigger `--close`
> can't fix this — the divider must be closed in the *art*. Prefer plain white
> backgrounds; the character's own parts (ears, face, paws, tail) are always
> separate because their outlines are closed.

### Export
- Download the **highest resolution PNG**.
- Resize to roughly **1000–1500 px** on the long side (square is ideal).
- Keep it as `something.png` somewhere you can point the script at.

---

## 2. Run the preprocess pipeline

```bash
node scripts/preprocess.mjs <path/to/your.png> public/designs/<design-id>/ \
  --close=2 --min=60 --name="Nice Display Name"
```

- `<design-id>` — a short kebab-case folder name, e.g. `baby-unicorn`.
- `--close` — gap-sealing strength (dilate+erode radius). Bigger seals larger
  gaps but eats thin detail. Start at `2`; go `3`–`4` if art has hairline gaps.
- `--min` — smallest region kept (px). Below this, a region merges into its
  biggest neighbour (kills speckle). Raise it if you get tiny junk regions.
- `--name` — the label (currently unused in the toddler UI, stored in meta).

This writes into `public/designs/<design-id>/`:
- `line.png` — the display line art (flattened onto white)
- `regions.png` — the hidden label map the app hit-tests (never shown)
- `meta.json` — `{ count, backgroundIds, w, h, ... }`
- `debug.png` — QA image, **not loaded at runtime**

---

## 3. QA — open `debug.png` (the 30-second glance)

Each region gets a random bright tint. Check:
- **Two areas that should be separate share one color?** → a gap let them merge.
  Fix: increase `--close`, OR open the source PNG and thicken/close the gap with
  a black brush, then re-run.
- **One area split into confetti?** → lower `--close` or raise `--min`.
- **Big outer background** is expected to be one region and is auto-marked
  non-colorable (`backgroundIds`) because it touches the border. Fine.

Re-run step 2 until `debug.png` looks clean.

---

## 4. Register + ship

```bash
node scripts/build-manifest.mjs   # regenerates public/designs/designs.json
```

Then commit and push. Vercel auto-deploys. The new design shows up in the gallery.

> Tip: to remove a design, delete its `public/designs/<id>/` folder and re-run
> `build-manifest.mjs`.

---

## Quick reference

| Symptom | Fix |
|---|---|
| Color leaks between two shapes | close the outline gap; raise `--close` |
| Two shapes are one region | same as above |
| Tiny junk regions | raise `--min` |
| Thin lines disappeared | ask AI for thicker outlines; lower `--close` |
| Whole picture is one region | outlines not closed / too light; regenerate art |
