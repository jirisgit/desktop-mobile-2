/* ==========================================================================
   controls.js — renders the schema into DOM widgets.
   Every widget registers a sync() so programmatic changes (presets, reset,
   randomize, keyboard) push back into the inputs without a rebuild.
   ========================================================================== */

import { CATEGORIES, PALETTE } from './schema.js';
import { state, set } from './store.js';
import { placePopover } from './popover.js';

/* ------------------------------------------------------------- helpers */

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function icon(id, cls = 'ico') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + id);
  svg.append(use);
  return svg;
}

const fmt = (v, f) => {
  const dec = String(f.step).includes('.') ? 1 : 0;
  return Number(v).toFixed(dec) + (f.unit || '');
};

/* ============================================================ build tree */

export function buildControls(host, opts = {}) {
  const instances = [];       // { field, el, sync }
  const conditionals = [];    // { el, when }

  for (const cat of CATEGORIES) {
    const section = h('div', { class: 'section', 'data-cat': cat.id, role: 'tabpanel',
                               'aria-label': cat.label });

    for (const group of cat.groups) {
      const wrap = h('div', { class: 'group' });
      if (group.label) wrap.append(h('h3', { class: 'group__head', text: group.label }));

      const fields = h('div', { class: 'fields' });
      for (const f of group.fields) {
        const built = buildField(f, opts);
        if (!built) continue;
        fields.append(built.el);
        if (built.sync) instances.push(built);
        if (f.when) conditionals.push({ el: built.el, when: f.when });
      }
      wrap.append(fields);
      if (group.when) conditionals.push({ el: wrap, when: group.when });
      section.append(wrap);
    }
    host.append(section);
  }

  function syncAll() {
    for (const it of instances) it.sync();
  }

  function refresh() {
    for (const c of conditionals) c.el.hidden = !c.when(state);
  }

  function setCategory(id) {
    for (const s of host.querySelectorAll('.section')) {
      s.classList.toggle('is-active', s.dataset.cat === id);
    }
  }

  refresh();
  syncAll();
  return { syncAll, refresh, setCategory, instances };
}

/* ============================================================ one field */

function buildField(f, opts) {
  switch (f.type) {
    case 'slider': return sliderField(f);
    case 'seg':    return segField(f);
    case 'switch': return switchField(f);
    case 'text':   return textField(f);
    case 'select': return selectField(f);
    case 'color':  return colorField(f);
    case 'xy':     return xyField(f);
    case 'note':   return { el: h('div', { class: 'note', html: f.html }) };
    default:       return null;
  }
}

/* ---------------------------------------------------------------- slider */

function sliderField(f) {
  const val = h('input', {
    class: 'field__val', type: 'text', inputmode: 'decimal', spellcheck: 'false',
    'aria-label': f.label + ' value',
  });

  const range = h('input', {
    type: 'range', min: f.min, max: f.max, step: f.step,
    'aria-label': f.label,
  });

  const track = h('div', { class: 'slider' + (f.bipolar ? ' is-bipolar' : '') }, range);

  const steps = (f.max - f.min) / f.step;
  if (steps <= 12 && steps >= 2) {
    const ticks = h('div', { class: 'slider__ticks' });
    for (let i = 0; i <= steps; i++) ticks.append(h('i'));
    track.append(ticks);
  }

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    h('div', { class: 'field__top' },
      h('label', { class: 'field__label', text: f.label,
        onclick: () => range.focus() }),
      val),
    track,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );

  const sync = () => {
    const v = state[f.id];
    range.value = v;
    /* never clobber the badge while it is being typed into */
    if (document.activeElement !== val) val.value = fmt(v, f);
    const pct = ((v - f.min) / (f.max - f.min)) * 100;
    track.style.setProperty('--pct', pct);
    if (f.bipolar) {
      track.style.setProperty('--fl', Math.min(50, pct));
      track.style.setProperty('--fw', Math.abs(pct - 50));
    }
  };

  const push = (v, live) => { set(f.id, v, { live }); sync(); };

  range.addEventListener('input', () => push(range.value, true));
  range.addEventListener('change', () => push(range.value, false));

  /* type a precise value */
  val.addEventListener('change', () => push(parseFloat(val.value), false));
  val.addEventListener('blur', sync);
  val.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); val.blur(); }
    if (e.key === 'Escape') { sync(); val.blur(); }
  });

  /* drag the badge sideways to scrub — a desktop nicety that costs nothing
     on touch because the badge is also a normal input. */
  let drag = null;
  val.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (document.activeElement === val) return;    // already typing
    drag = { x: e.clientX, v: Number(state[f.id]), moved: false };
    val.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  val.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 3) return;
    drag.moved = true;
    const span = f.max - f.min;
    const perPx = (span / 220) * (e.shiftKey ? 0.25 : 1);
    push(drag.v + dx * perPx, true);
  });
  const endDrag = e => {
    if (!drag) return;
    if (!drag.moved) { val.focus(); val.select(); }
    else set(f.id, state[f.id], { live: false });
    try { val.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    drag = null;
  };
  val.addEventListener('pointerup', endDrag);
  val.addEventListener('pointercancel', endDrag);

  return { el, sync, field: f };
}

