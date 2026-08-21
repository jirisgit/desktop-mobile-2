/* ==========================================================================
   render.js — pure canvas drawing. Nothing here touches the DOM chrome, so
   the same function paints the live preview and the full-resolution export.
   ========================================================================== */

import { ASPECTS } from './schema.js';

/* --------------------------------------------------------------- colour */

function hex2rgb(hex) {
  const s = String(hex).replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
  return Number.isNaN(n) ? [136, 136, 136] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a = 1) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; };
function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

/* -------------------------------------------------------------- random */

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------- grain cache */

let grainTile = null;
function getGrain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const g = c.getContext('2d');
  const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/* --------------------------------------------------------------- paths */

function shapePath(ctx, kind, r, cornerPct) {
  ctx.beginPath();
  switch (kind) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square': {
      const rad = Math.min(r, r * (cornerPct / 50));
      ctx.roundRect(-r, -r, r * 2, r * 2, rad);
      break;
    }
    case 'triangle': {
      const R = r * 1.15;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      const spikes = 5, inner = r * 0.44;
      for (let i = 0; i < spikes * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / spikes;
        const rr = i % 2 ? inner : r;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    }
    case 'cross': {
      const t = r * 0.34, rad = Math.min(t, t * (cornerPct / 50));
      ctx.roundRect(-t, -r, t * 2, r * 2, rad);
      ctx.roundRect(-r, -t, r * 2, t * 2, rad);
      break;
    }
    default:
      ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

/* ------------------------------------------------------------- layout */

function positions(s, iw, ih, rand) {
  const n = Math.max(1, Math.round(s.count));
  const out = [];
  const jit = s.jitter / 100;

  if (s.arrange === 'grid') {
    const cols = Math.max(1, Math.min(Math.round(s.cols), n));
    const rows = Math.ceil(n / cols);
    const cw = iw / cols, ch = ih / rows;
    const cell = Math.min(cw, ch);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push({
        x: (c + 0.5) * cw - iw / 2 + (rand() - 0.5) * cell * jit,
        y: (r + 0.5) * ch - ih / 2 + (rand() - 0.5) * cell * jit,
        t: n === 1 ? 0 : i / (n - 1),
        cell,
      });
    }
  } else if (s.arrange === 'ring') {
    const R = (Math.min(iw, ih) * s.ringR) / 100;
    const cell = Math.min(iw, ih) / Math.sqrt(Math.max(n, 1));
    const spin = (s.ringSpin * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = spin - Math.PI / 2 + (i / n) * Math.PI * 2;
      out.push({
        x: Math.cos(a) * R + (rand() - 0.5) * cell * jit,
        y: Math.sin(a) * R + (rand() - 0.5) * cell * jit,
        t: n === 1 ? 0 : i / (n - 1),
        cell,
      });
    }
  } else {
    const spread = 0.35 + jit * 0.65;
    const cell = Math.min(iw, ih) / Math.sqrt(Math.max(n, 1));
    for (let i = 0; i < n; i++) {
      out.push({
        x: (rand() - 0.5) * iw * spread * 2,
        y: (rand() - 0.5) * ih * spread * 2,
        t: n === 1 ? 0 : i / (n - 1),
        cell,
      });
    }
  }
  return out;
}

/* ----------------------------------------------------------------- text */

const FONTS = {
  sans: '"Inter", ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", "Noto Serif", serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
};

