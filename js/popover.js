/* ==========================================================================
   popover.js — placement for native popovers.

   The Popover API gives us the top layer and light-dismiss, but no anchoring
   (CSS anchor positioning is not portable yet). Two cases:

   • desktop — position under the trigger, clamped to the window.
   • mobile  — CSS already pins the popover to the bottom edge of the screen,
     which is right on a real phone. Inside the on-page device preview it is
     wrong: a top-layer element is positioned against the viewport, not
     against the phone frame, so it would break out of the frame. There we
     re-anchor to the app's own box.
   ========================================================================== */

const GAP = 6;
const EDGE = 8;
const M = 12;

export function placePopover(pop, anchor, align = 'left') {
  const app = document.getElementById('app');
  const stagehand = document.getElementById('stagehand');
  const mobile = app.dataset.layout === 'mobile';
  const previewing = stagehand?.dataset.preview === 'on';

  if (mobile) {
    if (!previewing) { clear(pop); return; }      // stylesheet is correct
    const host = app.getBoundingClientRect();
    imp(pop, 'left', host.left + M + 'px');
    imp(pop, 'right', 'auto');
    imp(pop, 'width', host.width - M * 2 + 'px');
    imp(pop, 'top', 'auto');
    imp(pop, 'bottom', window.innerHeight - host.bottom + M + 'px');
    return;
  }

  clear(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;

  let left = align === 'right' ? r.right - pw : r.left;
  left = Math.max(EDGE, Math.min(left, window.innerWidth - pw - EDGE));

  let top = r.bottom + GAP;
  if (top + ph > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - ph - GAP);

  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  if (align === 'match') pop.style.width = Math.max(232, r.width) + 'px';
}

/** Park off-screen before the popover paints, so the frame between opening
 *  and the queued `toggle` event never shows it at stale coordinates. */
export function parkPopover(pop) {
  const app = document.getElementById('app');
  if (app.dataset.layout === 'mobile') { clear(pop); return; }
  clear(pop);
  pop.style.left = '-9999px';
  pop.style.top = '0px';
}

function clear(pop) {
  for (const k of ['left', 'right', 'top', 'bottom', 'width']) pop.style.removeProperty(k);
}

function imp(pop, prop, value) {
  pop.style.setProperty(prop, value, 'important');
}
