# Canvas UI Playground

A playground for the hardest layout problem in creative tools: **one canvas, one deep
settings menu, two completely different ergonomics.**

On desktop it is a three-column editor — icon rail, resizable settings panel, canvas
workspace. On a phone the same app becomes a full-bleed canvas with a draggable bottom
sheet. Same markup, same state, same controls — the widgets just change size, position
and density.

No build step, no dependencies. Static files, deploys to Vercel as-is.

---

## Run it

```bash
npx serve .
```

Then open <http://localhost:3000>. Any static server works — there is nothing to compile.

## Deploy to Vercel

```bash
vercel --prod
```

Or import the repo at [vercel.com/new](https://vercel.com/new). Framework preset:
**Other**. Build command: none. Output directory: `./`. `vercel.json` already sets
`cleanUrls` and sensible headers.

---

## What's in it

**Canvas** — 1:1, 4:5, 9:16 and 16:9 artboards rendering at their native pixel size
(1080×1080 up to 1920×1080), independent of screen zoom or device DPR.

**Six settings categories**, ~45 controls total, covering every control type worth
testing: sliders (with tick marks, bipolar fills and drag-to-scrub value badges),
switches, segmented radios, native selects, text inputs, an XY pad and a colour picker
with a swatch palette + hex entry.

**Presets** — five worked examples (Aurora, Brutalist, Orbit, Story poster, Monochrome)
that give you real states to compare layouts against instead of an empty canvas.

**Export** — PNG / JPG / WebP at 1×, 2× or 3×, rendered offscreen at full resolution.

**Device preview** — the toolbar above the app reframes it as a 390×844 phone,
430×932 phone, or 834×1112 tablet, portrait or landscape, without touching devtools.
Because the layout switch is driven by the app's own measured width rather than a
viewport media query, what you see in the frame is genuinely the mobile UI.

---

## The responsive techniques on show

This is the actual point of the playground. Each of these is a decision you have to make
once and then live with everywhere.

### One layout truth, in JS and CSS

A `ResizeObserver` on the app root writes `data-layout="mobile|desktop"`. Every CSS rule
keys off that attribute; every JS branch reads the same attribute. There is no case where
CSS thinks it's mobile and JS disagrees — and a media query could never do this, because
the device-preview frame is narrower than the window that contains it.

```css
[data-layout="mobile"] .t-desk { display: none !important; }
[data-layout="desktop"] .t-mob { display: none !important; }
```

### Density as tokens, not as duplicated rules

Every control is written once. The desktop/mobile difference is eight custom properties:

```css
.app[data-layout="mobile"] {
  --ctl-h: 44px;   --tap: 44px;   --thumb: 26px;  --track: 6px;
  --row-gap: 18px; --pad-x: 16px; --label-fs: 15px; --topbar-h: 54px;
}
```

A 15px slider thumb becomes a 26px one; a 30px row becomes 44px. No `.slider--mobile`
anywhere. Hybrid devices (`pointer: coarse` on a wide screen) get an in-between tap size.

### One control tree, two homes

The settings DOM is built once from `js/schema.js` and *moved* between the desktop panel
and the mobile sheet on layout change:

```js
(next === 'mobile' ? sheetBody : panelBody).append(controlsHost);
```

Not rendered twice, not hidden and duplicated. Focus, scroll position and input state
survive the move, and the two layouts can never drift out of sync.

### A bottom sheet that behaves

Three snap points (peek / half / full), velocity-projected release, rubber-banding past
the edges, and scroll hand-off: dragging down when the content is already scrolled to
the top collapses the sheet instead of fighting it. `touch-action` is assigned per
region — `pan-x` on the chip strip, `pan-y` in the scrolling body, `none` on the sheet
itself — so gestures never get stolen from the wrong element.

The canvas viewport reserves the peek height as bottom padding, so the artwork stays
optically centred in the space the sheet leaves behind rather than hiding under it.

### Progressive toolbar, not just two breakpoints

"Desktop" is not one width. Between 860px and a roomy window the toolbar sheds controls
in priority order via container queries — zoom box first, then the aspect switcher, then
the title — and every dropped control still has a home elsewhere (aspect lives in the
Canvas panel, zoom on the HUD pill and ⌘+scroll).

### Canvas sizing that respects the device

The backing store is sized from the *measured* CSS box × DPR, capped at 2× and at 4.2
megapixels total. A 3× phone screen never allocates a 12 MP buffer to draw a preview.
Export is a separate offscreen render at true native size, so what you download does not
depend on what your screen can show.

### Touch gestures on the workspace

Pinch to zoom (two-pointer tracking with a focal point), one-finger pan, double-tap to
toggle fit ↔ 100%, and ⌘/Ctrl + scroll to zoom at the cursor on desktop.

### The details that only bite on real phones

- `100dvh`, not `100vh` — no jump when the browser chrome hides.
- `env(safe-area-inset-*)` on the top bar, rail, sheet and HUD, with `viewport-fit=cover`.
- `font-size: 16px` on mobile inputs, because iOS zooms the page on focus below that.
- `overscroll-behavior: none` on the shell to kill pull-to-refresh mid-drag.
- `visualViewport` tracking so the sheet lifts above the software keyboard.
- `-webkit-text-size-adjust: 100%` so rotating the phone doesn't resize type.
- Popovers become bottom-anchored sheets on mobile — always inside thumb reach, never
  clipped by a screen edge.

### Accessibility that survives both layouts

Real radio groups with arrow-key navigation, `role="switch"` checkboxes, a focus-visible
ring on everything, `prefers-reduced-motion` honoured globally, and full keyboard
shortcuts (press <kbd>?</kbd>).

---

## Layout of the code

```
index.html          markup + inline SVG icon sprite
styles/
  tokens.css        colour, spacing, radii, density and motion tokens
  base.css          reset and primitives (buttons, pills, popovers, toast, modal)
  layout.css        app shell, chrome, and the desktop/mobile switch
  controls.css      every control, sized from density tokens
  sheet.css         the mobile bottom sheet
js/
  schema.js         declarative settings — the single source both layouts render from
  store.js          observable state + localStorage persistence
  controls.js       schema → DOM widgets, with sync() for programmatic changes
  render.js         pure canvas drawing (live preview and export share it)
  viewport.js       artboard sizing, zoom, pinch, pan
  sheet.js          bottom-sheet snap points and gestures
  app.js            wiring: layout decision, render loop, chrome
```

**Adding a setting** is one object in `js/schema.js` and one branch in `render.js`. The
panel, the sheet, the reset baseline, the randomizer, the "modified" dots and persistence
all pick it up automatically.

## Browser support

Targets current Chrome, Safari, Firefox and Edge. Uses container queries, `:has()`,
`color-mix()`, the Popover API and `ResizeObserver`. Without JS the page still renders a
single-column shell rather than a broken three-column one.

## Licence

MIT.
