/* Ring controls, camera, legal seeded sequences, and Atlas integration. */
(function(){
'use strict';
const $=id=>document.getElementById(id),type=document.body.dataset.puzzle,E=MasterPyraminxEngine,model=E.create(type),G=FaceGroupedRings.create(model),TAU=Math.PI*2;
const rings=$('rings'),cube=$('cube'),rc=rings.getContext('2d'),cc=cube.getContext('2d');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>v.map(x=>x/Math.hypot(...v));
const center=points=>points.reduce((a,p)=>a.map((v,i)=>v+p[i]/points.length),[0,0,0]),ease=t=>t*t*(3-2*t);
let history=[],journal=[],selected=model.configs[0].id,userTurns=0,seed=null,seedCounter=0,mode='idle',queue=[],animation=null,paused=false,pauseAt=0,sequenceTotal=0,sequenceDone=0,stopRequested=false,dirty=true,ringFocused=true,pieceLabels=false;
const homeView={yaw:.93,pitch:.30,zoom:1.08};
let view={...homeView},ringDrag=null,ringViewport={cx:0,cy:0,scale:1},faceTargets=[],ringDots=[],cubePointers=new Map(),pinchDistance=0;
let sizes={rings:{w:500,h:460},cube:{w:500,h:460}};
let inspectedPiece=null;const SCRAMBLE_LENGTH=40;
function normalize(move){return model.normalizeMove(move);}
const invert=move=>({...move,dir:-move.dir}),label=move=>model.moveLabel(move);
function locked(){return !!animation||mode!=='idle';}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
function freshSeed(){seedCounter++;const bytes=new Uint32Array(3);if(globalThis.crypto&&crypto.getRandomValues)crypto.getRandomValues(bytes);else{bytes[0]=Date.now()>>>0;bytes[1]=(Math.random()*4294967296)>>>0;bytes[2]=seedCounter;}return Array.from(bytes,n=>n.toString(16).padStart(8,'0')).join('-').toUpperCase()+'-'+seedCounter;}
let scrambleSpeedActive=false;
function updateUI(){
 if(scrambleSpeedActive&&mode!=='scramble'){scrambleSpeedActive=false;$('speed').value='3';$('speedText').textContent='Normal';}
 const busy=locked(),solved=model.isSolved(),edges=model.pieces.filter(p=>!p.fixed&&p.kind!=='center');
 $('status').className='status'+(busy?' busy':solved?'':' mixed');$('status').textContent=busy?(paused?'Ⅱ Paused':mode==='solve'?'✦ Solving':mode==='scramble'?'⤨ Scrambling':mode==='algorithm'?'↻ Solving':'↻ Turning'):(solved?'● Solved':'● In play');
 $('selectedName').textContent=selected;$('selectedName').title=model.configById[selected].name;$('moveCount').textContent=userTurns;$('solvedFaces').textContent=model.uniformFaces()+' / 4';
 $('pieceLabels').setAttribute('aria-pressed',String(pieceLabels));$('pieceLabels').textContent=pieceLabels?'Hide labels':'Piece labels';
 $('ringFocus').textContent=ringFocused?'Show all rings':'Focus selected rings';$('ringFocus').setAttribute('aria-pressed',String(ringFocused));
 document.querySelectorAll('.ring-key').forEach(b=>{b.classList.toggle('active',b.dataset.face===selected);b.setAttribute('aria-pressed',String(b.dataset.face===selected));b.disabled=busy;});
 document.querySelectorAll('.notation-key').forEach(b=>b.disabled=busy);
 for(const id of ['ccw','cw','randomize'])$(id).disabled=busy;
 $('solve').disabled=busy||solved;$('undo').disabled=busy||!history.length;$('copy').disabled=!journal.some(j=>j.move);
 $('pause').hidden=mode==='idle';$('pause').textContent=mode==='scramble'?'Stop':paused?'Resume':'Pause';$('pause').disabled=false;
 $('cw').title=label({face:selected,dir:G.getRing(selected).cwDir||1})+' · clockwise looking inward along the selected axis';$('ccw').title=label({face:selected,dir:-(G.getRing(selected).cwDir||1)})+' · counterclockwise looking inward along the selected axis';
 $('cubeNote').textContent='Every dot is one real sticker, shown once in its own color. Solved face colors form groups. Connected rings show every face’s sticker paths, with the selected face highlighted. Click any ring to select it and drag along its path to turn. Click a dot to inspect its piece and orientation.';updateInspector();
 dirty=true;window.ConstrainedSolverUI?.syncTransport?.();
}
function setSelected(id){if(!model.configById[id])return;selected=id;ringDrag=null;updateUI();}
function clearJournal(){journal=[];$('log').replaceChildren();}
function addLabel(text){if(!journal.length)$('log').replaceChildren();journal.push({label:text});const el=document.createElement('div');el.className='log-label';el.textContent=text;$('log').appendChild(el);}
function addMove(move,source){
 if(!journal.length)$('log').replaceChildren();$('log').querySelectorAll('.current').forEach(n=>n.classList.remove('current'));journal.push({move:{...move},source});
 const el=document.createElement('span');el.className='move current'+(source==='solve'?' solve':'');const n=document.createElement('span');n.className='move-index';n.textContent=journal.filter(j=>j.move).length;el.append(n,document.createTextNode(label(move)));$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight;
}
// Explicit puzzle turns always honor the speed chosen in this control.
function duration(){return [0,1400,850,450,240,110][+$('speed').value];}
function beginMove(move,source){const m=normalize(move);selected=m.face;ringDrag=null;animation={move:m,source,start:performance.now(),duration:duration()*(m.turns===2?1.35:1)};updateUI();}
function manual(move){if(locked())return false;beginMove(move,'manual');return true;}
function finishMove(){
 const a=animation;model.applyMove(a.move);animation=null;
 if(a.source==='solve'||a.source==='undo')history.pop();else history.push({...a.move});
 if(a.source==='manual'||a.source==='algorithm')userTurns++;if(a.source==='undo')userTurns=Math.max(0,userTurns-1);addMove(a.move,a.source);
 if(stopRequested){
  if(mode!=='idle')sequenceDone++;
  mode='idle';paused=false;stopRequested=false;
  $('message').textContent='Stopped after completing the current move. Remaining moves were canceled.';
  updateUI();return;
 }
 if(mode!=='idle'){
  sequenceDone++;$('message').textContent=(mode==='solve'?'Solving':mode==='algorithm'?'Applying moves':'Scrambling')+' · '+sequenceDone+' / '+sequenceTotal+' · '+label(a.move);
  if(!queue.length){const finished=mode;mode='idle';paused=false;
   $('message').textContent=finished==='solve'?(model.isSolved()?'Solved. Reversed '+sequenceTotal+' recorded moves.':'Sequence complete.'):finished==='algorithm'?'Move sequence complete. Every turn is in the journal.':'Scramble ready. '+sequenceTotal+' legal turns from solved — your move.';
   if(finished==='solve'&&model.isSolved()){$('logTitle').textContent='Move journal · solved';toast('Solved — every move is printed in the journal.');}
  }
 }else $('message').textContent=model.isSolved()?'Solved. Every piece is back in place.':a.source==='undo'?'Undid the last recorded turn.':'Played '+label(a.move)+'.';
 updateUI();
}
function startSequence(moves,kind){if(kind==='scramble'){scrambleSpeedActive=true;$('speed').value='5';$('speedText').textContent='Fast';}stopRequested=false;mode=kind;queue=moves.map(normalize);sequenceTotal=queue.length;sequenceDone=0;paused=false;if(queue.length)beginMove(queue.shift(),kind);else{mode='idle';updateUI();}}
function randomize(){if(locked())return false;seed=freshSeed();const scrambleMoves=model.scramble(seed,SCRAMBLE_LENGTH);addLabel('Scramble · '+scrambleMoves.length+' legal turns');$('seedLabel').textContent='Fresh seed · continues current state';$('seed').textContent=seed;$('logTitle').textContent='Move journal';$('message').textContent='Scrambling the current position…';startSequence(scrambleMoves,'scramble');return true;}
function solve(){if(locked()||model.isSolved())return false;const solver=window.ConstrainedSolverUI;if(!solver||typeof solver.autoSolve!=='function'){toast('Constrained Solver is unavailable. Reload this puzzle to try again.');return false;}return solver.autoSolve();}
function reset(){animation=null;queue=[];mode='idle';paused=false;sequenceTotal=0;sequenceDone=0;stopRequested=false;ringDrag=null;model.reset();history=[];userTurns=0;seed=null;clearJournal();$('log').innerHTML='<span class="empty">Your moves will appear here. Try a ring or press Randomize.</span>';$('seedLabel').textContent='Start solved, or try a new scramble.';$('seed').textContent='NO SEED YET';$('logTitle').textContent='Move journal';$('message').textContent='Reset to solved.';updateUI();return true;}
// Cancel queued turns while committing the active turn at its exact legal endpoint.
function stopAfterCurrentMove(){
 if(!animation&&mode==='idle')return false;
 queue=[];stopRequested=true;
 if(paused){if(animation)animation.start+=performance.now()-pauseAt;paused=false;}
 if(!animation){mode='idle';stopRequested=false;$('message').textContent='Stopped at a legal move boundary.';}
 updateUI();return true;
}
function stopScrambleNow(){
 if(mode!=='scramble')return false;
 // State is committed only in finishMove; discard the uncommitted animation.
 animation=null;queue=[];mode='idle';paused=false;stopRequested=false;ringDrag=null;
 $('message').textContent='Randomizing stopped · '+sequenceDone+' completed turns. The unfinished turn was canceled.';
 updateUI();return true;
}
function resumePlayback(){if(paused){if(animation)animation.start+=performance.now()-pauseAt;paused=false;updateUI();}}
function togglePause(){if(window.ConstrainedSolverUI?.autoStopActive?.())return window.ConstrainedSolverUI.stopAuto();if(mode==='scramble')return stopScrambleNow();if(mode==='idle')return;if(paused){if(animation)animation.start+=performance.now()-pauseAt;paused=false;}else{pauseAt=performance.now();paused=true;}updateUI();}
function resize(){for(const [name,canvas]of [['rings',rings],['cube',cube]]){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);sizes[name]={w:b.width,h:b.height};canvas.width=Math.max(1,Math.round(b.width*dpr));canvas.height=Math.max(1,Math.round(b.height*dpr));canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}dirty=true;}
function updateInspector(){
 const el=$('pieceInfo');if(!el)return;const piece=model.pieces.find(p=>p.id===inspectedPiece);
 if(!piece){el.textContent=pieceLabels?'Map labels identify each sticker’s piece. Click a dot for its full identity and orientation.':'Click a colored dot to inspect its piece.';return;}
 const name=piece.name,slot=model.positionName(piece.pos),home=piece.stickers.map(s=>s.face),current=model.stickerState.filter(s=>s.piece===piece.id).map(s=>model.slots[s.slot].face);
 const orientation=home.map((f,i)=>f+'→'+current[i]).join(' · ');
 el.textContent=piece.kind+' '+name+' → '+slot+' · sticker faces '+orientation;
}
// Read-only overlay bridge: these are the exact marks from the existing draw pass.
let solverRingNodes=[];
window.PUZZLE_SOLVER_BRIDGE=Object.freeze({
 viewport:()=>({x:ringViewport.ox??ringViewport.cx??0,y:ringViewport.oy??ringViewport.cy??0,scale:ringViewport.scale}),
 nodes:()=>solverRingNodes.map(node=>({...node})),
 refreshControls:updateUI,
 requestRender:()=>{dirty=true;}
});
function drawRings(progress){
 solverRingNodes=[];
 if(!(sizes.rings.w>40&&sizes.rings.h>40))return;
 const result=G.render(rc,{width:sizes.rings.w,height:sizes.rings.h,selected,animation:animation?{move:animation.move,progress}:null,pieceLabels,inspectedPiece,focus:ringFocused});ringViewport=result.viewport;ringDots=result.dots;
 solverRingNodes=result.dots.map(d=>({stickerId:String(d.sticker),x:ringViewport.cx+d.x*ringViewport.scale,y:ringViewport.cy+d.y*ringViewport.scale,r:d.r*ringViewport.scale,color:d.color,reference:!!d.reference,highlighted:!!d.highlighted,highlightLineWidth:d.highlightLineWidth||2.2,highlightOuterRadius:d.r*ringViewport.scale}));}
function drawCube(progress){const result=ShapeRenderer.render(cc,model,{width:sizes.cube.w,height:sizes.cube.h,selected,view,pieceLabels,animation:animation?{move:animation.move,progress}:null});faceTargets=result.targets;}
function frame(now){let t=0;if(animation){t=clamp(((paused?pauseAt:now)-animation.start)/animation.duration,0,1);if(t>=1&&!paused){finishMove();if(mode!=='idle'&&queue.length)beginMove(queue.shift(),mode);t=0;}dirty=true;}if(dirty){drawRings(ease(t));drawCube(ease(t));dirty=false;}requestAnimationFrame(frame);}
// Each row offers one turn depth on the same four geometric axes.
for(const [title,ids] of [['Main layers',['U','L','R','B']],['Wide layers',['Uw','Lw','Rw','Bw']],['Tips only',['u','l','r','b']]]){const group=document.createElement('div');group.className='axis-row';const label=document.createElement('span');label.className='axis-label';label.textContent=title;const buttons=document.createElement('div');buttons.className='axis-buttons';for(const face of ids){const b=document.createElement('button');b.type='button';b.className='ring-key';b.dataset.face=face;b.textContent=face;b.title='Select '+face+' · '+model.configById[face].name;b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>setSelected(face));buttons.appendChild(b);}group.append(label,buttons);$('selector').appendChild(group);}
function updateNotation(){document.querySelectorAll('.notation-key').forEach(b=>{b.textContent=b.dataset.face+($('notationInverse').checked?'′':'');b.setAttribute('aria-label','Turn '+b.dataset.face+($('notationInverse').checked?' counterclockwise':' clockwise'));});}
for(const {id} of model.configs){const b=document.createElement('button');b.type='button';b.className='notation-key';b.dataset.face=id;b.addEventListener('click',()=>manual({face:id,dir:$('notationInverse').checked?-1:1}));$('notationButtons').appendChild(b);}$('notationInverse').addEventListener('change',updateNotation);updateNotation();
$('pieceLabels').addEventListener('click',()=>{pieceLabels=!pieceLabels;updateUI();});
$('ringFocus').addEventListener('click',()=>{ringFocused=!ringFocused;updateUI();});$('faceView').addEventListener('click',()=>{const n=model.configById[selected].normal;view.yaw=-Math.atan2(n[0],n[2]);view.pitch=Math.atan2(n[1],Math.hypot(n[0],n[2]));dirty=true;});
$('homeView').addEventListener('click',()=>{view={...homeView};dirty=true;});$('ccw').addEventListener('click',()=>manual({face:selected,dir:-(G.getRing(selected).cwDir||1)}));$('cw').addEventListener('click',()=>manual({face:selected,dir:G.getRing(selected).cwDir||1}));$('randomize').addEventListener('click',randomize);$('solve').addEventListener('click',solve);$('reset').addEventListener('click',reset);$('pause').addEventListener('click',togglePause);$('undo').addEventListener('click',()=>{if(!locked()&&history.length)beginMove(invert(history[history.length-1]),'undo');});
$('speed').addEventListener('input',()=>{$('speedText').textContent=['','Slow','Gentle','Normal','Quick','Fast'][+$('speed').value];if(animation){const clock=paused?pauseAt:performance.now(),progress=clamp((clock-animation.start)/animation.duration,0,1),next=duration()*(animation.move.turns===2?1.35:1);animation.start=clock-progress*next;animation.duration=next;}dirty=true;});
$('copy').addEventListener('click',async()=>{const text=journal.map(j=>j.label?'\n'+j.label+':':label(j.move)).join(' ').trim();try{await navigator.clipboard.writeText(text);toast('Moves copied.');}catch(_){const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();toast(copied?'Moves copied.':'Copy is unavailable in this browser.');}});
function ringPoint(e){const b=rings.getBoundingClientRect();return{x:(e.clientX-b.left-ringViewport.cx)/ringViewport.scale,y:(e.clientY-b.top-ringViewport.cy)/ringViewport.scale};}
rings.addEventListener('pointerdown',e=>{if(locked()||e.button>0)return;const p=ringPoint(e),hit=ringDots.map(d=>({...d,d:Math.hypot(p.x-d.x,p.y-d.y)})).filter(d=>d.d<d.r+3/ringViewport.scale).sort((a,b)=>a.d-b.d)[0];if(hit){inspectedPiece=hit.id;updateInspector();dirty=true;}
 const nearest=G.nearestRing(p,selected);if(!nearest||nearest.distance*ringViewport.scale>15)return;const r=nearest.ring;setSelected(r.face);ringDrag={pointer:e.pointerId,ring:r,angle:G.dragAngle(p,r),total:0};rings.setPointerCapture(e.pointerId);rings.focus({preventScroll:true});dirty=true;});
