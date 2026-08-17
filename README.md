# 🎨 Baby Coloring Website

A dead-simple online coloring app for toddlers (ages 1–4). Kids tap regions of
cute kawaii line art to fill them with color — no accounts, no ads, no saving,
no reading required. Every visitor colors in their own isolated session.

**Live:** [babycoloringbook.vercel.app](https://babycoloringbook.vercel.app)

![Coloring a page](public/designs/dog/thumb.png)

---

## Features

- **Tap-to-fill coloring** — crisp, leak-proof region fills (no bucket-fill bleed).
- **Toddler-first UI** — giant touch targets, no text, no fail states, no scrolling on the coloring screen.
- **12-color palette + a 🌈 magic random color**, white doubles as an eraser.
- **Undo** (unlimited) and **hold-to-confirm Clean / Home** so a stray poke can't wipe a drawing or leave the page.
- **Nursery-rhyme background music** — public-domain melodies (Twinkle Twinkle, Old MacDonald, London Bridge, …) rendered as a music box, with a mute toggle.
- **No persistence** — nothing is saved; each visit / tab is a fresh, isolated session.
- **Randomized gallery** — a different set of designs greets you each visit.
- **Zero backend** — pure static site, deploys to Vercel free tier.

---

## How it works

The core trick is a **region map**. For every design there are two images:

| File | Purpose |
|------|---------|
| `line.png` | The black line art shown to the child (transparent fill areas). |
| `regions.png` | A hidden label map — every enclosed area painted a unique color, its id encoded in the pixel (`R + (G<<8)`). Never displayed. |

When a child taps the canvas, the app reads the pixel under their finger in the
**hidden** `regions.png`, finds which region id it belongs to, and floods that
region's pixels with the chosen color on a middle canvas layer. The line art
stays crisp on top. Because regions are precomputed, fills never leak.

The label maps are generated offline by an image pipeline (threshold →
morphological close to seal line gaps → connected-components → tiny-region
merge). See [`BRAINSTORM.md`](BRAINSTORM.md) for the full design rationale.

---

## Tech stack

- **Vite + React + TypeScript** — client-side SPA, `react-router-dom`.
- **Canvas 2D API** — region fills.
- **Web Audio + HTML Audio** — tap sounds and background music.
- **sharp** (Node) — offline image preprocessing.
- **fluidsynth + ffmpeg** — render nursery-rhyme MIDI to audio.
- **Vercel** — static hosting.

No backend, no database, no environment variables required to run.

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Build & preview the production bundle:

```bash
npm run build
npm run preview
```

---

## Adding a coloring design

Designs are AI-generated line art (e.g. Google "Nano Banana" / any image model).
Full art-prompt guidance is in [`DESIGN_GENERATION.md`](DESIGN_GENERATION.md) and
[`lineart-prompt-template.json`](lineart-prompt-template.json).

1. Generate line art following the prompt rules (thick closed black outlines,
   pure white background, no scenery, subject inside the frame).
2. Process it into a design:

   ```bash
   node scripts/preprocess.mjs your-art.png public/designs/<id>/ \
     --close=2 --min=60 --name="Nice Name"
   node scripts/build-manifest.mjs      # updates public/designs/designs.json
   ```

3. **QA:** open `public/designs/<id>/debug.png` — each region gets a random
   tint. If two areas that should be separate share a color, thicken/close the
   gap in the source art or raise `--close`, then re-run.

Batch-import a whole folder at once:

```bash
node scripts/import-art.mjs /path/to/folder --close=2 --min=60
```

Designs are capped at 1024px and get a 320px `thumb.png` for the gallery.

---

## Adding / changing music

Background tracks live in `public/music/` and are listed in `music.json`.

- **Nursery rhymes** are rendered from public-domain melodies. Edit the `SONGS`
  array in [`scripts/render-music.mjs`](scripts/render-music.mjs), then:

  ```bash
  SF2=/path/to/gm.sf2 node scripts/render-music.mjs   # needs fluidsynth + ffmpeg + a GM soundfont
  node scripts/build-music.mjs                         # updates music.json
  ```

- **Or drop your own** CC0 / public-domain audio files into `public/music/` and
  run `node scripts/build-music.mjs`. If a track requires attribution, credit it
  in `public/music/CREDITS.txt`.

---

## Deployment

The app is a static Vite build. On [Vercel](https://vercel.com):

1. Import the Git repository (Vite is auto-detected).
2. Confirm the **Production Branch** matches your default branch.
3. Every push then deploys automatically.

`vercel.json` provides the SPA rewrite so deep links (e.g. `/color/<id>`) resolve.

---

## Project structure

```
public/
  designs/<id>/     line.png, regions.png, thumb.png, meta.json, debug.png
  designs/designs.json
  music/            *.mp3, music.json, CREDITS.txt
scripts/
  preprocess.mjs        line art -> region map
  import-art.mjs        batch preprocess a folder
  build-manifest.mjs    regenerate designs.json
  render-music.mjs      MIDI -> nursery-rhyme audio
  build-music.mjs       regenerate music.json
src/
  pages/            Gallery, ColorPage
  components/       ColoringCanvas, Palette, Controls, HoldButton
  engine/           regionIndex, coords, fill (hit-test core)
  hooks/            useColoringState, useSound, useMusic
  audio/            shared AudioContext
```

---

## Credits & licensing

- **Music:** public-domain nursery-rhyme melodies, self-rendered — see
  [`public/music/CREDITS.txt`](public/music/CREDITS.txt).
- **Coloring art:** AI-generated; you are responsible for the rights to any art
  you add.

The source code in this repository is released under the [MIT License](LICENSE).
