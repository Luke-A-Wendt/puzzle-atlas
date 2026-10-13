/* Optional selection overlay. Original ring geometry and controls remain intact. */
(() => {
  'use strict';
  if (!document.querySelector || !window.PUZZLE_API || !window.PUZZLE_SOLVER_BRIDGE || !window.ConstrainedSolverCore) return;
  const api = window.PUZZLE_API, bridge = window.PUZZLE_SOLVER_BRIDGE, core = window.ConstrainedSolverCore;
  const panel = document.getElementById('ringPanel'), rings = document.getElementById('rings');
  if (!panel || !rings) return;
  const head = panel.querySelector('.ring-panel-head'), wrap = rings.parentElement;
  const scriptBase = new URL('.', document.currentScript.src);
  const make = (tag, id, cls, text) => { const el = document.createElement(tag); if (id) el.id = id; if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  const button = (id, text, cls = '') => { const el = make('button', id, cls, text); el.type = 'button'; return el; };
  const toggle = button('constrainedSolverToggle', 'Constrained Solver', 'small outline cs-toggle');
  toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-controls', 'constrainedSolverControls');
  const normalMode=button('ringModeDefault','Turn rings','small outline');
  const modeSwitch=make('div','','cs-mode-switch');modeSwitch.setAttribute('role','group');modeSwitch.setAttribute('aria-label','Ring map mode');modeSwitch.append(normalMode,toggle);
  head.insertBefore(modeSwitch, document.getElementById('ringPanelHide'));
  const controls = make('section', 'constrainedSolverControls', 'cs-controls'); controls.hidden = true;
  controls.setAttribute('aria-label', 'Constrained Solver');
  const toolbar = make('div', '', 'cs-toolbar');
  const tools = make('div', '', 'cs-tools'); tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Node selection tool');
  const hold = button('csHold', 'Select holds'), release = button('csRelease', 'Deselect holds'), swap = button('csSwap', 'Swap pair'); tools.append(hold, release);swap.hidden=true;swap.tabIndex=-1;tools.append(swap);
  const clear = button('csClear', 'Clear all', 'small outline'), cancel = button('csCancel', 'Cancel search', 'small outline');
  const retry = button('csRetry', 'Try longer · 10s', 'small outline'); cancel.hidden = true; retry.hidden = true;
  const go = button('csGo', 'Go', 'small outline cs-go');
  const holdLabel=make('span','','cs-hold-label','Hold nodes');
  toolbar.append(holdLabel,tools,clear);
  const selection = make('div', '', 'cs-selection');
  const heldCount = make('span', 'csHeldCount', 'cs-held-count', '0 held');
  const aChip = button('csPairA', 'A · choose a node', 'cs-pair-chip'), bChip = button('csPairB', 'B · choose a node', 'cs-pair-chip');
  const slotParts=[aChip,bChip].map((chip,i)=>{chip.textContent='';const label=make('span','','cs-slot-label',i?'B':'A'),value=make('span','','cs-slot-value','Choose a node'),action=make('span','','cs-slot-action','Choose');chip.append(label,value,action);return {value,action};});
  const pairArrow = make('span', '', 'cs-swap-arrow', '↔'); toolbar.insertBefore(heldCount,clear);selection.append(aChip, pairArrow, bChip, go);
  const searchActions=make('div','','cs-search-actions');searchActions.append(cancel,retry);
  const autoProgress = make('div', 'csAutoProgress', 'cs-auto-progress'); autoProgress.hidden = true;
  const progressLabel = make('span', 'csAutoProgressLabel', '', 'Preparing a solution');
  const progressBar = make('progress', 'csAutoProgressBar'); progressBar.setAttribute('aria-label', 'Nodes solved and constrained'); autoProgress.append(progressLabel, progressBar);
  const stepLabel = make('span', 'csStepProgressLabel', '', 'Current step');
  const stepBar = make('progress', 'csStepProgressBar'); stepBar.setAttribute('aria-label', 'Moves completed in the current constrained step'); autoProgress.append(stepLabel, stepBar);
  const status = make('p', 'csStatus', 'cs-status', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const autoNotice=make('div','csAutoNotice','cs-auto-notice');autoNotice.hidden=true;
  const autoNoticeText=make('span','csAutoNoticeText');autoNoticeText.setAttribute('role','status');autoNoticeText.setAttribute('aria-live','polite');
  const autoNoticeProgress=make('progress','csAutoNoticeProgress');autoNoticeProgress.setAttribute('aria-label','Auto Solve preparation');
  const autoNoticeRetry=button('csAutoNoticeRetry','Retry','small outline'),autoNoticeDismiss=button('csAutoNoticeDismiss','Dismiss','small outline');
  autoNotice.append(autoNoticeText,autoNoticeProgress,autoNoticeRetry,autoNoticeDismiss);document.querySelector('.action-panel')?.appendChild(autoNotice);
  const eligibilityNote = make('p', 'csEligibilityNote', 'cs-eligibility', ''); eligibilityNote.hidden=true;
  const bottom = make('div', '', 'cs-bottom');
  const keyboardNote = make('span', '', 'cs-keyboard', 'Click or lasso to hold · Click A or B to replace it · Go to swap');
  bottom.append(keyboardNote);
  controls.append(toolbar, selection, eligibilityNote, searchActions, autoProgress, status, bottom); panel.appendChild(controls);
  const overlay = make('canvas', 'csNodeOverlay', 'cs-node-overlay'); overlay.hidden = true; overlay.tabIndex = 0;
  overlay.setAttribute('aria-label', 'Select ring-map nodes. Arrow keys choose a node; Enter selects it.');
  overlay.setAttribute('aria-describedby', 'csStatus'); wrap.appendChild(overlay);
  const ctx = overlay.getContext('2d');
  const backdrop = make('canvas', 'csAnchorBackdrop', 'cs-anchor-backdrop'); backdrop.hidden=true; backdrop.setAttribute('aria-hidden','true'); wrap.insertBefore(backdrop,rings);
  const backCtx = backdrop.getContext('2d');
  let active = false, tool = 'hold', phase = 'off', model = null, held = new Set(), pair = [], result = null;
  let message = '', worker = null, workerTimer = null, epoch = 0, execution = null, observed = null, hover = null, focusId = null, lastDraw = '', pointerStart = null;
  let autoJob = null, autoRequested = false, autoSpeed = false, lasso = null, lastAutoStep = 0, lastManualStep = 0;
  let autoTransportActive = false;
  let eligibility=null, eligibilityWorker=null, eligibilityTimer=null, eligibilityEpoch=0;
  let anchors=[], referencesDirty=true, pairTarget=0, returnToDefault=false, lastEligibilityProof=null;
  const eligibilityCache=new Map(); let eligibilityBytes=0;
  const cache = new Map(); let cacheBytes = 0; const CACHE_LIMIT = 1024 * 1024;
  const isBusy = () => ['loading', 'unavailable', 'solving', 'executing', 'auto-gap'].includes(phase);
  const idle = s => !s.animating && (!s.mode || s.mode === 'idle');
  const tokenKey = m => JSON.stringify(Object.entries(m.stickerToNode).sort((a,b) => a[0].localeCompare(b[0])));
  const mapping = s => core.mapSnapshot(model, s);
  const sameMap = (a,b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]);
  const nodes = () => (bridge.nodes() || []).filter(n => Number.isFinite(n.x) && Number.isFinite(n.y)).map(n => ({...n, stickerId: String(n.stickerId)}));
  const nodeName = id => { const s = api.snapshot().stickers?.find(x => String(x.id) === String(id)); return (s?.face ? s.face + ' · ' : '') + String(id); };
  const setMessage = text => { message = text; status.textContent = text; };
  function hideAutoNotice(){autoNotice.hidden=true;document.querySelector('.action-panel')?.classList.remove('cs-notice-visible');}
  function showAutoNotice(text,failed=false){autoNotice.hidden=false;document.querySelector('.action-panel')?.classList.add('cs-notice-visible');autoNoticeText.textContent=text;autoNoticeProgress.hidden=failed;autoNoticeRetry.hidden=!failed;autoNoticeDismiss.hidden=!failed;autoNotice.setAttribute('data-state',failed?'error':'loading');}
  function autoFailure(reason,detail){
    let text;
    if(/load_timeout/.test(reason))text='Downloading the solver data timed out. Check your connection and retry.';
    else if(/network|http|unavailable/.test(reason) && !/worker|integrity/.test(reason))text='Solver data could not be downloaded. Check your connection and retry.';
    else if(/integrity|parse|version/.test(reason))text='The solver data could not be verified. Reload this puzzle and retry.';
    else if(/worker/.test(reason))text='The browser could not start or keep the solver running. Close other tabs and retry; an updated browser may help.';
    else if(/memory|storage/.test(reason))text='The solver reached its memory limit. Close other tabs and retry.';
    else if(/output|sequence|word/.test(reason))text='The solution exceeded the move-sequence limit.';
    else if(/time|limit|budget/.test(reason))text='The solver reached its computation limit. Retry allows more planning time.';
    else text='Auto Solve could not complete its preparation.';
    return text+' No moves were made. ('+String(reason||'startup_error')+(detail?': '+String(detail).slice(0,220):'')+')';
  }
  function reportAutoFailure(reason,detail){const text=autoFailure(reason,detail);setMessage(text);showAutoNotice(text,true);}
  const autoStopActive = () => active && autoRequested && ['loading','solving','executing','auto-gap'].includes(phase);
  function syncTransport() {
    const stop=document.getElementById('pause');if(!stop)return;
    const snap=api.snapshot(), automatic=autoStopActive(), scrambling=snap.mode==='scramble';
    // The solver session remains active while the native move queue rests
    // between stages. Keep its status and disabled/hover treatment steady.
    if(automatic){
      const badge=document.getElementById('status'),solve=document.getElementById('solve');
      if(badge){badge.className='status busy';badge.textContent='✦ Solving';}
      if(solve)solve.disabled=true;
    }
    stop.hidden=!automatic && (!snap.mode || snap.mode==='idle');
    stop.textContent=automatic && autoJob?.stopAfterStep?'Stopping…':automatic||scrambling?'Stop':snap.paused?'Resume':'Pause';
    stop.disabled=!!(automatic && autoJob?.stopAfterStep);
    stop.title=automatic?'Stop after the current constrained step':scrambling?'Stop randomizing immediately; keep completed turns':'Pause or resume the current sequence';
  }
  function captureReferences() {
    const v=bridge.viewport?.();if(!v || !(v.scale>0))return;
    anchors=nodes().filter(n=>held.has(n.stickerId)||pair.includes(n.stickerId)).map(n=>({id:n.stickerId,x:(n.x-v.x)/v.scale,y:(n.y-v.y)/v.scale,r:(n.r||5)/v.scale,label:pair.includes(n.stickerId)?(pair.indexOf(n.stickerId)?'B':'A'):''}));
    referencesDirty=false;lastDraw='';
  }
  function setAutoSpeed(on) {
    if (!on && !autoSpeed) return;
    autoSpeed = on;
    const speed = document.getElementById('speed');
    if (speed) { speed.value = on ? '5' : '3'; speed.dispatchEvent(new Event('input', {bubbles:true})); }
  }
  function updateStepProgress(snap = api.snapshot()) {
    const job = execution, previous = autoRequested ? lastAutoStep : lastManualStep;
    const completed = job ? Math.min(job.length, job.offset + (job.pending ? (snap.sequence?.completed || 0) : 0)) : autoJob?.completed ? autoJob.stages[autoJob.completed-1].moveIndices.length : previous;
    const total = job?.length || (autoJob?.completed ? autoJob.stages[autoJob.completed-1].moveIndices.length : previous);
    stepBar.max = total || 1; stepBar.value = completed;
    const label = autoRequested ? 'Current step' : 'Swap progress';
    stepLabel.textContent = label + (total ? ' · ' + completed + ' / ' + total + ' moves' : phase === 'solving' ? ' · finding a sequence' : ' · waiting');
  }
  const hasPair=()=>pair[0]!=null && pair[1]!=null;
  const trimPair=()=>{while(pair.length && pair[pair.length-1]==null)pair.pop();};
  function stopEligibility(terminate=true) {
    eligibilityEpoch++;
    if(terminate && eligibilityWorker){eligibilityWorker.terminate();eligibilityWorker=null;}
    if(eligibilityTimer!==null)clearTimeout(eligibilityTimer);eligibilityTimer=null;
  }
  function proofStatus(a,b) {
    if(a===undefined)return 0;
    if(b!==undefined && a===b)return 2;
    const status=core.eligibilityStatus(eligibility?.result,a,b);if(status)return status;
    const bound=eligibility?.bound;if(!bound)return 0;
    const old=core.eligibilityStatus(bound.result,a,b);
    // Adding constraints preserves impossibility; removing them preserves a witness.
    if(old===2 && bound.fixed.every(n=>eligibility.fixed.includes(n)))return 2;
    if(old===1 && eligibility.fixed.every(n=>bound.fixed.includes(n)))return 1;
    return 0;
  }
  const candidatePartner=()=>pairTarget===1 && pair[0]!=null ? pair[0] : null;
  function candidateStatus(id) {
    if(held.has(id))return 2;
    const n=eligibility?.map[id], other=candidatePartner();
    return proofStatus(n,other!=null?eligibility?.map[other]:undefined);
  }
  function selectedPairStatus() {
    if(!hasPair())return 0;
    if(held.has(pair[0]) || held.has(pair[1]) || pair[0]===pair[1])return 2;
    if(result?.status==='impossible')return 2;
    return proofStatus(eligibility?.map[pair[0]],eligibility?.map[pair[1]]);
  }
  function eligibilityCode(id) {
    if(!active || phase!=='selecting' || autoRequested || held.has(id) || pair.includes(id))return 0;
    return candidateStatus(id);
  }
  function syncPairUI() {
    const invalid=selectedPairStatus()===2;
    [aChip,bChip].forEach((chip,i)=>{
      const selected=pair[i]!=null, editing=tool==='swap' && pairTarget===i && !isBusy() && !autoRequested;
      slotParts[i].value.textContent=selected?nodeName(pair[i]):autoRequested?(i?'Solved position':'Current position'):'Choose a node';
      slotParts[i].action.textContent=autoRequested?(i?'Target':'Current'):isBusy()?'Selected':editing?'Pick on map':selected?'Change':'Choose';
      chip.classList.toggle('chosen',selected);chip.classList.toggle('editing',editing);chip.classList.toggle('invalid',invalid);
      chip.setAttribute('aria-pressed',String(editing));chip.setAttribute('aria-label',(selected?'Change ':'Choose ')+(i?'B':'A')+(selected?': '+nodeName(pair[i]):''));
      chip.disabled=isBusy()||!!autoRequested;
    });
    go.hidden=!!autoRequested;go.disabled=isBusy()||!hasPair()||invalid;
    go.title=invalid?'This pair cannot swap with the current holds':!hasPair()?'Choose A and B first':'Find and execute the selected swap';
  }
  function syncEligibilityNote() {
    eligibilityNote.hidden=!active || phase!=='selecting' || autoRequested;
    if(eligibilityNote.hidden)return;
    const label=pairTarget?'B':'A', invalid=selectedPairStatus()===2;
    const partner=candidatePartner(), candidates=nodes().filter(n=>!held.has(n.stickerId) && n.stickerId!==partner);
    let available=0,blocked=0,unknown=0;for(const n of candidates){const s=candidateStatus(n.stickerId);if(s===1)available++;else if(s===2)blocked++;else unknown++;}
    const checking=eligibility?.status==='pending';
    eligibilityNote.setAttribute('data-state',invalid?'blocked':checking?'checking':unknown?'unknown':'ready');
    if(invalid)eligibilityNote.textContent='A and B cannot swap with these holds. Change A or B, or release a hold.';
    else if(!candidates.length || (blocked===candidates.length && !unknown))eligibilityNote.textContent='No '+label+' choices under the legal moves'+(held.size?' with these holds':'')+(partner!=null?' and A':'')+'. '+(held.size?'Release a hold or choose a new A.':'This node has no legal swap partner. Choose a new A.');
    else if(checking)eligibilityNote.textContent='Checking choices for '+label+'…'+(blocked?' '+blocked+' already ruled out.':'')+' You can keep selecting.';
    else if(hasPair() && selectedPairStatus()===1)eligibilityNote.textContent='This pair can swap. Press Go, or click A or B to change it.';
    else eligibilityNote.textContent=label+': '+available+' available · '+blocked+' unavailable'+(unknown?' · '+unknown+' unchecked. Go checks your pair.':'. Shaded nodes cannot be '+label+'.');
    if(!held.size && partner==null && blocked)eligibilityNote.textContent+=' No holds are applied: these nodes have no legal pair exchange.';
    eligibilityNote.title='A choices depend on the current holds and legal puzzle moves. B choices also depend on A. Fixed centers and groups that only cycle in threes may have no legal pair exchange, even without holds. Unchecked choices remain selectable.';
    overlay.setAttribute('aria-busy',String(checking));
  }
  function ensureEligibility() {
    if(!active || phase!=='selecting' || autoRequested || !model) { stopEligibility();if(eligibility?.status==='pending')eligibility=null;return; }
    const snapshot=api.snapshot();if(!idle(snapshot))return;
    let map;try{map=mapping(snapshot);}catch(_){return;}
    const startKey=tokenKey(map),fixed=[...held].map(id=>map.stickerToNode[id]).sort((a,b)=>a-b);
    const occupiedKey=JSON.stringify(Object.values(map.stickerToNode).sort((a,b)=>a-b)),key=JSON.stringify([fixed,occupiedKey]);
    if(eligibility?.key===key && eligibility.startKey===startKey)return;
    // Reuse an idle worker's prepared chain; cancel work tied to old holds.
    stopEligibility(eligibility?.status==='pending');const id=eligibilityEpoch;
    const bound=lastEligibilityProof?.occupiedKey===occupiedKey?lastEligibilityProof:null;
    eligibility={key,startKey,fixed,occupiedKey,map:{...map.stickerToNode},status:'pending',result:null,bound};
    const receive=payload=>{
      if(id!==eligibilityEpoch || !active || phase!=='selecting' || autoRequested || !idle(api.snapshot()))return;
      try{
        if(tokenKey(mapping(api.snapshot()))!==startKey)return;
        const r=payload.result;
        if(payload.modelFingerprint && payload.modelFingerprint!==core.modelFingerprint(model))throw Error('stale model');
        if(!r || !['complete','partial','unknown','invalid'].includes(r.status))throw Error('invalid eligibility');
        stopEligibility(!['complete','partial'].includes(r.status));eligibility={key,startKey,fixed,occupiedKey,map:{...map.stickerToNode},status:r.status,result:r,bound};
        if(['complete','partial'].includes(r.status)){
          lastEligibilityProof={result:r,fixed,occupiedKey};
          if(!eligibilityCache.has(key)){
            const bytes=(r.knownPairs?.length||0)+(r.feasiblePairs?.length||0)+(r.firstStatus?.length||0)+256;
            while(eligibilityCache.size && eligibilityBytes+bytes>2*1024*1024){const old=eligibilityCache.keys().next().value;eligibilityBytes-=eligibilityCache.get(old).bytes;eligibilityCache.delete(old);}
            if(bytes<=2*1024*1024){eligibilityCache.set(key,{result:r,bytes});eligibilityBytes+=bytes;}
          }
        }
      }catch(_){stopEligibility();eligibility={key,startKey,fixed,occupiedKey,map:{...map.stickerToNode},status:'unknown',result:null,bound};}
      syncPairUI();syncEligibilityNote();lastDraw='';bridge.requestRender();
    };
    if(eligibilityCache.has(key)){receive({result:eligibilityCache.get(key).result});return;}
    eligibilityTimer=setTimeout(()=>{
      eligibilityTimer=null;
      if(id!==eligibilityEpoch || !active || phase!=='selecting' || autoRequested)return;
      try{
        if(!eligibilityWorker)eligibilityWorker=new Worker(new URL('constrained-solver-worker.js',scriptBase));
        eligibilityWorker.onmessage=e=>{if(e.data?.id===id && e.data.type==='result')receive(e.data);};
        eligibilityWorker.onerror=()=>receive({result:{status:'unknown'}});
        eligibilityTimer=setTimeout(()=>receive({result:{status:'unknown'}}),7000);
        eligibilityWorker.postMessage({task:'eligible-swaps',id,modelId:api.puzzle,snapshot,selection:{protectedStickerIds:[...held]},options:{maxMs:3000}});
      }catch(_){receive({result:{status:'unknown'}});}
    },80);
  }
  function sync() {
    panel.classList.toggle('cs-active', active); panel.classList.toggle('cs-auto-active', active && autoRequested); document.body.classList.toggle('cs-working', active && ['loading','solving','executing','auto-gap'].includes(phase));
    controls.hidden = !active; overlay.hidden = !active; backdrop.hidden = !active;
    toggle.setAttribute('aria-pressed', String(active));normalMode.setAttribute('aria-pressed',String(!active));toggle.disabled=false;normalMode.disabled=returnToDefault||!!autoJob?.stopAfterStep;
    toggle.title='Hold nodes and swap a pair';normalMode.title=phase==='executing'?'Return to ring turns after this complete step':'Return to ordinary ring turns';
    normalMode.textContent=normalMode.disabled?'Finishing step…':'Turn rings';modeSwitch.setAttribute('aria-busy',String(normalMode.disabled));
    hold.setAttribute('aria-pressed', String(tool === 'hold')); release.setAttribute('aria-pressed', String(tool === 'release')); swap.setAttribute('aria-pressed', String(tool === 'swap'));
    hold.disabled = release.disabled = swap.disabled = clear.disabled = isBusy();
    heldCount.textContent = held.size + (autoRequested ? ' secured' : ' held');
    cancel.hidden = phase !== 'solving' && !(autoRequested && phase==='loading'); retry.hidden = !active || phase !== 'selecting' || result?.status !== 'unknown' || (!autoRequested && !hasPair()); retry.textContent = autoRequested ? 'Retry full solve · 30s' : 'Try longer · 10s';
    searchActions.hidden=cancel.hidden && retry.hidden;
    tools.hidden = !!autoJob || (autoRequested && phase === 'solving'); holdLabel.hidden=!!autoRequested; clear.hidden = !!autoJob; pairArrow.textContent = autoRequested ? '→' : '↔';
    autoProgress.hidden = !active; progressBar.hidden = progressLabel.hidden = !autoRequested; progressBar.max = model?.stickerCount || 1; progressBar.value = held.size;
    progressLabel.textContent = autoJob ? 'Step ' + Math.min(autoJob.completed + 1, autoJob.stages.length) + ' / ' + autoJob.stages.length + ' · ' + held.size + ' / ' + model.stickerCount + ' nodes secured' : held.size === model?.stickerCount ? 'All ' + held.size + ' nodes restored' : phase === 'solving' ? 'Planning from the current configuration' : held.size + ' nodes secured';
    updateStepProgress();
    ensureEligibility();syncPairUI();syncEligibilityNote();
    const automatic=autoStopActive();
    if(autoTransportActive!==automatic){autoTransportActive=automatic;bridge.refreshControls?.();}
    syncTransport();
    panel.setAttribute('data-solver-phase', phase); lastDraw = ''; bridge.requestRender();
  }
  function instructions() {
    setMessage(tool==='hold'?'Click or lasso nodes to hold. Then choose A and B below. Held nodes return after the whole swap.':tool==='release'?'Click or lasso to release holds. A and B stay selected; their availability updates.':hasPair()?'Click a new node to replace '+(pairTarget?'B':'A')+', or press Go. Other unheld nodes may move.':'Choose '+(pairTarget?'B':'A')+' on the map. Click either letter below to change which one you are choosing.');
  }
  function terminateWorker() { if (worker) worker.terminate(); worker = null; if (workerTimer !== null) clearTimeout(workerTimer); workerTimer = null; }
  function cancelSearch() {
    if (phase !== 'solving' && !(autoRequested && phase==='loading')) return false;
    if (autoRequested) { closePanel(); return true; }
    epoch++; terminateWorker(); phase = 'selecting'; result = null; autoJob = null; setAutoSpeed(false); setMessage('Search canceled. The puzzle has not moved.'); sync(); return true;
  }
  // Closing the map abandons endpoint constraints, but never interrupts an
  // atomic puzzle turn. The engine finishes that turn and discards its queue.
  function closePanel() {
    hideAutoNotice();
    epoch++; terminateWorker();
    stopEligibility(); eligibility=null;lastEligibilityProof=null;
    if (execution || autoJob) api.stopAfterCurrentMove?.();
    active=false; phase='off'; execution=null; autoJob=null; autoRequested=false;
    held.clear(); pair=[]; result=null; observed=null; pointerStart=null; lasso=null; lastAutoStep=0; lastManualStep=0; anchors=[];referencesDirty=true;pairTarget=0;returnToDefault=false;
    setAutoSpeed(false); sync(); return true;
  }
  async function setActive(value) {
    value = !!value;
    if (value === active) return true;
    if (phase === 'executing' || phase === 'auto-gap') return false;
    if (!value) return closePanel();
    const snap = api.snapshot();
    if (!idle(snap)) { toggle.title = 'Wait for the current sequence to finish'; return false; }
    active = true; phase = 'loading'; tool = 'hold'; setMessage('Loading the puzzle move model…'); sync();
    const id = ++epoch;
    try {
      model = await core.loadModel(api.puzzle);
      if (!active || id !== epoch) return false;
      observed = tokenKey(mapping(api.snapshot())); phase = autoRequested?'solving':'selecting'; if(!autoRequested)instructions(); sync(); overlay.focus({preventScroll:true}); return true;
    } catch (error) {
      if (!active || id !== epoch) return false;
      phase = 'unavailable';if(autoRequested)reportAutoFailure(error.code||'model_unavailable',error.message);else setMessage('Solver unavailable: ' + error.message + '. Turn this mode off and on to retry.');setAutoSpeed(false);sync();return false;
    }
  }
  function editPair(index) {
    if(!active || isBusy() || autoRequested)return false;
    // Starting over at A releases both endpoints, but preserves all holds.
    if(index===0){pair=[];result=null;lastManualStep=0;anchors=anchors.filter(a=>held.has(a.id));referencesDirty=true;}
    hideAutoNotice();tool='swap';pairTarget=index;instructions();sync();return true;
  }
  function setTool(value) {
    if(!active || isBusy() || !['hold','release','swap'].includes(value))return false;
    hideAutoNotice();autoRequested=false;tool=value;if(value==='swap'){if(pair[0]==null)pairTarget=0;else if(pair[1]==null)pairTarget=1;}
    instructions();sync();return true;
  }
  function clearSelection() { if (!active || isBusy()) return false;hideAutoNotice(); autoRequested=false;lastManualStep=0;held.clear();pair=[];pairTarget=0;result=null;anchors=[];referencesDirty=true;instructions();sync();return true; }
  function changedHolds() {
    pair=pair.map(id=>held.has(id)?null:id);trimPair();
    if(pair[0]==null){pair=[];pairTarget=0;}else if(pair[1]==null)pairTarget=1;
    result=null;autoRequested=false;lastManualStep=0;referencesDirty=true;
  }
  function selectNode(id) {
    id=String(id);
    if(!active || isBusy() || !model || !nodes().some(n=>n.stickerId===id))return false;
    if(!idle(api.snapshot())){setMessage('Wait for the puzzle to finish moving.');return false;}
    focusId=id;
    if(tool==='hold' || tool==='release'){
      if(tool==='hold')held.add(id);else held.delete(id);
      changedHolds();instructions();sync();return true;
    }
    if(held.has(id)){setMessage('That node is held. Choose Deselect holds to release it first.');return false;}
    if(candidatePartner()===id){setMessage('That node is already A. Choose another node, or click A below to start a new pair.');return false;}
    if(candidateStatus(id)===2){setMessage('That choice has no legal pair exchange'+(held.size?' with the current holds':'')+(candidatePartner()!=null?' and A':'')+'. Choose an unshaded node'+(held.size?' or release a hold.':'.'));return false;}
    if(pair[pairTarget]===id)return true;
    result=null;autoRequested=false;lastManualStep=0;pair[pairTarget]=id;
    if(pair[0]==null)pairTarget=0;else if(pair[1]==null)pairTarget=1;
    referencesDirty=true;instructions();sync();return true;
  }
  function remember(key, payload) {
    if (!['solved','impossible'].includes(payload.result.status)) return;
    const value = JSON.stringify(payload), bytes = value.length * 2;
    if (bytes > CACHE_LIMIT) return;
    if (cache.has(key)) { cacheBytes -= cache.get(key).length * 2; cache.delete(key); }
    while (cache.size && cacheBytes + bytes > CACHE_LIMIT) { const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).length * 2; cache.delete(oldest); }
    cache.set(key, value); cacheBytes += bytes;
  }
  function startSearch(maxMs) {
    if (!active || phase !== 'selecting' || !hasPair() || !model) return;
    const snapshot = api.snapshot(); if (!idle(snapshot)) return;
    ensureEligibility();if(selectedPairStatus()===2){syncPairUI();syncEligibilityNote();return;}
    let req, before;
    try { req = core.requestFromSnapshot(model, snapshot, {protectedStickerIds: [...held], swapStickerIds: pair}); before = mapping(snapshot); }
    catch (error) { setMessage(error.message); return; }
    captureReferences();phase = 'solving'; result = null; lastManualStep=0; setAutoSpeed(true); setMessage('Finding a legal swap… Held nodes may move during playback, then return.'); sync();
    const id = ++epoch, startKey = tokenKey(before), cacheKey = JSON.stringify({protected:req.protected.slice().sort((a,b)=>a-b),swap:req.swap,occupied:req.occupiedNodes});
    const receive = payload => {
      if (id !== epoch || !active || phase !== 'solving') return;
      terminateWorker();
      try {
        const current = api.snapshot();
        if (!idle(current) || tokenKey(mapping(current)) !== startKey) throw Error('The puzzle changed during search. Select the nodes again.');
        const r = payload.result; if (!r || !['solved','impossible','unknown','invalid'].includes(r.status)) throw Error('The solver returned an invalid response.');
        result = r;
        if (r.status === 'solved') {
          const normalized = core.normalize(model, req);
          if (!Array.isArray(r.moveIndices) || !r.moveIndices.length || r.moveIndices.length > 5000 || !core.verify(model, normalized, r.moveIndices)) throw Error('The returned sequence did not pass verification. No moves were made.');
          if (payload.modelFingerprint && payload.modelFingerprint !== core.modelFingerprint(model)) throw Error('The puzzle model changed. Reload before solving.');
          remember(cacheKey, payload);
          execution = {request: normalized, indices:r.moveIndices.slice(), offset:0, chunkEnd:0, pending:false, expected:{...before.stickerToNode}, original:{...before.stickerToNode}, length:r.moveIndices.length};
          phase = 'executing'; setMessage('Playing ' + execution.length + ' verified moves' + (r.optimal ? ' · shortest sequence.' : ' · shortest length not proved.') + ' Held nodes return at the end.'); sync(); runChunk();
        } else {
          phase = 'selecting'; setAutoSpeed(false);
          if (r.status === 'impossible') { remember(cacheKey, payload); setMessage('This swap is impossible with these held nodes. No moves were made. Release some nodes or choose another pair.'); }
          else if (r.status === 'unknown') setMessage('Unresolved within the compute limit—not proved impossible. No moves were made. Try fewer held nodes or a longer search.');
          else setMessage('This request is unavailable: ' + (r.reason || 'unsupported state') + '. No moves were made.');
          sync();
        }
      } catch (error) { phase = 'selecting'; result = null; execution = null; pair = []; setAutoSpeed(false); setMessage(error.message); sync(); }
    };
    if (cache.has(cacheKey)) { const payload = JSON.parse(cache.get(cacheKey)); Promise.resolve().then(() => receive(payload)); return; }
    try {
      worker = new Worker(new URL('constrained-solver-worker.js', scriptBase));
      worker.onmessage = event => { if (event.data?.id === id && event.data?.type === 'result') receive(event.data); };
      worker.onerror = () => receive({result:{status:'unknown',reason:'worker_unavailable'}});
      workerTimer = setTimeout(() => receive({result:{status:'unknown',reason:'time_limit'}}), maxMs + 1000);
      worker.postMessage({id,modelId:api.puzzle,snapshot,selection:{protectedStickerIds:[...held],swapStickerIds:pair.slice()},options:{maxMs,searchMs:maxMs>3000?1500:450,maxOutputMoves:5000}});
    } catch (_) { receive({result:{status:'unknown',reason:'worker_unavailable'}}); }
  }
  const AUTO_GAP_MS = 500;
  function updateSecured() {
    const locked = autoJob?.locked || new Set();
    held = new Set(Object.entries(model.homeBySticker).filter(([,node]) => locked.has(node)).map(([id]) => id));
  }
  async function autoSolve(maxMs = 15000) {
    try{return await startAutoPlanning(maxMs);}
    catch(error){terminateWorker();autoJob=null;execution=null;result={status:'unknown',reason:error.code||'startup_error'};phase='selecting';setAutoSpeed(false);reportAutoFailure(result.reason,error.message);sync();return false;}
  }
  async function startAutoPlanning(maxMs) {
    if (['executing','auto-gap','loading'].includes(phase) || !idle(api.snapshot())) return false;
    if (phase === 'solving') cancelSearch();
    if(phase==='unavailable')closePanel();
    autoRequested=true;
    showAutoNotice('Loading the puzzle move model…');
    // Mirror difficulty deliberately hides the map. Return to its colored view
    // before opening the existing panel; neither operation changes the state.
    if (api.snapshot().mirrorMode && api.setMirrorMode) { api.setMirrorMode(false); await Promise.resolve(); }
    document.getElementById('ringPanelToggle')?.click();
    if (!active && !await setActive(true)) return false;
    if (!model || phase === 'unavailable') return false;
    const snapshot = api.snapshot(); if (!idle(snapshot)) return false;
    let before;
    try { before = mapping(snapshot); core.solvedProgress(model, snapshot); }
    catch (error) { phase='selecting';reportAutoFailure('state_mapping_error',error.message);sync();return false; }
    held.clear(); pair=[]; autoJob=null; autoRequested=true; result=null; lastAutoStep=0; phase='solving';
    setAutoSpeed(true);
    setMessage('Planning a solution from the current sticker positions… No move journal is needed.');showAutoNotice('Starting the solver…'); sync();
    const id=++epoch, startKey=tokenKey(before);
    const receive = payload => {
      if (id !== epoch || !active || phase !== 'solving') return;
      terminateWorker();
      try {
        const current=api.snapshot();
        if (!idle(current) || tokenKey(mapping(current)) !== startKey) throw Error('The puzzle changed during planning. No automatic moves were made.');
        const r=payload.result;
        if (!r || !['solved','impossible','unknown','invalid'].includes(r.status)) throw Error('The solver returned an invalid response.');
        if (payload.modelFingerprint && payload.modelFingerprint !== core.modelFingerprint(model)) throw Error('The puzzle model changed. Reload before solving.');
        result=r;
        if (r.status !== 'solved') {
          phase='selecting';
          setAutoSpeed(false);
          if (r.status === 'unknown') reportAutoFailure(r.reason||'compute_limit',r.detail);
          else if (r.status === 'impossible') setMessage('This arrangement does not match a reachable state in the solver’s move model. If it followed ordinary game moves, reload the puzzle: this can indicate a browser/model mismatch. No moves were made. ('+(r.reason||'state_outside_legal_moves')+(Number.isInteger(r.failedTargetNode)?'; target node '+r.failedTargetNode:'')+')');
          else setMessage('Auto Solve is unavailable for this state: ' + (r.reason || 'unsupported state') + '. No moves were made.');
          if(r.status!=='unknown')showAutoNotice(message,true);sync(); return;
        }
        if (!core.verifyAutoPlan(model,current,r)) throw Error('The full solution did not pass independent verification. No moves were made.');
        const stages=r.stages.map(s=>({...s,moveIndices:s.moveIndices.slice(),protectedNodes:s.protectedNodes.slice(),newlySolvedNodes:s.newlySolvedNodes.slice()}));
        autoJob={stages,completed:0,locked:new Set(r.initialProtectedNodes || stages[0]?.protectedNodes || []),paused:false,stopAfterStep:false,gapUntil:0,totalMoves:r.moveIndices.length};
        updateSecured(); observed=startKey;
        if (!stages.length) finishAuto(false); else beginAutoStage();
      } catch (error) { autoJob=null; execution=null; phase='selecting'; result=null; pair=[]; setAutoSpeed(false);reportAutoFailure('verification_error',error.message);sync(); }
    };
    const watch=stage=>{if(workerTimer!==null)clearTimeout(workerTimer);const loading=stage==='loading-model'||stage==='loading-cache';workerTimer=setTimeout(()=>receive({result:{status:'unknown',reason:loading?(stage==='loading-cache'?'cache_load_timeout':'model_load_timeout'):'time_limit'}}),loading?24000:maxMs+12000);};
    try {
      worker=new Worker(new URL('constrained-solver-worker.js',scriptBase));
      worker.onmessage=event=>{
        const data=event.data;if(data?.id!==id||id!==epoch||!active||phase!=='solving')return;
        if(data.type==='result'){receive(data);return;}
        const stages={'loading-model':'Loading the puzzle move model…','loading-cache':'Loading the precomputed solution table…',planning:'Planning a solution from the current position…',verifying:'Verifying the solution before making moves…'};
        if(data.type==='progress' && stages[data.stage]){watch(data.stage);setMessage(stages[data.stage]);showAutoNotice(stages[data.stage]);}
      };
      worker.onerror=event=>receive({result:{status:'unknown',reason:'worker_unavailable',detail:event?.message}});
      worker.onmessageerror=()=>receive({result:{status:'unknown',reason:'worker_message_error'}});
      watch('loading-model');
      // History is intentionally excluded from the planning request.
      worker.postMessage({task:'full-solve',id,modelId:api.puzzle,snapshot:{...snapshot,history:[]},options:{maxMs,maxOutputMoves:20000}});
      return true;
    } catch (error) { receive({result:{status:'unknown',reason:'worker_unavailable',detail:error.message}}); return false; }
  }
  function beginAutoStage() {
    if (!autoJob) return;
    const snapshot=api.snapshot();
    if (!idle(snapshot) || tokenKey(mapping(snapshot)) !== observed) { interrupted('The puzzle changed between constrained steps. No further automatic moves were made.'); return; }
    if (autoJob.stopAfterStep) { finishAuto(true); return; }
    if (autoJob.completed >= autoJob.stages.length) { finishAuto(false); return; }
    hideAutoNotice();
    const stage=autoJob.stages[autoJob.completed], current=mapping(snapshot);
    for (const node of stage.protectedNodes) autoJob.locked.add(node);
    updateSecured();
    pair=[current.nodeToSticker[stage.sourceNode],current.nodeToSticker[stage.targetNode]].filter(id=>id!==undefined).map(String);
    captureReferences();
    execution={kind:'auto',stage,indices:stage.moveIndices,offset:0,chunkEnd:0,pending:false,expected:{...current.stickerToNode},original:{...current.stickerToNode},length:stage.moveIndices.length};
    phase='executing';
    setMessage('Constrained step ' + (autoJob.completed+1) + ' of ' + autoJob.stages.length + ' · ' + stage.moveIndices.length + ' moves. Dashed white nodes return at the end of this step.'); sync(); runChunk();
  }
  function finishAuto(stopped) {
    const job=autoJob; if (!job) return;
    const progress=core.solvedProgress(model,api.snapshot());
    if (!stopped && progress.solvedCount !== progress.totalCount) { interrupted('Final solved-state verification failed. No further moves were made.'); return; }
    if (!stopped) held=new Set(progress.solvedStickerIds);
    const count=job.completed, moves=job.totalMoves;
    lastAutoStep=job.stages[count-1]?.moveIndices.length||0;
    autoJob=null; execution=null; pair=[]; phase='selecting'; observed=tokenKey(mapping(api.snapshot()));
    setAutoSpeed(false);
    setMessage(stopped ? 'Exited after ' + count + ' constrained steps. All ' + held.size + ' secured nodes are restored.' : 'Puzzle solved · ' + count + ' constrained steps · ' + moves + ' moves. All nodes are restored; shortest length is not claimed.');
    closePanel();
  }
  function stopAuto() {
    if(autoRequested && (phase==='solving'||phase==='loading')){cancelSearch();return;}
    if (!autoJob) return;
    autoJob.stopAfterStep=true;
    if (phase==='auto-gap') finishAuto(true);
    else { autoJob.paused=false;api.resumePlayback?.();setMessage('Stopping after this constrained step, once the secured nodes are restored.'); sync(); }
  }
  function interrupted(text) { execution = null; autoJob=null; held.clear(); phase = 'selecting'; pair = []; anchors=[];referencesDirty=true; result = null; observed = null; setAutoSpeed(false); setMessage(text); if(returnToDefault){closePanel();return;}sync(); }
  function runChunk() {
    const job = execution; if (!job || phase !== 'executing') return;
    try {
      const current = api.snapshot(); if (!idle(current)) return;
      if (!sameMap(mapping(current).stickerToNode, job.expected)) { interrupted('Playback was interrupted. The requested restoration is not confirmed.'); return; }
      if (job.offset >= job.length) {
        const end = mapping(current).stickerToNode;
        if (job.kind === 'auto') {
          const restored=new Set([...job.stage.protectedNodes,...job.stage.newlySolvedNodes]);
          if (Object.entries(model.homeBySticker).some(([id,node])=>restored.has(node) && end[id]!==node)) throw Error('Constrained step restoration check failed.');
          for (const node of restored) autoJob.locked.add(node);
          autoJob.completed++; updateSecured(); observed=tokenKey(mapping(current));
          execution=null; pair=[]; phase='auto-gap'; autoJob.gapUntil=performance.now()+AUTO_GAP_MS;
          setMessage('Step ' + autoJob.completed + ' complete · ' + held.size + ' nodes solved and secured.'); sync();
          if (autoJob.stopAfterStep) finishAuto(true);
          return;
        }
        const requestOK = Object.entries(job.original).every(([id,from]) => job.request.protected.includes(from) ? end[id] === from : from === job.request.swap[0] ? end[id] === job.request.swap[1] : from === job.request.swap[1] ? end[id] === job.request.swap[0] : true);
        if (!requestOK) throw Error('Final restoration check failed.');
        observed = tokenKey(mapping(current)); const length = job.length;
        const optimal=!!result?.optimal;
        lastManualStep = length; execution = null; phase = 'selecting'; pair=[];pairTarget=0;result=null;tool='swap';anchors=anchors.filter(a=>held.has(a.id));referencesDirty=true;setAutoSpeed(false);
        if(returnToDefault){closePanel();return;}
        setMessage('Swap complete · ' + length + ' moves' + (optimal ? ' · proved shortest' : '') + '. All ' + held.size + ' held nodes are restored. Choose a new A and B.'); sync(); return;
      }
      const indices = job.indices.slice(job.offset, job.offset + 300);
      const predicted = {...job.expected};
      for (const i of indices) for (const id of Object.keys(predicted)) predicted[id] = model.moves[i].perm[predicted[id]];
      if (!api.runMoves(indices.map(i => model.moves[i].engineMove), {label:job.kind==='auto' ? 'Auto Solve · constrained step ' + (autoJob.completed+1) : 'Constrained swap'})) { interrupted('The puzzle could not start playback. No further moves were made.'); return; }
      job.expected = predicted; job.chunkEnd = job.offset + indices.length; job.pending = true;
    } catch (error) { interrupted('Playback stopped: ' + error.message + ' Held-node restoration is not confirmed.'); }
  }
  function hitAt(event) {
    const b = overlay.getBoundingClientRect(), x = event.clientX - b.left, y = event.clientY - b.top;
    return nodes().map(n => ({...n,distance:Math.hypot(n.x-x,n.y-y)})).filter(n => n.distance <= Math.max(12,(n.r || 5)+5)).sort((a,b) => a.distance-b.distance)[0] || null;
  }
  const localPoint = event => { const b=overlay.getBoundingClientRect(); return {x:event.clientX-b.left,y:event.clientY-b.top}; };
  function enclosed(point, polygon) {
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i],b=polygon[j];
      if((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
    }
    return inside;
  }
  overlay.addEventListener('pointerdown', event => {
    if (event.button > 0 || !active || isBusy() || !idle(api.snapshot())) return;
    event.preventDefault(); event.stopPropagation(); overlay.focus({preventScroll:true});
    pointerStart={x:event.clientX,y:event.clientY,id:hitAt(event)?.stickerId,pointer:event.pointerId,dragged:false,remove:tool==='release'||!!event.altKey};
    lasso=tool==='hold'||tool==='release'?[localPoint(event)]:null;
    overlay.setPointerCapture?.(event.pointerId);
  });
  overlay.addEventListener('pointerup', event => {
    const start=pointerStart, polygon=lasso; pointerStart=null; lasso=null; lastDraw='';
    if (!start || start.pointer!==event.pointerId) return;
    overlay.releasePointerCapture?.(event.pointerId);
    if (start.dragged && (tool==='hold'||tool==='release') && polygon?.length>=3 && active && !isBusy() && idle(api.snapshot())) {
      let count=0; const ids=nodes().filter(n=>enclosed(n,polygon)).map(n=>n.stickerId);
      for (const id of ids) { if(start.remove ? held.delete(id) : !held.has(id)) { if(!start.remove)held.add(id);count++; } }
      changedHolds();
      setMessage(count ? count+' nodes '+(start.remove?'released':'held')+'. Choose A and B below when ready.' : 'No nodes changed. Enclose node centers to select them.'); sync();
    } else if (!start.dragged && start.id!==undefined) selectNode(start.id);
  });
  overlay.addEventListener('pointercancel', () => { pointerStart=null; lasso=null; lastDraw=''; });
  overlay.addEventListener('pointermove', event => {
    if (pointerStart?.pointer===event.pointerId) {
      if(Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>=9)pointerStart.dragged=true;
      if(lasso){const p=localPoint(event),last=lasso[lasso.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>=3){lasso.push(p);lastDraw='';}}
    }
    const id=hitAt(event)?.stickerId??null; if(hover!==id){hover=id;lastDraw='';}
  });
  overlay.addEventListener('pointerleave', () => { hover = null; lastDraw = ''; });
  overlay.addEventListener('focus', () => { if (!focusId) focusId = nodes()[0]?.stickerId ?? null; lastDraw = ''; });
  overlay.addEventListener('blur', () => { lastDraw = ''; });
  function navigate(key) {
    const list = nodes(); if (!list.length) return;
    const current = list.find(n => n.stickerId === focusId) || list[0];
    const direction = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];
    const next = list.filter(n => n.stickerId !== current.stickerId).map(n => { const dx=n.x-current.x,dy=n.y-current.y,along=dx*direction[0]+dy*direction[1],across=Math.abs(dx*direction[1]-dy*direction[0]);return {n,along,score:Math.hypot(dx,dy)+across*2}; }).filter(x => x.along > 1).sort((a,b) => a.score-b.score)[0]?.n;
    focusId = (next || current).stickerId; overlay.setAttribute('aria-label', nodeName(focusId) + (held.has(focusId) ? ', held. ' : '. ') + 'Enter to ' + (tool === 'hold' ? 'hold this node.' : tool==='release'?'release this node.':'choose for swap.')); lastDraw = '';
  }
  // Capture only puzzle shortcuts while active. Camera controls and normal form
  // navigation keep their original behavior; inactive mode is a strict no-op.
  document.addEventListener('keydown', event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target === overlay) {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); if (!isBusy()) { if (event.key === 'Enter' || event.key === ' ') { if (focusId !== null) selectNode(focusId); } else navigate(event.key); } return; }
    }
    if (event.key === 'Escape' && (phase === 'solving'||(autoRequested&&phase==='loading'))) { event.preventDefault(); event.stopImmediatePropagation(); cancelSearch(); return; }
    if (event.target?.matches?.('input,textarea,select')) return;
    if (event.target?.id === 'cube' && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key)) return;
    if (/^[A-Za-z]$/.test(event.key) || event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', event => {
    if (!active) return;
    const target = event.target.closest?.('button');
    if (target && (['cw','ccw'].includes(target.id) || target.classList.contains('ring-key'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (['loading','solving','executing','auto-gap'].includes(phase) && target && (['randomize','solve','reset','undo','mirrorMode','advanced','advancedMode','jumbleMode'].includes(target.id) || target.classList.contains('notation-key') || target.closest('#jumbleControls'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (['randomize','reset'].includes(target?.id) && !target.disabled) closePanel();
  }, true);
  toggle.addEventListener('click', () => setActive(true));
  normalMode.addEventListener('click',()=>{if(!active)return;if(autoStopActive()){stopAuto();return;}if(phase==='executing'){returnToDefault=true;api.resumePlayback?.();setMessage('Returning to Turn rings after this swap restores the held nodes.');sync();return;}closePanel();}); hold.addEventListener('click', () => setTool('hold')); release.addEventListener('click',()=>setTool('release'));swap.addEventListener('click', () => setTool('swap'));
  clear.addEventListener('click', clearSelection); cancel.addEventListener('click', cancelSearch); retry.addEventListener('click', () => autoRequested ? autoSolve(30000) : startSearch(10000));
  go.addEventListener('click',()=>startSearch(3000));
  autoNoticeRetry.addEventListener('click',()=>autoSolve(30000));autoNoticeDismiss.addEventListener('click',hideAutoNotice);
  aChip.addEventListener('click',()=>editPair(0));
  bChip.addEventListener('click',()=>editPair(1));
  function draw() {
    const b = rings.getBoundingClientRect(), list = nodes(), dpr = Math.min(window.devicePixelRatio || 1,2);
    const viewport=bridge.viewport?.();
    const blockedHover=tool==='swap' && hover!==null && candidateStatus(hover)===2;
    overlay.style.cursor=isBusy()?'progress':blockedHover?'not-allowed':tool==='swap'?'pointer':'crosshair';
    overlay.title=blockedHover?'Unavailable with the current holds and other endpoint':tool==='swap'?'Choose '+(pairTarget?'B':'A')+' · click its card below to change the target':'Click or lasso to '+(tool==='release'?'release':'hold')+' nodes';
    const key = JSON.stringify([b.width,b.height,viewport,anchors,phase,tool,[...held],pair,pairTarget,hover,focusId,lasso,eligibility?.status,document.activeElement === overlay,list.map(n=>[n.stickerId,n.x,n.y,n.r,n.highlightLineWidth,n.highlightOuterRadius,n.highlighted])]); if (key === lastDraw) return; lastDraw = key;
    overlay.width = Math.max(1,Math.round(b.width*dpr)); overlay.height = Math.max(1,Math.round(b.height*dpr)); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,b.width,b.height);
    backdrop.width=overlay.width;backdrop.height=overlay.height;backCtx.setTransform(dpr,0,0,dpr,0,0);backCtx.clearRect(0,0,b.width,b.height);
    if(viewport?.scale>0)for(const a of anchors){
      const x=viewport.x+a.x*viewport.scale,y=viewport.y+a.y*viewport.scale,r=Math.max(4,a.r*viewport.scale)+7;
      backCtx.beginPath();backCtx.arc(x,y,r,0,Math.PI*2);backCtx.fillStyle='rgba(145,145,157,.18)';backCtx.fill();
      if(a.label){backCtx.font='700 12px system-ui';backCtx.textAlign='center';backCtx.textBaseline='middle';backCtx.fillStyle='#73737e';backCtx.fillText(a.label,x+Math.min(r+6,18),y-r-3);}
    }
    for (const n of list) {
      const fixed = held.has(n.stickerId), index = pair.indexOf(n.stickerId), hot = hover === n.stickerId, focused = document.activeElement === overlay && focusId === n.stickerId;
      if(eligibilityCode(n.stickerId)===2){ctx.beginPath();ctx.arc(n.x,n.y,Math.max(3,n.r||5)+1,0,Math.PI*2);ctx.fillStyle='rgba(20,21,29,.78)';ctx.fill();}
      if (!fixed && index < 0 && !hot && !focused) continue;
      const nodeRadius = Math.max(3,n.r || 5), nativeWidth = Number.isFinite(n.highlightLineWidth) && n.highlightLineWidth > 0 ? n.highlightLineWidth : 2.2;
      const nativeOuter = Number.isFinite(n.highlightOuterRadius) ? Math.max(nodeRadius,n.highlightOuterRadius) : nodeRadius;
      const radius = nodeRadius + 3;
      if (fixed) {
        // The native canvas owns the selected-axis solid outline. A held node
        // adds only this outer dashed ring, with the same native stroke weight.
        const outerRadius = nativeOuter + nativeWidth + 2;
        ctx.setLineDash([nativeWidth * 2, nativeWidth * 1.25]);
        ctx.beginPath(); ctx.arc(n.x,n.y,outerRadius,0,Math.PI*2);
        ctx.lineWidth=nativeWidth; ctx.strokeStyle='#ffffff'; ctx.stroke(); ctx.setLineDash([]);
      } else if (index >= 0 || hot || focused) {
        ctx.beginPath(); ctx.arc(n.x,n.y,radius,0,Math.PI*2); ctx.lineWidth=index>=0?4.8:1.3; ctx.strokeStyle=index>=0?'#ffffff':'#f4f1fc'; ctx.stroke();
      }
      if (index >= 0) { const x = Math.max(8,Math.min(b.width-8,n.x+radius+6)),y=Math.max(9,n.y-radius-4);ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();ctx.font='700 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#171820';ctx.fillText(index?'B':'A',x,y+.4); }
      // The solid hover/focus outline above keeps keyboard focus distinct from
      // the dashed held-node symbol; an unheld node never gets a dashed circle.
    }
    if(lasso?.length>1 && pointerStart?.dragged){ctx.beginPath();lasso.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);}
  }
  function frame() {
    if (active) {
      try {
        const snap = api.snapshot();
        updateStepProgress(snap);
        if (phase === 'executing' && autoJob) { const paused=!!snap.paused;if(autoJob.paused!==paused){autoJob.paused=paused;sync();} }
        if (phase === 'executing' && execution?.pending && idle(snap)) { execution.offset = execution.chunkEnd; execution.pending = false; runChunk(); }
        else if (phase === 'auto-gap' && autoJob && !autoJob.paused && performance.now() >= autoJob.gapUntil) beginAutoStage();
        else if (phase === 'selecting' && model && idle(snap)) {
          const now = tokenKey(mapping(snap));
          if (observed !== null && observed !== now) { held.clear(); pair=[]; result=null; autoRequested=false; lastManualStep=0;anchors=[];referencesDirty=true; setMessage('The puzzle changed. Selections were cleared; choose the nodes for this state.'); sync(); }
          observed = now;
        }
        if(referencesDirty && idle(snap) && phase==='selecting')captureReferences();
        draw();
      } catch (error) { if (phase === 'executing' || phase === 'auto-gap') interrupted('Playback could not be verified: ' + error.message); else if (phase !== 'loading') { terminateWorker();epoch++;phase='unavailable';setMessage(error.message);sync(); } }
    }
    requestAnimationFrame(frame);
  }
  window.ConstrainedSolverUI = Object.freeze({setActive,closePanel,selectNode,setTool,clearSelection,autoSolve,startAutoSolve:autoSolve,go:()=>startSearch(3000),stopAuto,autoStopActive,syncTransport,cancel:cancelSearch,state:()=>({active,tool,phase,pairTarget,held:[...held],pair:pair.slice(),anchors:anchors.map(a=>({...a})),status:message,eligibility:{status:eligibility?.status||'idle',dimmed:nodes().filter(n=>eligibilityCode(n.stickerId)===2).map(n=>n.stickerId)},result:result?{status:result.status,optimal:!!result.optimal}:null,executed:execution?.offset || 0,total:execution?.length || 0,auto:autoJob?{active:true,stage:autoJob.completed,completed:autoJob.completed,totalStages:autoJob.stages.length,lockedNodes:[...autoJob.locked],paused:autoJob.paused,gapUntil:autoJob.gapUntil}:null})});
  sync(); requestAnimationFrame(frame);
})();