rings.addEventListener('pointermove',e=>{if(!ringDrag||ringDrag.pointer!==e.pointerId)return;const p=ringPoint(e),r=ringDrag.ring,angle=G.dragAngle(p,r);if(!Number.isFinite(angle))return;ringDrag.total+=((angle-ringDrag.angle+Math.PI+TAU)%TAU)-Math.PI;ringDrag.angle=angle;dirty=true;});
function endRing(e,cancel){if(!ringDrag||ringDrag.pointer!==e.pointerId)return;const delta=ringDrag.total,r=ringDrag.ring;ringDrag=null;dirty=true;if(!cancel&&Math.abs(delta)>.20)manual({face:r.face,dir:delta>0?1:-1});}
for(const name of ['pointerup','pointercancel','lostpointercapture'])rings.addEventListener(name,e=>endRing(e,name!=='pointerup'));
cube.addEventListener('pointerdown',e=>{if(e.button>0)return;cubePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});cube.setPointerCapture(e.pointerId);cube.focus({preventScroll:true});if(cubePointers.size===2){cubePointers.forEach(p=>p.moved=true);const[a,b]=[...cubePointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
cube.addEventListener('pointermove',e=>{const old=cubePointers.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY,startX:old.startX,startY:old.startY,moved:old.moved||Math.hypot(e.clientX-old.startX,e.clientY-old.startY)>6};cubePointers.set(e.pointerId,next);if(cubePointers.size===2){const[a,b]=[...cubePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)view.zoom=clamp(view.zoom*d/pinchDistance,.55,1.9);pinchDistance=d;}else{view.yaw+=(next.x-old.x)*.009;view.pitch=clamp(view.pitch+(next.y-old.y)*.009,-Math.PI/2,Math.PI/2);}dirty=true;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])cube.addEventListener(name,e=>{const p=cubePointers.get(e.pointerId);if(name==='pointerup'&&p&&!p.moved&&cubePointers.size===1&&!locked()){const b=cube.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,hit=faceTargets.find(f=>Math.hypot(x-f.x,y-f.y)<18);if(hit)setSelected(hit.face);}cubePointers.delete(e.pointerId);pinchDistance=0;});
cube.addEventListener('wheel',e=>{e.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-e.deltaY*.001),.55,1.9);dirty=true;},{passive:false});
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select'))return;const key=e.key.toUpperCase();if(e.target===cube&&['ARROWLEFT','ARROWRIGHT','ARROWUP','ARROWDOWN','+','-','='].includes(key)){e.preventDefault();if(key==='ARROWLEFT')view.yaw-=.15;if(key==='ARROWRIGHT')view.yaw+=.15;if(key==='ARROWUP')view.pitch=clamp(view.pitch-.15,-Math.PI/2,Math.PI/2);if(key==='ARROWDOWN')view.pitch=clamp(view.pitch+.15,-Math.PI/2,Math.PI/2);if(key==='+'||key==='=')view.zoom=clamp(view.zoom+.1,.55,1.9);if(key==='-')view.zoom=clamp(view.zoom-.1,.55,1.9);dirty=true;return;}if(locked())return;if(key==='ARROWLEFT'||key==='ARROWRIGHT'){e.preventDefault();manual({face:selected,dir:(key==='ARROWRIGHT'?1:-1)*(G.getRing(selected).cwDir||1)});return;}if('ULRB'.includes(key)&&key.length===1&&!e.repeat){e.preventDefault();manual({face:key+(e.altKey?'w':''),dir:e.shiftKey?-1:1});}});
const snapshot=()=>({...model.snapshot(),history:history.map(m=>({...m})),journal:journal.map(j=>j.move?{...j,move:{...j.move}}:{...j}),selected,userTurns,seed,mode,paused,animating:!!animation,sequence:{completed:sequenceDone,total:sequenceTotal,remaining:queue.length+(animation&&mode!=='idle'?1:0),active:mode!=='idle',stopping:stopRequested},solved:model.isSolved(),view:{...view}});
window.PUZZLE_API=Object.freeze({stopAfterCurrentMove,stopScrambleNow,resumePlayback,puzzle:type,snapshot,move:move=>{if(locked())return false;return manual(normalize(move));},runMoves:(moves,options={})=>{if(locked())return false;const list=(typeof moves==='string'?moves.trim().split(/\s+/):moves).filter(Boolean).map(normalize);if(!list.length||list.length>300)return false;addLabel(typeof options?.label==='string'?options.label.slice(0,120):'Guide practice');startSequence(list,'algorithm');return true;},reset,randomize,solve,select:id=>{if(locked()||!model.configById[id])return false;setSelected(id);return true;}});
window.RingMasterPyraminx=Object.freeze({snapshot});
window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined'){const obs=new ResizeObserver(resize);obs.observe(rings);obs.observe(cube);}resize();updateUI();requestAnimationFrame(frame);
if(window.parent!==window){window.parent.postMessage({type:'puzzle-ready',puzzle:type},window.location.origin);let previous=0,pending=false;function report(){pending=false;const height=Math.ceil($('puzzleApp').getBoundingClientRect().height)+2;if(height>0&&height!==previous){previous=height;window.parent.postMessage({type:'puzzle-height',puzzle:type,height},window.location.origin);}}function schedule(){if(!pending){pending=true;requestAnimationFrame(report);}}if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe($('puzzleApp'));window.addEventListener('resize',schedule);schedule();}
})();
