/* Ring controls, camera, legal seeded sequences, and Atlas integration. */
(function(){
'use strict';
const $=id=>document.getElementById(id),type=document.body.dataset.puzzle,E=HelicopterEngine,model=E.create(type),G=FaceGroupedRings.create(model),TAU=Math.PI*2;
const rings=$('rings'),cube=$('cube'),rc=rings.getContext('2d'),cc=cube.getContext('2d');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>v.map(x=>x/Math.hypot(...v));
const center=points=>points.reduce((a,p)=>a.map((v,i)=>v+p[i]/points.length),[0,0,0]),ease=t=>t*t*(3-2*t);
let history=[],journal=[],selected=model.configs[0].id,userTurns=0,seed=null,seedCounter=0,mode='idle',queue=[],animation=null,paused=false,pauseAt=0,sequenceTotal=0,sequenceDone=0,stopRequested=false,dirty=true,ringFocused=true,pieceLabels=false;
const homeView={yaw:-.62,pitch:.48,zoom:1};
let view={...homeView},ringDrag=null,ringViewport={cx:0,cy:0,scale:1},faceTargets=[],ringDots=[],ringAxisTargets=[],cubePointers=new Map(),pinchDistance=0;
let sizes={rings:{w:500,h:460},cube:{w:500,h:460}};
let inspectedPiece=null;const SCRAMBLE_LENGTH=35;let advanced=false,mirrorMode=false;
function normalize(move){return model.normalizeMove(move);}
const invert=move=>model.invertMove(move),label=move=>model.moveLabel(move);
function locked(){return !!animation||mode!=='idle';}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
function freshSeed(){seedCounter++;const bytes=new Uint32Array(3);if(globalThis.crypto&&crypto.getRandomValues)crypto.getRandomValues(bytes);else{bytes[0]=Date.now()>>>0;bytes[1]=(Math.random()*4294967296)>>>0;bytes[2]=seedCounter;}return Array.from(bytes,n=>n.toString(16).padStart(8,'0')).join('-').toUpperCase()+'-'+seedCounter;}
let scrambleSpeedActive=false,sequenceDefaultsActive=false;
function restorePlaybackDefaults(options={}){
 sequenceDefaultsActive=false;scrambleSpeedActive=false;if(options.preserveSettings)return;const changed=$('speed').value!=='3';$('speed').value='3';$('speedText').textContent='Normal';window.PuzzlePlaybackControls.syncSpeed();if(changed)window.PuzzleFeedback?.pulse?.($('speed'));
 window.PuzzleAxisDisplay?.resetDefaults?.({pulse:true});window.PuzzleSelection3D?.clearHover?.();
}
function updateUI(){
 if(sequenceDefaultsActive&&!locked()&&!window.ConstrainedSolverUI?.journalBusy?.()&&!window.PuzzleJournal?.isReplaying?.())restorePlaybackDefaults();
 const busy=locked(),solved=isSolved(),edges=model.pieces.filter(p=>p.kind==='corner'),cubeShape=model.isCubeShape(),showMap=cubeShape&&!(animation&&animation.shapeChanging);
 $('ringPanel').hidden=!showMap;document.body.classList.toggle('mirror-active',mirrorMode);document.body.classList.toggle('rings-unavailable',!showMap);$('advanced').setAttribute('aria-pressed',String(advanced));$('advanced').textContent=advanced?'Jumbling on':'Advanced jumbling';$('advanced').disabled=busy;$('mirrorMode').hidden=!advanced;$('mirrorMode').setAttribute('aria-pressed',String(mirrorMode));$('jumbleControls').hidden=!advanced;$('jumbleAxisName').textContent=selected;$('pieceLabels').hidden=false;$('identityMetric').hidden=mirrorMode;document.querySelectorAll('.jumble-axis').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.face===(window.PuzzleAxisDisplay?.selection(selected,animation)||null)));b.textContent=b.dataset.face+(model.cutState(b.dataset.face).legal?'':' · blocked');});
 $('jumbleNote').textContent=advanced?(cubeShape?'Select an edge, then choose an alignment stop. Some turns change the shape.':'Shape changed · the face map returns when the puzzle is cubic. Blocked edges cannot turn.'):'Standard mode · 180° edge turns preserve the cube shape.';
 document.querySelectorAll('.stop-key').forEach(b=>{const current=model.axisStops[selected];b.disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.()||+b.dataset.stop===current||!model.cutState(selected).legal;b.setAttribute('aria-pressed',String(+b.dataset.stop===current));});
 $('status').className='status'+(busy?' busy':solved?'':' mixed');$('status').textContent=busy?(mode==='solve'?'✦ Solving':mode==='scramble'?'⤨ Scrambling':mode==='algorithm'?'↻ Solving':'↻ Turning'):(solved?'● Solved':'● In play');
 $('selectedName').textContent=window.PuzzleAxisDisplay?.selection(selected,animation)||'Select axis';$('selectedName').title=model.configById[selected].name;$('moveCount').textContent=userTurns;$('solvedFaces').textContent=edges.filter(p=>p.home.every((x,i)=>Math.abs(x-p.pos[i])<1e-7)).length+' / '+edges.length;
 $('pieceLabels').setAttribute('aria-pressed',String(pieceLabels));$('pieceLabels').textContent=pieceLabels?'Hide tile labels':'Show tile labels';
 $('ringFocus').textContent=ringFocused?'Show all rings':'Focus rings';$('ringFocus').setAttribute('aria-pressed',String(ringFocused));
 document.querySelectorAll('.ring-key').forEach(b=>{b.classList.toggle('active',b.dataset.face===(window.PuzzleAxisDisplay?.selection(selected,animation)||null));b.setAttribute('aria-pressed',String(b.dataset.face===(window.PuzzleAxisDisplay?.selection(selected,animation)||null)));b.disabled=busy||!model.cutState(b.dataset.face).legal;b.title=b.dataset.face+' edge'+(model.cutState(b.dataset.face).legal?'':' · blocked by crossing pieces');});
 document.querySelectorAll('.notation-key').forEach(b=>b.disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.()||!model.cutState(b.dataset.face).legal);
 for(const id of ['ccw','cw'])$(id).disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.()||!window.PuzzleAxisDisplay?.selection(selected,animation)||!model.cutState(selected).legal;$('randomize').disabled=busy;
 $('solve').disabled=busy||solved;$('undo').disabled=busy||!history.length;$('copy').disabled=!journal.some(j=>j.move);
 $('pause').hidden=mode==='idle';$('pause').textContent='Stop';$('pause').disabled=false;
 $('cw').title=label({face:selected,dir:G.getRing(selected).cwDir||1})+' · clockwise looking inward along the selected axis';$('ccw').title=label({face:selected,dir:-(G.getRing(selected).cwDir||1)})+' · counterclockwise looking inward along the selected axis';
 $('cubeNote').textContent='Every dot is one real sticker, shown once in its own color. Solved face colors form groups. Connected rings show the sticker paths for every axis. Click any ring to select it, then drag along its path to turn. Click a dot to inspect its piece and orientation.';updateInspector();
 dirty=true;window.ConstrainedSolverUI?.syncTransport?.();window.PuzzleJournal?.sync?.();
}
function isSolved(){return mirrorMode?model.isCubeShape():model.isSolved();}
function setSelected(id){if(!model.configById[id])return;selected=id;window.PuzzleAxisDisplay?.choose?.(id);ringDrag=null;updateUI();}
function clearJournal(){journal=[];$('log').replaceChildren();}
function addLabel(text){if(window.PuzzleJournal){journal=window.PuzzleJournal.label(text);return;}if(!journal.length)$('log').replaceChildren();journal.push({label:text});const el=document.createElement('div');el.className='log-label';el.textContent=text;$('log').appendChild(el);}
function addMove(move,source){
 if(window.PuzzleJournal){journal=window.PuzzleJournal.record(move,source);return;}
 if(!journal.length)$('log').replaceChildren();$('log').querySelectorAll('.current').forEach(n=>n.classList.remove('current'));journal.push({move:{...move},source});
 const el=document.createElement('span');el.className='move current'+(source==='solve'?' solve':'');const n=document.createElement('span');n.className='move-index';n.textContent=journal.filter(j=>j.move).length;el.append(n,document.createTextNode(label(move)));$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight;
}
// Explicit puzzle turns always honor the speed chosen in this control.
function duration(){return window.PuzzlePlaybackControls.duration(+$('speed').value);}
function beginMove(move,source){window.PuzzleSelection3D?.clearHover?.();if(source!=='manual')window.PuzzleAxisDisplay?.clear?.();const m=normalize(move);if(!model.legalMove(m))return false;selected=m.face;if(source==='manual')window.PuzzleAxisDisplay?.choose?.(m.face);ringDrag=null;animation={move:m,source,start:performance.now(),duration:duration(),shapeChanging:!model.isCubeShape()||Math.abs(m.turns-1)>1e-7};updateUI();resize();return true;}
function manual(move){if(locked()||window.ConstrainedSolverUI?.blocksManualMoves?.())return false;if(!model.legalMove(move)){toast('That edge is blocked by a crossing piece.');return false;}return beginMove(move,'manual');}
function finishMove(){
 const a=animation;model.applyMove(a.move);animation=null;
 if(a.source==='solve'||a.source==='undo'||a.source==='journal-undo')history.pop();else history.push({...a.move});
 if(a.source==='manual'||a.source==='algorithm')userTurns++;if(a.source==='undo')userTurns=Math.max(0,userTurns-1);if(a.source==='journal-undo'||a.source==='journal-redo')userTurns=Math.max(0,userTurns+window.PuzzleJournal.replayTurnDelta());addMove(a.move,a.source);
 if(stopRequested){
  if(mode!=='idle')sequenceDone++;
  mode='idle';paused=false;stopRequested=false;
  $('message').textContent='Stopped after completing the current move. Remaining moves were canceled.';
  updateUI();return;
 }
 if(mode!=='idle'){
  sequenceDone++;$('message').textContent=(mode==='solve'?'Solving':mode==='algorithm'?'Applying moves':'Scrambling')+' · '+sequenceDone+' / '+sequenceTotal+' · '+label(a.move);
  if(!queue.length){const finished=mode;mode='idle';paused=false;
   $('message').textContent=finished==='solve'?(isSolved()?'Solved. Reversed '+sequenceTotal+' recorded moves.':'Sequence complete.'):finished==='algorithm'?'Move sequence complete. Every turn is in the journal.':'Scramble ready. '+sequenceTotal+' legal turns from solved — your move.';
   if(finished==='solve'&&isSolved()){$('logTitle').textContent='Move journal · solved';toast('Solved — every move is printed in the journal.');}
  }
 }else $('message').textContent=isSolved()?'Solved. Every piece is back in place.':a.source==='undo'?'Undid the last recorded turn.':'Played '+label(a.move)+'.';
 updateUI();resize();
}
function startSequence(moves,kind){sequenceDefaultsActive=kind!=='journal-undo'&&kind!=='journal-redo';if(kind==='scramble'){scrambleSpeedActive=true;window.PuzzleAxisDisplay?.setLabelMode?.('none',{resetSpeed:true});$('speed').value='5';$('speedText').textContent='Fast';window.PuzzlePlaybackControls.syncSpeed();window.PuzzleFeedback?.pulse?.($('speed'));}stopRequested=false;mode=kind;queue=moves.map(normalize);sequenceTotal=queue.length;sequenceDone=0;paused=false;if(queue.length)beginMove(queue.shift(),kind);else{mode='idle';updateUI();}}
function randomize(){if(locked())return false;seed=freshSeed();const scrambleMoves=(advanced?model.jumbleScramble(seed,25):model.scramble(seed,SCRAMBLE_LENGTH));addLabel('Scramble · '+scrambleMoves.length+' legal turns');$('seedLabel').textContent='Fresh seed · continues current state';$('seed').textContent=seed;window.PuzzleJournal?.setSeed?.(seed);$('logTitle').textContent='Move journal';$('message').textContent='Scrambling the current position…';startSequence(scrambleMoves,'scramble');return true;}
function solve(){if(locked()||isSolved())return false;const solver=window.ConstrainedSolverUI;if(!solver||typeof solver.autoSolve!=='function'){toast('Constrained Solver is unavailable. Reload this puzzle to try again.');return false;}return solver.autoSolve();}
function reset(){restorePlaybackDefaults();window.PuzzleJournal?.reset?.();animation=null;queue=[];mode='idle';paused=false;sequenceTotal=0;sequenceDone=0;stopRequested=false;ringDrag=null;model.reset();history=[];userTurns=0;seed=null;clearJournal();$('log').innerHTML='<span class="empty">Your moves will appear here. Try a ring or press Randomize.</span>';$('seedLabel').textContent='Start solved, or try a new scramble.';$('seed').textContent='NO SEED YET';$('logTitle').textContent='Move journal';$('message').textContent='Reset to solved.';updateUI();resize();return true;}
// Cancel queued turns while committing the active turn at its exact legal endpoint.
function stopAfterCurrentMove(){
 if(!animation&&mode==='idle')return false;
 queue=[];stopRequested=true;
 if(paused){if(animation)animation.start+=performance.now()-pauseAt;paused=false;}
 if(!animation){mode='idle';stopRequested=false;$('message').textContent='Stopped at a legal move boundary.';}
 updateUI();return true;
}
function stopScrambleNow(){if(mode!=='scramble')return false;return stopPlaybackNow();}

