/* ==========================================================================
   app.js — wiring. Owns the desktop/mobile decision, the render loop and
   all the chrome that surrounds the canvas.
   ========================================================================== */

import { CATEGORIES, ASPECTS, PRESETS, DEFAULTS, FIELD_INDEX, RANDOMIZABLE, PALETTE } from './schema.js';
import { state, ui, set, resetAll, subscribe, saveUI } from './store.js';
import { buildControls, syncColorPop, h, icon } from './controls.js';
import { draw, renderExport } from './render.js';
import { createSheet } from './sheet.js';
import { createViewport } from './viewport.js';

const $ = id => document.getElementById(id);

const el = {
  root: document.documentElement,
  stagehand: $('stagehand'), devbar: $('devbar'), devSize: $('devSize'), device: $('device'),
  app: $('app'), rail: $('rail'), chips: $('chips'),
  panel: $('panel'), panelBody: $('panelBody'), panelTitle: $('panelTitle'),
  panelCollapse: $('panelCollapse'), panelReopen: $('panelReopen'), panelResize: $('panelResize'),
  sheet: $('sheet'), sheetGrab: $('sheetGrab'), sheetBody: $('sheetBody'),
  sheetHead: document.querySelector('.sheet__head'),
  host: $('controlsHost'),
  viewport: $('viewport'), artboard: $('artboard'), canvas: $('canvas'),
  hudSize: $('hudSize'), zoomVal: $('zoomVal'), zoomValMob: $('zoomValMob'),
  aspectTop: $('aspectTop'), presetName: $('presetName'), presetList: $('presetList'),
  presetPop: $('presetPop'), morePop: $('morePop'), toast: $('toast'),
  kbdModal: $('kbdModal'), kbdList: $('kbdList'),
};

const MOBILE_MAX = 860;

/* ==================================================================== theme */

