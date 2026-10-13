(() => {
  'use strict';
  const panel = document.getElementById('ringPanel');
  const toggle = document.getElementById('ringPanelToggle');
  const hideToggle = document.getElementById('ringPanelHide');
  const guideToggle = document.getElementById('guidePanelToggle');
  const embedded = window.parent !== window;
  const targetOrigin = location.origin === 'null' ? '*' : location.origin;
  let open = true;

  function sync() {
    const available = !document.body.classList.contains('mirror-active');
    if (!available && window.ConstrainedSolverUI?.state().active) window.ConstrainedSolverUI.closePanel();
    const visible = open && available;
    panel.inert = !visible;
    toggle.disabled = !available;
    toggle.hidden = visible || !available;
    toggle.setAttribute('aria-expanded', 'false');
    hideToggle.hidden = !visible;
    hideToggle.setAttribute('aria-expanded', String(visible));
    if (embedded) window.parent.postMessage({type: 'ring-panel-state', open: visible, available}, targetOrigin);
  }
  function setOpen(value) {
    open = !!value;
    if (!open) window.ConstrainedSolverUI?.closePanel();
    document.body.classList.toggle('rings-collapsed', !open);
    sync();
  }
  guideToggle.hidden = !embedded;
  toggle.addEventListener('click', () => {setOpen(true);hideToggle.focus();});
  hideToggle.addEventListener('click', () => {setOpen(false);toggle.focus();});
  guideToggle.addEventListener('click', () => {
    if (embedded) window.parent.postMessage({type: 'toggle-guide'}, targetOrigin);
  });
  window.addEventListener('message', event => {
    if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
    if (event.data?.type === 'set-ring-panel' && typeof event.data.open === 'boolean') setOpen(event.data.open);
    if (event.data?.type === 'guide-panel-state' && typeof event.data.open === 'boolean') {
      guideToggle.setAttribute('aria-expanded', String(event.data.open));
      guideToggle.hidden = event.data.open;
    }
  });
  // Mirror mode owns its existing visibility rule; it does not overwrite the
  // user's panel preference when returning to colored play.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(sync).observe(document.body, {attributes: true, attributeFilter: ['class']});
  sync();
})();
