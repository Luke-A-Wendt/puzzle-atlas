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
  const actionRow = make('div', '', 'cs-action-row');
  const toolbar = make('div', '', 'cs-toolbar');
  const tools = make('div', '', 'cs-tools cs-hold-group'); tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Hold controls');
  const holdTitle=make('span','','cs-hold-title','Hold');
  const hold = button('csHold', ''), swap = button('csSwap', 'Swap'); tools.append(holdTitle);
  hold.title='Select holds manually: click a tile or lasso nodes to toggle holds. Turns Auto hold off.';
  const clear = button('csClear', 'Clear', 'small outline'), cancel = button('csCancel', 'Cancel search', 'small outline');
  clear.title='Clear every hold and both swap selections';
  const retry = button('csRetry', 'Continue · +7s', 'small outline'); cancel.hidden = true; retry.hidden = true;
  toolbar.append(tools);
  const selection = make('div', '', 'cs-selection');
  const heldCount = make('span', 'csHeldCount', 'cs-held-count', '0');
  const holdCaption=make('span','','cs-hold-caption','Select');hold.append(holdCaption);heldCount.setAttribute('aria-label','Held nodes');tools.append(heldCount,clear,hold);
  const aChip = button('csPairA', '1 · choose a node', 'cs-pair-chip'), bChip = button('csPairB', '2 · choose a node', 'cs-pair-chip');
  [aChip,bChip].forEach((chip,i)=>{chip.textContent='';chip.append(make('span','','cs-slot-label',i?'2':'1'));});
  const pairArrow = make('span', '', 'cs-swap-arrow', '↔');pairArrow.hidden=true;selection.setAttribute('role','group');selection.setAttribute('aria-label','Swap selections');selection.append(swap,aChip,pairArrow,bChip);
  const suggestHolds=button('csSuggestHolds','Auto','small outline');suggestHolds.title='Auto hold: keeps holds and the next white-ringed choices updated after every guided step';suggestHolds.setAttribute('aria-pressed','false');
  const guide=make('a','csGuide','small outline cs-guide','Guide');guide.href=new URL('../solver-handbook.html#using-constrained-solver',scriptBase).href;guide.target='_blank';guide.rel='noopener';guide.title='Open Using the Constrained Solver in the solving handbook (new tab)';guide.setAttribute('aria-label','Constrained Solver guide (opens in a new tab)');
  const showGoal=button('csShowGoal','Show goal','small outline cs-show-goal');showGoal.title='Press and hold to see the solved colors at these node locations; release to return to the current colors';showGoal.setAttribute('aria-pressed','false');
  const searchActions=make('div','','cs-search-actions');searchActions.append(cancel,retry);tools.append(suggestHolds);head.insertBefore(showGoal,document.getElementById('ringPanelHide'));
  const searchProgress=make('div','csSearchProgress','cs-search-progress');searchProgress.hidden=true;
  const searchProgressLabel=make('span','csSearchProgressLabel');
  const searchActivity=make('progress','csSearchActivity');searchActivity.setAttribute('aria-label','Searching for a verified swap; completion percentage is unknown');
  searchProgress.append(searchProgressLabel,searchActivity);
  const autoProgress = make('div', 'csAutoProgress', 'cs-auto-progress'); autoProgress.hidden = true;
  const progressLabel = make('span', 'csAutoProgressLabel', '', 'Preparing a solution');
  const progressBar = make('progress', 'csAutoProgressBar'); progressBar.setAttribute('aria-label', 'Nodes solved and secured by completed solving steps'); autoProgress.append(progressLabel, progressBar);
  const stepLabel = make('span', 'csStepProgressLabel', '', 'Current step');
  const stepBar = make('progress', 'csStepProgressBar'); stepBar.setAttribute('aria-label', 'Moves completed in the current constrained step'); autoProgress.append(stepLabel, stepBar);
  const status = make('p', 'csStatus', 'cs-status', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const autoNotice=make('div','csAutoNotice','cs-auto-notice');autoNotice.hidden=true;
  const autoNoticeText=make('span','csAutoNoticeText');autoNoticeText.setAttribute('role','status');autoNoticeText.setAttribute('aria-live','polite');
  const autoNoticeProgress=make('progress','csAutoNoticeProgress');autoNoticeProgress.setAttribute('aria-label','Auto Solve preparation');
  const autoNoticeReload=button('csAutoNoticeReload','Reload puzzle','small outline');
  const autoNoticeRetry=button('csAutoNoticeRetry','Retry','small outline'),autoNoticeDismiss=button('csAutoNoticeDismiss','Dismiss','small outline');
  autoNotice.append(autoNoticeText,autoNoticeProgress,autoNoticeRetry,autoNoticeReload,autoNoticeDismiss);document.querySelector('.action-panel')?.appendChild(autoNotice);
  const eligibilityNote = make('p', 'csEligibilityNote', 'cs-eligibility', ''); eligibilityNote.hidden=true;
  const bottom = make('div', '', 'cs-bottom');
  const keyboardNote = make('span', '', 'cs-keyboard', 'White ring: goal step · Bright: ready · Gray: unavailable');
  bottom.append(keyboardNote);
  // One persistent feedback area prevents the canvas moving when a check turns
  // into playback. Search and playback use the same slot; idle keeps it blank.
  const feedback=make('div','','cs-feedback'),progressSlot=make('div','','cs-progress-slot'),detailSlot=make('div','','cs-detail-slot');
  const completion=make('div','csCompletion','cs-completion'),completionValue=make('strong','csCompletionValue','','0%'),completionCaption=make('span','','cs-completion-caption','complete');
  completion.append(completionValue,completionCaption);completion.hidden=true;wrap.appendChild(completion);
  progressSlot.append(searchProgress,autoProgress);detailSlot.append(eligibilityNote,status);
  feedback.append(progressSlot,searchActions,detailSlot);
  actionRow.append(toolbar,selection,guide);controls.append(actionRow, feedback, bottom); panel.appendChild(controls);
  const overlay = make('canvas', 'csNodeOverlay', 'cs-node-overlay'); overlay.hidden = true; overlay.tabIndex = 0;
  overlay.setAttribute('aria-label', 'Select ring-map nodes. Arrow keys choose a node; Enter selects it.');
  overlay.setAttribute('aria-describedby', 'csStatus'); wrap.appendChild(overlay);
  const ctx = overlay.getContext('2d');
  const backdrop = make('canvas', 'csAnchorBackdrop', 'cs-anchor-backdrop'); backdrop.hidden=true; backdrop.setAttribute('aria-hidden','true'); wrap.insertBefore(backdrop,rings);
  const backCtx = backdrop.getContext('2d');
  let active = false, tool = 'hold', phase = 'off', model = null, held = new Set(), pair = [], result = null;
  let message = '', worker = null, workerTimer = null, epoch = 0, execution = null, observed = null, hover = null, focusId = null, lastDraw = '', pointerStart = null;
  let autoJob = null, autoRequested = false, solverSpeed = false, lasso = null, lastAutoStep = 0, lastManualStep = 0;
  let autoTransportActive = false, manualMoveBlockActive = false;
  let goalPreview=false, goalColors=null, goalPointer=null, goalKey=null, goalRequested=false, goalLoad=null, goalNeedsPalette=false, goalPalette=null;
  let exitToManual=false;
  let eligibility=null, eligibilityWorker=null, eligibilityTimer=null, eligibilityEpoch=0;
  let anchors=[], referencesDirty=true, pairTarget=0, returnToDefault=false, lastEligibilityProof=null;
  const eligibilityCache=new Map(); let eligibilityBytes=0;
  // Readiness is stronger than mathematical reachability: it always carries a
  // bounded, executable word. A proved orbit relation alone is not a sequence.
  let lastSwapWitness=null,manualSearch=null;const rejectedReadiness=new WeakSet();
  let autoHoldsPending=false,autoHold=false,manualHoldSelected=true,guidedSession=null,guidedChoiceMemo=null,guidedHintMemo=null,goalHintsMemo=null;
  let completionMirror=null;
  const goalFields=new WeakMap(),emptyHints=new Set();
  const cache = new Map(); let cacheBytes = 0; const CACHE_LIMIT = 1024 * 1024;
  const isBusy = () => ['loading', 'unavailable', 'solving', 'executing', 'auto-gap'].includes(phase);
  const idle = s => !s.animating && (!s.mode || s.mode === 'idle');
  const mirrorActive = () => document.body.classList.contains('mirror-active');
  const tokenKey = m => JSON.stringify(Object.entries(m.stickerToNode).sort((a,b) => a[0].localeCompare(b[0])));
  const mapping = s => core.mapSnapshot(model, s);
  const sameMap = (a,b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => a[k] === b[k]);
  const nodes = () => (bridge.nodes() || []).filter(n => Number.isFinite(n.x) && Number.isFinite(n.y)).map(n => ({...n, stickerId: String(n.stickerId)}));
  const nodeName = id => { const s = api.snapshot().stickers?.find(x => String(x.id) === String(id)); return (s?.face ? s.face + ' · ' : '') + String(id); };
  const setMessage = (text,kind='notice') => { message=text;status.textContent=text;status.title=text;status.hidden=!text||kind==='help';status.setAttribute('data-state',kind); };
  // The UI is installed synchronously after a fresh engine is created. Keep
  // only its immutable solved color field, not the move tables or solver data.
  // Use the same 1e-7 geometric addresses as the solver adapter; array order
  // and sticker identity are not spatial locations. A late installation into
  // an already played state falls back to the verified model instead.
  const goalPoint=value=>{if(!Array.isArray(value)||value.length!==3||value.some(x=>!Number.isFinite(x)))throw Error('Invalid tile pose');return value.map(x=>Math.round(x*1e7)||0).join(',');};
  const goalAddress=sticker=>sticker.normal||sticker.n?'pose:'+(sticker.pos?goalPoint(sticker.pos):'')+'/'+goalPoint(sticker.center||sticker.p)+'/'+goalPoint(sticker.normal||sticker.n):sticker.slot!==undefined?'slot:'+String(sticker.slot):null;
  const localGoal=(()=>{
    try{
      const snapshot=api.snapshot(),stickers=snapshot.stickers||snapshot.stickerState;
      if(!idle(snapshot)||snapshot.solved===false||snapshot.history?.length||snapshot.journal?.some(entry=>entry.move)||snapshot.userTurns>0||!stickers?.length)return null;
      const homes=new Map(),colors=new Map();
      for(const sticker of stickers){const address=goalAddress(sticker);if(address===null||homes.has(address))return null;homes.set(address,String(sticker.id));colors.set(String(sticker.id),String(sticker.color));}
      return {homes,colors};
    }catch(_){return null;}
  })();
  function captureGoalPalette(){
    if(!localGoal||goalPalette||mirrorActive())return;
    const display=new Map(nodes().map(n=>[n.stickerId,n.color]));
    if(display.size===localGoal.colors.size&&new Set(display.values()).size>=new Set(localGoal.colors.values()).size&&[...localGoal.colors.keys()].every(id=>typeof display.get(id)==='string'))goalPalette=display;
  }
  function localGoalTargets(){
    captureGoalPalette();
    const snapshot=api.snapshot(),stickers=snapshot.stickers||snapshot.stickerState,targets=new Map();
    goalNeedsPalette=!goalPalette;
    for(const sticker of stickers){const home=localGoal.homes.get(goalAddress(sticker));targets.set(String(sticker.id),home===undefined?null:goalPalette?.get(home)||localGoal.colors.get(home));}
    return targets;
  }
  function syncGoalAvailability(){
    const hidden=mirrorActive(),disabled=hidden||isBusy()||!!autoRequested||(bridge.isBusy?bridge.isBusy():!idle(api.snapshot()));
    // Reassigning reflected DOM attributes on every animation frame still
    // fires MutationObservers, even when the value has not changed.
    if(showGoal.hidden!==hidden)showGoal.hidden=hidden;
    if(showGoal.disabled!==disabled)showGoal.disabled=disabled;
  }
  // The canonical goal is a spatial color field, not a sticker-identity goal.
  // Some shape-changing models include poses that are empty in the solved
  // geometry. Those addresses have no goal color and must not invent one.
  function goalState() {
    const snapshot=api.snapshot(), map=mapping(snapshot), colors=core.colorsFromSnapshot(model,snapshot,map), homes=new Map(), palette=new Map();
    for(const [id,node] of Object.entries(model.homeBySticker||{})){const color=model.colorBySticker?.[id];if(color!==undefined&&color!==null)homes.set(node,String(color));}
    for(const n of nodes()){const color=colors[map.stickerToNode[n.stickerId]];if(color!=null&&typeof n.color==='string')palette.set(String(color),n.color);}
    const targets=new Map(), matching=[];let empty=0;
    for(const [id,node] of Object.entries(map.stickerToNode)){
      const color=homes.get(node);
      if(color===undefined){targets.set(id,null);empty++;continue;}
      targets.set(id,palette.get(color)||color);
      if(colors[node]===color)matching.push(id);
    }
    return {targets,matching,empty};
  }
  function setGoalPreview(value) {
    value=!!value;goalRequested=value;window.PuzzleJournal?.sync?.();
    if(!value){goalColors=null;goalPointer=null;goalKey=null;goalNeedsPalette=false;}
    if(value){
      if(mirrorActive()||autoRequested||isBusy()||!idle(api.snapshot())){goalRequested=false;return false;}
      if(!localGoal&&!model){
        if(!goalLoad)goalLoad=core.loadModel(api.puzzle).then(loaded=>{model=loaded;goalLoad=null;if(goalRequested)setGoalPreview(true);}).catch(error=>{goalLoad=null;goalRequested=false;showGoal.title='Goal could not load: '+error.message+'. Press again to retry.';});
        return true;
      }
      try{goalColors=localGoal?localGoalTargets():goalState().targets;}catch(_){goalRequested=false;return false;}
      pointerStart=null;lasso=null;hover=null;window.PuzzleSelection3D?.clearHover?.();
    }
    goalPreview=value;showGoal.setAttribute('aria-pressed',String(value));
    window.PuzzleJournal?.sync?.();panel.classList.toggle('cs-goal-preview',value);overlay.hidden=!active&&!value;overlay.style.pointerEvents=active?'':'none';lastDraw='';bridge.requestRender();return true;
  }
  function dropGuidance() { autoHold=false;manualHoldSelected=true;guidedSession=null;guidedChoiceMemo=null;guidedHintMemo=null;goalHintsMemo=null;lastDraw=''; }
  function guidedStage() { return guidedSession?.plan.stages[guidedSession.completed]||null; }
  function guidedChoices() {
    const stage=guidedStage();if(!stage)return [];
    const map=guidedSession.map;
    if(guidedChoiceMemo?.stage===stage&&guidedChoiceMemo.map===map)return guidedChoiceMemo.choices;
    const choices=stage.choices.map(choice=>({...choice,firstStickerId:String(map.nodeToSticker[choice.firstNode]),secondStickerId:String(map.nodeToSticker[choice.secondNode])}));
    guidedChoiceMemo={stage,map,choices};return choices;
  }
  function syncGuidedHolds(snapshot=api.snapshot()) {
    if(!guidedSession)return;
    guidedSession.map=mapping(snapshot);guidedSession.key=tokenKey(guidedSession.map);
    held=new Set([...guidedSession.locked].map(node=>guidedSession.map.nodeToSticker[node]).filter(id=>id!==undefined).map(String));
    referencesDirty=true;
  }
  function suggestCurrentHolds() {
    // The public action is idempotent; only the visible Auto toggle turns an
    // enabled mode off. Selecting another pair never changes this policy.
    if(autoHold&&autoHoldsPending)return true;
    if(!canSelect3D()||!model)return false;
    const snapshot=api.snapshot();let before;
    try{before=mapping(snapshot);}catch(error){setMessage('Could not read the puzzle: '+error.message);return false;}
    if(guidedSession&&guidedSession.key===tokenKey(before)){
      autoHold=true;pair=[];pairTarget=0;tool='swap';syncGuidedHolds(snapshot);
      setMessage(guidedStage()?'Choose the white rings for the next guided step.':'Goal reached. All nodes secured.');sync();return true;
    }
    dropGuidance();discardManualSearch();terminateWorker();hideAutoNotice();stopEligibility();eligibility=null;autoHold=true;
    pair=[];pairTarget=0;tool='swap';result=null;autoRequested=false;lastManualStep=0;anchors=[];pointerStart=null;lasso=null;referencesDirty=true;
    const progress=core.solvedProgress(model,snapshot);
    if(progress.solvedCount===progress.totalCount){
      const plan=core.makeAutoHoldsPlan(model,snapshot,{status:'solved',goalSemantics:progress.exact?'identity':'colors',stages:[],moveIndices:[],initialProtectedNodes:progress.solvedNodes,finalProtectedNodes:progress.solvedNodes});
      if(core.verifyAutoHoldsPlan(model,snapshot,plan)){guidedSession={plan,completed:0,locked:new Set(plan.initialProtectedNodes),map:before,key:tokenKey(before)};syncGuidedHolds(snapshot);setMessage('Goal reached. All nodes secured.');sync();return true;}
    }
    const startKey=tokenKey(before),id=++epoch;autoHoldsPending=true;phase='solving';setMessage('Planning guided steps…');sync();
    const receive=payload=>{
      if(id!==epoch||!active||phase!=='solving'||!autoHoldsPending)return;
      terminateWorker();
      try{
        const current=api.snapshot(),map=mapping(current);
        if(!idle(current)||tokenKey(map)!==startKey)throw Error('Puzzle changed. Choose Auto again.');
        if(payload.modelFingerprint&&payload.modelFingerprint!==core.modelFingerprint(model))throw Error('Puzzle data changed. Reload before choosing Auto.');
        const plan=payload.result;
        if(plan?.status!=='solved')throw Error('No verified route ready. Try Auto again.');
        if(!core.verifyAutoHoldsPlan?.(model,current,plan))throw Error('Guided steps did not pass verification. No moves were made.');
        guidedSession={plan,completed:0,locked:new Set(plan.initialProtectedNodes),map,key:startKey};
        syncGuidedHolds(current);lastEligibilityProof=null;lastSwapWitness=null;
        setMessage(guidedStage()?'Guided steps ready. Choose a white-ringed node.':'Goal reached. All nodes secured.');
      }catch(error){dropGuidance();setMessage(error.message);}
      phase='selecting';try{observed=tokenKey(mapping(api.snapshot()));}catch(_){observed=null;}referencesDirty=true;sync();
    };
    const watch=stage=>{clearWorkerTimer();workerTimer=setTimeout(()=>receive({result:{status:'unknown'}}),stage==='planning'?18000:24000);};
    try{
      worker=new Worker(core.workerURL||new URL('constrained-solver-worker.js',scriptBase));
      worker.onmessage=e=>{const data=e.data;if(data?.id!==id||id!==epoch||!autoHoldsPending)return;if(data.type==='result')receive(data);else if(data.type==='progress'){watch(data.stage);setMessage(data.stage==='verifying'?'Verifying guided steps…':'Planning guided steps…');}};
      worker.onerror=()=>receive({result:{status:'invalid'}});worker.onmessageerror=()=>receive({result:{status:'invalid'}});watch('loading-model');
      worker.postMessage({task:'auto-holds-plan',id,modelId:api.puzzle,expectedRelease:core.assetRelease,snapshot:{...snapshot,history:[]},options:{maxMs:15000,maxOutputMoves:20000}});
    }catch(_){receive({result:{status:'invalid'}});}
    return true;
  }
  function chooseManualHolds(selecting=true) {
    if(!active||goalPreview||autoRequested||(!autoHoldsPending&&isBusy()))return false;
    if(autoHoldsPending){epoch++;terminateWorker();phase='selecting';}
    const leavingAuto=autoHold;dropGuidance();discardManualSearch();pointerStart=null;lasso=null;result=null;
    if(leavingAuto){pair=[];pairTarget=0;lastManualStep=0;anchors=anchors.filter(a=>held.has(a.id)).map(a=>({...a,label:''}));referencesDirty=true;}
    tool=selecting?'hold':'swap';hideAutoNotice();instructions();sync();return true;
  }
  function toggleAutoHolds() { return autoHold?chooseManualHolds(false):suggestCurrentHolds(); }
  function canSelect3D(){return active&&phase==='selecting'&&!autoRequested&&!goalPreview&&!!model&&idle(api.snapshot());}
  function hideAutoNotice(){autoNotice.hidden=true;document.querySelector('.action-panel')?.classList.remove('cs-notice-visible');}
  function showAutoNotice(text,failed=false){autoNotice.hidden=false;document.querySelector('.action-panel')?.classList.add('cs-notice-visible');autoNoticeText.textContent=text;autoNoticeProgress.hidden=failed;autoNoticeRetry.hidden=!failed;autoNoticeReload.hidden=!failed;autoNoticeDismiss.hidden=!failed;autoNotice.setAttribute('data-state',failed?'error':'loading');}
  function autoFailure(reason,detail){
    let text;
    if(reason==='file_protocol'||window.location?.protocol==='file:')text='The solver needs local HTTP to load its included files and worker. Serve the complete website folder over HTTP, then open its local address.';
    else if(reason==='release_mismatch')text='This puzzle tab and its solver are from different releases. Reload the puzzle to use matching files.';
    else if(reason==='color_goal_identity_baseline_unreachable')text='The sticker identities do not match the solver’s reachable states. This does not prove the color goal impossible. If you used only ordinary moves, reload the puzzle to check for a browser/model mismatch.';
    else if(/load_timeout/.test(reason))text='Downloading the solver data timed out. Check your connection and retry.';
    else if(/network|http|unavailable/.test(reason) && !/worker|integrity/.test(reason))text='Solver data could not be loaded. Keep the complete website folder together, including its solver data and caches; reload and retry.';
    else if(/integrity|parse|version/.test(reason))text='The solver data could not be verified, possibly because files from different releases are mixed. Reload this puzzle with the complete matching website files and retry.';
    else if(/worker/.test(reason))text='The browser could not start or keep the solver running. If the site was just updated, reload this puzzle. Otherwise close other tabs and retry; an updated browser may help.';
    else if(/memory|storage/.test(reason))return 'No solution found. Please try again. No moves were made.';
    else if(/output|sequence|word/.test(reason))text='The solution exceeded the move-sequence limit.';
    else if(/time|limit|budget/.test(reason))text='The solver reached its computation limit. Retry allows more planning time.';
    else text='Auto Solve could not complete its preparation.';
    return text+' No moves were made. ('+String(reason||'startup_error')+(detail?': '+String(detail).slice(0,220):'')+')';
  }
  function reportAutoFailure(reason,detail){const text=autoFailure(reason,detail);setMessage(text);showAutoNotice(text,true);}
  const autoStopActive = () => active && autoRequested && ['loading','solving','executing','auto-gap'].includes(phase);
  const manualStopActive = () => active && !autoRequested && ['loading','solving','executing'].includes(phase);
  function syncTransport() {
    const stop=document.getElementById('pause');if(!stop)return;
    const snap=api.snapshot(), automatic=autoStopActive(), manual=manualStopActive(), scrambling=snap.mode==='scramble';
    // The solver session remains active while the native move queue rests
    // between stages. Keep its status and disabled/hover treatment steady.
    if(automatic){
      const badge=document.getElementById('status'),solve=document.getElementById('solve');
      if(badge){badge.className='status busy';badge.textContent='✦ Solving';}
      if(solve)solve.disabled=true;
    }
    stop.hidden=!automatic&&!manual && (!snap.mode || snap.mode==='idle');
    const stoppingTurn=(automatic&&autoJob?.stopAfterTurn)||(manual&&execution?.stopAfterTurn),stoppingStep=automatic&&autoJob?.stopAfterStep;
    stop.textContent=stoppingStep&&!stoppingTurn?'Stop now':'Stop';stop.setAttribute('aria-label',stoppingTurn?'Stopping after the current turn':stoppingStep?'Stop after the current turn instead':'Stop');
    stop.disabled=!!stoppingTurn;
    stop.setAttribute('aria-pressed',String(!!(stoppingStep||stoppingTurn)));
    stop.title=automatic?(stoppingTurn?'Stopping after the current turn; unfinished holds will be cleared':stoppingStep?'Stopping after this sequence. Click again to stop after the current turn; unfinished holds will be cleared':'Finish this sequence, then stop. Click twice to stop after the current turn'):manual?'Finish the current turn, then stop; held colors may not yet be restored':scrambling?'Stop randomizing immediately; keep completed turns':'Stop replay at the current completed turn';window.PuzzleJournal?.sync?.();
  }
  function captureReferences() {
    const v=bridge.viewport?.();if(!v || !(v.scale>0))return;
    anchors=nodes().filter(n=>held.has(n.stickerId)||pair.includes(n.stickerId)).map(n=>({id:n.stickerId,x:(n.x-v.x)/v.scale,y:(n.y-v.y)/v.scale,r:(n.r||5)/v.scale,label:pair.includes(n.stickerId)?(pair.indexOf(n.stickerId)?'2':'1'):''}));
    referencesDirty=false;lastDraw='';
  }
  function setSolverSpeed(on) {
    // Solver bookkeeping must never change user display or playback choices.
    solverSpeed = on;
    if (!on) api.restorePlaybackDefaults?.({preserveSettings:true});
  }
  function enterManualDefaults() {
    // Selection mode is independent of persistent page-level preferences.
  }
  function updateGoalProgress(){
    // Show the verified secured-node checkpoint in Auto Solve's upper bar.
    // This never changes the plan, holds, or stage timing.
    if(!model)return;
    const count=autoJob?.locked.size||0,total=model.stickerCount||1;
    progressBar.max=total;progressBar.value=count;
    progressBar.setAttribute('aria-valuetext',count+' of '+total+' nodes secured');
    progressLabel.textContent=autoJob?'Step '+Math.min(autoJob.completed+1,autoJob.stages.length)+' / '+autoJob.stages.length+' · '+count+' / '+total+' secured':phase==='solving'?'Planning solution…':count+' / '+total+' secured';
    progressLabel.title=progressLabel.textContent;
  }
  function updateGoalCompletion(){
    // A display-only goal-match checkpoint, independent of holds and input mode.
    // Exclude hypothetical empty shape poses and transient sequence positions.
    if(!active)return;
    if(!model){completionValue.textContent='—';completion.setAttribute('aria-label','Completion available when the puzzle model loads');return;}
    if(phase==='executing'||!idle(api.snapshot()))return;
    completionMirror=mirrorActive();
    try{
      const snapshot=api.snapshot(),progress=core.solvedProgress(model,snapshot);
      const count=progress.solvedCount,total=progress.totalCount;
      const value=total?Math.floor(100*count/total):0,text=value+'%';
      if(completionValue.textContent!==text)completionValue.textContent=text;
      completion.title=count+' of '+total+' nodes match the goal. Updates after each completed sequence.';
      completion.setAttribute('aria-label',text+' complete: '+count+' of '+total+' nodes matching the goal');
    }catch(_){completionValue.textContent='—';completion.setAttribute('aria-label','Completion unavailable for the current state');}
  }
  function updateStepProgress(snap = api.snapshot()) {
    const job = execution, previous = autoRequested ? lastAutoStep : lastManualStep;
    const completed = job ? Math.min(job.length, job.offset + (job.pending ? (snap.sequence?.completed || 0) : 0)) : autoJob?.completed ? autoJob.stages[autoJob.completed-1].moveIndices.length : previous;
    const total = job?.length || (autoJob?.completed ? autoJob.stages[autoJob.completed-1].moveIndices.length : previous);
    stepBar.max = total || 1; stepBar.value = completed;
    const label = autoRequested ? 'Current step' : guidedSession ? 'Step progress' : 'Swap progress';
    stepLabel.textContent = label + (total ? ' · ' + completed + ' / ' + total + ' moves' : phase === 'solving' ? ' · finding a sequence' : ' · waiting');
    stepLabel.title=stepLabel.textContent;
  }
  const hasPair=()=>pair[0]!=null && pair[1]!=null;
  // A hold is a persistent location classification. Selected swap endpoints
  // temporarily override its color constraint without removing its outline.
  const effectiveHeld = (endpoints=pair) => [...held].filter(id=>autoRequested||guidedSession||!endpoints.includes(id));
  const seconds=ms=>(Math.max(0,Number(ms)||0)/1000).toFixed(1).replace(/\.0$/,'');
  function clearWorkerTimer(){if(workerTimer!==null)clearTimeout(workerTimer);workerTimer=null;}
  function discardManualSearch(){if(manualSearch){epoch++;terminateWorker();manualSearch=null;}}
  function updateSearchProgress(){
    const searching=active&&!autoRequested&&phase==='solving'&&!!manualSearch;
    searchProgress.hidden=!searching;
    if(!searching)return;
    const s=manualSearch.search||{},running=manualSearch.stage==='searching'||manualSearch.stage==='planning';
    const elapsed=Math.min(manualSearch.budgetMs,(Number(s.elapsedMs)||0)+(running?Math.max(0,performance.now()-manualSearch.progressAt):0));
    const count=Number(s.states)||0;
    searchProgressLabel.textContent=running?'Searching · '+seconds(elapsed)+'s / '+seconds(manualSearch.budgetMs)+'s compute budget'+(count?' · '+count.toLocaleString()+' states examined':''):'Preparing the move library…';
    searchProgressLabel.title=searchProgressLabel.textContent;
    searchActivity.removeAttribute('value');
  }
  function manualUnavailable(){return !autoRequested&&!!manualSearch&&phase==='selecting'&&result?.status==='unknown';}
  function canContinueSearch(){return manualUnavailable()&&manualSearch.search?.canContinue===true&&Number(manualSearch.search.nextBudgetMs)>Number(manualSearch.search.budgetMs)&&Number(manualSearch.search.nextBudgetMs)<=60000;}

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
    if(old===2 && eligibility.boundCanTighten)return 2;
    if(old===1 && eligibility.boundCanRelax)return 1;
    return 0;
  }
  function readinessSource(a,b) {
    if(a===undefined || (b!==undefined && a===b))return null;
    if(eligibility?.result && !rejectedReadiness.has(eligibility.result) && core.eligibilityReady?.(eligibility.result,a,b))return eligibility.result;
    const bound=eligibility?.bound;
    // Same full color state, with a subset of the old holds. An old verified
    // word remains valid; adding holds must never reuse positive readiness.
    if(bound && !rejectedReadiness.has(bound.result) && eligibility.boundCanRelax && core.eligibilityReady?.(bound.result,a,b))return bound.result;
    return null;
  }
  function localWitness(a,b) {
    if(!lastSwapWitness || lastSwapWitness.key!==eligibility?.key)return null;
    const w=lastSwapWitness;
    return (a===w.a && (b===undefined || b===w.b)) || (a===w.b && (b===undefined || b===w.a)) ? w.word : null;
  }
  function readyStatus(a,b) { return !!(localWitness(a,b) || readinessSource(a,b)); }
  function readyWord(a,b) {
    const local=localWitness(a,b);if(local)return local.slice();
    return core.eligibilityWitness?.(readinessSource(a,b),a,b)||null;
  }
  const candidatePartner=()=>pairTarget===1 && pair[0]!=null ? pair[0] : null;
  function candidateStatus(id) {
    if(guidedSession)return goalImprovingNodes().has(id)?1:2;
    const n=eligibility?.map[id], other=candidatePartner();
    if(other===id)return 2;
    const status=proofStatus(n,other!=null?eligibility?.map[other]:undefined);
    // Older/unfinished tables describe H, not H minus the candidate endpoints.
    // Their held-node exclusion must never masquerade as a legal impossibility.
    if(eligibility?.result?.exemptSwapEndpoints!==true && (held.has(id)||held.has(other)||(other==null&&held.size&&status===2)))return 0;
    return status;
  }
  function candidateReady(id) {
    if(guidedSession)return goalImprovingNodes().has(id);
    if(candidateStatus(id)===2)return false;
    const n=eligibility?.map[id],other=candidatePartner();
    return readyStatus(n,other!=null?eligibility?.map[other]:undefined);
  }
  function canonicalGoals() {
    if(goalFields.has(model))return goalFields.get(model);
    const goals=Array(model.degree).fill(null);
    for(const [id,node] of Object.entries(model.homeBySticker||{})){
      const color=model.colorBySticker?.[id];if(color!==undefined&&color!==null)goals[node]=String(color);
    }
    goalFields.set(model,goals);return goals;
  }
  function newlyCorrectEndpoint(a,b,colors,goals) {
    return (goals[a]!=null&&colors[a]!==goals[a]&&colors[b]===goals[a]) ||
      (goals[b]!=null&&colors[b]!==goals[b]&&colors[a]===goals[b]);
  }
  function goalImprovingNodes() {
    if(!active||phase!=='selecting'||autoRequested||goalPreview)return emptyHints;
    const partner=candidatePartner();
    if(guidedSession){
      const choices=guidedChoices();
      if(guidedHintMemo?.choices===choices&&guidedHintMemo.partner===partner)return guidedHintMemo.found;
      const found=new Set();for(const choice of choices){
        if(partner===null)found.add(choice.firstStickerId);
        else if(choice.firstStickerId===partner)found.add(choice.secondStickerId);
      }
      guidedHintMemo={choices,partner,found};return found;
    }
    if(autoHold||!eligibility?.colors)return emptyHints;
    // Manual white rings describe a local endpoint improvement, not a complete
    // solving route. Scan only published witness pairs once per context/choice,
    // and never replay move words or scan every possible pair while rendering.
    const rejected=!!eligibility.result&&rejectedReadiness.has(eligibility.result),rejectedBound=!!eligibility.bound?.result&&rejectedReadiness.has(eligibility.bound.result);
    if(goalHintsMemo?.context===eligibility&&goalHintsMemo.partner===partner&&goalHintsMemo.local===lastSwapWitness&&goalHintsMemo.rejected===rejected&&goalHintsMemo.rejectedBound===rejectedBound)return goalHintsMemo.nodes;
    const found=new Set(),byNode=new Map(Object.entries(eligibility.map).map(([id,node])=>[node,id]));
    const consider=(a,b)=>{
      const first=byNode.get(a),second=byNode.get(b);
      if(first===undefined||second===undefined||a===b||!readyStatus(a,b)||proofStatus(a,b)===2||!newlyCorrectEndpoint(a,b,eligibility.colors,eligibility.goals))return;
      if(partner===null){if(!held.has(second))found.add(first);if(!held.has(first))found.add(second);}
      else if(first===partner&&!held.has(second))found.add(second);
      else if(second===partner&&!held.has(first))found.add(first);
    };
    const sources=[eligibility.result,...(eligibility.boundCanRelax?[eligibility.bound?.result]:[])];
    for(const source of sources){if(!source||rejectedReadiness.has(source))continue;for(const witness of source.readyWitnesses||[]){const pairs=witness.pairs||[];for(let i=0;i+1<pairs.length;i+=2)consider(pairs[i],pairs[i+1]);}}
    if(lastSwapWitness?.key===eligibility.key)consider(lastSwapWitness.a,lastSwapWitness.b);
    goalHintsMemo={context:eligibility,partner,local:lastSwapWitness,rejected,rejectedBound,nodes:found};return found;
  }
  function selectedPairStatus() {
    if(guidedSession)return !hasPair()?0:guidedChoices().some(c=>c.firstStickerId===pair[0]&&c.secondStickerId===pair[1])?1:2;
    if(!hasPair())return 0;
    if(pair[0]===pair[1])return 2;
    if(result?.status==='impossible')return 2;
    if(eligibility?.result?.exemptSwapEndpoints!==true && pair.some(id=>held.has(id)))return 0;
    return proofStatus(eligibility?.map[pair[0]],eligibility?.map[pair[1]]);
  }
  function eligibilityCode(id) {
    if(!active || phase!=='selecting' || autoRequested || (tool==='hold'&&held.has(id)) || pair.includes(id))return 0;
    return candidateStatus(id)===2?2:candidateReady(id)?1:3;
  }
  function syncPairUI() {
    const invalid=selectedPairStatus()===2;
    swap.textContent=autoHold?'Move':'Swap';
    swap.title=autoHold?'Auto hold keeps Move active. Choose 1, then 2 for the next guided step.':tool==='swap'?'Swap is active. Choose Select to edit holds, or Clear to reset.':'Choose a pair to swap';
    selection.setAttribute('aria-label',autoHold?'Guided move selections':'Swap selections');
    [aChip,bChip].forEach((chip,i)=>{
      const selected=pair[i]!=null, editing=tool==='swap' && pairTarget===i && !isBusy() && !autoRequested;
      chip.classList.toggle('chosen',selected);chip.classList.toggle('editing',editing);chip.classList.toggle('invalid',invalid);
      chip.setAttribute('aria-pressed',String(editing));chip.setAttribute('aria-label',(selected?'Change ':'Choose ')+(i?'2':'1')+(selected?': '+nodeName(pair[i]):''));
      chip.title=guidedSession?'Guided step: choose '+(i?'the second marked tile':'a white-ringed tile')+'. This can place or cycle tiles; all secured holds are restored.':selected?nodeName(pair[i])+' · '+(held.has(pair[i])&&!autoRequested?'Held location: temporarily released for this swap, then held again with its new color':'Choose another '+(i?'2':'1')):'Choose '+(i?'2':'1')+' on the ring map';
      chip.disabled=isBusy()||!!autoRequested;
    });

  }
  function syncEligibilityNote() {
    eligibilityNote.hidden=!active || phase!=='selecting' || autoRequested;
    if(eligibilityNote.hidden)return;
    if(guidedSession){eligibilityNote.textContent='';eligibilityNote.hidden=true;overlay.setAttribute('aria-busy','false');return;}
    const label=pairTarget?'2':'1', invalid=selectedPairStatus()===2;
    const partner=candidatePartner(), candidates=nodes().filter(n=>n.stickerId!==partner);
    let available=0,blocked=0,unknown=0;for(const n of candidates){const s=candidateStatus(n.stickerId);if(s===2)blocked++;else if(candidateReady(n.stickerId))available++;else unknown++;}
    const checking=eligibility?.status==='pending';
    eligibilityNote.setAttribute('data-state',invalid?'blocked':checking?'checking':unknown?'unknown':'ready');
    if(manualUnavailable()&&!readyStatus(eligibility?.map[pair[0]],eligibility?.map[pair[1]]))eligibilityNote.textContent=canContinueSearch()?'Search saved · continue or change the pair':'Search limit reached · change pair or holds';
    else if(invalid)eligibilityNote.textContent='This pair cannot swap with these holds';
    else if(checking)eligibilityNote.textContent='Checking choices…';
    else if(!available)eligibilityNote.textContent=partner!==null?'No swaps ready. Choose another first tile or release a hold.':held.size?'No swaps ready. Release a hold to see more options.':'No verified swaps ready for this position.';
    else if(hasPair()&&readyStatus(eligibility?.map[pair[0]],eligibility?.map[pair[1]])){const length=readyWord(eligibility?.map[pair[0]],eligibility?.map[pair[1]])?.length;eligibilityNote.textContent='Ready'+(length?' · '+length+' '+(length===1?'move':'moves'):'');}
    else if(hasPair())eligibilityNote.textContent='Check required';
    else eligibilityNote.textContent='';
    // A completed action or error takes precedence over background eligibility
    // checking. Both occupy one reserved line instead of growing the panel.
    eligibilityNote.hidden=!eligibilityNote.textContent||(!status.hidden&&!!status.textContent);
    eligibilityNote.title='Bright nodes have a verified manual swap ready, including swaps with held endpoints. Gray means no verified swap is ready, not proof of impossibility. White rings in manual mode mark a verified swap with an unheld partner that corrects at least one endpoint; other unheld colors may change. Auto hold retains a verified route and automatically advances its holds and white-ringed choices after each step. In ordinary manual swaps a held endpoint is temporarily released, then held again with its new color.';
    overlay.setAttribute('aria-busy',String(checking));
  }
  function eligibilityContext(snapshot) {
    const map=mapping(snapshot);
    const startKey=tokenKey(map),fixed=[...held].map(id=>map.stickerToNode[id]).sort((a,b)=>a-b);
    const colors=core.colorsFromSnapshot(model,snapshot,map),goals=canonicalGoals();
    const occupiedKey=JSON.stringify(Object.values(map.stickerToNode).sort((a,b)=>a-b)),colorKey=JSON.stringify(colors),key=JSON.stringify([fixed,occupiedKey,colorKey,'endpoint-exempt']);
    const bound=lastEligibilityProof?.occupiedKey===occupiedKey && lastEligibilityProof?.colorKey===colorKey?lastEligibilityProof:null;
    const fixedSet=new Set(fixed),boundSet=new Set(bound?.fixed||[]),boundCanRelax=!!bound&&fixed.every(n=>boundSet.has(n)),boundCanTighten=!!bound&&bound.fixed.every(n=>fixedSet.has(n));
    return {key,startKey,fixed,occupiedKey,colorKey,colors,goals,map:{...map.stickerToNode},bound,boundCanRelax,boundCanTighten};
  }
  function ensureEligibility() {
    if(guidedSession){stopEligibility();eligibility=null;return;}
    if(!active || phase!=='selecting' || autoRequested || !model) { stopEligibility();if(eligibility?.status==='pending')eligibility=null;return; }
    const snapshot=api.snapshot();if(!idle(snapshot))return;
    let context;try{context=eligibilityContext(snapshot);}catch(_){return;}
    const {key,startKey,fixed,occupiedKey,colorKey}=context;
    if(eligibility?.key===key && eligibility.startKey===startKey)return;
    // Reuse an idle worker's prepared chain; cancel work tied to old holds.
    stopEligibility(eligibility?.status==='pending');const id=eligibilityEpoch;
    eligibility={...context,status:'pending',result:null};
    const receive=payload=>{
      if(id!==eligibilityEpoch || !active || phase!=='selecting' || autoRequested || !idle(api.snapshot()))return;
      try{
        if(tokenKey(mapping(api.snapshot()))!==startKey)return;
        const r=payload.result;
        if(payload.modelFingerprint && payload.modelFingerprint!==core.modelFingerprint(model))throw Error('stale model');
        if(!r || !['complete','partial','unknown','invalid'].includes(r.status))throw Error('invalid eligibility');
        stopEligibility(!['complete','partial'].includes(r.status));eligibility={...context,status:r.status,result:r};
        if(['complete','partial'].includes(r.status)){
          lastEligibilityProof={result:r,fixed,occupiedKey,colorKey};
          if(!eligibilityCache.has(key)){
            const bytes=(r.knownPairs?.length||0)+(r.feasiblePairs?.length||0)+(r.firstStatus?.length||0)+(r.readyPairs?.length||0)+(r.readyFirstStatus?.length||0)+(r.readyWitnesses||[]).reduce((sum,w)=>sum+8*((w.word?.length||0)+(w.pairs?.length||0))+96,0)+256;
            while(eligibilityCache.size && eligibilityBytes+bytes>2*1024*1024){const old=eligibilityCache.keys().next().value;eligibilityBytes-=eligibilityCache.get(old).bytes;eligibilityCache.delete(old);}
            if(bytes<=2*1024*1024){eligibilityCache.set(key,{result:r,bytes});eligibilityBytes+=bytes;}
          }
        }
      }catch(_){stopEligibility();eligibility={...context,status:'unknown',result:null};}
      syncPairUI();syncEligibilityNote();lastDraw='';bridge.requestRender();
    };
    if(eligibilityCache.has(key)){receive({result:eligibilityCache.get(key).result});return;}
    eligibilityTimer=setTimeout(()=>{
      eligibilityTimer=null;
      if(id!==eligibilityEpoch || !active || phase!=='selecting' || autoRequested)return;
      try{
        if(!eligibilityWorker)eligibilityWorker=new Worker(core.workerURL||new URL('constrained-solver-worker.js',scriptBase));
        eligibilityWorker.onmessage=e=>{if(e.data?.id===id && e.data.type==='result')receive(e.data);};
        eligibilityWorker.onerror=()=>receive({result:{status:'unknown'}});
        eligibilityTimer=setTimeout(()=>receive({result:{status:'unknown'}}),7000);
        eligibilityWorker.postMessage({task:'eligible-swaps',id,modelId:api.puzzle,expectedRelease:core.assetRelease,snapshot,selection:{protectedStickerIds:[...held],holdSemantics:'color',exemptSwapEndpoints:true},options:{maxMs:3000}});
      }catch(_){receive({result:{status:'unknown'}});}
    },80);
  }
  function sync() {
    panel.classList.toggle('cs-active', active); panel.classList.toggle('cs-auto-active', active && autoRequested); document.body.classList.toggle('cs-working', active && ['loading','solving','executing','auto-gap'].includes(phase));
    controls.hidden = !active; completion.hidden = !active; overlay.hidden = !active&&!goalPreview; overlay.style.pointerEvents=active?'':'none'; backdrop.hidden = !active;
    toggle.setAttribute('aria-pressed', String(active));normalMode.setAttribute('aria-pressed',String(!active));toggle.disabled=false;normalMode.disabled=returnToDefault||!!autoJob?.stopAfterTurn;
    toggle.title='Preserve colors at held locations and swap a pair';normalMode.title=phase==='executing'?'Return to ring turns after the current turn':'Return to ordinary ring turns';
    normalMode.textContent='Turn rings';normalMode.setAttribute('aria-label',normalMode.disabled?'Returning to Turn rings after the current turn':'Turn rings');modeSwitch.setAttribute('aria-busy',String(normalMode.disabled));
    hold.setAttribute('aria-pressed', String(manualHoldSelected&&!autoHold)); swap.setAttribute('aria-pressed', String(tool === 'swap'));
    hold.classList.toggle('selecting',tool==='hold'&&!autoHold);tools.setAttribute('data-hold-mode',autoHold?'auto':manualHoldSelected?'manual':'none');tools.setAttribute('data-selection-tool',tool);
    hold.disabled = !!autoRequested||(isBusy()&&!autoHoldsPending);swap.disabled=isBusy();clear.disabled=!!autoRequested||(isBusy()&&!autoHoldsPending);
    suggestHolds.hidden=!active||!!autoRequested;suggestHolds.disabled=!!autoRequested||(isBusy()&&!autoHoldsPending);suggestHolds.setAttribute('aria-pressed',String(autoHold));suggestHolds.setAttribute('aria-busy',String(autoHoldsPending));
    suggestHolds.setAttribute('aria-label',autoHold?'Auto hold on. Turn off automatic holds.':'Auto hold off. Turn on automatic holds.');
    suggestHolds.title=autoHold?'Auto hold is on: holds and white-ringed choices advance after each step. Click to return to manual swaps.':'Turn on Auto hold: prepare a verified route and automatically update holds after each chosen pair';
    clear.title='Clear all holds and selections; turn off Select, Auto, and Swap';syncGoalAvailability();
    if(goalPreview&&(mirrorActive()||isBusy()||autoRequested||!idle(api.snapshot())))setGoalPreview(false);
    actionRow.hidden=!!autoRequested;toolbar.hidden=!!autoRequested;heldCount.hidden=!!autoRequested;
    heldCount.textContent = String(held.size);heldCount.setAttribute('aria-label',held.size+' held nodes');hold.setAttribute('aria-label','Select holds manually: '+held.size+' held'+(autoHold?'; turns Auto hold off':'; click or lasso nodes to toggle'));tools.setAttribute('aria-label','Hold controls: '+held.size+' held; '+(autoHold?'automatic':manualHoldSelected?'manual':'no hold mode selected'));
    cancel.hidden = phase !== 'solving' && !(autoRequested && phase==='loading');
    retry.hidden=!active||phase!=='selecting'||result?.status!=='unknown'||(!autoRequested&&!canContinueSearch());
    const next=manualSearch?.search?.nextBudgetMs||10000,previous=manualSearch?.search?.budgetMs||3000;
    retry.textContent=autoRequested?'Retry full solve · 30s':'Continue previous pair · +'+seconds(next-previous)+'s';
    retry.title=autoRequested?'Retry full puzzle planning with a longer budget':'Restore the previous 1 and 2, then resume their saved search with a '+seconds(next)+'-second total compute budget';
    searchActions.hidden=cancel.hidden&&retry.hidden;updateSearchProgress();
    tools.hidden = !!autoJob || (autoRequested && phase === 'solving'); clear.hidden = !!autoJob; pairArrow.textContent = autoRequested ? '→' : '↔';
    autoProgress.hidden = !active || (!autoRequested && phase!=='executing'); progressBar.hidden = progressLabel.hidden = !autoRequested;
    updateGoalProgress();
    updateGoalCompletion();
    updateStepProgress();
    ensureEligibility();syncPairUI();syncEligibilityNote();syncNodeLabel();
    // Readiness/results and progress share the same reserved footprint. The
    // progress caption already reports moves; do not repeat it below the bar.
    detailSlot.hidden=autoRequested||!autoProgress.hidden||!searchProgress.hidden;
    const automatic=autoStopActive();
    if(autoTransportActive!==automatic||manualMoveBlockActive!==active){autoTransportActive=automatic;manualMoveBlockActive=active;bridge.refreshControls?.();}
    syncTransport();
    panel.setAttribute('data-solver-phase', phase); lastDraw = ''; bridge.requestRender();
  }
  function instructions() {
    if(guidedSession){setMessage(guidedStage()?'Choose white-ringed Move 1, then Move 2. Auto hold preserves secured holds, adds new ones, and offers the next choices automatically. Choose Select to edit holds manually.':'Goal reached. All nodes secured.','help');return;}
    setMessage(tool==='none'?'Choose Select, Swap, or Auto to continue.':tool==='hold'?'Click or lasso nodes to toggle holds. Auto hold updates holds automatically along a verified route. Choose 1 and 2 to start a manual swap.':hasPair()?'The pair is being checked. A verified swap starts after a short pause. Other unheld nodes may move.':'Choose '+(pairTarget?'2':'1')+' on the map or 3D puzzle. White rings mark swaps with an unheld partner that correct at least one endpoint. Bright nodes have a verified swap; gray nodes have no swap ready. Auto hold follows a complete verified route.','help');
  }
  function clearManualPair() {
    pair=[];pairTarget=0;tool='swap';lastManualStep=0;
    anchors=anchors.filter(a=>held.has(a.id)).map(a=>({...a,label:''}));referencesDirty=true;
  }
  function terminateWorker() { if (worker) worker.terminate(); worker = null; autoHoldsPending=false; clearWorkerTimer(); }
  function cancelSearch() {
    if(phase==='selecting'&&manualSearch){discardManualSearch();result=null;clearManualPair();setMessage('Saved search cleared.');sync();return true;}
    if (phase !== 'solving' && !(autoRequested && phase==='loading')) return false;
    if (autoRequested) { closePanel(); return true; }
    epoch++; terminateWorker(); if(autoHold&&!guidedSession)dropGuidance();manualSearch=null; phase = 'selecting'; result = null; autoJob = null; clearManualPair();setSolverSpeed(false); setMessage('Search canceled · pair cleared.'); sync(); return true;
  }
  // Closing the map abandons endpoint constraints, but never interrupts an
  // atomic puzzle turn. The engine finishes that turn and discards its queue.
  function closePanel() {
    setGoalPreview(false);
    window.PuzzleAxisDisplay?.clear();
    hideAutoNotice();
    epoch++; terminateWorker();manualSearch=null;
    dropGuidance();
    stopEligibility(); eligibility=null;lastEligibilityProof=null;
    if (execution || autoJob){api.stopAfterCurrentMove?.();window.PuzzleJournal?.endSequence();}
    active=false; phase='off'; execution=null; autoJob=null; autoRequested=false;exitToManual=false;
    held.clear(); pair=[]; result=null; observed=null; pointerStart=null; lasso=null; lastAutoStep=0; lastManualStep=0; anchors=[];referencesDirty=true;pairTarget=0;returnToDefault=false;
    setSolverSpeed(false); sync(); return true;
  }
  async function setActive(value) {
    value = !!value;
    if(value&&active&&autoRequested){stopAuto(true);return true;}
    if (value === active) return true;
    if (phase === 'executing' || phase === 'auto-gap') return false;
    if (!value) return closePanel();
    const snap = api.snapshot();
    if (!idle(snap)) { toggle.title = 'Wait for the current sequence to finish'; return false; }
    setGoalPreview(false);window.PuzzleAxisDisplay?.clear();window.PuzzleSelection3D?.clearHover?.();
    active = true; phase = 'loading'; tool = 'hold';manualHoldSelected=true; if(!autoRequested)enterManualDefaults();setMessage('Loading the puzzle move model…'); sync();
    const id = ++epoch;
    try {
      model = await core.loadModel(api.puzzle);
      if (!active || id !== epoch) return false;
      observed = tokenKey(mapping(api.snapshot())); phase = autoRequested?'solving':'selecting'; if(!autoRequested)instructions(); sync(); overlay.focus({preventScroll:true}); return true;
    } catch (error) {
      if (!active || id !== epoch) return false;
      phase = 'unavailable';if(autoRequested)reportAutoFailure(error.code||'model_unavailable',error.message);else setMessage('Solver unavailable: ' + error.message + '. Turn this mode off and on to retry.');setSolverSpeed(false);sync();return false;
    }
  }
  function editPair(index) {
    if(!active || isBusy() || autoRequested || goalPreview)return false;
    // Starting over at 1 releases both endpoints, but preserves all holds.
    discardManualSearch();result=null;
    if(index===0){pair=[];result=null;lastManualStep=0;anchors=anchors.filter(a=>held.has(a.id)).map(a=>({...a,label:''}));referencesDirty=true;}
    hideAutoNotice();pointerStart=null;lasso=null;tool='swap';pairTarget=index;instructions();sync();return true;
  }
  function setTool(value) {
    if(value==='hold')return chooseManualHolds(true);
    if(!active || isBusy() || goalPreview || !['hold','swap'].includes(value))return false;
    hideAutoNotice();autoRequested=false;pointerStart=null;lasso=null;tool=value;if(value==='swap'){if(pair[0]==null)pairTarget=0;else if(pair[1]==null)pairTarget=1;}
    instructions();sync();return true;
  }
  function clearSelection() {
    if(!active||goalPreview||autoRequested||(isBusy()&&!autoHoldsPending))return false;
    if(autoHoldsPending){epoch++;terminateWorker();phase='selecting';}
    dropGuidance();manualHoldSelected=false;tool='none';discardManualSearch();hideAutoNotice();
    lastManualStep=0;held.clear();pair=[];pairTarget=0;result=null;anchors=[];pointerStart=null;lasso=null;referencesDirty=true;
    instructions();sync();return true;
  }
  function changedHolds() {
    goalHintsMemo=null;
    if(guidedSession){dropGuidance();pair=[];pairTarget=0;}
    discardManualSearch();
    // Toggling a hold never cancels a chosen endpoint: its classification and
    // its temporary swap exemption are independent.
    if(pair[0]==null){pair=[];pairTarget=0;}else if(pair[1]==null)pairTarget=1;
    result=null;autoRequested=false;lastManualStep=0;referencesDirty=true;
  }
  function selectNode(id) {
    id=String(id);
    if(!active || isBusy() || goalPreview || tool==='none' || !model || !nodes().some(n=>n.stickerId===id))return false;
    if(!idle(api.snapshot())){setMessage('Wait for the puzzle to finish moving.');return false;}
    focusId=id;
    if(tool==='hold'){
      if(autoHold)return false;
      if(!held.delete(id))held.add(id);
      changedHolds();instructions();sync();return true;
    }

    if(candidatePartner()===id){setMessage('Already selected as 1.');return false;}
    if(!candidateReady(id)){setMessage(guidedSession?'Choose a white-ringed tile for this guided step.':'No verified swap ready for this tile. Choose a bright node'+(held.size?' or release a hold.':'.'));return false;}
    if(pair[pairTarget]===id)return true;
    discardManualSearch();result=null;autoRequested=false;lastManualStep=0;pair[pairTarget]=id;
    if(pair[0]==null)pairTarget=0;else if(pair[1]==null)pairTarget=1;
    referencesDirty=true;instructions();sync();
    if(hasPair())startSearch(3000);
    return true;
  }
  function remember(key, payload) {
    if (!['solved','impossible'].includes(payload.result.status)) return;
    const value = JSON.stringify(payload), bytes = value.length * 2;
    if (bytes > CACHE_LIMIT) return;
    if (cache.has(key)) { cacheBytes -= cache.get(key).length * 2; cache.delete(key); }
    while (cache.size && cacheBytes + bytes > CACHE_LIMIT) { const oldest = cache.keys().next().value; cacheBytes -= cache.get(oldest).length * 2; cache.delete(oldest); }
    cache.set(key, value); cacheBytes += bytes;
  }

  function startGuidedChoice() {
    if(!active||phase!=='selecting'||!hasPair()||!guidedSession)return false;
    const snapshot=api.snapshot(),stage=guidedStage();
    const choice=guidedChoices().find(c=>c.firstStickerId===pair[0]&&c.secondStickerId===pair[1]);
    if(!idle(snapshot)||!stage||!choice)return false;
    const before=mapping(snapshot);
    if(tokenKey(before)!==guidedSession.key||!core.verifyAutoHoldsStage?.(model,snapshot,stage,[...guidedSession.locked])){
      dropGuidance();clearManualPair();setMessage('Guided step no longer matches this position. Choose Auto again.');sync();return false;
    }
    captureReferences();
    execution={kind:'guided',stage,choice,indices:stage.moveIndices.slice(),offset:0,chunkEnd:0,pending:false,expected:{...before.stickerToNode},original:{...before.stickerToNode},length:stage.moveIndices.length,readyAt:performance.now()+350};
    phase='executing';setSolverSpeed(true);window.PuzzleSelection3D?.clearHover?.();
    setMessage('Guided '+(choice.kind==='swap'?'swap':choice.kind==='placement'?'placement':'step')+' · '+execution.length+' moves');sync();runChunk();return true;
  }
  function startSearch(maxMs,continuing=false) {
    if(goalPreview)return false;
    if(guidedSession)return startGuidedChoice();
    // A failed check releases the visible endpoints. Explicit Continue restores
    // its private pair and retained frontier; choosing anything new discards it.
    if(continuing && active && phase==='selecting' && canContinueSearch() && worker && manualSearch.pair?.length===2){
      pair=manualSearch.pair.slice();pairTarget=1;tool='swap';referencesDirty=true;
    }
    if (!active || phase !== 'selecting' || !hasPair() || !model) return;
    const snapshot = api.snapshot(); if (!idle(snapshot)) return;
    ensureEligibility();if(selectedPairStatus()===2){clearManualPair();setMessage('No solution found. Try another pair.');sync();return;}
    let req, before;
    try { req = core.requestFromSnapshot(model, snapshot, {protectedStickerIds: effectiveHeld(), swapStickerIds: pair,holdSemantics:'color'}); before = mapping(snapshot); }
    catch (error) { discardManualSearch();clearManualPair();setSolverSpeed(false);setMessage(error.message);sync(); return; }
    const startKey=tokenKey(before),cacheKey=JSON.stringify({protected:req.protected.slice().sort((a,b)=>a-b),swap:req.swap,occupied:req.occupiedNodes,holdSemantics:req.holdSemantics,colors:req.colorByNode}),sessionKey=cacheKey+'|'+startKey;
    if(manualSearch&&manualSearch.key!==sessionKey)discardManualSearch();
    if(manualUnavailable()&&!readyWord(req.swap[0],req.swap[1])&&(!continuing||!canContinueSearch())){sync();return;}
    if(continuing&&(!manualSearch||!worker||!canContinueSearch()))return;
    maxMs=continuing?Number(manualSearch.search.nextBudgetMs):3000;
    const priorElapsed=continuing?Number(manualSearch.search.elapsedMs)||0:0;
    const eligibilityKey=eligibility?.key,source=readinessSource(req.swap[0],req.swap[1]);let witness=readyWord(req.swap[0],req.swap[1]);
    // A bright pair already has a legal word; never replace it with a new search.
    if(witness){try{if(!core.verify(model,core.normalize(model,req),witness))throw Error('invalid witness');}catch(_){witness=null;lastSwapWitness=null;if(source)rejectedReadiness.add(source);}}
    else if(source)rejectedReadiness.add(source);
    if(!continuing&&!witness){discardManualSearch();result=null;clearManualPair();setMessage('No verified swap ready. Choose another pair.');sync();return;}
    if(manualUnavailable()&&!witness&&(!continuing||!canContinueSearch())){sync();return;}
    if(!manualSearch)manualSearch={key:sessionKey,pair:pair.slice(),search:{budgetMs:0,elapsedMs:0,states:0,transitions:0,canContinue:false},budgetMs:maxMs,stage:'loading-model',progressAt:performance.now()};
    manualSearch.budgetMs=maxMs;manualSearch.stage=continuing?'planning':'loading-model';manualSearch.progressAt=performance.now();
    captureReferences();phase = 'solving'; result = null; lastManualStep=0; setSolverSpeed(true); setMessage(witness?'Starting swap…':continuing?'Resuming search…':'Checking pair…'); sync();
    const id = ++epoch;
    const receive = payload => {
      if (id !== epoch || !active || phase !== 'solving') return;
      clearWorkerTimer();
      try {
        const current = api.snapshot();
        if (!idle(current) || tokenKey(mapping(current)) !== startKey) throw Error('The puzzle changed during search. Select the nodes again.');
        const r = payload.result; if (!r || !['solved','impossible','unknown','invalid'].includes(r.status)) throw Error('The solver returned an invalid response.');
        result = r;
        if (r.status === 'solved') {
          terminateWorker();manualSearch=null;
          const normalized = core.normalize(model, req);
          if (!Array.isArray(r.moveIndices) || !r.moveIndices.length || r.moveIndices.length > 5000 || !core.verify(model, normalized, r.moveIndices)) throw Error('The returned sequence did not pass verification. No moves were made.');
          if (payload.modelFingerprint && payload.modelFingerprint !== core.modelFingerprint(model)) throw Error('The puzzle model changed. Reload before solving.');
          remember(cacheKey, payload);
          lastSwapWitness={key:eligibilityKey,a:req.swap[0],b:req.swap[1],word:r.moveIndices.slice()};
          execution = {request: normalized, heldNodes:[...held].map(sticker=>before.stickerToNode[sticker]), swappedHolds:pair.filter(sticker=>held.has(sticker)).length, indices:r.moveIndices.slice(), offset:0, chunkEnd:0, pending:false, expected:{...before.stickerToNode}, original:{...before.stickerToNode}, length:r.moveIndices.length,readyAt:performance.now()+350};
          phase = 'executing';window.PuzzleSelection3D?.clearHover?.(); setMessage('Starting swap · ' + execution.length + ' moves' + (r.optimal ? ' · shortest' : '')); sync(); runChunk();
        } else {
          phase = 'selecting'; setSolverSpeed(false);
          const supplied=r.search||{},canResume=r.status==='unknown'&&supplied.canContinue===true&&!!worker&&Number(supplied.nextBudgetMs)>maxMs&&Number(supplied.nextBudgetMs)<=60000;
          manualSearch.search={...manualSearch.search,...supplied,budgetMs:maxMs,canContinue:canResume,...(canResume?{}:{terminalReason:supplied.terminalReason||r.reason||'search_limit'})};manualSearch.stage='paused';
          if(!canResume)terminateWorker();
          clearManualPair();
          if (r.status === 'impossible') { remember(cacheKey, payload); setMessage('No solution found. Try another pair.'); }
          else if (r.status === 'unknown'&&canResume)setMessage('No solution found yet. Try another pair or continue this search.');
          else if(r.status==='unknown'&&/worker|load|network|integrity|release_mismatch/.test(r.reason||'')){setMessage(r.reason==='release_mismatch'?'This puzzle tab and its solver are from different releases. Reload the puzzle before trying again. No moves were made.':'The search could not continue ('+String(r.reason).replace(/_/g,' ')+(r.detail?': '+String(r.detail).slice(0,160):'')+'). No moves were made. If the site was just updated, reload this puzzle; otherwise reopen Constrained Solver to retry.');showAutoNotice(message,true);autoNoticeRetry.hidden=true;}
          else if (r.status === 'unknown') {
            const reason=String(supplied.terminalReason||r.reason||''),limit=/storage|memory|state_limit/.test(reason)?'':/depth|output|word/.test(reason)?'Sequence search limit reached. ':maxMs>=60000?'One-minute search budget reached. ':'';
            setMessage(limit+'No solution found. Try another pair.');
          }
          else setMessage('This request is unavailable: ' + (r.reason || 'unsupported state') + '. No moves were made.');
          sync();
        }
      } catch (error) { terminateWorker();manualSearch=null;phase = 'selecting'; result = null; execution = null; clearManualPair();setSolverSpeed(false); setMessage(error.message); sync(); }
    };
    if(witness){Promise.resolve().then(()=>receive({result:{status:'solved',moveIndices:witness,optimal:witness.length===1,source:'stored-eligibility-witness'},modelFingerprint:core.modelFingerprint(model)}));return;}
    if (cache.has(cacheKey)) { const payload = JSON.parse(cache.get(cacheKey)); Promise.resolve().then(() => receive(payload)); return; }
    try {
      if(!worker)worker = new Worker(core.workerURL||new URL('constrained-solver-worker.js', scriptBase));
      worker.onmessage = event => {
        const data=event.data;if(data?.id!==id||id!==epoch||!active||phase!=='solving')return;
        if(data.type==='result'){receive(data);return;}
        if(data.type==='progress'&&['loading-model','loading-cache','planning','searching'].includes(data.stage)){
          const starting=manualSearch.stage!==data.stage;manualSearch.stage=data.stage;
          if(data.search){manualSearch.search={...manualSearch.search,...data.search};manualSearch.progressAt=performance.now();}
          else if(starting)manualSearch.progressAt=performance.now();
          // The watchdog is a wall-time safety net, not a new solver budget.
          if(starting){clearWorkerTimer();workerTimer=setTimeout(()=>receive({result:{status:'unknown',reason:['planning','searching'].includes(data.stage)?'worker_timeout':'solver_data_load_timeout'}}),['planning','searching'].includes(data.stage)?Math.max(1000,maxMs-priorElapsed)+3000:24000);}
          if(data.stage==='loading-cache')setMessage('Loading the verified move library…');
          if(data.stage==='planning'||data.stage==='searching')setMessage(continuing?'Resuming search…':'Finding a verified swap…');
          updateSearchProgress();
        }
      };
      worker.onerror = event => receive({result:{status:'unknown',reason:'worker_unavailable',detail:event?.message}});
      worker.onmessageerror=()=>receive({result:{status:'unknown',reason:'worker_message_error'}});
      clearWorkerTimer();workerTimer = setTimeout(() => receive({result:{status:'unknown',reason:'worker_timeout'}}),continuing?Math.max(1000,maxMs-priorElapsed)+3000:24000);
      worker.postMessage({task:'manual-swap',id,modelId:api.puzzle,expectedRelease:core.assetRelease,snapshot,selection:{protectedStickerIds:effectiveHeld(),swapStickerIds:pair.slice(),holdSemantics:'color'},options:{maxMs,maxOutputMoves:5000}});
    } catch (_) { receive({result:{status:'unknown',reason:'worker_unavailable'}}); }
  }
  const AUTO_GAP_MS = 500;
  function updateSecured() {
    const locked = autoJob?.locked || new Set();
    const current=mapping(api.snapshot());
    held = new Set([...locked].map(node=>current.nodeToSticker[node]).filter(id=>id!==undefined).map(String));
  }
  async function autoSolve(maxMs = 15000) {
    try{return await startAutoPlanning(maxMs);}
    catch(error){terminateWorker();autoJob=null;execution=null;result={status:'unknown',reason:error.code||'startup_error'};phase='selecting';setSolverSpeed(false);reportAutoFailure(result.reason,error.message);sync();return false;}
  }
  async function startAutoPlanning(maxMs) {
    if (['executing','auto-gap','loading'].includes(phase) || !idle(api.snapshot())) return false;
    if (phase === 'solving') cancelSearch();
    dropGuidance();discardManualSearch();exitToManual=false;
    if(phase==='unavailable')closePanel();
    autoRequested=true;
    showAutoNotice('Loading the puzzle move model…');
    // Mirror mode shares the same legal move model and keeps the map usable.
    document.getElementById('ringPanelToggle')?.click();
    if (!active && !await setActive(true)) return false;
    if(!autoRequested)return false;
    if (!model || phase === 'unavailable') return false;
    const snapshot = api.snapshot(); if (!idle(snapshot)) return false;
    let before;
    try { before = mapping(snapshot); core.solvedProgress(model, snapshot); }
    catch (error) { phase='selecting';setSolverSpeed(false);reportAutoFailure('state_mapping_error',error.message);sync();return false; }
    held.clear(); pair=[]; autoJob=null; autoRequested=true; result=null; lastAutoStep=0; phase='solving';
    setSolverSpeed(true);
    setMessage('Planning solution…');showAutoNotice('Starting the solver…'); sync();
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
          setSolverSpeed(false);
          if (r.status === 'unknown') reportAutoFailure(r.reason||'compute_limit',r.detail);
          else if (r.status === 'impossible') setMessage('This arrangement does not match a reachable state in the solver’s move model. If it followed ordinary game moves, reload the puzzle: this can indicate a browser/model mismatch. No moves were made. ('+(r.reason||'state_outside_legal_moves')+(Number.isInteger(r.failedTargetNode)?'; target node '+r.failedTargetNode:'')+')');
          else setMessage('Auto Solve is unavailable for this state: ' + (r.reason || 'unsupported state') + '. No moves were made.');
          if(r.status!=='unknown')showAutoNotice(message,true);sync(); return;
        }
        if (!core.verifyAutoPlan(model,current,r)) throw Error('The full solution did not pass independent verification. No moves were made.');
        // Preserve the solver's verified incremental placements. Protecting all
        // incidental correct colors would merge these into very long stages.
        const stages=r.stages.map(s=>({...s,moveIndices:s.moveIndices.slice(),protectedNodes:s.protectedNodes.slice(),newlySolvedNodes:s.newlySolvedNodes.slice()}));
        autoJob={stages,goalSemantics:r.goalSemantics||'identity',completed:0,locked:new Set(r.initialProtectedNodes || stages[0]?.protectedNodes || []),paused:false,stopAfterStep:false,stopAfterTurn:false,gapUntil:0,totalMoves:r.moveIndices.length};
        updateSecured(); updateGoalCompletion(); observed=startKey;
        if (!stages.length) finishAuto(false); else beginAutoStage();
      } catch (error) { autoJob=null; execution=null; phase='selecting'; result=null; pair=[]; setSolverSpeed(false);reportAutoFailure('verification_error',error.message);sync(); }
    };
    const watch=stage=>{if(workerTimer!==null)clearTimeout(workerTimer);const loading=stage==='loading-model'||stage==='loading-cache';workerTimer=setTimeout(()=>receive({result:{status:'unknown',reason:loading?(stage==='loading-cache'?'cache_load_timeout':'model_load_timeout'):'time_limit'}}),loading?24000:maxMs+12000);};
    try {
      worker=new Worker(core.workerURL||new URL('constrained-solver-worker.js',scriptBase));
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
      worker.postMessage({task:'full-solve',id,modelId:api.puzzle,expectedRelease:core.assetRelease,snapshot:{...snapshot,history:[]},options:{maxMs,maxOutputMoves:20000}});
      return true;
    } catch (error) { receive({result:{status:'unknown',reason:'worker_unavailable',detail:error.message}}); return false; }
  }
  function beginAutoStage() {
    if (!autoJob) return;
    const snapshot=api.snapshot();
    if (!idle(snapshot) || tokenKey(mapping(snapshot)) !== observed) { interrupted('The puzzle changed between constrained steps. No further automatic moves were made.'); return; }
    if (autoJob.stopAfterStep || autoJob.stopAfterTurn) { finishAuto(true); return; }
    if (autoJob.completed >= autoJob.stages.length) { finishAuto(false); return; }
    hideAutoNotice();
    const stage=autoJob.stages[autoJob.completed], current=mapping(snapshot);
    for (const node of stage.protectedNodes) autoJob.locked.add(node);
    updateSecured();
    pair=[current.nodeToSticker[stage.sourceNode],current.nodeToSticker[stage.targetNode]].filter(id=>id!==undefined).map(String);
    captureReferences();
    execution={kind:'auto',stage,indices:stage.moveIndices,offset:0,chunkEnd:0,pending:false,expected:{...current.stickerToNode},original:{...current.stickerToNode},length:stage.moveIndices.length};
    window.PuzzleJournal?.beginSequence('Auto Solve · step '+(autoJob.completed+1));phase='executing';window.PuzzleSelection3D?.clearHover?.();
    setMessage('Solving · step ' + (autoJob.completed+1) + ' / ' + autoJob.stages.length + ' · ' + stage.moveIndices.length + ' moves'); sync(); runChunk();
  }
  function finishAuto(stopped) {
    const job=autoJob; if (!job) return;
    const progress=core.solvedProgress(model,api.snapshot());
    if (!stopped && progress.solvedCount !== progress.totalCount) { interrupted('Final solved-state verification failed. No further moves were made.'); return; }
    if (!stopped) held=new Set(progress.solvedStickerIds);
    const count=job.completed, moves=job.totalMoves;
    lastAutoStep=job.stages[count-1]?.moveIndices.length||0;
    autoJob=null; execution=null; pair=[]; phase='selecting'; observed=tokenKey(mapping(api.snapshot()));
    setSolverSpeed(false);
    setMessage(stopped ? 'Stopped at a completed step · '+held.size+' holds restored.' : 'Solved · '+count+' steps · '+moves+' moves.');
    if(exitToManual){exitToManual=false;autoRequested=false;returnToDefault=false;tool='hold';pairTarget=0;result=null;anchors=[];referencesDirty=true;enterManualDefaults();window.PuzzleAxisDisplay?.clear();window.PuzzleSelection3D?.clearHover?.();sync();return;}
    closePanel();
  }
  function stopAuto(toManual=false,gracefulOnly=false) {
    // Changing mode always finishes the stage. Only a repeated Stop request
    // escalates the existing graceful stop to the current primitive turn.
    if(toManual)exitToManual=true;else if(gracefulOnly)exitToManual=false;
    if(toManual&&phase==='loading'&&!model){autoRequested=false;exitToManual=false;hideAutoNotice();setSolverSpeed(false);enterManualDefaults();setMessage('Opening manual Constrained Solver…');sync();return;}
    if(autoRequested && (phase==='solving'||phase==='loading'||(toManual&&!autoJob))){if(toManual){epoch++;terminateWorker();autoRequested=false;autoJob=null;phase=model?'selecting':'unavailable';exitToManual=false;setSolverSpeed(false);enterManualDefaults();hideAutoNotice();setMessage('Planning stopped. Choose holds and a pair.');sync();}else cancelSearch();return;}
    if (!autoJob) return;
    if (phase==='auto-gap') { finishAuto(true);return; }
    if (!execution || autoJob.stopAfterTurn)return;
    if(autoJob.stopAfterStep&&!toManual&&!gracefulOnly){
      autoJob.stopAfterTurn=true;execution.stopAfterTurn=true;autoJob.paused=false;
      api.stopAfterCurrentMove?.();setMessage('Stopping after the current turn… Unfinished holds will be cleared.');sync();return;
    }
    autoJob.stopAfterStep=true;autoJob.paused=false;api.resumePlayback?.();
    setMessage(toManual?'Finishing this sequence, then opening Constrained Solver…':'Stopping after this sequence… Press Stop again to stop after the current turn.');sync();
  }
  function stopManual() {
    if(!manualStopActive())return false;
    if(phase==='executing'&&execution?.readyAt){execution=null;result=null;phase='selecting';clearManualPair();setSolverSpeed(false);setMessage(guidedSession?'Step canceled. The guided route is still ready.':'Swap canceled.');if(returnToDefault)closePanel();else sync();return true;}
    if(phase==='executing'&&execution){execution.stopAfterTurn=true;api.stopAfterCurrentMove?.();setMessage('Stopping after the current turn…');sync();return true;}
    if(phase==='loading'){closePanel();return true;}
    return cancelSearch();
  }
  function finishStoppedTurn(snapshot) {
    const job=execution;if(!job)return;
    const completed=Math.min(job.chunkEnd-job.offset,Math.max(0,Number(snapshot.sequence?.completed)||0));
    const expected={...(job.chunkOriginal||job.original)};
    for(const index of job.indices.slice(job.offset,job.offset+completed))for(const id of Object.keys(expected))expected[id]=model.moves[index].perm[expected[id]];
    if(!sameMap(mapping(snapshot).stickerToNode,expected)){interrupted('Stopped. The committed turn could not be verified; selections cleared.');return;}
    const count=job.offset+completed,wasAuto=!!autoJob,toManual=exitToManual;
    if(count===job.length){job.offset=count;job.pending=false;runChunk();return;}
    const text='Stopped after '+count+' / '+job.length+' moves. Holds cleared: the unfinished sequence may not have restored their colors.';
    window.PuzzleJournal?.endSequence();execution=null;autoJob=null;autoRequested=false;exitToManual=false;dropGuidance();
    held.clear();pair=[];pairTarget=0;result=null;anchors=[];referencesDirty=true;observed=tokenKey(mapping(snapshot));phase='selecting';tool='hold';
    lastManualStep=count;lastAutoStep=count;setSolverSpeed(false);if(wasAuto&&toManual)enterManualDefaults();window.PuzzleAxisDisplay?.clear();window.PuzzleSelection3D?.clearHover?.();
    setMessage(text);document.getElementById('message').textContent=text;
    if(returnToDefault||(wasAuto&&!toManual)){closePanel();return;}
    sync();
  }
  function interrupted(text) {window.PuzzleJournal?.endSequence(); window.PuzzleAxisDisplay?.clear();window.PuzzleSelection3D?.clearHover?.(); execution = null; autoJob=null;autoRequested=false;exitToManual=false;dropGuidance(); held.clear(); phase = 'selecting'; pair = []; anchors=[];referencesDirty=true; result = null; observed = null; setSolverSpeed(false); setMessage(text); if(returnToDefault){closePanel();return;}sync(); }
  function runChunk() {
    const job = execution; if (!job || phase !== 'executing') return;
    if(job.readyAt){if(performance.now()<job.readyAt)return;delete job.readyAt;window.PuzzleJournal?.beginSequence(job.kind==='guided'?'Guided step '+(guidedSession.completed+1):'Constrained swap');}
    try {
      const current = api.snapshot(); if (!idle(current)) return;
      if (!sameMap(mapping(current).stickerToNode, job.expected)) { interrupted('Playback was interrupted. The requested restoration is not confirmed.'); return; }
      if (job.offset >= job.length) {
        window.PuzzleJournal?.endSequence();
        const end = mapping(current).stickerToNode;
        if (job.kind === 'auto') {
          const restored=new Set([...job.stage.protectedNodes,...job.stage.newlySolvedNodes]);
          const colors=core.colorsFromSnapshot(model,current),homeId=new Map(Object.entries(model.homeBySticker).map(([id,node])=>[node,id]));
          const correct=node=>autoJob.goalSemantics==='colors'?colors[node]===model.colorBySticker[homeId.get(node)]:end[homeId.get(node)]===node;
          if([...restored].some(node=>!correct(node)))throw Error('Secured-node restoration check failed.');
          for (const node of restored) autoJob.locked.add(node);
          autoJob.completed++; updateSecured(); observed=tokenKey(mapping(current));
          window.PuzzleAxisDisplay?.clear();
          execution=null; pair=[]; phase='auto-gap'; autoJob.gapUntil=performance.now()+AUTO_GAP_MS;
          setMessage('Step '+autoJob.completed+' complete · '+held.size+' secured'); sync();
          if (autoJob.stopAfterStep || autoJob.stopAfterTurn) finishAuto(true);
          return;
        }
        if(job.kind==='guided'){
          if(!guidedSession)throw Error('Guided route was interrupted.');
          const restored=new Set([...guidedSession.locked,...job.stage.protectedNodes,...job.stage.newlySolvedNodes]);
          const colors=core.colorsFromSnapshot(model,current),homeId=new Map(Object.entries(model.homeBySticker).map(([id,node])=>[node,id]));
          const correct=node=>guidedSession.plan.goalSemantics==='colors'?colors[node]===model.colorBySticker[homeId.get(node)]:end[homeId.get(node)]===node;
          if(restored.size<=guidedSession.locked.size||[...restored].some(node=>!correct(node)))throw Error('Guided step did not increase restored holds.');
          guidedSession.locked=restored;guidedSession.completed++;syncGuidedHolds(current);observed=guidedSession.key;
          if(!guidedStage()&&(held.size!==model.stickerCount||core.solvedProgress(model,current).solvedCount!==model.stickerCount))throw Error('Guided final goal verification failed.');
          window.PuzzleAxisDisplay?.clear();lastManualStep=job.length;execution=null;phase='selecting';pair=[];pairTarget=0;result=null;tool='swap';anchors=[];referencesDirty=true;setSolverSpeed(false);
          setMessage(guidedStage()?'Step complete. More nodes secured; choose the next white rings.':'Goal reached. All nodes secured.');
          if(returnToDefault){closePanel();return;}sync();return;
        }
        const finalColors=job.request.holdSemantics==='color'?core.colorsFromSnapshot(model,current):null;
        const requestOK = Object.entries(job.original).every(([id,from]) => job.request.protected.includes(from) ? finalColors?finalColors[from]===job.request.colorByNode[from]:end[id] === from : from === job.request.swap[0] ? end[id] === job.request.swap[1] : from === job.request.swap[1] ? end[id] === job.request.swap[0] : true);
        if (!requestOK) throw Error('Final restoration check failed.');
        // Holds belong to locations. Replaced stickers inherit the hold; a held
        // swap endpoint intentionally adopts its new color when the pair clears.
        const finalMapping=mapping(current);
        held=new Set((job.heldNodes||job.request.protected).map(node=>finalMapping.nodeToSticker[node]).filter(id=>id!==undefined).map(String));
        observed = tokenKey(mapping(current)); const length = job.length;
        const optimal=!!result?.optimal;
        window.PuzzleAxisDisplay?.clear();
        lastManualStep = length; execution = null; phase = 'selecting'; pair=[];pairTarget=0;result=null;tool='swap';anchors=anchors.filter(a=>held.has(a.id)).map(a=>({...a,label:''}));referencesDirty=true;setSolverSpeed(false);
        if(returnToDefault){closePanel();return;}
        setMessage('Swap complete · ' + length + ' moves' + (optimal ? ' · shortest' : '')); sync(); return;
      }
      const indices = job.indices.slice(job.offset, job.offset + 300);
      job.chunkOriginal={...job.expected};
      const predicted = {...job.expected};
      for (const i of indices) for (const id of Object.keys(predicted)) predicted[id] = model.moves[i].perm[predicted[id]];
      if (!api.runMoves(indices.map(i => model.moves[i].engineMove), {label:job.kind==='auto' ? 'Auto Solve · constrained step ' + (autoJob.completed+1) : job.kind==='guided'?'Guided step '+(guidedSession.completed+1):'Constrained swap'})) { interrupted('The puzzle could not start playback. No further moves were made.'); return; }
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
    if (event.button > 0 || !active || isBusy() || goalPreview || !idle(api.snapshot())) return;
    event.preventDefault(); event.stopPropagation(); overlay.focus({preventScroll:true});
    pointerStart={x:event.clientX,y:event.clientY,id:hitAt(event)?.stickerId,pointer:event.pointerId,dragged:false};
    lasso=tool==='hold'&&!autoHold?[localPoint(event)]:null;
    overlay.setPointerCapture?.(event.pointerId);
  });
  overlay.addEventListener('pointerup', event => {
    const start=pointerStart, polygon=lasso; pointerStart=null; lasso=null; lastDraw='';
    if (!start || start.pointer!==event.pointerId) return;
    overlay.releasePointerCapture?.(event.pointerId);
    if (start.dragged && tool==='hold' && !autoHold && polygon?.length>=3 && active && !isBusy() && idle(api.snapshot())) {
      let added=0,removed=0; const ids=new Set(nodes().filter(n=>enclosed(n,polygon)).map(n=>n.stickerId));
      for (const id of ids) { if(held.delete(id))removed++;else{held.add(id);added++;} }
      if(ids.size)changedHolds();
      setMessage(ids.size ? added+' held · '+removed+' released' : 'No nodes changed'); sync();
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
  function syncNodeLabel() {
    if(focusId===null)return;
    const heldLabel=held.has(focusId)?', held. ':', not held. ';
    const goalHint=goalImprovingNodes().has(focusId)?(guidedSession?'Verified guided step: preserves solved holds and adds new ones. ':'Verified swap corrects at least one endpoint; other unheld colors may change. '):'';
    const action=tool==='none'?'Choose Select, Swap, or Auto first.':tool==='hold'?goalHint+'Enter to '+(held.has(focusId)?'release this node.':'hold this node.'):candidateReady(focusId)?goalHint+(guidedSession?'Guided step ready. ':'Verified swap ready. ')+'Enter to choose this tile.':guidedSession?'Choose a white-ringed tile for this step.':'No verified swap ready. Choose a bright tile.';
    overlay.setAttribute('aria-label',nodeName(focusId)+heldLabel+action);
  }
  function navigate(key) {
    const list = nodes(); if (!list.length) return;
    const current = list.find(n => n.stickerId === focusId) || list[0];
    const direction = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];
    const next = list.filter(n => n.stickerId !== current.stickerId).map(n => { const dx=n.x-current.x,dy=n.y-current.y,along=dx*direction[0]+dy*direction[1],across=Math.abs(dx*direction[1]-dy*direction[0]);return {n,along,score:Math.hypot(dx,dy)+across*2}; }).filter(x => x.along > 1).sort((a,b) => a.score-b.score)[0]?.n;
    focusId = (next || current).stickerId;syncNodeLabel();lastDraw = '';
  }
  // Capture only puzzle shortcuts while active. Camera controls and normal form
  // navigation keep their original behavior; inactive mode is a strict no-op.
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if(goalPreview&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setGoalPreview(false);return;}
    if(!active)return;
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
    if (target && (['cw','ccw','axisTurnCW','axisTurnCCW'].includes(target.id) || target.classList.contains('ring-key') || target.classList.contains('notation-key') || target.closest('#jumbleControls'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (['loading','solving','executing','auto-gap'].includes(phase) && target && (['randomize','solve','reset','undo','mirrorMode','advanced','advancedMode','jumbleMode'].includes(target.id) || target.classList.contains('notation-key') || target.closest('#jumbleControls'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (['randomize','reset'].includes(target?.id) && !target.disabled) closePanel();
  }, true);
  toggle.addEventListener('click', () => setActive(true));
  normalMode.addEventListener('click',()=>{if(!active)return;if(autoStopActive()){stopAuto(false,true);return;}if(phase==='executing'){returnToDefault=true;stopManual();return;}closePanel();}); hold.addEventListener('click', () => setTool('hold'));swap.addEventListener('click', () => setTool('swap'));
  clear.addEventListener('click', clearSelection); cancel.addEventListener('click', cancelSearch); retry.addEventListener('click', () => autoRequested ? autoSolve(30000) : canContinueSearch()&&startSearch(manualSearch.search.nextBudgetMs,true));
  suggestHolds.addEventListener('click',toggleAutoHolds);
  showGoal.addEventListener('pointerdown',event=>{if(event.button>0)return;event.preventDefault();if(setGoalPreview(true)){goalPointer=event.pointerId;showGoal.setPointerCapture?.(event.pointerId);}});
  const releaseGoalPointer=event=>{if(goalPointer!==null&&(event.pointerId===undefined||event.pointerId===goalPointer))setGoalPreview(false);};
  showGoal.addEventListener('pointerup',releaseGoalPointer);showGoal.addEventListener('pointercancel',releaseGoalPointer);showGoal.addEventListener('lostpointercapture',releaseGoalPointer);
  document.addEventListener('pointerup',releaseGoalPointer,true);document.addEventListener('pointercancel',releaseGoalPointer,true);
  showGoal.addEventListener('keydown',event=>{if(event.key!==' '&&event.key!=='Enter')return;event.preventDefault();if(!event.repeat&&setGoalPreview(true))goalKey=event.key;});
  const releaseGoalKey=event=>{if(goalKey&&event.key===goalKey){event.preventDefault();setGoalPreview(false);}};
  showGoal.addEventListener('keyup',releaseGoalKey);document.addEventListener('keyup',releaseGoalKey,true);
  showGoal.addEventListener('click',event=>event.preventDefault());showGoal.addEventListener('contextmenu',event=>event.preventDefault());showGoal.addEventListener('blur',()=>setGoalPreview(false));
  window.addEventListener('blur',()=>setGoalPreview(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)setGoalPreview(false);});
  autoNoticeReload.addEventListener('click',()=>{if(!execution)window.location?.reload?.();});autoNoticeRetry.addEventListener('click',()=>autoSolve(30000));autoNoticeDismiss.addEventListener('click',hideAutoNotice);
  aChip.addEventListener('click',()=>editPair(0));
  bChip.addEventListener('click',()=>editPair(1));
  function draw() {
    const b = rings.getBoundingClientRect(), list = nodes(), dpr = Math.min(window.devicePixelRatio || 1,2);
    const viewport=bridge.viewport?.(),goalHints=goalImprovingNodes();
    const blockedHover=tool==='swap' && hover!==null && !candidateReady(hover);
    overlay.style.cursor=goalPreview||tool==='none'?'default':isBusy()?'progress':blockedHover?'not-allowed':tool==='swap'?'pointer':'crosshair';
    overlay.title=tool==='none'?'Choose Select, Swap, or Auto to continue.':goalPreview?'Solved goal colors · release Show goal to resume.':blockedHover?'No verified swap ready with the current holds and selected tile':tool==='swap'?(hover!==null?(goalHints.has(hover)?(guidedSession?'Verified guided step preserves secured holds and adds new ones. ':'Verified swap corrects at least one endpoint; other unheld colors may change. '):candidateReady(hover)?'Verified sequence ready. ':'No verified swap ready. '):'')+'Choose '+(pairTarget?'2':'1')+' · click its card below to change the target':'Click or lasso to flip each node between held and not held';
    const key = JSON.stringify([b.width,b.height,viewport,anchors,phase,tool,goalPreview,[...held],[...goalHints],pair,pairTarget,hover,focusId,lasso,eligibility?.status,document.activeElement === overlay,list.map(n=>[n.stickerId,n.x,n.y,n.r,n.highlightLineWidth,n.highlightOuterRadius,n.highlighted])]); if (key === lastDraw) return; lastDraw = key;
    const pixelWidth=Math.max(1,Math.round(b.width*dpr)),pixelHeight=Math.max(1,Math.round(b.height*dpr));
    // Retain backing stores between moves: assigning even the same canvas
    // dimensions resets its context and can allocate another full bitmap.
    if(overlay.width!==pixelWidth)overlay.width=pixelWidth;if(overlay.height!==pixelHeight)overlay.height=pixelHeight;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,b.width,b.height);
    if(backdrop.width!==pixelWidth)backdrop.width=pixelWidth;if(backdrop.height!==pixelHeight)backdrop.height=pixelHeight;backCtx.setTransform(dpr,0,0,dpr,0,0);backCtx.clearRect(0,0,b.width,b.height);
    if(!goalPreview&&viewport?.scale>0)for(const a of anchors){
      const x=viewport.x+a.x*viewport.scale,y=viewport.y+a.y*viewport.scale,r=Math.max(4,a.r*viewport.scale)+7;
      backCtx.beginPath();backCtx.arc(x,y,r,0,Math.PI*2);backCtx.fillStyle='rgba(145,145,157,.18)';backCtx.fill();
      if(a.label){backCtx.font='700 12px system-ui';backCtx.textAlign='center';backCtx.textBaseline='middle';backCtx.fillStyle='#73737e';backCtx.fillText(a.label,x+Math.min(r+6,18),y-r-3);}
    }
    // Paint eligibility below every selection mark. A neighboring node may
    // overlap a numbered badge, so interleaving these layers can shade 1/2.
    for (const n of list) {
      if(goalPreview){
        // Opaque circles exactly cover the native node fills. Holds and pair
        // outlines remain legible; no readiness dimming obscures the goal.
        const color=n.goalColor||goalColors?.get(n.stickerId);
        ctx.beginPath();ctx.arc(n.x,n.y,Math.max(3,n.r||5)+.4,0,Math.PI*2);ctx.fillStyle=color||'#24252e';ctx.fill();
        if(!color){ctx.strokeStyle='#8b8c97';ctx.lineWidth=1.25;ctx.stroke();}
      }
      const choice=goalPreview?0:eligibilityCode(n.stickerId);
      if(choice===2 || choice===3){
        ctx.beginPath();ctx.arc(n.x,n.y,Math.max(3,n.r||5)+1,0,Math.PI*2);ctx.fillStyle='rgba(20,21,29,.78)';ctx.fill();
      }
    }
    // On small screens the minimum eligibility-mask radius may extend into
    // a neighboring selected node. Clear only these two native-color disks;
    // do not repaint colors, which may represent mirror mode or a moving tile.
    if(!goalPreview)for(const n of list){if(!pair.includes(n.stickerId))continue;const r=Math.max(3,n.r||5)+.4;ctx.save();ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.clip();ctx.clearRect(n.x-r,n.y-r,r*2,r*2);ctx.restore();}
    const endpointLabels=[];
    for (const n of list) {
      if(goalPreview&&n.goalColor)continue;
      const fixed = held.has(n.stickerId), index = pair.indexOf(n.stickerId), hot = hover === n.stickerId, focused = document.activeElement === overlay && focusId === n.stickerId, improving=goalHints.has(n.stickerId);
      if (!fixed && index < 0 && !hot && !focused && !improving) continue;
      const nodeRadius = Math.max(3,n.r || 5), nativeWidth = Number.isFinite(n.highlightLineWidth) && n.highlightLineWidth > 0 ? n.highlightLineWidth : 2.2;
      const nativeOuter = Number.isFinite(n.highlightOuterRadius) ? Math.max(nodeRadius,n.highlightOuterRadius) : nodeRadius;
      const radius = nodeRadius + 3;
      const heldRadius = nativeOuter + nativeWidth + 2;
      const selectedRadius = fixed ? Math.max(radius,heldRadius + nativeWidth/2 + 4.4) : radius;
      if (fixed) {
        // A selected held node keeps its dashed classification, surrounded by
        // a separate thicker numbered endpoint circle.
        const outerRadius = heldRadius;
        ctx.setLineDash([nativeWidth * 2, nativeWidth * 1.25]);
        ctx.beginPath(); ctx.arc(n.x,n.y,outerRadius,0,Math.PI*2);
        ctx.lineWidth=nativeWidth; ctx.strokeStyle='#ffffff'; ctx.stroke(); ctx.setLineDash([]);
      }
      if (index >= 0 || improving || (!fixed && (hot || focused))) {
        ctx.beginPath(); ctx.arc(n.x,n.y,index>=0||improving?selectedRadius:radius,0,Math.PI*2); ctx.lineWidth=index>=0?4.8:improving?Math.max(3.2,nativeWidth*2):1.3; ctx.strokeStyle=index>=0||improving?'#ffffff':'#f5f5f5'; ctx.stroke();
      }
      if (index >= 0) endpointLabels.push({x:Math.max(10,Math.min(b.width-10,n.x+selectedRadius+7)),y:Math.max(10,Math.min(b.height-10,n.y-selectedRadius-6)),label:index?'2':'1'});
      // The solid hover/focus outline above keeps keyboard focus distinct from
      // the dashed held-node symbol; an unheld node never gets a dashed circle.
    }
    // Number badges are the top selection layer, above neighboring node
    // eligibility masks and held/hover outlines in dense ring maps.
    for(const {x,y,label} of endpointLabels){ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();ctx.lineWidth=1.25;ctx.strokeStyle='#111111';ctx.stroke();ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#171820';ctx.fillText(label,x,y+.4);}
    if(lasso?.length>1 && pointerStart?.dragged){ctx.beginPath();lasso.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);}
  }
  function frame() {
    captureGoalPalette();
    if(mirrorActive()&&(goalPreview||goalRequested))setGoalPreview(false);
    if(goalPreview&&goalNeedsPalette&&localGoal)goalColors=localGoalTargets();
    if(goalPreview&&!active){if(!idle(api.snapshot()))setGoalPreview(false);else draw();}
    syncGoalAvailability();
    if (active) {
      try {
        const snap = api.snapshot();
        if(completionMirror!==mirrorActive())updateGoalCompletion();
        if(goalPreview&&!idle(snap))setGoalPreview(false);
        updateStepProgress(snap);updateSearchProgress();
        if (phase === 'executing' && autoJob) { const paused=!!snap.paused;if(autoJob.paused!==paused){autoJob.paused=paused;sync();} }
        if (phase === 'executing' && execution?.stopAfterTurn && idle(snap)) finishStoppedTurn(snap);
        else if (phase === 'executing' && execution?.readyAt && performance.now() >= execution.readyAt) runChunk();
        else if (phase === 'executing' && execution?.pending && idle(snap)) { execution.offset = execution.chunkEnd; execution.pending = false; runChunk(); }
        else if (phase === 'auto-gap' && autoJob && !autoJob.paused && performance.now() >= autoJob.gapUntil) beginAutoStage();
        else if (phase === 'selecting' && model && idle(snap)) {
          const now = tokenKey(mapping(snap));
          if (observed !== null && observed !== now) { dropGuidance();discardManualSearch();held.clear(); pair=[]; result=null; autoRequested=false; lastManualStep=0;anchors=[];referencesDirty=true; setMessage('Puzzle changed · selections cleared.'); sync(); }
          observed = now;
        }
        if(referencesDirty && idle(snap) && phase==='selecting')captureReferences();
        draw();
      } catch (error) { if (phase === 'executing' || phase === 'auto-gap') interrupted('Playback could not be verified: ' + error.message); else if (phase !== 'loading') { terminateWorker();epoch++;phase='unavailable';setSolverSpeed(false);window.PuzzleAxisDisplay?.clear();setMessage(error.message);sync(); } }
    }
    requestAnimationFrame(frame);
  }
  window.ConstrainedSolverUI = Object.freeze({blocksManualMoves:()=>active||goalPreview||goalRequested,journalBusy:()=>goalPreview||goalRequested||autoRequested||!!autoJob||['loading','solving','executing','auto-gap'].includes(phase),setActive,closePanel,selectNode,canSelect3D,setTool,suggestHolds:suggestCurrentHolds,setGoalPreview,clearSelection,autoSolve,startAutoSolve:autoSolve,go:()=>startSearch(3000),stopAuto,autoStopActive,stop:stopManual,stopManualAfterStep:stopManual,manualStopActive,syncTransport,cancel:cancelSearch,visualState:()=>({active,...(autoStopActive()?{auto:true}:{}),...(goalPreview?{goalPreview:true}:{}),held:[...held],pair:pair.slice()}),state:()=>({active,tool,phase,pairTarget,goalPreview,holdMode:autoHold?'auto':manualHoldSelected?'manual':'none',autoHold,autoHolds:autoHoldsPending,guided:guidedSession?{stage:guidedSession.completed,completed:guidedSession.completed,totalStages:guidedSession.plan.stages.length,lockedNodes:[...guidedSession.locked],choices:guidedChoices()}:null,held:[...held],effectiveHeld:effectiveHeld(),pair:pair.slice(),anchors:anchors.map(a=>({...a})),status:message,eligibility:{status:eligibility?.status||'idle',goalImproving:[...goalImprovingNodes()],ready:nodes().filter(n=>eligibilityCode(n.stickerId)===1).map(n=>n.stickerId),uncertain:nodes().filter(n=>eligibilityCode(n.stickerId)===3).map(n=>n.stickerId),blocked:nodes().filter(n=>eligibilityCode(n.stickerId)===2).map(n=>n.stickerId),dimmed:nodes().filter(n=>eligibilityCode(n.stickerId)>=2).map(n=>n.stickerId)},result:result?{status:result.status,optimal:!!result.optimal}:null,search:manualSearch?{...manualSearch.search}:null,executed:execution?.offset || 0,total:execution?.length || 0,auto:autoJob?{active:true,stage:autoJob.completed,completed:autoJob.completed,totalStages:autoJob.stages.length,lockedNodes:[...autoJob.locked],paused:autoJob.paused,stopRequested:autoJob.stopAfterTurn?'turn':autoJob.stopAfterStep?'sequence':null,gapUntil:autoJob.gapUntil}:null})});
  sync(); requestAnimationFrame(frame);
})();