function resumePlayback(){if(paused){if(animation)animation.start+=performance.now()-pauseAt;paused=false;updateUI();}}
function stopPlaybackNow(){
 if(!animation&&mode==='idle'&&!window.PuzzleJournal?.isReplaying?.())return false;
 const replaying=window.PuzzleJournal?.isReplaying?.(),scrambling=mode==='scramble';
 // Rendering interpolates an uncommitted turn; its pre-turn state remains exact.
 // Preserve the journal cursor and future so replay can resume from this boundary.
 animation=null;queue=[];mode='idle';paused=false;stopRequested=false;ringDrag=null;
 window.PuzzleJournal?.stopReplay?.();restorePlaybackDefaults({preserveSettings:!!replaying});
 $('message').textContent=(replaying?'Journal playback':scrambling?'Randomizing':'Sequence')+' stopped at the last completed turn. The unfinished turn was canceled.';
 updateUI();return true;
}
function stopPlayback(){const ui=window.ConstrainedSolverUI;if(ui?.autoStopActive?.())return ui.stopAuto();if(ui?.manualStopActive?.())return ui.stop();return stopPlaybackNow();}
function resize(){for(const [name,canvas]of [['rings',rings],['cube',cube]]){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);sizes[name]={w:b.width,h:b.height};canvas.width=Math.max(1,Math.round(b.width*dpr));canvas.height=Math.max(1,Math.round(b.height*dpr));canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}dirty=true;}
function currentSlot(piece){if(!model.isCubeShape())return 'jumbled';if(piece.kind==='corner')return model.positionName(piece.pos);const normal=model.mesh(piece).stickers[0].normal,face=model.faces.find(f=>Math.hypot(...f.normal.map((x,i)=>x-normal[i]))<1e-6);return face?face.id+model.positionName(piece.pos.map((v,i)=>Math.abs(normal[i])>.5?0:v)).toLowerCase():'jumbled';}
function updateInspector(){
 const el=$('pieceInfo');if(!el)return;const piece=model.pieces.find(p=>p.id===inspectedPiece);
 if(!piece){el.textContent=pieceLabels?'Map labels identify each sticker’s piece. Click a dot for its full identity and orientation.':'Click a colored dot to inspect its piece.';return;}
 const name=piece.name||ShapeRenderer.slotName(piece.home),slot=currentSlot(piece),ori=piece.orientation,names=['R','U','F'];
 const axisName=v=>v[0]>.5?'R':v[0]<-.5?'L':v[1]>.5?'U':v[1]<-.5?'D':v[2]>.5?'F':'B';
 const frame=model.isCubeShape()?names.map((name,j)=>name+'→'+axisName(ori.map(row=>row[j]))).join(' · '):'Shape changed';
 const orientation=piece.home.every((v,i)=>Math.abs(v-piece.pos[i])<1e-6)?'home slot':piece.kind;
 el.textContent=name+' → '+slot+' · '+(typeof orientation==='string'?orientation:JSON.stringify(orientation))+' · frame '+frame;
}
// Read-only overlay bridge: these are the exact marks from the existing draw pass.
let solverRingNodes=[];
window.PUZZLE_SOLVER_BRIDGE=Object.freeze({
 isBusy:locked,
 inspectNode:id=>{if(mirrorMode)return '';const sticker=model.stickerState.find(s=>String(s.id)===String(id)),el=$('pieceInfo');if(!sticker||!el)return '';const previous=inspectedPiece,text=el.textContent;try{inspectedPiece=sticker.piece;updateInspector();return el.textContent;}finally{inspectedPiece=previous;el.textContent=text;}},
 axesForNode:id=>{const sticker=model.stickerState.find(s=>String(s.id)===String(id));if(!sticker)return [];return model.configs.filter(c=>(!model.legalMove||model.legalMove({face:c.id,dir:1}))&&model.movingPieces({face:c.id,dir:1}).some(piece=>String(piece)===String(sticker.piece))).map(c=>c.id);},
 viewport:()=>({x:ringViewport.ox??ringViewport.cx??0,y:ringViewport.oy??ringViewport.cy??0,scale:ringViewport.scale}),
 nodes:()=>solverRingNodes.map(node=>({...node})),
 tileLabelsAvailable:()=>false,
 tileLabelsOn:()=>pieceLabels,
 setTileLabels:on=>{pieceLabels=false;$('pieceLabels').setAttribute('aria-pressed',String(pieceLabels));$('pieceLabels').textContent=pieceLabels?'Hide tile labels':'Show tile labels';dirty=true;},
 refreshControls:updateUI,
 requestRender:()=>{dirty=true;}
});
function drawRings(progress){
 solverRingNodes=[];
 if(!(sizes.rings.w>40&&sizes.rings.h>40))return;
 if($('ringPanel').hidden)return;
 const result=G.render(rc,{width:sizes.rings.w,height:sizes.rings.h,selected,focus:ringFocused,mirrorMode,animation:animation?{move:animation.move,progress}:null,pieceLabels,inspectedPiece:typeof inspectedPiece==='undefined'?null:inspectedPiece});ringViewport=result.viewport;ringDots=result.dots;ringAxisTargets=result.axisLabels||[];
 solverRingNodes=result.dots.map(d=>({stickerId:String(d.sticker),x:ringViewport.cx+d.x*ringViewport.scale,y:ringViewport.cy+d.y*ringViewport.scale,r:d.r*ringViewport.scale,color:d.color,reference:!!d.reference,highlighted:!!d.highlighted,highlightLineWidth:d.highlightLineWidth||2.2,highlightOuterRadius:d.r*ringViewport.scale}));
}
function drawCube(progress){const result=HelicopterRenderer.render(cc,model,{canvas:cube,width:sizes.cube.w,height:sizes.cube.h,selected,view,pieceLabels,mirrorMode,animation:animation?{move:animation.move,progress}:null});faceTargets=result.targets;}
function frame(now){let t=0;if(animation){t=clamp(((paused?pauseAt:now)-animation.start)/animation.duration,0,1);if(t>=1&&!paused){finishMove();if(mode!=='idle'&&queue.length)beginMove(queue.shift(),mode);t=0;}dirty=true;}if(dirty){drawRings(ease(t));drawCube(ease(t));dirty=false;}requestAnimationFrame(frame);}
// Twelve edge axes grouped by their position around the cube.
for(const pair of [['UF','UR','UB','UL'],['DF','DR','DB','DL'],['FR','BR','BL','FL']]){const group=document.createElement('div');group.className='axis-row';const title=document.createElement('span');title.className='axis-label';title.textContent=pair[0][0]==='U'?'Upper edges':pair[0][0]==='D'?'Lower edges':'Side edges';const buttons=document.createElement('div');buttons.className='axis-buttons';for(const face of pair){const b=document.createElement('button');b.type='button';b.className='ring-key';b.dataset.face=face;b.textContent=face;b.title='Select '+face+' edge';b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>setSelected(face));buttons.appendChild(b);}group.append(title,buttons);$('selector').appendChild(group);}
window.PuzzlePlaybackControls.installNotation({faces:model.configs.map(config=>config.id),onMove:manual});
$('pieceLabels').addEventListener('click',()=>{pieceLabels=false;updateUI();});
$('ringFocus').addEventListener('click',()=>{ringFocused=!ringFocused;updateUI();});$('faceView').addEventListener('click',()=>{const n=model.configById[selected].normal;view.yaw=-Math.atan2(n[0],n[2]);view.pitch=Math.atan2(n[1],Math.hypot(n[0],n[2]));dirty=true;});
$('homeView').addEventListener('click',()=>{view={...homeView};dirty=true;});$('ccw').addEventListener('click',()=>manual({face:selected,dir:-(G.getRing(selected).cwDir||1)}));$('cw').addEventListener('click',()=>manual({face:selected,dir:G.getRing(selected).cwDir||1}));$('randomize').addEventListener('click',randomize);$('solve').addEventListener('click',solve);$('reset').addEventListener('click',reset);$('pause').addEventListener('click',stopPlayback);$('undo').addEventListener('click',()=>window.PuzzleJournal?.navigate(-1,false));
$('speed').addEventListener('input',()=>{$('speedText').textContent=['','Slow','Gentle','Normal','Quick','Fast'][+$('speed').value];if(animation){const clock=paused?pauseAt:performance.now(),progress=clamp((clock-animation.start)/animation.duration,0,1),next=duration()*(animation.move.turns===2?1.35:1);animation.start=clock-progress*next;animation.duration=next;}dirty=true;});
$('copy').addEventListener('click',async()=>{const text=journal.map(j=>j.label?'\n'+j.label+':':label(j.move)).join(' ').trim();try{await navigator.clipboard.writeText(text);toast('Moves copied.');}catch(_){const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();toast(copied?'Moves copied.':'Copy is unavailable in this browser.');}});
function nearestRingAt(p){const x=ringViewport.cx+p.x*ringViewport.scale,y=ringViewport.cy+p.y*ringViewport.scale,label=ringAxisTargets.find(t=>Math.hypot(x-t.x,y-t.y)<=t.r+3);return label?{ring:G.getRing(label.id),distance:0}:G.nearestRing(p,window.PuzzleAxisDisplay?window.PuzzleAxisDisplay.selection(selected,animation):selected);}
function ringPoint(e){const b=rings.getBoundingClientRect();return{x:(e.clientX-b.left-ringViewport.cx)/ringViewport.scale,y:(e.clientY-b.top-ringViewport.cy)/ringViewport.scale};}
rings.addEventListener('pointerdown',e=>{if(locked()||e.button>0)return;const p=ringPoint(e),hit=ringDots.map(d=>({...d,d:Math.hypot(p.x-d.x,p.y-d.y)})).filter(d=>d.d<d.r+3/ringViewport.scale).sort((a,b)=>a.d-b.d)[0];if(hit){inspectedPiece=hit.id;updateInspector();dirty=true;}
 const nearest=nearestRingAt(p);if(!nearest||nearest.distance*ringViewport.scale>15){window.PuzzleAxisDisplay?.clear?.();ringDrag=null;dirty=true;return;}const r=nearest.ring;setSelected(r.face);ringDrag={pointer:e.pointerId,ring:r,angle:G.dragAngle(p,r),total:0};rings.setPointerCapture(e.pointerId);rings.focus({preventScroll:true});dirty=true;});