/* ------------------------------------------------------------- segmented */

function segField(f) {
  const cls = 'seg' + (f.variant === 'grid' ? ' seg--grid' : '') +
              (f.options.length > 4 && f.variant !== 'grid' ? ' seg--wrap' : '');
  const group = h('div', { class: cls, role: 'radiogroup', 'aria-label': f.label });

  const btns = f.options.map(o => {
    const btn = h('button', {
      class: 'seg__btn', type: 'button', role: 'radio', 'aria-checked': 'false',
      'data-v': o.value, title: o.title || o.label,
    });
    if (o.box) {
      const [bw, bh] = o.box;
      btn.append(h('span', { class: 'seg__ratio',
        style: `width:${bw}px;height:${bh}px` }));
    }
    btn.append(h('span', { text: o.label }));
    btn.addEventListener('click', () => { set(f.id, o.value); });
    group.append(btn);
    return btn;
  });

  group.addEventListener('keydown', e => {
    const i = btns.findIndex(b => b === document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
    if (n === null) return;
    e.preventDefault();
    btns[n].focus();
    btns[n].click();
  });

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    f.label ? h('div', { class: 'field__top' }, h('span', { class: 'field__label', text: f.label })) : null,
    group,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );

  const sync = () => {
    for (const b of btns) {
      const on = b.dataset.v === String(state[f.id]);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
  };

  return { el, sync, field: f };
}

/* ---------------------------------------------------------------- switch */

function switchField(f) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  const label = h('label', { class: 'switch' },
    h('span', { class: 'field__label', text: f.label }),
    input,
    h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
  );
  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    label,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );
  input.addEventListener('change', () => set(f.id, input.checked));
  const sync = () => { input.checked = Boolean(state[f.id]); };
  return { el, sync, field: f };
}

/* ------------------------------------------------------------------ text */

function textField(f) {
  const input = h('input', {
    class: 'input', type: 'text', placeholder: f.placeholder || '',
    'aria-label': f.label, spellcheck: 'false', autocomplete: 'off',
    enterkeyhint: 'done',
  });
  input.addEventListener('input', () => set(f.id, input.value, { live: true }));
  input.addEventListener('change', () => set(f.id, input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    h('div', { class: 'field__top' }, h('span', { class: 'field__label', text: f.label })),
    input,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );
  const sync = () => { if (document.activeElement !== input) input.value = state[f.id] ?? ''; };
  return { el, sync, field: f };
}

/* ---------------------------------------------------------------- select */

function selectField(f) {
  const sel = h('select', { class: 'select', 'aria-label': f.label },
    ...f.options.map(o => h('option', { value: o.value, text: o.label })));
  sel.addEventListener('change', () => set(f.id, sel.value));

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    h('div', { class: 'field__top' }, h('span', { class: 'field__label', text: f.label })),
    sel,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );
  const sync = () => { sel.value = state[f.id]; };
  return { el, sync, field: f };
}

/* ----------------------------------------------------------------- color */

function colorField(f) {
  const chip = h('span', { class: 'colorbtn__chip' });
  const hex = h('span', { class: 'colorbtn__hex' });
  const btn = h('button', { class: 'colorbtn', type: 'button' }, chip, hex);
  btn.addEventListener('click', () => openColorPop(btn, f));

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    h('div', { class: 'field__top' }, h('span', { class: 'field__label', text: f.label })),
    btn,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );
  const sync = () => {
    const v = state[f.id];
    chip.style.setProperty('--chip', v);
    hex.textContent = v;
  };
  return { el, sync, field: f };
}