function applyTheme(next) {
  ui.theme = next;
  el.root.dataset.theme = next;
  saveUI();
}
applyTheme(ui.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

/* ================================================================ controls */

el.host.hidden = false;
const controls = buildControls(el.host);

/* ---- rail (desktop) + chips (mobile), same categories ---- */

const railBtns = new Map();
const chipBtns = new Map();

for (const cat of CATEGORIES) {
  const rb = h('button', { class: 'rail__btn', type: 'button', title: cat.label,
    'data-cat': cat.id, 'aria-pressed': 'false' }, icon(cat.icon), h('span', { text: cat.label }));
  rb.addEventListener('click', () => selectCategory(cat.id));
  el.rail.append(rb);
  railBtns.set(cat.id, rb);

  const cb = h('button', { class: 'chip', type: 'button', role: 'tab',
    'data-cat': cat.id, 'aria-selected': 'false' }, icon(cat.icon), h('span', { text: cat.label }));
  cb.addEventListener('click', () => {
    selectCategory(cat.id);
    sheet.expand();
    cb.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
  el.chips.append(cb);
  chipBtns.set(cat.id, cb);
}

function selectCategory(id) {
  ui.category = id;
  saveUI();
  controls.setCategory(id);
  el.panelTitle.textContent = CATEGORIES.find(c => c.id === id)?.label ?? '';
  for (const [k, b] of railBtns) {
    b.classList.toggle('is-active', k === id);
    b.setAttribute('aria-pressed', k === id ? 'true' : 'false');
  }
  for (const [k, b] of chipBtns) b.setAttribute('aria-selected', k === id ? 'true' : 'false');
  el.panelBody.scrollTop = 0;
  el.sheetBody.scrollTop = 0;
}

/* ---- "this category has non-default values" dots ---- */

const catOfField = new Map([...FIELD_INDEX].map(([id, f]) => [id, f.category]));

function updateDirty() {
  const dirty = new Set();
  for (const [id, cat] of catOfField) {
    if (JSON.stringify(state[id]) !== JSON.stringify(DEFAULTS[id])) dirty.add(cat);
  }
  for (const [k, b] of railBtns) b.dataset.dirty = dirty.has(k) ? 'true' : 'false';
  for (const [k, b] of chipBtns) b.dataset.dirty = dirty.has(k) ? 'true' : 'false';
}

/* ============================================================ aspect chips */

for (const [key, a] of Object.entries(ASPECTS)) {
  const box = key === '1:1' ? [14, 14] : key === '4:5' ? [12, 15] : key === '9:16' ? [9, 15] : [16, 9];
  const b = h('button', { class: 'seg__btn', type: 'button', role: 'radio',
    'aria-checked': 'false', 'data-v': key, title: `${a.w} × ${a.h}` },
    h('span', { class: 'seg__ratio', style: `width:${box[0]}px;height:${box[1]}px` }),
    h('span', { text: a.label }));
  b.addEventListener('click', () => set('aspect', key));
  el.aspectTop.append(b);
}

function syncAspectTop() {
  for (const b of el.aspectTop.children) {
    b.setAttribute('aria-checked', b.dataset.v === state.aspect ? 'true' : 'false');
  }
}

/* ================================================================= presets */

for (const p of PRESETS) {
  const b = h('button', { class: 'pop__item', type: 'button', 'data-preset': p.id },
    icon('i-check'), h('span', {}, h('b', { text: p.name }), h('small', { text: p.hint })));
  b.addEventListener('click', () => {
    set({ ...DEFAULTS, ...p.values });
    ui.preset = p.id;
    saveUI();
    el.presetPop.hidePopover();
    toast(`Preset · ${p.name}`);
  });
  el.presetList.append(b);
}

function detectPreset() {
  const hit = PRESETS.find(p => Object.entries(p.values).every(
    ([k, v]) => JSON.stringify(state[k]) === JSON.stringify(v)));
  ui.preset = hit?.id || '';
  if (el.presetName) el.presetName.textContent = hit ? hit.name : 'Custom';
  for (const b of el.presetList.children) {
    b.classList.toggle('is-active', b.dataset.preset === ui.preset);
  }
}

/* ================================================================ viewport */

const vp = createViewport({
  viewport: el.viewport, artboard: el.artboard, canvas: el.canvas,
  app: el.app, ui,
  onChange: info => {
    el.zoomVal.textContent = info.zoom + '%';
    el.zoomValMob.textContent = info.zoom + '%';
    scheduleDraw();
  },
});
vp.setAspectGetter(() => state.aspect);

/* =================================================================== sheet */

const scrim = h('div', { class: 'scrim' });
scrim.addEventListener('click', () => sheet.collapse());
el.app.insertBefore(scrim, el.sheet);

const sheet = createSheet({
  sheet: el.sheet, grab: el.sheetGrab, head: el.sheetHead, body: el.sheetBody, app: el.app,
  onSnap: () => { requestAnimationFrame(() => vp.layout()); },
});

/* ============================================================ layout switch */

let layout = '';

function resolveLayout() {
  const w = el.app.clientWidth;
  const next = w <= MOBILE_MAX ? 'mobile' : 'desktop';
  el.app.dataset.touch = matchMedia('(pointer: coarse)').matches ? 'true' : 'false';
  if (next === layout) { sheet.measure(); return; }
  layout = next;
  el.app.dataset.layout = next;

  /* one controls tree, two homes */
  (next === 'mobile' ? el.sheetBody : el.panelBody).append(el.host);

  if (next === 'desktop') {
    el.app.style.setProperty('--panel-w', ui.panelW + 'px');
    el.app.dataset.panel = ui.panelCollapsed ? 'collapsed' : 'open';
  } else {
    el.app.dataset.panel = 'open';
  }

  requestAnimationFrame(() => {
    sheet.measure();
    vp.layout();
  });
}

new ResizeObserver(resolveLayout).observe(el.app);

/* ============================================================ render loop */

let frame = 0;
function scheduleDraw() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const { w, h: hh } = vp.size;
    draw(vp.ctx, state, w, hh, { guides: state.showGuides });
    el.artboard.classList.toggle('is-checker', state.bgMode === 'none');
    const b = ASPECTS[state.aspect];
    el.hudSize.textContent = `${b.w} × ${b.h}`;
  });
}

subscribe((changed, opts) => {
  controls.refresh();
  controls.syncAll();
  syncColorPop();
  syncAspectTop();
  updateDirty();
  detectPreset();

  if (changed.includes('aspect')) {
    vp.layout();
    requestAnimationFrame(() => vp.layout());
  }
  if (opts?.live && !state.liveRender) return;
  scheduleDraw();
});

/* ================================================================== export */

