/* Shared presentation state. Move engines retain their physical selected axis. */
(function (root) {
  'use strict';
  let muted = true, hoveredAxis = null, visibleAxes = [], repaintPending = false;
  let axisLabelTargets = [];
  // Preferences initialize exactly once per page. Modes and playback never reset them.
  let labels3D = 'none', outline3D = true, labelsOnRings = false;
  const modes = ['none', 'some', 'all'];
  const modeName = mode => mode;
  const pulse = element => root.PuzzleFeedback?.pulse?.(element);
  const palettes = Object.freeze({
    active: Object.freeze({fill:'#f3f3f5', stroke:'#101116', text:'#101116'}),
    inactive: Object.freeze({fill:'#101116', stroke:'#f3f3f5', text:'#f3f3f5'})
  });
  // One direction marker per active orbit. Cache by geometry and resting-node
  // layout; neither moving colors nor animation frames invalidate placement.
  const directionPlacements = new WeakMap();
  function drawRingDirection(ctx, curve, options) {
    if(!labelsOnRings)return null;
    const {at,period,nodes,radius,scale=1,direction=1}=options;
    if(!(period>0&&scale>0)||!nodes?.length)return null;
    const bounds=options.bounds||{x0:0,y0:0,x1:500,y1:500};
    const size=Math.max(7/scale,Math.min(16/scale,radius*1.8));
    const key=[scale,size,bounds.x0,bounds.y0,bounds.x1,bounds.y1].join(',');
    let marker=directionPlacements.get(curve);
    if(!marker||marker.nodes!==nodes||marker.key!==key){
      const margin=size*.65, samples=256;
      const candidate=t=>{
        const point=at((t%period+period)%period);
        if(!Number.isFinite(point.x+point.y))return null;
        let clearance=Infinity;
        for(const node of nodes){const dx=point.x-node.x,dy=point.y-node.y;clearance=Math.min(clearance,dx*dx+dy*dy);}
        const edge=Math.min(point.x-bounds.x0,bounds.x1-point.x,point.y-bounds.y0,bounds.y1-point.y);
        return {t,point,score:Math.sqrt(clearance)-Math.max(0,margin-edge)*100};
      };
      let best=null;
      for(let i=0;i<samples;i++){const c=candidate(period*i/samples);if(c&&(!best||c.score>best.score))best=c;}
      if(!best)return null;
      // Refine locally without changing the ring or its resting intersections.
      let step=period/samples;
      for(let pass=0;pass<4;pass++){const center=best.t;for(const offset of [-.5,-.25,.25,.5]){const c=candidate(center+offset*step);if(c&&c.score>best.score)best=c;}step/=2;}
      marker={...best,size,nodes,key};directionPlacements.set(curve,marker);
    }
    const sample=t=>at((t%period+period)%period),epsilon=period*1e-5,a=sample(marker.t-epsilon),b=sample(marker.t+epsilon),length=Math.hypot(b.x-a.x,b.y-a.y);
    if(!(length>1e-9))return null;
    const dx=(b.x-a.x)/length*Math.sign(direction),dy=(b.y-a.y)/length*Math.sign(direction),{x,y}=marker.point;
    const tip={x:x+dx*size*.45,y:y+dy*size*.45},tail={x:x-dx*size*.45,y:y-dy*size*.45};
    ctx.save();ctx.lineWidth=Math.min(2.3/scale,Math.max(1.6/scale,size*.14));ctx.lineCap='round';ctx.lineJoin='round';
    ctx.fillStyle=ctx.strokeStyle;
    ctx.beginPath();ctx.moveTo(tail.x-dy*size*.5,tail.y+dx*size*.5);ctx.lineTo(tip.x,tip.y);ctx.lineTo(tail.x+dy*size*.5,tail.y-dx*size*.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    return marker;
  }
  const controls = {};
  let clearNodeInspection = () => {};
  let presentedAxis = null, turnSyncPending = false, turnObserver = null, chromeObserver = null;
  let selectionControlState = '';
  function syncChrome() {
    const doc=root.document,stop=doc?.getElementById?.('pause'),activity=doc?.getElementById?.('journalActivity');
    // Engines keep ownership of Stop availability. Its idle placeholder keeps
    // the toolbar steady, and is disabled for keyboard/programmatic activation.
    if(stop?.hidden && !stop.disabled)stop.disabled=true;
    if(stop?.hidden && stop.getAttribute('aria-disabled')!=='true')stop.setAttribute('aria-disabled','true');
    else if(stop && !stop.hidden && stop.getAttribute('aria-disabled')!==String(!!stop.disabled))stop.setAttribute('aria-disabled',String(!!stop.disabled));
    if(activity && activity.title!==activity.textContent)activity.title=activity.textContent;
    const actions=doc?.querySelector?.('.action-panel'),playing=String(!!activity?.textContent?.trim());
    if(actions && actions.getAttribute('data-journal-active')!==playing)actions.setAttribute('data-journal-active',playing);
    const focus = doc?.getElementById?.('ringFocus');
    if (focus) {
      const focused = focus.getAttribute('aria-pressed') === 'true';
      const description = (focused ? 'Show all rings. Current view: focused rings, with unselected paths dimmed.' : 'Focus on rings. Current view: all rings visible.') + ' Selected rings and zoom stay unchanged.';
      if (focus.title !== description) focus.title = description;
      if (focus.getAttribute('aria-label') !== description) focus.setAttribute('aria-label', description);
    }
    const header=doc?.querySelector?.('.view-header-toolbar'),mirror=doc?.getElementById?.('mirrorMode');
    if(header)header.classList.toggle('has-mirror-toggle',!!mirror&&!mirror.hidden);
    if (controls.features) {
      const hidden = !Array.from(controls.features.children).some(child => !child.hidden && child.id !== 'pieceLabels');
      if (controls.features.hidden !== hidden) controls.features.hidden = hidden;
    }
  }
  // The native selectors remain connected for engine state, but only the 3D
  // control panel is shown. Ring dragging retains its projected-screen
  // convention; the 3D arrows use signed physical turns
  // looking inward from the named pole. Every current engine's unprimed move
  // is clockwise there, so CCW (+) uses its existing inverse notation move.
  // This changes only which legal command the 3D UI requests, never an engine,
  // ring projection, permutation, journal convention or solver vocabulary.
  let ringSource = null, ringPairs = [];
  let playingMove = null, playingAxis = null, playingDirection = 0, turnPulse = 0;
  function trackPlayingTurn(animation) {
    const axis = animation?.move?.face, direction = Math.sign(Number(animation?.move?.dir));
    const active = axis != null && (direction === -1 || direction === 1);
    // The engine creates one normalized move object per primitive. Renderers
    // may wrap that object differently each frame, but keep its identity;
    // a repeated identical move gets a new object and therefore a new flash.
    // There is no duration estimate or timer that could outlive a stopped move.
    if (active && animation.move !== playingMove) turnPulse = 1 - turnPulse;
    playingMove = active ? animation.move : null;
    playingAxis = active ? String(axis) : null;
    playingDirection = active ? direction : 0;
  }
  function syncPlayingTurn() {
    if (!controls.ringCopy) return;
    for (const button of controls.ringCopy.querySelectorAll('button')) {
      const selected = playingAxis != null && (button.classList.contains('ring-key') ? button.dataset.face === playingAxis :
        button === controls.left ? playingDirection < 0 : button === controls.right && playingDirection > 0);
      if (selected) {
        if (button.getAttribute('data-turn-active') !== 'true') button.setAttribute('data-turn-active', 'true');
        if (button.getAttribute('data-turn-pulse') !== String(turnPulse)) button.setAttribute('data-turn-pulse', String(turnPulse));
      } else {
        if (button.hasAttribute('data-turn-active')) button.removeAttribute('data-turn-active');
        if (button.hasAttribute('data-turn-pulse')) button.removeAttribute('data-turn-pulse');
      }
    }
  }
  function turnPhysical(direction) {
    syncTurnControls();
    const button = direction < 0 ? controls.left : controls.right;
    if (!presentedAxis || !button || button.disabled || muted ||
        root.PUZZLE_SOLVER_BRIDGE?.isBusy?.() || root.ConstrainedSolverUI?.blocksManualMoves?.()) return;
    root.PUZZLE_API?.move?.({face:presentedAxis, dir:direction, turns:1});
  }
  function describePhysicalTurn(button, direction) {
    if (!button) return;
    const clockwise = direction > 0, axis = presentedAxis;
    const middleSide = ({M:'L', E:'D', S:'F'})[axis];
    const notation = axis && root.PUZZLE_API?.moveLabel?.({face:axis,dir:direction,turns:1});
    const viewpoint = middleSide ? 'looking inward from the ' + middleSide + ' side for the ' + axis + ' slice' : 'looking inward along the selected axis stem toward the center';
    const description = (notation ? notation + ' · ' : '') + 'Turn ' + (clockwise ? 'clockwise (−)' : 'counterclockwise (+)') + ', ' + viewpoint + '. The ring map keeps its own on-screen left/right convention.';
    if (button.title !== description) button.title = description;
    if (button.getAttribute('aria-label') !== description) button.setAttribute('aria-label', description);
  }
  function buildRingCopy() {
    if (!ringSource || !controls.ringCopy) return;
    const copy = ringSource.cloneNode(true);
    const originals = [ringSource, ...ringSource.querySelectorAll('*')];
    const copies = [copy, ...copy.querySelectorAll('*')];
    const ids = {selector:'viewRingSelector', selectedName:'viewRingSelectedName', ccw:'viewRingCCW', cw:'viewRingCW'};
    ringPairs = originals.map((native, index) => {
      const duplicate = copies[index];
      if (native.id) duplicate.id = ids[native.id] || ('viewRingCopy-' + native.id);
      if (native.tagName === 'BUTTON') {
        const physicalDirection = native.id === 'ccw' ? -1 : native.id === 'cw' ? 1 : 0;
        if (physicalDirection) {
          // Retain the exact arrow glyph/span; only this panel's caption and
          // request mapping differ from the native ring-map controls.
          const arrow = duplicate.querySelector('.direction');
          if (arrow) {
            if (physicalDirection < 0) duplicate.replaceChildren(arrow, root.document.createTextNode(' Rotate'));
            else duplicate.replaceChildren(root.document.createTextNode('Rotate '), arrow);
          }
        }
        duplicate.addEventListener('click', () => {
          syncTurnControls();
          if (duplicate.disabled || native.disabled || !ringSource.contains(native)) return;
          if (physicalDirection) turnPhysical(physicalDirection);
          else native.click();
        });
      }
      return [native, duplicate];
    });
    // Keep the outer container stable for layout, focus and observers. All
    // copied native IDs are namespaced; guides and engines keep their IDs.
    controls.ringCopy.replaceChildren(...Array.from(copy.childNodes || copy.children));
    controls.turnName = controls.ringCopy.querySelector('#viewRingSelectedName');
    controls.left = controls.ringCopy.querySelector('#viewRingCCW');
    controls.right = controls.ringCopy.querySelector('#viewRingCW');
    ringPairs[0][1] = controls.ringCopy;
  }
  function syncRingCopy(blocked, active) {
    if (!ringSource || !controls.ringCopy) return;
    const nativeElements = [ringSource, ...ringSource.querySelectorAll('*')];
    if (nativeElements.length !== ringPairs.length || nativeElements.some((node, index) => ringPairs[index]?.[0] !== node)) buildRingCopy();
    for (const [native, duplicate] of ringPairs.slice(1)) {
      if (duplicate.className !== native.className) duplicate.className = native.className;
      const physicalTurn = native.id === 'ccw' || native.id === 'cw';
      if (!physicalTurn && duplicate.title !== native.title) duplicate.title = native.title;
      if (duplicate.hidden !== native.hidden) duplicate.hidden = native.hidden;
      // Preserve native captions except the redundant selected-axis readout.
      // The selected axis remains clear in the selector and rotation tooltips.
      // Only leaf text is updated, never a whole button's internal markup.
      const text = native.id === 'selectedName' && active ? '' : native.textContent;
      if (!native.children.length && duplicate.textContent !== text) duplicate.textContent = text;
      for (const attribute of ['aria-pressed','aria-label','data-selected']) {
        if (physicalTurn && attribute === 'aria-label') continue;
        const value = native.getAttribute(attribute);
        if (value !== duplicate.getAttribute(attribute)) { if (value == null) duplicate.removeAttribute(attribute); else duplicate.setAttribute(attribute, value); }
      }
      if (native.tagName === 'BUTTON') {
        const disabled = blocked || !!native.disabled;
        if (duplicate.disabled !== disabled) duplicate.disabled = disabled;
      }
    }
    describePhysicalTurn(controls.left, -1); describePhysicalTurn(controls.right, 1);
    const description = 'Rotation axes and physical turns — counterclockwise positive, clockwise negative, viewed inward from the selected pole';
    if (controls.ringCopy.getAttribute('aria-label') !== description) controls.ringCopy.setAttribute('aria-label', description);
  }
  function syncTurnControls() {
    syncChrome();
    const doc = root.document, busy = !!root.PUZZLE_SOLVER_BRIDGE?.isBusy?.();
    const manualBlocked = !!root.ConstrainedSolverUI?.blocksManualMoves?.();
    const axis = !busy && (muted || root.ConstrainedSolverUI?.visualState?.().active) ? null : presentedAxis;
    const active = !!axis;
    const ringName = doc?.getElementById?.('selectedName')?.parentElement;
    if (ringName && ringName.getAttribute('data-selected') !== String(active)) ringName.setAttribute('data-selected', String(active));
    const ringCaption = doc?.getElementById?.('selectedName');
    if (!active && ringCaption && ringCaption.textContent !== 'Select axis') ringCaption.textContent = 'Select axis';
    syncRingCopy(busy || manualBlocked, active);
    for (const button of [controls.left, controls.right]) if (button && !active) button.disabled = true;
    syncPlayingTurn();
  }
  function queueTurnSync() {
    if (turnSyncPending) return;
    turnSyncPending = true;
    // Native updateUI sets its buttons just after asking for presentation state.
    // Read their final mapping/disabled state after that synchronous update.
    Promise.resolve().then(() => { turnSyncPending = false; syncTurnControls(); });
  }
  function syncControls() {
    const next = modes[(modes.indexOf(labels3D) + 1) % modes.length];
    if (controls.labels) {
      // Like Show/Hide highlights, the caption names the next action, not the
      // current state. The stored mode remains available to feedback/readers.
      controls.labels.textContent = ({none:'Show no labels',some:'Show some labels',all:'Show all labels'})[next];
      controls.labels.setAttribute('data-mode', labels3D);
      controls.labels.setAttribute('aria-label', (next === 'none' ? 'Hide axis labels.' : 'Show ' + modeName(next) + ' axis labels.') + ' Current mode: ' + modeName(labels3D) + ' axis labels.');
      controls.labels.title = ({none:'Hide axis labels and swap markers.',some:'Show labels on the puzzle, without leader lines or swap markers.',all:'Show all available axis labels, including leader lines and the 1/2 swap markers.'})[next] + ' Current mode: ' + modeName(labels3D) + ' labels.';
    }
    if (controls.highlights) {
      controls.highlights.textContent = outline3D ? 'Hide highlights' : 'Show highlights';
      controls.highlights.setAttribute('aria-pressed', String(outline3D));
      controls.highlights.title = outline3D ? 'Hide white tile outlines in the 3D view; ring-map highlights stay visible.' : 'Show white outlines on held tiles and the selected rotation in the 3D view.';
    }
    if (controls.ringLabels) {
      controls.ringLabels.textContent = labelsOnRings ? 'Hide labels' : 'Show labels';
      controls.ringLabels.setAttribute('aria-pressed', String(labelsOnRings));
      controls.ringLabels.title = labelsOnRings ? 'Hide axis labels and direction arrows on the ring map.' : 'Show clickable axis labels and one positive-turn arrow per active ring.';
    }
    queueTurnSync();
  }
  function installControls() {
    const doc = root.document;
    if (!doc?.querySelector || !doc.createElement) return;
    const top = doc.querySelector('.cube-top'), focus = doc.querySelector('#ringFocus');
    // Native engines retain this legacy element as an internal reference.
    // There is no longer a separate tile-label display mode in the UI.
    const tiles = doc.getElementById('pieceLabels');
    if (tiles) { tiles.hidden = true; tiles.disabled = true; tiles.setAttribute('aria-hidden','true'); }
    root.PUZZLE_SOLVER_BRIDGE?.setTileLabels?.(false);
    const makeButton = (name, action) => {
      const button = doc.createElement('button'); button.id = name; button.type = 'button';
      button.className = 'small outline puzzle-display-control';
      button.addEventListener('click', action); return button;
    };
    if (top && !controls.labels) {
      controls.labels = makeButton('viewLabelMode', () => display.setLabelMode(modes[(modes.indexOf(labels3D) + 1) % modes.length]));
      controls.highlights = makeButton('viewHighlightToggle', () => display.setHighlights3D(!outline3D));
      top.append(controls.labels, controls.highlights);
    }
    if (top && !controls.ringCopy) {
      const wrap = doc.querySelector('.cube-wrap');
      if (wrap?.parentNode && top.parentNode === wrap) wrap.parentNode.insertBefore(top, wrap);
      top.setAttribute('role', 'toolbar'); top.setAttribute('aria-label', '3D puzzle controls');
      // Native camera controls remain connected for older engine references,
      // but are no longer part of the user interface or keyboard focus order.
      for (const id of ['faceView', 'homeView']) {
        const camera = doc.getElementById(id);
        if (camera) { camera.hidden = true; camera.disabled = true; camera.classList.add('view-native-camera'); camera.setAttribute('aria-hidden','true'); camera.setAttribute('tabindex','-1'); }
      }
      // Retain the native notation elements for engines, shortcuts and guide
      // notation, but no longer present a separate actions disclosure.
      for (const notation of doc.querySelectorAll('.notation-panel')) {
        if (notation.id === 'jumbleControls') continue;
        notation.hidden = true; notation.classList.add('view-native-actions');
      }
      ringSource = doc.getElementById('ringPanel')?.querySelector('.ring-controls');
      if (ringSource && wrap?.parentNode) {
        const copy = doc.createElement('div'); copy.id = 'viewRingControls'; copy.className = 'ring-controls view-ring-controls';
        controls.ringCopy = copy; wrap.parentNode.insertBefore(copy, wrap.nextSibling);
        buildRingCopy();
        // Keep native element IDs and handlers for the engines and 3D selector,
        // but remove this panel from layout, accessibility and keyboard input.
        ringSource.hidden = true; ringSource.inert = true;
        ringSource.classList.add('ring-native-controls'); ringSource.setAttribute('aria-hidden', 'true');
        if (root.MutationObserver && !turnObserver) {
          // Only observe the originals; synchronization cannot recursively
          // trigger itself. Rebuild if a native puzzle replaces its selector.
          turnObserver = new root.MutationObserver(queueTurnSync);
          turnObserver.observe(ringSource, {attributes:true, childList:true, characterData:true, subtree:true, attributeFilter:['class','disabled','title','hidden','aria-pressed','aria-label','data-selected']});
        }
      }
      syncTurnControls();
    }
    if (focus?.parentNode && !controls.ringLabels) {
      controls.ringLabels = makeButton('ringLabelToggle', () => display.toggleRingLabels());
      focus.parentNode.insertBefore(controls.ringLabels, focus.nextSibling);
    }
    if (top && !doc.getElementById('viewDisplayTools')) {
      const settings = doc.createElement('div'); settings.id = 'viewDisplayTools'; settings.className = 'view-display-tools';
      settings.setAttribute('role','group'); settings.setAttribute('aria-label','3D display settings');
      for (const child of Array.from(top.children)) settings.appendChild(child);
      top.append(settings);
    }
    if (top && !top.classList.contains('view-header-toolbar')) {
      const heading = doc.querySelector('.view-panel-head'), settings = doc.getElementById('viewDisplayTools');
      if (heading && heading !== top && settings) {
        // Share one reserved header row with the title and panel switches.
        // Puzzle-specific features remain visible in the same compact row.
        // All controls reserve real space outside the live view.
        const title = heading.querySelector('h2'), panels = heading.querySelector('.view-panel-controls');
        const features = doc.createElement('div');features.id='viewFeatureTools';features.className='view-feature-tools';
        features.setAttribute('role','group');features.setAttribute('aria-label','Puzzle-specific display settings');
        for (const child of Array.from(settings.children)) if (![controls.labels, controls.highlights].includes(child)) features.appendChild(child);
        controls.features = features;
        top.classList.add('panel-head','view-panel-head','view-header-toolbar');
        if (title) {
          // A short mobile heading leaves room for full, single-line control
          // captions without shrinking them. Keep the full accessible name.
          if (title.textContent.trim() === '3D puzzle') {
            title.setAttribute('aria-label','3D puzzle');
            const full = doc.createElement('span'), short = doc.createElement('span');
            full.className = 'view-title-full'; full.textContent = '3D puzzle'; full.setAttribute('aria-hidden','true');
            short.className = 'view-title-short'; short.textContent = '3D'; short.setAttribute('aria-hidden','true');
            title.replaceChildren(full, short);
          }
          top.insertBefore(title, top.firstChild);
        }
        // Mirror mode leads the display controls. Keep it separate from the
        // optional feature group so mirror mode stays left of common settings.
        const mirror = features.querySelector('#mirrorMode');
        if (mirror) top.insertBefore(mirror, settings);
        if (panels) {
          const guide = panels.querySelector('#guidePanelToggle');
          if (guide) {
            const full = doc.createElement('span'), short = doc.createElement('span');
            full.className = 'view-guide-full'; full.textContent = 'Show guide ←'; full.setAttribute('aria-hidden','true');
            short.className = 'view-guide-short'; short.textContent = 'Show guide ←'; short.setAttribute('aria-hidden','true');
            guide.replaceChildren(full, short); guide.setAttribute('aria-label','Show guide'); guide.title = 'Show guide';
          }
          top.appendChild(panels);
        }
        // Hidden native badges can still be updated by their engine (Homer's
        // viewMode, for example). Keep those exact elements connected.
        for (const child of Array.from(heading.children)) top.appendChild(child);
        top.appendChild(features);heading.remove();
      }
    }
    if(!chromeObserver && root.MutationObserver){
      chromeObserver=new root.MutationObserver(syncChrome);
      const stop=doc.getElementById('pause'),activity=doc.getElementById('journalActivity');
      if(stop)chromeObserver.observe(stop,{attributes:true,attributeFilter:['hidden','disabled']});
      if(activity)chromeObserver.observe(activity,{childList:true,characterData:true,subtree:true});
    }
    // Native engines still update these counters, but the retired metrics
    // strip is inert and consumes no space in the puzzle panel.
    const metrics=doc.querySelector('.cube-bottom');
    if(metrics){metrics.hidden=true;metrics.setAttribute('aria-hidden','true');}
    const ringHint=doc.getElementById('ringHint'),turnBar=doc.querySelector('.turn-bar');
    if(ringHint && turnBar)turnBar.title=ringHint.textContent;
    const notation=doc.querySelector('.notation-panel'),note=notation?.querySelector?.('p');
    if(note)notation.setAttribute('title',note.textContent);
    const notationHeading=notation?.querySelector?.('.notation-heading');
    if(notationHeading)for(const child of Array.from(notationHeading.children))if(child.tagName==='SPAN' && child.textContent.trim()==='Notation moves')child.remove();
    syncChrome();
    if ((top || focus) && !doc.querySelector('#puzzleDisplayControlStyles')) {
      const css = doc.createElement('style'); css.id = 'puzzleDisplayControlStyles';
      css.textContent = '.cube-top{flex-wrap:wrap;gap:5px}.cube-top .puzzle-display-control{white-space:nowrap;color:#f3f3f5;border-color:#595b66;background:#191921ed;font-size:10px;padding:4px 7px;min-height:27px}.cube-top .puzzle-display-control:hover,.cube-top .puzzle-display-control:focus-visible{background:#33343f;border-color:#a5a7b2}.ring-panel-head #ringLabelToggle{color:#f3f3f5;min-width:0}@media(max-width:680px){.cube-top .puzzle-display-control{min-height:32px}}';
      (doc.head || doc.body).appendChild(css);
    }
    syncControls(); installNodeInspector();
  }
  function installNodeInspector() {
    const doc=root.document,canvas=doc?.getElementById?.('rings');
    if(!canvas || !doc.createElement || doc.getElementById('pieceReferenceTooltip'))return;
    const tip=doc.createElement('div');tip.id='pieceReferenceTooltip';tip.setAttribute('role','tooltip');tip.hidden=true;
    tip.style.cssText='position:fixed;z-index:1000;pointer-events:none;box-sizing:border-box;max-width:min(340px,calc(100vw - 24px));padding:8px 10px;border:1px solid #d9d9df;border-radius:8px;background:#15151bf5;color:#f3f3f5;font:12px/1.45 system-ui,sans-serif;overflow-wrap:anywhere;box-shadow:0 3px 16px #0008';
    tip.style.display='none';doc.body.appendChild(tip);
    let down=null;
    const allowed=()=>!root.PUZZLE_SOLVER_BRIDGE?.isBusy?.()&&!root.ConstrainedSolverUI?.visualState?.().active&&!doc.body.classList.contains('mirror-active')&&typeof root.PUZZLE_SOLVER_BRIDGE?.inspectNode==='function';
    clearNodeInspection=()=>{if(!tip.hidden)tip.hidden=true;if(tip.style.display!=='none')tip.style.display='none';};
    function show(event) {
      if(!allowed()){clearNodeInspection();return;}
      const b=canvas.getBoundingClientRect(),x=event.clientX-b.left,y=event.clientY-b.top;
      const hit=(root.PUZZLE_SOLVER_BRIDGE.nodes()||[]).map(n=>({n,d:Math.hypot(n.x-x,n.y-y)})).filter(h=>h.d<=Math.max(9,(h.n.r||5)+3)).sort((a,b)=>a.d-b.d)[0]?.n;
      const text=hit&&root.PUZZLE_SOLVER_BRIDGE.inspectNode(hit.stickerId);
      if(!text){clearNodeInspection();return;}
      tip.textContent='Piece reference · '+text;tip.hidden=false;tip.style.display='block';
      const viewportWidth=root.innerWidth||doc.documentElement?.clientWidth||Math.max(360,b.left+b.width),viewportHeight=root.innerHeight||doc.documentElement?.clientHeight||Math.max(640,b.top+b.height);
      tip.style.left='12px';tip.style.top='12px';
      const box=tip.getBoundingClientRect(),width=Math.min(box.width||340,viewportWidth-24),height=box.height||64;
      tip.style.left=Math.max(12,Math.min(event.clientX+12,viewportWidth-width-12))+'px';
      tip.style.top=Math.max(12,Math.min(event.clientY+18,viewportHeight-height-12))+'px';
    }
    canvas.addEventListener('pointermove',event=>{
      if(down){if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)down.moved=true;clearNodeInspection();return;}
      if(event.pointerType!=='touch'&&!event.buttons)show(event);
    });
    canvas.addEventListener('pointerdown',event=>{clearNodeInspection();down=event.button>0?null:{x:event.clientX,y:event.clientY,moved:false};});
    canvas.addEventListener('pointerup',event=>{const tap=down&&!down.moved&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<=6;down=null;if(tap)show(event);});
    for(const name of ['pointerleave','pointercancel'])canvas.addEventListener(name,()=>{down=null;clearNodeInspection();});
    doc.addEventListener('pointerdown',event=>{if(event.target!==canvas)clearNodeInspection();},true);
    doc.addEventListener('pointermove',event=>{if(event.target!==canvas&&!down)clearNodeInspection();},true);
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')clearNodeInspection();});
    root.addEventListener?.('scroll',clearNodeInspection,{capture:true,passive:true});root.addEventListener?.('resize',clearNodeInspection);
    root.addEventListener?.('blur',clearNodeInspection);
  }
  const id = value => value == null || value === '' ? null : String(value);
  const repaint = () => root.PUZZLE_SOLVER_BRIDGE?.requestRender?.();
  const mutedClass = animationAxis => root.document?.body?.classList?.toggle('puzzle-axis-muted', muted && !animationAxis);
  function nextFrameRepaint() {
    if (repaintPending) return;
    repaintPending = true;
    // Ring maps draw before the 3D panel. A synchronous dirty flag is consumed
    // by that same frame; publish the newly visible label set on the next one.
    const schedule = root.requestAnimationFrame || (callback => root.setTimeout(callback, 0));
    schedule(() => { repaintPending = false; repaint(); });
  }
  const display = {
    syncTurnControls,
    labelMode() { return labels3D; },
    tileLabelsAvailable() { return false; },
    tileLabelsVisible() { return display.tileLabelsAvailable() && !!root.PUZZLE_SOLVER_BRIDGE?.tileLabelsOn?.(); },
    setTileLabels(on) {
      if (!display.tileLabelsAvailable()) return;
      on = !!on; if (on === display.tileLabelsVisible()) return; root.PUZZLE_SOLVER_BRIDGE?.setTileLabels?.(on);
      syncControls(); pulse(root.document?.querySelector?.('#pieceLabels')); repaint();
    },
    publish3DLabelTargets(targets) { axisLabelTargets = targets || []; },
    axisLabelTargets() { return labels3D === 'none' ? [] : axisLabelTargets; },
    setLabelMode(mode) {
      if (mode === 'more') mode = 'all';
      if (!modes.includes(mode)) return;
      const changed = mode !== labels3D;
      if (!changed) return;
      labels3D = mode;
      if (changed) { syncControls(); pulse(controls.labels); repaint(); }
    },
    highlights3D() { return outline3D; },
    setHighlights3D(on) {
      on = !!on; if (on === outline3D) return;
      outline3D = on; syncControls(); pulse(controls.highlights); repaint();
    },
    drawRingDirection,
    ringLabelsVisible() {
      // One shared preference in turn-ring and constrained-solver modes.
      return labelsOnRings;
    },
    toggleRingLabels() { labelsOnRings = !labelsOnRings; syncControls(); pulse(controls.ringLabels); repaint(); },
    resetDefaults() {
      // Compatibility entry point for older lifecycle callers: clear transient
      // selection only. Fresh page initialization owns all preference defaults.
      display.clear();
    },
    palette(active) { return active ? palettes.active : palettes.inactive; },
    selection(fallback, animation) {
      // A caller querying selection without animation is not a playback event.
      if (arguments.length > 1) trackPlayingTurn(animation);
      const moving = id(animation?.move?.face);
      const busy = !!root.PUZZLE_SOLVER_BRIDGE?.isBusy?.();
      const solving = !!root.ConstrainedSolverUI?.visualState?.().active;
      if(moving || busy || solving)clearNodeInspection();
      mutedClass(moving);
      const selected = moving || (muted || solving ? null : id(fallback));
      presentedAxis = selected;
      // Renderers ask for this state several times on every animation frame.
      // Sync DOM controls only at a selection, availability or primitive-move
      // boundary. The native-control observer separately handles their edits.
      // turnPulse distinguishes consecutive identical turns without reflashing
      // or traversing the selector DOM for each interpolation frame.
      const next = [selected, busy, solving, !!root.ConstrainedSolverUI?.blocksManualMoves?.(), playingAxis, playingDirection, turnPulse].join('|');
      if (next !== selectionControlState) { selectionControlState = next; queueTurnSync(); }
      return selected;
    },
    choose(axis) {
      if (id(axis) == null) return;
      muted = false; hoveredAxis = null; mutedClass(null); repaint();
    },
    clear() {
      clearNodeInspection();
      muted = true; hoveredAxis = null; mutedClass(null); root.PuzzleSelection3D?.clearHover?.(); repaint(); root.PUZZLE_SOLVER_BRIDGE?.refreshControls?.();
    },
    publish3DAxes(ids) {
      const next = [...new Set((ids || []).map(id).filter(Boolean))].sort();
      if (next.length === visibleAxes.length && next.every((axis, index) => axis === visibleAxes[index])) return;
      visibleAxes = next; nextFrameRepaint();
    },
    ringAxes() { return [...new Set([...visibleAxes, ...(hoveredAxis == null ? [] : [hoveredAxis])])]; },
    hover(axis) {
      const next = id(axis); if (next === hoveredAxis) return;
      hoveredAxis = next; repaint();
    },
    hovered() { return hoveredAxis; }
  };
  function freshPageDefaults() {
    // Returning through the browser's back/forward cache is a new visit, but
    // must not reset the physical puzzle or its journal. This is deliberately
    // separate from every playback, solver, mirror and reset lifecycle hook.
    labels3D = 'none'; outline3D = true; labelsOnRings = false;
    const focus = root.document?.getElementById?.('ringFocus');
    if (focus?.getAttribute('aria-pressed') === 'false') focus.click();
    const speed = root.document?.getElementById?.('speed');
    if (speed && String(speed.value) !== '3') {
      speed.value = '3';
      if (root.Event) speed.dispatchEvent(new root.Event('input', {bubbles:true}));
    }
    root.PuzzlePlaybackControls?.syncSpeed?.();
    root.RingMapNavigation?.reset?.();
    syncControls(); repaint();
  }
  root.addEventListener?.('pageshow', event => { if (event.persisted) freshPageDefaults(); });
  root.PuzzleAxisDisplay = Object.freeze(display);
  installControls();
  root.document?.addEventListener?.('DOMContentLoaded', installControls, {once:true});
})(typeof window === 'undefined' ? globalThis : window);