/* ---- shared color popover ---------------------------------------------- */

let colorPop, colorTitle, colorSwatches, colorNative, colorHex, colorDot;
let activeColor = null;

function initColorPop() {
  if (colorPop) return;
  colorPop = document.getElementById('colorPop');
  colorTitle = document.getElementById('colorPopTitle');
  colorSwatches = document.getElementById('colorSwatches');
  colorNative = document.getElementById('colorNative');
  colorHex = document.getElementById('colorHex');
  colorDot = document.getElementById('colorDot');

  for (const c of PALETTE) {
    const sw = h('button', { class: 'swatch', type: 'button', 'data-c': c,
      style: `--sw:${c}`, 'aria-label': c });
    sw.addEventListener('click', () => applyColor(c));
    colorSwatches.append(sw);
  }

  colorNative.addEventListener('input', () => applyColor(colorNative.value, false));
  colorHex.addEventListener('change', () => {
    const v = normalizeHex(colorHex.value);
    if (v) applyColor(v);
    else refreshColorPop();
  });
  colorHex.addEventListener('keydown', e => { if (e.key === 'Enter') colorHex.blur(); });
}

function applyColor(c, close = true) {
  if (!activeColor) return;
  set(activeColor.id, c, { live: !close });
  refreshColorPop();
  if (close && matchMedia('(pointer: fine)').matches) { /* keep open for tweaking */ }
}

function refreshColorPop() {
  if (!activeColor) return;
  const v = state[activeColor.id];
  colorNative.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
  colorHex.value = v;
  colorDot.style.setProperty('--chip', v);
  for (const sw of colorSwatches.children) {
    sw.classList.toggle('is-active', sw.dataset.c.toLowerCase() === String(v).toLowerCase());
  }
}

function openColorPop(anchor, f) {
  initColorPop();
  activeColor = f;
  colorTitle.textContent = f.label;
  refreshColorPop();

  colorPop.hidePopover?.();
  colorPop.showPopover?.();
  /* same task as showPopover(), so this never paints unpositioned */
  placePopover(colorPop, anchor, 'match');
}

export function syncColorPop() { if (colorPop?.matches?.(':popover-open')) refreshColorPop(); }

function normalizeHex(v) {
  let s = String(v).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toLowerCase() : null;
}

/* -------------------------------------------------------------- xy pad */

function xyField(f) {
  const dot = h('span', { class: 'xy__dot' });
  const pad = h('div', { class: 'xy', role: 'slider', tabindex: '0',
    'aria-label': f.label, 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('span', { class: 'xy__cross', 'aria-hidden': 'true' }), dot);

  const el = h('div', { class: 'field', 'data-fid': f.key || f.id },
    h('div', { class: 'field__top' }, h('span', { class: 'field__label', text: f.label })),
    pad,
    f.hint ? h('div', { class: 'field__hint', text: f.hint }) : null,
  );

  const sync = () => {
    const v = state[f.id] || { x: 50, y: 50 };
    pad.style.setProperty('--x', v.x);
    pad.style.setProperty('--y', v.y);
    pad.setAttribute('aria-valuetext', `x ${Math.round(v.x)}%, y ${Math.round(v.y)}%`);
  };

  const move = (e, live = true) => {
    const r = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    set(f.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }, { live });
    sync();
  };

  let down = false;
  pad.addEventListener('pointerdown', e => {
    down = true;
    pad.setPointerCapture(e.pointerId);
    move(e);
    e.preventDefault();
  });
  pad.addEventListener('pointermove', e => { if (down) move(e); });
  const up = e => {
    if (!down) return;
    down = false;
    try { pad.releasePointerCapture(e.pointerId); } catch { /* gone */ }
    set(f.id, state[f.id], { live: false });
  };
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);

  pad.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    const v = state[f.id];
    set(f.id, {
      x: Math.max(0, Math.min(100, v.x + k[0] * step)),
      y: Math.max(0, Math.min(100, v.y + k[1] * step)),
    });
    sync();
  });

  return { el, sync, field: f };
}