function drawText(ctx, s, W, H, u) {
  if (!s.textOn) return;
  const head = s.upper ? String(s.text || '').toUpperCase() : String(s.text || '');
  const sub = s.upper ? String(s.sub || '').toUpperCase() : String(s.sub || '');
  if (!head && !sub) return;

  const pad = (W * s.padding) / 100;
  const maxW = W - pad * 2;
  const size = (Math.min(W, H) * s.fontSize) / 100;

  const x = s.align === 'left' ? pad : s.align === 'right' ? W - pad : W / 2;
  const y = (H * s.textY) / 100;

  ctx.save();
  ctx.textAlign = s.align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = s.textColor;
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${(s.tracking * u) / 10}px`;

  if (head) {
    let fs = size;
    ctx.font = `${s.weight} ${fs}px ${FONTS[s.font] || FONTS.sans}`;
    const w = ctx.measureText(head).width;
    if (w > maxW) {
      fs = fs * (maxW / w);
      ctx.font = `${s.weight} ${fs}px ${FONTS[s.font] || FONTS.sans}`;
    }
    ctx.fillText(head, x, y);
  }

  if (sub) {
    const fs2 = size * 0.36;
    ctx.font = `400 ${fs2}px ${FONTS[s.font] || FONTS.sans}`;
    ctx.globalAlpha = 0.7;
    let w = ctx.measureText(sub).width;
    if (w > maxW) ctx.font = `400 ${fs2 * (maxW / w)}px ${FONTS[s.font] || FONTS.sans}`;
    ctx.fillText(sub, x, y + size * 0.62);
  }
  ctx.restore();
}

/* ================================================================ draw */

/**
 * Paint one frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} s   settings
 * @param {number} W   output width in device pixels
 * @param {number} H   output height in device pixels
 * @param {{guides?:boolean}} [opt]
 */
export function draw(ctx, s, W, H, opt = {}) {
  const base = ASPECTS[s.aspect] || ASPECTS['1:1'];
  const u = W / base.w;                       // design-px → output-px
  const rand = rng(Math.round(s.seed) * 7919);

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  /* ---- rounded artboard clip ---- */
  const rad = (Math.min(W, H) / 2) * (s.radius / 100);
  if (rad > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, rad);
    ctx.clip();
  }

  /* ---- background ---- */
  if (s.bgMode === 'solid') {
    ctx.fillStyle = s.bg1;
    ctx.fillRect(0, 0, W, H);
  } else if (s.bgMode === 'gradient') {
    const a = ((s.bgAngle - 90) * Math.PI) / 180;
    const len = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    const g = ctx.createLinearGradient(
      W / 2 - (Math.cos(a) * len) / 2, H / 2 - (Math.sin(a) * len) / 2,
      W / 2 + (Math.cos(a) * len) / 2, H / 2 + (Math.sin(a) * len) / 2);
    g.addColorStop(0, s.bg1);
    g.addColorStop(1, s.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (s.bgMode !== 'none' && s.bgSoft > 0) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.28, 0, W * 0.5, H * 0.28, Math.max(W, H) * 0.75);
    g.addColorStop(0, `rgba(255,255,255,${(s.bgSoft / 100) * 0.22})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- composition ---- */
  const pad = (Math.min(W, H) * s.padding) / 100;
  const iw = W - pad * 2, ih = H - pad * 2;
  const origin = s.origin || { x: 50, y: 50 };

  ctx.save();
  ctx.translate(pad + iw * (origin.x / 100), pad + ih * (origin.y / 100));
  ctx.scale(s.scale / 100, s.scale / 100);

  ctx.globalCompositeOperation = s.blend;
  ctx.globalAlpha = s.opacity / 100;
  if (s.blur > 0) ctx.filter = `blur(${s.blur * u}px)`;
  if (s.glowOn && s.glow > 0) {
    ctx.shadowColor = rgba(s.glowColor, Math.min(1, s.glow / 100));
    ctx.shadowBlur = (s.glow / 100) * 60 * u;
  }

  const pts = positions(s, iw, ih, rand);
  const baseRot = (s.rotate * Math.PI) / 180;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const vr = 1 - (s.sizeVar / 100) * rand();
    const r = (p.cell / 2) * (s.size / 100) * vr;
    if (r <= 0.2) continue;

    const rot = baseRot + (rand() - 0.5) * Math.PI * 2 * (s.rotateVar / 100);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rot);

    ctx.fillStyle = s.fillMode === 'solid' ? s.fill1
      : s.fillMode === 'duo' ? (i % 2 ? s.fill2 : s.fill1)
        : mix(s.fill1, s.fill2, p.t);

    shapePath(ctx, s.shape, r, s.corner);
    ctx.fill();

    if (s.strokeOn && s.strokeW > 0) {
      ctx.lineWidth = s.strokeW * u;
      ctx.strokeStyle = s.strokeColor;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  /* ---- type ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  drawText(ctx, s, W, H, u);
  ctx.restore();

  /* ---- surface treatments ---- */
  if (s.tintOn && s.tintAmt > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = rgba(s.tint, s.tintAmt / 100);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (s.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28,
      W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${(s.vignette / 100) * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (s.grain > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (s.grain / 100) * 0.5;
    const pat = ctx.createPattern(getGrain(), 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---- workspace guides (never exported) ---- */
  if (opt.guides) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(108,124,255,.9)';
    ctx.setLineDash([6 * u, 6 * u]);
    ctx.lineWidth = 1.5 * u;
    const m = (Math.min(W, H) * s.padding) / 100;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    ctx.strokeStyle = 'rgba(255,95,107,.75)';
    ctx.strokeRect(W * 0.06, H * 0.12, W * 0.88, H * 0.76);
    ctx.restore();
  }

  ctx.restore();
}

/** Render at full native resolution into a detached canvas (for export). */
export function renderExport(s, scale = 1, opaqueBg = null) {
  const base = ASPECTS[s.aspect] || ASPECTS['1:1'];
  const c = document.createElement('canvas');
  c.width = Math.round(base.w * scale);
  c.height = Math.round(base.h * scale);
  const ctx = c.getContext('2d');
  if (opaqueBg) {
    ctx.fillStyle = opaqueBg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  draw(ctx, s, c.width, c.height);
  return c;
}
