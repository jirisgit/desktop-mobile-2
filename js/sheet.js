/* ==========================================================================
   sheet.js — the mobile bottom sheet.
   Three snap points, velocity-aware release, and scroll hand-off so a drag
   that starts at the top of the scrolled content collapses the sheet
   instead of fighting it.
   ========================================================================== */

const SNAPS = ['peek', 'half', 'full'];

export function createSheet({ sheet, grab, head, body, app, onSnap }) {
  let snap = 'peek';
  let y = 0;                 // current translateY in px
  let offsets = { peek: 0, half: 0, full: 0 };
  let drag = null;

  /* ---------------------------------------------------------- geometry */

  function measure() {
    if (app.dataset.layout !== 'mobile') return;
    const appH = app.clientHeight;
    const sheetH = sheet.offsetHeight;
    const peekH = grab.offsetHeight + head.offsetHeight;

    app.style.setProperty('--sheet-peek', peekH + 'px');

    offsets = {
      full: 0,
      half: Math.max(0, sheetH - Math.round(appH * 0.52)),
      peek: Math.max(0, sheetH - peekH),
    };
    applyY(offsets[snap], false);
  }

  function applyY(next, animate) {
    y = next;
    sheet.classList.toggle('is-animating', !!animate);
    sheet.style.setProperty('--sheet-y', next + 'px');
  }

  function goTo(next, animate = true) {
    snap = next;
    sheet.dataset.snap = next;
    grab.setAttribute('aria-expanded', next === 'peek' ? 'false' : 'true');
    applyY(offsets[next], animate);
    onSnap?.(next);
  }

  /* -------------------------------------------------------------- drag */

  function begin(clientY) {
    drag = { y0: clientY, base: y, last: clientY, t: performance.now(), v: 0, moved: false };
    sheet.classList.remove('is-animating');
  }

  function update(clientY) {
    if (!drag) return;
    const dy = clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 5) return;
    drag.moved = true;

    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    drag.v = (clientY - drag.last) / dt;      // px per ms
    drag.last = clientY;
    drag.t = now;

    let next = drag.base + dy;
    // rubber-band past the top edge
    if (next < offsets.full) next = offsets.full + (next - offsets.full) * 0.28;
    if (next > offsets.peek) next = offsets.peek + (next - offsets.peek) * 0.28;
    applyY(next, false);
  }

  function end() {
    if (!drag) return;
    const moved = drag.moved;
    const v = drag.v;
    drag = null;
    if (!moved) return false;

    // project where the sheet is heading, then take the nearest snap
    const projected = y + v * 140;
    let best = SNAPS[0], bestD = Infinity;
    for (const k of SNAPS) {
      const d = Math.abs(offsets[k] - projected);
      if (d < bestD) { bestD = d; best = k; }
    }
    goTo(best);
    return true;
  }

  /* ------------------------------------------------------------ wiring */

  const onDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    begin(e.clientY);
    grab.setPointerCapture?.(e.pointerId);
  };

  grab.addEventListener('pointerdown', e => { onDown(e); e.preventDefault(); });
  head.addEventListener('pointerdown', onDown);

  const onMove = e => { if (drag) update(e.clientY); };
  const onUp = () => { end(); };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  /* tap the grabber to cycle */
  grab.addEventListener('click', () => {
    if (drag) return;
    goTo(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
  });
  grab.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); grab.click(); }
    if (e.key === 'Escape') goTo('peek');
  });

  /* scroll hand-off: dragging down at scrollTop 0 collapses the sheet */
  let touch = null;
  body.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    touch = { y0: e.touches[0].clientY, atTop: body.scrollTop <= 0, active: false };
  }, { passive: true });

  body.addEventListener('touchmove', e => {
    if (!touch || e.touches.length !== 1) return;
    const cy = e.touches[0].clientY;
    const dy = cy - touch.y0;

    if (!touch.active) {
      if (!(touch.atTop && dy > 6)) return;
      touch.active = true;
      begin(touch.y0);
    }
    e.preventDefault();
    update(cy);
  }, { passive: false });

  const endTouch = () => {
    if (touch?.active) end();
    touch = null;
  };
  body.addEventListener('touchend', endTouch);
  body.addEventListener('touchcancel', endTouch);

  return {
    measure,
    goTo,
    get snap() { return snap; },
    expand: () => { if (snap === 'peek') goTo('half'); },
    collapse: () => goTo('peek'),
  };
}
