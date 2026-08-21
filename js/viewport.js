/* ==========================================================================
   viewport.js — sizing the artboard, zoom, pinch and pan.
   The canvas backing store is sized from the *measured* CSS box × DPR and
   capped, so a 3× phone screen never allocates a 12 MP buffer for a preview.
   ========================================================================== */

import { ASPECTS } from './schema.js';

const MAX_PIXELS = 4.2e6;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;

export function createViewport({ viewport, artboard, canvas, app, ui, onChange }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  let avail = { w: 0, h: 0 };
  let fitScale = 1;
  let cssW = 0, cssH = 0;

  /* ------------------------------------------------------------ sizing */

  function base() { return ASPECTS[currentAspect()] || ASPECTS['1:1']; }
  let currentAspect = () => '1:1';
  function setAspectGetter(fn) { currentAspect = fn; }

  function measure() {
    const cs = getComputedStyle(viewport);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    avail = {
      w: Math.max(40, viewport.clientWidth - padX),
      h: Math.max(40, viewport.clientHeight - padY),
    };
  }

  function layout() {
    measure();
    const b = base();
    fitScale = Math.min(avail.w / b.w, avail.h / b.h);

    const zoom = ui.zoom > 0 ? ui.zoom : fitScale;
    cssW = Math.max(24, Math.round(b.w * zoom));
    cssH = Math.max(24, Math.round(b.h * zoom));

    artboard.style.width = cssW + 'px';
    artboard.style.height = cssH + 'px';

    /* backing store */
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cssW * cssH * dpr * dpr > MAX_PIXELS) {
      dpr = Math.sqrt(MAX_PIXELS / (cssW * cssH));
    }
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    onChange?.({ zoom: zoomPct(), fit: Math.abs(zoom - fitScale) < 1e-6, cssW, cssH });
    return { bw, bh };
  }

  const zoomPct = () => Math.round((ui.zoom > 0 ? ui.zoom : fitScale) * 100);

  /* -------------------------------------------------------------- zoom */

  function setZoom(next, focal) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    const prev = ui.zoom > 0 ? ui.zoom : fitScale;
    ui.zoom = clamped;

    const sl = viewport.scrollLeft, st = viewport.scrollTop;
    layout();

    if (focal) {
      const r = viewport.getBoundingClientRect();
      const fx = focal.x - r.left + sl;
      const fy = focal.y - r.top + st;
      const k = clamped / prev;
      viewport.scrollLeft = fx * k - (focal.x - r.left);
      viewport.scrollTop = fy * k - (focal.y - r.top);
    }
    return clamped;
  }

  function zoomBy(mult, focal) { return setZoom((ui.zoom > 0 ? ui.zoom : fitScale) * mult, focal); }
  function fit() { ui.zoom = 0; layout(); }
  function actual() { setZoom(1); }

  /* ------------------------------------------------------- pinch + pan */

  const pointers = new Map();
  let pinch = null;
  let pan = null;

  viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('.pill, .btn')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.setPointerCapture(e.pointerId);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        z: ui.zoom > 0 ? ui.zoom : fitScale,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      };
      pan = null;
    } else if (pointers.size === 1) {
      pan = { x: e.clientX, y: e.clientY, sl: viewport.scrollLeft, st: viewport.scrollTop };
    }
  });

  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0) setZoom(pinch.z * (d / pinch.d), { x: pinch.cx, y: pinch.cy });
      return;
    }
    if (pan) {
      viewport.scrollLeft = pan.sl - (e.clientX - pan.x);
      viewport.scrollTop = pan.st - (e.clientY - pan.y);
    }
  });

  const release = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) pan = null;
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  /* ctrl/⌘ + wheel zooms, plain wheel scrolls the workspace */
  viewport.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  /* double-tap / double-click toggles fit ↔ 100% */
  let lastTap = 0;
  viewport.addEventListener('pointerup', e => {
    const now = performance.now();
    if (now - lastTap < 300 && pointers.size === 0) {
      const isFit = Math.abs((ui.zoom > 0 ? ui.zoom : fitScale) - fitScale) < 1e-6;
      isFit ? setZoom(1, { x: e.clientX, y: e.clientY }) : fit();
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });

  /* ---------------------------------------------------------- observe */

  const ro = new ResizeObserver(() => layout());
  ro.observe(viewport);

  return {
    ctx, layout, setZoom, zoomBy, fit, actual, setAspectGetter,
    get fitScale() { return fitScale; },
    get zoomPct() { return zoomPct(); },
    get size() { return { cssW, cssH, w: canvas.width, h: canvas.height }; },
  };
}
