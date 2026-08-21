/* ==========================================================================
   store.js — tiny observable state + localStorage persistence.
   ========================================================================== */

import { DEFAULTS, FIELD_INDEX } from './schema.js';

const KEY = 'canvas-playground:v1';

const subs = new Set();

export const state = load();

function load() {
  const base = structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    for (const k of Object.keys(base)) {
      if (k in saved && saved[k] !== null && typeof saved[k] === typeof base[k]) base[k] = saved[k];
    }
  } catch { /* corrupt or blocked storage — defaults are fine */ }
  return base;
}

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, 250);
}

/** Coerce a raw control value into the type the schema declares. */
export function coerce(id, value) {
  const f = FIELD_INDEX.get(id);
  if (!f) return value;
  if (f.type === 'slider') {
    const n = Number(value);
    if (Number.isNaN(n)) return state[id];
    return Math.min(f.max, Math.max(f.min, Math.round(n / f.step) * f.step));
  }
  if (f.type === 'switch') return Boolean(value);
  return value;
}

/**
 * @param {string|object} id  field id, or an object of id→value for batches
 * @param {*} [value]
 * @param {{silent?:boolean, source?:string}} [opts]
 */
export function set(id, value, opts = {}) {
  const patch = typeof id === 'object' ? id : { [id]: value };
  const changed = [];
  for (const [k, v] of Object.entries(patch)) {
    const next = coerce(k, v);
    if (deepEqual(state[k], next)) continue;
    state[k] = next;
    changed.push(k);
  }
  if (!changed.length) return changed;
  persist();
  if (!opts.silent) emit(changed, opts);
  return changed;
}

export function resetAll() {
  Object.assign(state, structuredClone(DEFAULTS));
  persist();
  emit(Object.keys(state), { source: 'reset' });
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function emit(changed, opts) {
  for (const fn of subs) fn(changed, opts);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
}

/* ---- non-persisted UI state (layout, zoom, active category) ------------- */

const UI_KEY = 'canvas-playground:ui:v1';

export const ui = Object.assign({
  category: 'canvas',
  theme: '',
  panelW: 300,
  panelCollapsed: false,
  zoom: 0,          // 0 = fit
  preset: '',
}, (() => {
  try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch { return {}; }
})());

let uiTimer = 0;
export function saveUI() {
  clearTimeout(uiTimer);
  uiTimer = setTimeout(() => {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ }
  }, 250);
}