rings.addEventListener('pointermove',e=>{if(!ringDrag){if(!locked()&&!window.ConstrainedSolverUI?.visualState?.().active){const near=nearestRingAt(ringPoint(e));window.PuzzleAxisDisplay?.hover?.(near&&near.distance*ringViewport.scale<12?near.ring.face:null);}return;}if(ringDrag.pointer!==e.pointerId)return;const p=ringPoint(e),r=ringDrag.ring,angle=G.dragAngle(p,r);if(!Number.isFinite(angle))return;ringDrag.total+=((angle-ringDrag.angle+Math.PI+TAU)%TAU)-Math.PI;ringDrag.angle=angle;dirty=true;});
rings.addEventListener('pointerleave',()=>window.PuzzleAxisDisplay?.hover?.(null));
function endRing(e,cancel){if(!ringDrag||ringDrag.pointer!==e.pointerId)return;const delta=ringDrag.total,r=ringDrag.ring;ringDrag=null;dirty=true;if(!cancel&&Math.abs(delta)>.20)manual({face:r.face,dir:delta>0?1:-1});}
for(const name of ['pointerup','pointercancel','lostpointercapture'])rings.addEventListener(name,e=>endRing(e,name!=='pointerup'));
cube.addEventListener('pointerdown',e=>{if(e.button>0)return;window.PuzzleSelection3D?.clearHover?.(cube);cubePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});cube.setPointerCapture(e.pointerId);cube.focus({preventScroll:true});if(cubePointers.size===2){cubePointers.forEach(p=>p.moved=true);const[a,b]=[...cubePointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
cube.addEventListener('pointermove',e=>{const old=cubePointers.get(e.pointerId);if(!old){const b=cube.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;if(locked()||faceTargets.some(f=>Math.hypot(x-f.x,y-f.y)<(f.r||15)+3))window.PuzzleSelection3D?.clearHover?.(cube);else window.PuzzleSelection3D?.hover?.(cube,x,y);return;}window.PuzzleSelection3D?.clearHover?.(cube);const next={x:e.clientX,y:e.clientY,startX:old.startX,startY:old.startY,moved:old.moved||Math.hypot(e.clientX-old.startX,e.clientY-old.startY)>6};cubePointers.set(e.pointerId,next);if(cubePointers.size===2){const[a,b]=[...cubePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)view.zoom=clamp(view.zoom*d/pinchDistance,.55,1.9);pinchDistance=d;}else{view.yaw+=(next.x-old.x)*.009;view.pitch=clamp(view.pitch+(next.y-old.y)*.009,-Math.PI/2,Math.PI/2);}dirty=true;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])cube.addEventListener(name,e=>{const p=cubePointers.get(e.pointerId);if(name==='pointerup'&&p&&!p.moved&&cubePointers.size===1&&!locked()){const b=cube.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,hit=faceTargets.find(f=>Math.hypot(x-f.x,y-f.y)<(f.r||15)+3);if(hit)setSelected(hit.face);else window.PuzzleSelection3D?.select?.(cube,x,y);}cubePointers.delete(e.pointerId);pinchDistance=0;});
cube.addEventListener('pointerleave',()=>window.PuzzleSelection3D?.clearHover?.(cube));
cube.addEventListener('wheel',e=>{e.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-e.deltaY*.001),.55,1.9);dirty=true;},{passive:false});
document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select'))return;const key=e.key.toUpperCase();if(e.target===cube&&['ARROWLEFT','ARROWRIGHT','ARROWUP','ARROWDOWN','+','-','='].includes(key)){e.preventDefault();if(key==='ARROWLEFT')view.yaw-=.15;if(key==='ARROWRIGHT')view.yaw+=.15;if(key==='ARROWUP')view.pitch=clamp(view.pitch-.15,-Math.PI/2,Math.PI/2);if(key==='ARROWDOWN')view.pitch=clamp(view.pitch+.15,-Math.PI/2,Math.PI/2);if(key==='+'||key==='=')view.zoom=clamp(view.zoom+.1,.55,1.9);if(key==='-')view.zoom=clamp(view.zoom-.1,.55,1.9);dirty=true;return;}if(locked())return;if(key==='ARROWLEFT'||key==='ARROWRIGHT'){e.preventDefault();manual({face:selected,dir:(key==='ARROWRIGHT'?1:-1)*(G.getRing(selected).cwDir||1)});return;}});
const snapshot=()=>({...model.snapshot(),history:history.map(m=>({...m})),journal:journal.map(j=>j.move?{...j,move:{...j.move}}:{...j}),selected,userTurns,seed,mode,paused,animating:!!animation,sequence:{completed:sequenceDone,total:sequenceTotal,remaining:queue.length+(animation&&mode!=='idle'?1:0),active:mode!=='idle',stopping:stopRequested},solved:isSolved(),advanced,mirrorMode,view:{...view}});
function setAdvanced(value){if(locked()||(!value&&!model.isCubeShape())){toast('Restore the cube shape before leaving jumbling mode.');return false;}advanced=!!value;if(!advanced&&mirrorMode){mirrorMode=false;window.PuzzleAxisDisplay?.resetDefaults?.({pulse:true});window.PuzzleFeedback?.pulse?.($('mirrorMode'));window.PuzzleSolvedProgress?.update?.();}model.mode=advanced?'jumbling':'normal';updateUI();resize();return true;}
function setMirrorMode(value){if(!advanced)return false;const changed=mirrorMode!==!!value;mirrorMode=!!value;if(changed){window.PuzzleAxisDisplay?.resetDefaults?.({pulse:true});window.PuzzleFeedback?.pulse?.($('mirrorMode'));window.PuzzleSolvedProgress?.update?.();}updateUI();resize();return true;}
$('advanced').addEventListener('click',()=>setAdvanced(!advanced));$('mirrorMode').addEventListener('click',()=>setMirrorMode(!mirrorMode));
for(const c of model.configs){const b=document.createElement('button');b.type='button';b.className='jumble-axis small outline';b.dataset.face=c.id;b.textContent=c.id;b.addEventListener('click',()=>setSelected(c.id));$('jumbleAxes').appendChild(b);}
for(let stop=0;stop<6;stop++){const b=document.createElement('button');b.type='button';b.className='stop-key small outline';b.dataset.stop=String(stop);b.textContent=String(stop);b.title='Alignment '+stop+' · '+(E.STOP_ANGLES[stop]*180/Math.PI).toFixed(1)+'°';b.addEventListener('click',()=>{if(model.axisStops[selected]!==stop)manual(model.stopMove(selected,stop));});$('stopButtons').appendChild(b);}
window.PUZZLE_API=Object.freeze({invertMove:invert,moveLabel:label,stopAfterCurrentMove,stopScrambleNow,stopPlaybackNow,restorePlaybackDefaults,resumePlayback,setAdvanced,setMirrorMode,stopMove:(face,stop)=>advanced&&manual(model.stopMove(face,stop)),puzzle:type,snapshot,move:move=>{if(locked()||window.ConstrainedSolverUI?.blocksManualMoves?.())return false;const m=normalize(move);if(!advanced&&m.fromStop!==undefined)return false;return manual(m);},runMoves:(moves,options={})=>{if(locked())return false;const list=(typeof moves==='string'?moves.trim().split(/\s+/):moves).filter(Boolean).map(normalize);if(!list.length||list.length>300||(!advanced&&list.some(m=>m.fromStop!==undefined))||!model.validateSequence(list))return false;if(options.journalReplay&&!window.PuzzleJournal?.isReplaying())return false;if(!options.journalReplay)addLabel(typeof options?.label==='string'?options.label.slice(0,120):'Guide practice');startSequence(list,options.journalReplay==='undo'?'journal-undo':options.journalReplay==='redo'?'journal-redo':'algorithm');return true;},reset,randomize,solve,select:id=>{if(locked()||!model.configById[id])return false;setSelected(id);return true;}});
window.RingDino=Object.freeze({snapshot});
window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined'){const obs=new ResizeObserver(resize);obs.observe(rings);obs.observe(cube);}resize();updateUI();requestAnimationFrame(frame);
window.PuzzleJournal?.attach?.(window.PUZZLE_API);
if(window.parent!==window){window.parent.postMessage({type:'puzzle-ready',puzzle:type},window.location.origin);let previous=0,pending=false;function report(){pending=false;const height=Math.ceil($('puzzleApp').getBoundingClientRect().height)+2;if(height>0&&height!==previous){previous=height;window.parent.postMessage({type:'puzzle-height',puzzle:type,height},window.location.origin);}}function schedule(){if(!pending){pending=true;requestAnimationFrame(report);}}if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe($('puzzleApp'));window.addEventListener('resize',schedule);schedule();}
})();
