/* Shared playback speed and explicit forward/inverse notation controls.
 * The legacy 1..5 input remains the engine's event contract, but only the
 * named playback-rate selector is exposed. One normal turn takes 450 ms.
 */
(function (root) {
  'use strict';
  if (root.PuzzlePlaybackControls) return;
  const rates = Object.freeze([0, .5, .75, 1, 1.5, 2]);
  const doc = root.document;
  const get = id => { try { return doc?.getElementById?.(id) || null; } catch (_) { return null; } };
  let speedSelect = null;
  function syncSpeed() {
    const speed = get('speed');
    if (!speed || !speedSelect) return;
    const value = String(speed.value), changed = speedSelect.value !== value;
    speedSelect.value = value;
    speedSelect.title = 'Playback speed: ' + (rates[Number(value)] || 1) + '×. Changes every animated move.';
    if (changed) root.PuzzleFeedback?.pulse?.(speedSelect);
  }
  function installSpeed() {
    if (!doc?.querySelector || speedSelect) return;
    const actions = doc.querySelector('.action-group'), speed = get('speed');
    if (!actions || !speed) return;
    const control = doc.createElement('label');
    control.id = 'playbackSpeedControl'; control.className = 'playback-speed-control';
    control.setAttribute('for', 'playbackSpeed');
    const caption = doc.createElement('span'); caption.textContent = 'Speed';
    speedSelect = doc.createElement('select'); speedSelect.id = 'playbackSpeed';
    speedSelect.setAttribute('aria-label', 'Playback speed');
    for (let index = 1; index < rates.length; index++) {
      const option = doc.createElement('option'); option.value = String(index);
      option.textContent = rates[index] + '×'; speedSelect.appendChild(option);
    }
    speedSelect.value = String(speed.value || 3);
    speedSelect.addEventListener('change', () => {
      speed.value = speedSelect.value;
      speed.dispatchEvent(new root.Event('input', {bubbles: true}));
      syncSpeed();
    });
    speed.addEventListener('input', syncSpeed);
    const oldControl = speed.closest?.('.view-speed-control');
    if (oldControl) { oldControl.hidden = true; oldControl.setAttribute('aria-hidden', 'true'); }
    speed.hidden = true; speed.setAttribute('aria-hidden', 'true'); speed.tabIndex = -1;
    control.append(caption, speedSelect);
    // Real DOM order matches both the requested reading and keyboard order.
    const transport = actions.querySelector('.journal-transport');
    for (const element of [get('randomize'), get('solve'), transport, control, get('pause'), get('reset'), get('journalActivity')]) {
      if (element) actions.appendChild(element);
    }
    syncSpeed();
  }
  function installNotation({faces, label = face => face, onMove}) {
    const container = get('notationButtons');
    if (!container || !doc?.createElement) return;
    container.replaceChildren();
    container.classList.toggle('notation-has-long-labels', faces.some(face => label(face).length + 1 >= 4));
    for (const face of faces) {
      const pair = doc.createElement('span'); pair.className = 'notation-pair';
      pair.dataset.labelLength = String(label(face).length + 1);
      if (label(face).length + 1 >= 4) pair.classList.add('notation-pair-long');
      pair.setAttribute('role', 'group'); pair.setAttribute('aria-label', label(face) + ' turns');
      for (const direction of [1, -1]) {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'notation-key';
        button.dataset.face = face; button.dataset.direction = String(direction);
        button.textContent = label(face) + (direction < 0 ? '′' : '');
        button.dataset.labelLength = String(button.textContent.length);
        if (button.textContent.length >= 4) button.classList.add('notation-key-long');
        const meaning = 'Turn ' + label(face) + (direction < 0 ? ' counterclockwise' : ' clockwise') + ' using puzzle notation';
        button.setAttribute('aria-label', meaning); button.title = meaning;
        button.addEventListener('click', () => onMove({face, dir: direction}));
        pair.appendChild(button);
      }
      container.appendChild(pair);
    }
    const inverse = get('notationInverse');
    if (inverse) {
      inverse.checked = false; inverse.hidden = true; inverse.disabled = true;
      const label = inverse.closest?.('.inverse-toggle');
      if (label) { label.hidden = true; label.setAttribute('aria-hidden', 'true'); }
    }
  }
  root.PuzzlePlaybackControls = Object.freeze({
    rates,
    duration: value => 450 / (rates[Number(value)] || 1),
    installNotation,
    syncSpeed
  });
  installSpeed();
  doc?.addEventListener?.('DOMContentLoaded', installSpeed, {once: true});
})(window);