async function doExport() {
  const scale = Number(state.exScale) || 1;
  const fmt = state.format;
  const mime = fmt === 'png' ? 'image/png' : fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const needsBg = fmt !== 'png' && state.bgMode === 'none';

  const c = renderExport(state, scale, needsBg ? '#ffffff' : null);
  const blob = await new Promise(res => c.toBlob(res, mime, state.quality / 100));
  if (!blob) { toast('Export failed'); return; }

  const ext = fmt === 'jpeg' ? 'jpg' : fmt;
  const name = `${(state.filename || 'canvas').replace(/[^\w.-]+/g, '-')}-${state.aspect.replace(':', 'x')}@${scale}x.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  const kb = blob.size / 1024;
  const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  toast(`${c.width}×${c.height} · ${size}`);
}

/* =============================================================== randomize */

function randomize() {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const patch = {};
  for (const id of RANDOMIZABLE) {
    if (id === 'aspect') continue;          // keep the frame the user chose
    const f = FIELD_INDEX.get(id);
    if (!f) continue;
    if (f.type === 'slider') {
      patch[id] = Math.round(rnd(f.min, f.max) / f.step) * f.step;
    } else if (f.type === 'seg' || f.type === 'select') {
      patch[id] = f.options[Math.floor(Math.random() * f.options.length)].value;
    } else if (f.type === 'switch') {
      patch[id] = Math.random() > 0.45;
    } else if (f.type === 'color') {
      patch[id] = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }
  }
  patch.count = Math.round(rnd(3, 40));
  patch.opacity = Math.round(rnd(55, 100));
  patch.blur = Math.random() > 0.75 ? Math.round(rnd(1, 12)) : 0;
  set(patch);
  controls.syncAll();
  toast('Randomized');
}

function doReset() {
  resetAll();
  controls.syncAll();
  syncAspectTop();
  toast('Reset to defaults');
}

/* =================================================================== toast */

let toastTimer = 0;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 1900);
}

/* ================================================================== chrome */

$('themeBtn').addEventListener('click', () => applyTheme(ui.theme === 'dark' ? 'light' : 'dark'));
$('exportBtn').addEventListener('click', doExport);
$('exportBtnM').addEventListener('click', doExport);
$('randomBtn').addEventListener('click', randomize);
$('randomBtnM').addEventListener('click', randomize);
$('resetBtn').addEventListener('click', doReset);

$('zoomIn').addEventListener('click', () => vp.zoomBy(1.25));
$('zoomOut').addEventListener('click', () => vp.zoomBy(1 / 1.25));
$('zoomVal').addEventListener('click', () => vp.fit());
$('zoomFitMob').addEventListener('click', () => vp.fit());

el.morePop.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  el.morePop.hidePopover();
  if (act === 'reset') doReset();
  if (act === 'theme') applyTheme(ui.theme === 'dark' ? 'light' : 'dark');
  if (act === 'fit') vp.fit();
});

/* ---- popover anchoring ----
   The popover API gives us the top layer and light-dismiss for free, but not
   placement. On mobile CSS pins every popover to the bottom edge, so we only
   compute coordinates for the desktop layout. */

function anchorPop(pop, btn, align = 'left') {
  pop.addEventListener('toggle', e => {
    if (e.newState !== 'open') return;
    if (el.app.dataset.layout === 'mobile') { pop.style.cssText = ''; return; }
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = align === 'right' ? r.right - pw : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  });
}
anchorPop(el.presetPop, $('presetBtn'), 'left');
anchorPop(el.morePop, $('moreBtn'), 'right');

/* ---- panel collapse + resize ---- */

el.panelCollapse.addEventListener('click', () => togglePanel(true));
el.panelReopen.addEventListener('click', () => togglePanel(false));

function togglePanel(collapsed) {
  ui.panelCollapsed = collapsed;
  el.app.dataset.panel = collapsed ? 'collapsed' : 'open';
  saveUI();
  requestAnimationFrame(() => vp.layout());
}

let resizing = null;
el.panelResize.addEventListener('pointerdown', e => {
  resizing = { x: e.clientX, w: ui.panelW };
  el.panelResize.setPointerCapture(e.pointerId);
  el.panelResize.classList.add('is-dragging');
  e.preventDefault();
});
el.panelResize.addEventListener('pointermove', e => {
  if (!resizing) return;
  ui.panelW = Math.max(240, Math.min(460, resizing.w + (e.clientX - resizing.x)));
  el.app.style.setProperty('--panel-w', ui.panelW + 'px');
});
const endResize = () => {
  if (!resizing) return;
  resizing = null;
  el.panelResize.classList.remove('is-dragging');
  saveUI();
  vp.layout();
};
el.panelResize.addEventListener('pointerup', endResize);
el.panelResize.addEventListener('pointercancel', endResize);
el.panelResize.addEventListener('keydown', e => {
  const d = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0;
  if (!d) return;
  e.preventDefault();
  ui.panelW = Math.max(240, Math.min(460, ui.panelW + d));
  el.app.style.setProperty('--panel-w', ui.panelW + 'px');
  saveUI();
});

/* ---- device preview ---- */

const DEVICES = {
  phone: [390, 844], 'phone-lg': [430, 932], tablet: [834, 1112],
};
let device = 'off';
let landscape = false;

function applyDevice() {
  el.stagehand.dataset.preview = device === 'off' ? 'off' : 'on';
  if (device === 'off') {
    el.devSize.textContent = 'auto';
  } else {
    const [w, hh] = DEVICES[device];
    const dw = landscape ? hh : w, dh = landscape ? w : hh;
    el.stagehand.style.setProperty('--dev-w', dw + 'px');
    el.stagehand.style.setProperty('--dev-h', dh + 'px');
    el.devSize.textContent = `${dw} × ${dh}`;
  }
  for (const b of el.devbar.querySelectorAll('[data-device]')) {
    const on = b.dataset.device === device;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  }
  requestAnimationFrame(() => { resolveLayout(); vp.layout(); });
}

el.devbar.addEventListener('click', e => {
  const b = e.target.closest('[data-device]');
  if (b) { device = b.dataset.device; applyDevice(); }
});
$('devRotate').addEventListener('click', () => { landscape = !landscape; applyDevice(); });

/* ---- keyboard ---- */

const SHORTCUTS = [
  ['1 – 4', 'Aspect ratio'],
  ['+ / −', 'Zoom in / out'],
  ['0', 'Fit to screen'],
  ['Shift + 0', 'Zoom to 100%'],
  ['⌘/Ctrl + scroll', 'Zoom at pointer'],
  ['D', 'Toggle theme'],
  ['R', 'Randomize'],
  ['Shift + R', 'Reset all settings'],
  ['E', 'Export image'],
  ['G', 'Toggle safe-area guides'],
  ['\\', 'Collapse settings panel'],
  ['[ / ]', 'Previous / next category'],
  ['?', 'This dialog'],
];
for (const [k, d] of SHORTCUTS) {
  el.kbdList.append(h('li', {}, h('span', { text: d }), h('kbd', { text: k })));
}
$('kbdBtn').addEventListener('click', () => el.kbdModal.showModal());
$('kbdClose').addEventListener('click', () => el.kbdModal.close());

window.addEventListener('keydown', e => {
  const t = e.target;
  if (t.matches?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;

  const keys = Object.keys(ASPECTS);
  const idx = CATEGORIES.findIndex(c => c.id === ui.category);

  switch (e.key) {
    case '1': case '2': case '3': case '4':
      set('aspect', keys[Number(e.key) - 1]); break;
    case '+': case '=': vp.zoomBy(1.25); break;
    case '-': case '_': vp.zoomBy(1 / 1.25); break;
    case '0': e.shiftKey ? vp.actual() : vp.fit(); break;
    case 'd': case 'D': applyTheme(ui.theme === 'dark' ? 'light' : 'dark'); break;
    case 'r': randomize(); break;
    case 'R': doReset(); break;
    case 'e': case 'E': doExport(); break;
    case 'g': case 'G': set('showGuides', !state.showGuides); controls.syncAll(); break;
    case '\\': togglePanel(!ui.panelCollapsed); break;
    case '[': selectCategory(CATEGORIES[(idx - 1 + CATEGORIES.length) % CATEGORIES.length].id); break;
    case ']': selectCategory(CATEGORIES[(idx + 1) % CATEGORIES.length].id); break;
    case '?': el.kbdModal.showModal(); break;
    case 'Escape': sheet.collapse(); break;
    default: return;
  }
  e.preventDefault();
});

/* ---- iOS: keep the sheet above the software keyboard ---- */

if (window.visualViewport) {
  const vv = window.visualViewport;
  const onVV = () => {
    const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    el.app.style.setProperty('--kb', overlap + 'px');
    if (overlap > 120 && layout === 'mobile') sheet.goTo('full');
  };
  vv.addEventListener('resize', onVV);
  vv.addEventListener('scroll', onVV);
}

/* ==================================================================== boot */

resolveLayout();
selectCategory(ui.category || 'canvas');
syncAspectTop();
updateDirty();
detectPreset();
applyDevice();
vp.layout();
scheduleDraw();

/* fonts can land after first paint and change text metrics */
document.fonts?.ready.then(() => scheduleDraw());
window.addEventListener('orientationchange', () => {
  setTimeout(() => { resolveLayout(); vp.layout(); sheet.measure(); }, 220);
});
