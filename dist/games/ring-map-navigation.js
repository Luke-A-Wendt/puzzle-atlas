/* Ring-map navigation in CSS pixels. Native renderers compose this viewport
 * before drawing, so ring hits, node selection, labels and held-node anchors
 * share one transform. No puzzle permutation or ring geometry is changed. */
(function (root) {
  'use strict';
  let zoom = 1, panX = 0, panY = 0, width = 500, height = 500, binding = null;
  const MAX_ZOOM = 8, DRAG_DISTANCE = 5;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  function repaint() { binding?.requestRender?.(); }
  function constrainPan() {
    // Permit blank-space panning even at the original scale, while keeping
    // enough of the map reachable. A zoom-out to 1 always restores its center.
    panX = clamp(panX, -width * zoom / 2, width * zoom / 2);
    panY = clamp(panY, -height * zoom / 2, height * zoom / 2);
  }
  function viewport(base, w, h) {
    if (w > 0 && h > 0) { width = w; height = h; }
    const out = {...base, scale:base.scale * zoom};
    for (const key of ['x', 'ox', 'cx']) if (Number.isFinite(base[key])) out[key] = width / 2 + (base[key] - width / 2) * zoom + panX;
    for (const key of ['y', 'oy', 'cy']) if (Number.isFinite(base[key])) out[key] = height / 2 + (base[key] - height / 2) * zoom + panY;
    return out;
  }
  function reset() { zoom = 1; panX = panY = 0; repaint(); }
  function zoomAt(factor, point, nextPoint = point, base = {zoom,panX,panY}) {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    const next = clamp(base.zoom * factor, 1, MAX_ZOOM);
    if (next <= 1 + 1e-9 && factor < 1) { reset(); return; }
    const ratio = next / base.zoom;
    panX = nextPoint.x - width / 2 - (point.x - width / 2 - base.panX) * ratio;
    panY = nextPoint.y - height / 2 - (point.y - height / 2 - base.panY) * ratio;
    zoom = next; constrainPan(); repaint();
  }
  function bind(options) {
    // Keep the native framing; do not install wheel, pan, pinch or zoom-key handlers.
    return false;
    const canvas = options?.canvas, wrap = canvas?.parentElement || canvas?.parentNode;
    if (!canvas || !wrap?.addEventListener || binding) return false;
    binding = options;
    const pointers = new Map();
    let gesture = null, pinching = false, cancelling = false;
    const block = event => { event.preventDefault?.(); event.stopImmediatePropagation?.(); };
    const busy = () => !!options.busy?.() || !!root.ConstrainedSolverUI?.journalBusy?.();
    const constrained = () => !!root.ConstrainedSolverUI?.visualState?.().active;
    const surface = target => target === canvas || target?.id === 'csNodeOverlay';
    const local = event => { const box = canvas.getBoundingClientRect(); return {x:event.clientX - box.left, y:event.clientY - box.top}; };
    function capture(target, id) { try { target.setPointerCapture?.(id); } catch (_) {} }
    function release(target, id) { try { target.releasePointerCapture?.(id); } catch (_) {} }
    function cancelNative() {
      options.cancel?.();
      root.PuzzleAxisDisplay?.hover?.(null);
      // A second finger must cancel a pending lasso/tile click, not commit it
      // when the first finger lifts. Native ring drag is canceled above.
      const overlay = root.document?.getElementById?.('csNodeOverlay');
      if (overlay?.dispatchEvent && root.Event) {
        cancelling = true;
        try { overlay.dispatchEvent(new root.Event('pointercancel', {bubbles:true})); }
        finally { cancelling = false; }
      }
    }
    function finish() {
      for (const [id, p] of pointers) release(p.target, id);
      pointers.clear(); gesture = null; pinching = false;
    }
    function abort() { cancelNative(); finish(); }
    function interactive(event) {
      if (options.hit?.(event)) return true;
      const p = local(event);
      return (root.PUZZLE_SOLVER_BRIDGE?.nodes?.() || []).some(n => Math.hypot(n.x - p.x, n.y - p.y) <= Math.max(9, (n.r || 5) + 4));
    }
    const pinch = () => {
      const [a,b] = [...pointers.values()];
      return {point:{x:(a.x+b.x)/2, y:(a.y+b.y)/2}, distance:Math.hypot(a.x-b.x, a.y-b.y)};
    };
    wrap.addEventListener('pointerdown', event => {
      if (!surface(event.target) || event.button > 0 || cancelling) return;
      if (busy()) { if (pointers.size) abort(); return; }
      const p = local(event); pointers.set(event.pointerId, {...p, target:event.target});
      if (pointers.size >= 2) {
        cancelNative(); pinching = true; gesture = {...pinch(),view:{zoom,panX,panY}};
        for (const [id, point] of pointers) capture(point.target, id);
        block(event); return;
      }
      // Preserve every one-finger constrained selection/lasso. Two fingers
      // always navigate; in turn mode, a drag that starts off a ring pans.
      gesture = {kind:!constrained() && !interactive(event) ? 'pan-pending' : 'native', start:p, previous:p};
      if (gesture.kind === 'pan-pending') capture(event.target, event.pointerId);
    }, true);
    wrap.addEventListener('pointermove', event => {
      if (cancelling || !pointers.has(event.pointerId)) return;
      if (busy()) { abort(); block(event); return; }
      const p = local(event), previous = pointers.get(event.pointerId);
      pointers.set(event.pointerId, {...previous, ...p});
      if (pinching) {
        if (pointers.size >= 2) {
          const next = pinch();
          // Use the gesture's original transform, not sequential clamped
          // deltas. Two fingers moving together must pan at zoom=1 without
          // accumulating a spurious zoom between their separate events.
          if (gesture?.distance > 1 && next.distance > 1) zoomAt(next.distance / gesture.distance, gesture.point, next.point, gesture.view);
        }
        block(event); return;
      }
      if (gesture?.kind === 'pan-pending' && Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y) >= DRAG_DISTANCE) {
        gesture.kind = 'pan'; cancelNative();
      }
      if (gesture?.kind === 'pan') {
        panX += p.x - gesture.previous.x; panY += p.y - gesture.previous.y;
        gesture.previous = p; constrainPan(); repaint(); block(event);
      }
    }, true);
    function end(event) {
      if (cancelling || !pointers.has(event.pointerId)) return;
      if (busy()) { abort(); block(event); return; }
      const consumed = pinching || gesture?.kind === 'pan', p = pointers.get(event.pointerId);
      pointers.delete(event.pointerId); release(p.target, event.pointerId);
      if (consumed) block(event);
      if (!pointers.size) { gesture = null; pinching = false; }
      // After a pinch, consume the last finger until it too lifts; otherwise
      // it could accidentally finish the native turn or select a held node.
    }
    for (const name of ['pointerup','pointercancel','lostpointercapture']) wrap.addEventListener(name, end, true);
    wrap.addEventListener('wheel', event => {
      if (!surface(event.target)) return;
      block(event); if (busy()) return;
      if (pointers.size) abort();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      zoomAt(Math.exp(-clamp(event.deltaY * unit, -600, 600) * .0015), local(event));
    }, {capture:true, passive:false});
    wrap.addEventListener('keydown', event => {
      if (!surface(event.target) || event.altKey || event.ctrlKey || event.metaKey || !['+','=','-','0'].includes(event.key)) return;
      block(event); if (busy()) return;
      if (pointers.size) abort();
      if (event.key === '0') reset();
      else zoomAt(event.key === '-' ? .8 : 1.25, {x:width/2, y:height/2});
    }, true);
    root.addEventListener?.('blur', abort);
    return true;
  }
  root.RingMapNavigation = Object.freeze({viewport, bind, reset, state:() => ({zoom, panX, panY, width, height})});
})(typeof globalThis !== 'undefined' ? globalThis : this);
