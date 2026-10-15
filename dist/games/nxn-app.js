
(function(){
'use strict';
const E=CubeEngine,N=E.size,G=RingGeometry,$=id=>document.getElementById(id);
const ringsCanvas=$('rings'),cubeCanvas=$('cube'),rc=ringsCanvas.getContext('2d'),cc=cubeCanvas.getContext('2d');
const palette={white:'#eeeef6',yellow:'#f4ce48',green:'#39bd8b',blue:'#4c90ef',red:'#ee596e',orange:'#f29a4b'};
let stickers=E.makeSolved(),history=[],journal=[],selected='R',userTurns=0,seed=null,seedCounter=0;
let ringFocused=false;
let mode='idle',queue=[],animation=null,paused=false,pauseAt=0,sequenceTotal=0,sequenceDone=0,stopRequested=false,dirty=true;
let view={yaw:-.62,pitch:.48,zoom:1},ringDrag=null,cubePointers=new Map(),pinchDistance=0;
let ringViewport={scale:1,ox:0,oy:0},sizes={rings:{w:500,h:500},cube:{w:500,h:400}},lastTimestamp=0;
const mod=(x,n)=>((x%n)+n)%n;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>t*t*(3-2*t);
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2000);}
function makeSeed(){seedCounter++;const bytes=new Uint32Array(2);if(globalThis.crypto&&crypto.getRandomValues)crypto.getRandomValues(bytes);else{bytes[0]=(Math.random()*4294967296)>>>0;bytes[1]=Date.now()>>>0;}return Array.from(bytes,n=>n.toString(16).padStart(8,'0')).join('-').toUpperCase()+'-'+seedCounter.toString(36).toUpperCase();}
function displayFace(face){return face.replace(/iiii$/,'iv');}
const SCRAMBLE_LENGTH=N*12;
const axisGroups=[['LEFT / RIGHT',G.rings.filter(r=>r.axis===0).map(r=>r.name)],['DOWN / UP',G.rings.filter(r=>r.axis===1).map(r=>r.name)],['BACK / FRONT',G.rings.filter(r=>r.axis===2).map(r=>r.name)]];
function currentMove(){return animation?animation.move:null;}
function locked(){return !!animation||mode!=='idle';}
function uniformFaces(){const groups=new Map();stickers.forEach(s=>{const k=s.n.join(',');if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(s.color);});return [...groups.values()].filter(v=>v.size===1).length;}
let scrambleSpeedActive=false,sequenceDefaultsActive=false;
function restorePlaybackDefaults(options={}){
 sequenceDefaultsActive=false;scrambleSpeedActive=false;if(options.preserveSettings)return;const changed=$('speed').value!=='3';$('speed').value='3';$('speedText').textContent='Normal';window.PuzzlePlaybackControls.syncSpeed();if(changed)window.PuzzleFeedback?.pulse?.($('speed'));
 window.PuzzleAxisDisplay?.resetDefaults?.({pulse:true});window.PuzzleSelection3D?.clearHover?.();
}
function updateUI(){
 if(sequenceDefaultsActive&&!locked()&&!window.ConstrainedSolverUI?.journalBusy?.()&&!window.PuzzleJournal?.isReplaying?.())restorePlaybackDefaults();
 const solved=E.isSolved(stickers),busy=locked();
 document.querySelectorAll('.notation-key').forEach(b=>b.disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.());
 $('status').className='status'+(busy?' busy':solved?'':' mixed');
 $('status').textContent=busy?(mode==='solve'?'✦ Solving':mode==='scramble'?'⤨ Scrambling':mode==='algorithm'?'↻ Solving':'↻ Turning'):(solved?'● Solved':'● In play');
 $('moveCount').textContent=userTurns;$('solvedFaces').textContent=uniformFaces()+' / 6';
 const shown=window.PuzzleAxisDisplay?.selection(selected,animation);$('selectedName').textContent=shown?displayFace(shown):'Select axis';
 $('ringFocus').textContent=ringFocused?'Show all rings':'Focus rings';$('ringFocus').setAttribute('aria-pressed',String(ringFocused));
 document.querySelectorAll('.ring-key').forEach(b=>{b.classList.toggle('active',b.dataset.face===visualAxis());b.setAttribute('aria-pressed',String(b.dataset.face===visualAxis()));b.disabled=busy;});
 $('ccw').disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.()||!window.PuzzleAxisDisplay?.selection(selected,animation);$('cw').disabled=busy||!!window.ConstrainedSolverUI?.blocksManualMoves?.()||!window.PuzzleAxisDisplay?.selection(selected,animation);$('randomize').disabled=busy;
 $('solve').disabled=busy||solved;$('undo').disabled=busy||!history.length;
 $('pause').hidden=mode==='idle';$('pause').textContent='Stop';$('pause').disabled=false;
 $('copy').disabled=!journal.some(j=>j.move);
 $('cubeNote').textContent=selected+' · '+G.getRing(selected).label+' layer. Highlighted stickers belong to this slice. '+(E.configs[selected].inner?'This inner slice moves '+(4*N)+' stickers; the outer layers stay in place.':'This outer layer moves '+(N*N+4*N)+' stickers, including the '+(N*N)+' on its face.');
 const cw={face:selected,dir:-E.configs[selected].turn},ccw=E.invertMove(cw);
 $('cw').title='Clockwise on diagram · '+E.moveLabel(cw);$('ccw').title='Counterclockwise on diagram · '+E.moveLabel(ccw);
 dirty=true;window.ConstrainedSolverUI?.syncTransport?.();window.PuzzleJournal?.sync?.();
}
function visualAxis(){return window.PuzzleAxisDisplay?window.PuzzleAxisDisplay.selection(selected,animation):selected;}
function setSelected(face){selected=face;window.PuzzleAxisDisplay?.choose?.(face);updateUI();}
function addLabel(label){if(window.PuzzleJournal){journal=window.PuzzleJournal.label(label);return;}journal.push({label});const el=document.createElement('div');el.className='log-label';el.textContent=label;$('log').appendChild(el);}
function clearJournal(){journal=[];$('log').replaceChildren();}
function addMove(move,source){
 if(window.PuzzleJournal){journal=window.PuzzleJournal.record(move,source);return;}
 if(!journal.length)$('log').replaceChildren();
 $('log').querySelectorAll('.current').forEach(n=>n.classList.remove('current'));
 journal.push({move:E.normalizeMove(move),source});
 const el=document.createElement('span');el.className='move current'+(source==='solve'?' solve':'');
 const index=document.createElement('span');index.className='move-index';index.textContent=journal.filter(j=>j.move).length;
 el.append(index,document.createTextNode(E.moveLabel(move).replace("'",'′')));$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight;
}
// Explicit puzzle turns always honor the speed chosen in this control.
function duration(){return window.PuzzlePlaybackControls.duration(+$('speed').value);}
function beginMove(move,source){window.PuzzleSelection3D?.clearHover?.();if(source!=='manual')window.PuzzleAxisDisplay?.clear?.();
 const m=E.normalizeMove(move);selected=m.face;if(source==='manual')window.PuzzleAxisDisplay?.choose?.(m.face);ringDrag=null;
 animation={move:m,source,before:stickers,after:E.applyMove(stickers,m),start:performance.now(),duration:duration()*(m.turns===2?1.35:1)};
 updateUI();
}
function manual(move){if(locked()||window.ConstrainedSolverUI?.blocksManualMoves?.())return;if(!journal.length)clearJournal();beginMove(move,'manual');}
function turn(screenDirection){manual({face:selected,dir:-screenDirection*E.configs[selected].turn,turns:1});}
function finishMove(){
 const a=animation;stickers=a.after;animation=null;
 if(a.source==='solve'||a.source==='undo'||a.source==='journal-undo')history.pop();else history.push(a.move);
 if(a.source==='manual'||a.source==='algorithm')userTurns++;
 if(a.source==='undo')userTurns=Math.max(0,userTurns-1);if(a.source==='journal-undo'||a.source==='journal-redo')userTurns=Math.max(0,userTurns+window.PuzzleJournal.replayTurnDelta());
 addMove(a.move,a.source);
 if(stopRequested){
  if(mode!=='idle')sequenceDone++;
  mode='idle';paused=false;stopRequested=false;
  $('message').textContent='Stopped after completing the current move. Remaining moves were canceled.';
  updateUI();return;
 }
 if(mode!=='idle'){
  sequenceDone++;$('message').textContent=(mode==='solve'?'Solving':mode==='algorithm'?'Applying moves':'Scrambling')+' · '+sequenceDone+' / '+sequenceTotal+' · '+E.moveLabel(a.move);
  if(!queue.length){const finished=mode;mode='idle';paused=false;
   $('message').textContent=finished==='solve'?'Solved. Reversed '+sequenceTotal+' recorded moves.':finished==='algorithm'?'Practice sequence complete. All moves are in the journal.':'Scramble ready. '+SCRAMBLE_LENGTH+' legal turns from solved — your move.';
   if(finished==='solve'){$('logTitle').textContent='Move journal · solved';toast('Solved — every move has been printed below.');}
  }
 }else $('message').textContent=E.isSolved(stickers)?'Solved. All six faces are uniform.':(a.source==='undo'?'Undid the last recorded turn.':'Played '+E.moveLabel(a.move)+'.');
 updateUI();
}
function startSequence(moves,type){sequenceDefaultsActive=type!=='journal-undo'&&type!=='journal-redo';if(type==='scramble'){scrambleSpeedActive=true;window.PuzzleAxisDisplay?.setLabelMode?.('none',{resetSpeed:true});$('speed').value='5';$('speedText').textContent='Fast';window.PuzzlePlaybackControls.syncSpeed();window.PuzzleFeedback?.pulse?.($('speed'));}stopRequested=false;mode=type;queue=moves.slice();sequenceTotal=queue.length;sequenceDone=0;paused=false;const first=queue.shift();if(first)beginMove(first,type);else{mode='idle';updateUI();}}
function randomize(){
 if(locked())return;ringFocused=false;seed=makeSeed();
 const moves=E.scramble(seed,SCRAMBLE_LENGTH);addLabel('Scramble · '+SCRAMBLE_LENGTH+' legal turns');$('seedLabel').textContent='Fresh seed · continues current state';$('seed').textContent=seed;window.PuzzleJournal?.setSeed?.(seed);
 $('logTitle').textContent='Move journal';$('message').textContent='Scrambling the current position…';startSequence(moves,'scramble');
}
function solve(){if(locked()||E.isSolved(stickers))return false;const solver=window.ConstrainedSolverUI;if(!solver||typeof solver.autoSolve!=='function'){toast('Constrained Solver is unavailable. Reload this puzzle to try again.');return false;}return solver.autoSolve();}
function reset(){restorePlaybackDefaults();window.PuzzleJournal?.reset?.();animation=null;queue=[];mode='idle';paused=false;sequenceTotal=0;sequenceDone=0;stopRequested=false;ringDrag=null;stickers=E.makeSolved();history=[];userTurns=0;seed=null;clearJournal();$('log').innerHTML='<span class="empty">Your moves will appear here. Try a ring or press Randomize.</span>';$('seedLabel').textContent='Start solved, or try a new scramble.';$('seed').textContent='NO SEED YET';$('logTitle').textContent='Move journal';$('message').textContent='Reset to the solved starting state.';updateUI();}
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
function resize(){for(const [name,canvas]of [['rings',ringsCanvas],['cube',cubeCanvas]]){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);sizes[name]={w:b.width,h:b.height};canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}dirty=true;}
function ringPoint(event){const b=ringsCanvas.getBoundingClientRect();return{x:(event.clientX-b.left-ringViewport.ox)/ringViewport.scale,y:(event.clientY-b.top-ringViewport.oy)/ringViewport.scale};}
function nearestRing(p){return G.nearestRing(p,selected);}
// Read-only overlay bridge: these are the exact marks from the existing draw pass.
let solverRingNodes=[],ringLabelTargets=[];
window.PUZZLE_SOLVER_BRIDGE=Object.freeze({
 isBusy:locked,
 axesForNode:id=>{const sticker=stickers.find(s=>String(s.id)===String(id));return sticker?Object.keys(E.configs).filter(face=>E.selected(sticker,{face,dir:1})):[];},
 viewport:()=>({x:ringViewport.ox??ringViewport.cx??0,y:ringViewport.oy??ringViewport.cy??0,scale:ringViewport.scale}),
 nodes:()=>solverRingNodes.map(node=>({...node})),
 refreshControls:updateUI,
 requestRender:()=>{dirty=true;}
});
function drawRings(t){
 solverRingNodes=[];
 if(!(sizes.rings.w>40&&sizes.rings.h>40))return;
 const{w,h}=sizes.rings;rc.clearRect(0,0,w,h);const ring=G.getRing(selected),zoom=ringDrag?ringDrag.viewport.zoom:(ringFocused?180/ring.r:1),scale=ringDrag?ringDrag.viewport.scale:Math.min((w-34)/500,(h-36)/500)*zoom;
 ringViewport=ringDrag?ringDrag.viewport:{scale,zoom,ox:w/2-(ringFocused?ring.cx:250)*scale,oy:h/2-(ringFocused?ring.cy:250)*scale-5};
 rc.save();rc.translate(ringViewport.ox,ringViewport.oy);rc.scale(scale,scale);
 const shownAxis=visualAxis();G.drawTracks(rc,shownAxis,scale,{focus:ringFocused});
 const active=animation,conf=active?E.configs[active.move.face]:null;
 if(ringDrag&&!ringDrag.r.companion&&Math.abs(ringDrag.total)>.025){rc.beginPath();rc.arc(ring.cx,ring.cy,ring.r,ringDrag.angle-ringDrag.total,ringDrag.angle,ringDrag.total<0);rc.lineWidth=4/scale;rc.strokeStyle='rgba(226,211,255,.7)';rc.stroke();}
 const list=active?active.before:stickers;
 list.forEach((s,i)=>{
  const p=active?G.interpolateSticker(s,active.after[i],ring,t,conf.turn*active.move.dir*active.move.turns):G.position(s);
  const willMove=!!shownAxis&&s.p[ring.axis]===ring.layer&&(s.n[ring.axis]===0||s.p.some((v,a)=>a!==ring.axis&&v!==0));
  G.drawNode(rc,p,palette[s.color],willMove,scale);
  solverRingNodes.push({stickerId:String(s.id),x:ringViewport.ox+p.x*scale,y:ringViewport.oy+p.y*scale,r:G.nodeRadius(scale)*scale,color:palette[s.color],highlighted:willMove,highlightLineWidth:1.15,highlightOuterRadius:(G.nodeRadius(scale)+Math.min(1.8/scale,G.nodeSpacing*.075))*scale});
 });
 ringLabelTargets=G.drawAxisLabels(rc,shownAxis,scale,displayFace);
 rc.restore();
}
function rot(v,axis,a){const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];}
function camera(v){return rot(rot(v,1,view.yaw),0,view.pitch);}
function add(a,b){return a.map((v,i)=>v+b[i]);}
function mul(a,n){return a.map(v=>v*n);}
function dot(a,b){return a.reduce((v,x,i)=>v+x*b[i],0);}
const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function basis(n){const axis=n.findIndex(v=>v!==0);return axis===0?[[0,1,0],[0,0,1]]:axis===1?[[1,0,0],[0,0,1]]:[[1,0,0],[0,1,0]];}
// Face names describe fixed move axes; camera orbit carries their badges with the cube.
let faceTargets=[];
function drawCubeFaceLabels(project,eye,distance,selection3D){
 faceTargets=G.draw3DAxisLabels(cc,{engine:E,camera,project,eye,distance,drawLeader:selection3D?.leader,selected:visualAxis(),width:sizes.cube.w,height:sizes.cube.h,spacing:.5075,labelFor:displayFace});
}
function drawCube(t){
 const{w,h}=sizes.cube;cc.clearRect(0,0,w,h);
 const scale=Math.min(w,h)*.118*view.zoom*4/N,eye=9.7*N/4;
 function project(v){const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*.50-v[1]*scale*q];}
 cc.save();cc.translate(w/2,h*.86);cc.scale(1,.22);const shadow=cc.createRadialGradient(0,0,2,0,0,w*.28);shadow.addColorStop(0,'rgba(0,0,0,.35)');shadow.addColorStop(1,'rgba(0,0,0,0)');cc.fillStyle=shadow;cc.beginPath();cc.arc(0,0,w*.28,0,Math.PI*2);cc.fill();cc.restore();
 const faces=[],anchors=[],shownAxis=visualAxis(),shownCfg=shownAxis?E.configs[shownAxis]:null,active=animation,cfg=active?E.configs[active.move.face]:null,angle=active?cfg.turn*active.move.dir*active.move.turns*Math.PI/2*t:0;
 function transform(v,p){return camera(active&&p[cfg.axis]===cfg.layer?rot(v,cfg.axis,angle):v);}
 function polygon(p,n,offset,half,color,sticker,stickerId){
  const center=add(mul(p,.5075),mul(n,offset));const cv=transform(center,p),nv=transform(n,p);
  if(sticker)anchors.push({id:stickerId,center:cv,normal:nv,selected:!!shownCfg&&p[shownCfg.axis]===shownCfg.layer&&(n[shownCfg.axis]===0||p.some((v,a)=>a!==shownCfg.axis&&v!==0))});
  if(dot(nv,[-cv[0],-cv[1],eye-cv[2]])<=0)return;
  const [u,v]=basis(n),k=half*.17;
  const coords=sticker?[[-half+k,-half],[half-k,-half],[half,-half+k],[half,half-k],[half-k,half],[-half+k,half],[-half,half-k],[-half,-half+k]]:[[-half,-half],[half,-half],[half,half],[-half,half]];
  const points=coords.map(([a,b])=>transform(add(center,add(mul(u,a),mul(v,b))),p));
  const chosen=window.PuzzleAxisDisplay?.highlights3D?.()!==false&&!!shownCfg&&p[shownCfg.axis]===shownCfg.layer;
  faces.push({points,outline:points,center:cv,normal:nv,stickerId,ringSelected:chosen&&(n[shownCfg.axis]===0||p.some((v,a)=>a!==shownCfg.axis&&v!==0)),depth:cv[2]+(sticker?.001:0),color,sticker,chosen,light:clamp(.77+.23*dot(nv,[-.2,.55,.81]),.62,1)});
 }
 // Draw outer plastic and both sides of each currently opened slice cut.
 // Hidden internal faces contribute no pixels; excluding them keeps 7×7 turns responsive.
 for(const x of E.levels)for(const y of E.levels)for(const z of E.levels){
  const p=[x,y,z];
  for(const n of normals){
   const axis=n.findIndex(v=>v!==0),sign=n[axis];
   const outside=p[axis]===sign*E.extent;
   const cut=active&&axis===cfg.axis&&(p[axis]===cfg.layer||p[axis]+2*sign===cfg.layer);
   if(outside||cut)polygon(p,n,.483,.481,'#191820',false);
  }
 }
 for(const s of active?active.before:stickers)polygon(s.p,s.n,.486,.411,palette[s.color],true,s.id);
 const selection3D=window.PuzzleSelection3D?.begin(cc,{canvas:cubeCanvas,project,eye,width:w,height:h,radius:Math.sqrt(3)*(Math.max(...E.levels)*.5075+.53),occluders:faces});
 for(const anchor of anchors)selection3D?.track?.(anchor);
 for(const f of CubeBSP.order(faces,[0,0,eye])){const pts=f.points.map(project);cc.beginPath();pts.forEach((p,i)=>i?cc.lineTo(...p):cc.moveTo(...p));cc.closePath();cc.fillStyle=f.color;cc.fill();if(f.sticker){cc.fillStyle='rgba(0,0,0,'+(1-f.light)+')';cc.fill();}
  cc.save();cc.clip();cc.beginPath();f.outline.map(project).forEach((p,i)=>i?cc.lineTo(...p):cc.moveTo(...p));cc.closePath();cc.strokeStyle=f.sticker?(f.chosen?'rgba(243,243,243,.75)':'rgba(255,255,255,.09)'):(f.chosen?'#675777':'#302e3b');cc.lineWidth=f.sticker?(f.chosen?1.15:.6):.6;cc.stroke();if(f.sticker)selection3D?.face({id:f.stickerId,points:f.points,outline:f.outline,center:f.center,normal:f.normal,selected:f.ringSelected});else selection3D?.pickFace?.({id:null,points:f.points});cc.restore();}

 drawCubeFaceLabels(project,eye,Math.max(...E.levels)*.5075+.53,selection3D);
 selection3D?.finish();
}
function frame(now){lastTimestamp=now;let t=0;
 if(animation){t=clamp(((paused?pauseAt:now)-animation.start)/animation.duration,0,1);if(t>=1&&!paused){finishMove();if(mode!=='idle'&&queue.length)beginMove(queue.shift(),mode);t=0;}dirty=true;}
 if(dirty){drawRings(ease(t));drawCube(ease(t));dirty=false;}requestAnimationFrame(frame);
}
for(const [axis,faces] of axisGroups){
 const group=document.createElement('div');group.className='axis-row';const label=document.createElement('span');label.className='axis-label';label.textContent=axis;const buttons=document.createElement('div');buttons.className='axis-buttons';
 faces.forEach(face=>{const b=document.createElement('button');b.type='button';b.className='ring-key';b.dataset.face=face;b.textContent=displayFace(face);b.title='Select '+G.getRing(face).label+' ring';b.setAttribute('aria-label',b.title);b.addEventListener('click',()=>setSelected(face));buttons.appendChild(b);});group.append(label,buttons);$('selector').appendChild(group);
}
$('ringFocus').addEventListener('click',()=>{ringFocused=!ringFocused;ringDrag=null;updateUI();});
$('ccw').addEventListener('click',()=>turn(-1));$('cw').addEventListener('click',()=>turn(1));$('randomize').addEventListener('click',randomize);$('solve').addEventListener('click',solve);$('pause').addEventListener('click',stopPlayback);$('reset').addEventListener('click',reset);
$('undo').addEventListener('click',()=>window.PuzzleJournal?.navigate(-1,false));
$('homeView').addEventListener('click',()=>{view={yaw:-.62,pitch:.48,zoom:1};dirty=true;});
$('speed').addEventListener('input',()=>{
 $('speedText').textContent=['','Slow','Gentle','Normal','Quick','Fast'][+$('speed').value];
 if(animation){const now=paused?pauseAt:performance.now(),progress=clamp((now-animation.start)/animation.duration,0,1),nextDuration=duration()*(animation.move.turns===2?1.35:1);
  animation.start=now-progress*nextDuration;animation.duration=nextDuration;}
 dirty=true;
});
$('copy').addEventListener('click',async()=>{
 const text=journal.map(j=>j.label?'\n'+j.label+':':E.moveLabel(j.move)).join(' ').trim();
 try{await navigator.clipboard.writeText(text);toast('Moves copied.');}catch(_){const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();toast(copied?'Moves copied.':'Copy is unavailable in this browser.');}
});
ringsCanvas.addEventListener('pointerdown',e=>{
 if(locked()||e.button>0)return;const p=ringPoint(e),labelHit=ringLabelTargets.find(label=>Math.hypot(label.x-p.x,label.y-p.y)<=label.radius+3/ringViewport.scale);const nearest=labelHit?{r:G.getRing(labelHit.face),d:0}:nearestRing(p);if(!nearest||nearest.d*ringViewport.scale>13){window.PuzzleAxisDisplay?.clear?.();ringDrag=null;dirty=true;return;}setSelected(nearest.r.name);
 ringDrag={pointer:e.pointerId,r:nearest.r,viewport:{...ringViewport},angle:G.angleAt(p,nearest.r),total:0,startX:e.clientX,startY:e.clientY};ringsCanvas.setPointerCapture(e.pointerId);ringsCanvas.focus({preventScroll:true});dirty=true;
});
ringsCanvas.addEventListener('pointermove',e=>{if(!ringDrag){const near=nearestRing(ringPoint(e));window.PuzzleAxisDisplay?.hover?.(near&&near.d*ringViewport.scale<13?near.r.name:null);dirty=true;return;}if(e.pointerId!==ringDrag.pointer)return;const p=ringPoint(e),r=ringDrag.r||G.getRing(selected),a=G.angleAt(p,r);ringDrag.total+=mod(a-ringDrag.angle+Math.PI,Math.PI*2)-Math.PI;ringDrag.angle=a;dirty=true;});
ringsCanvas.addEventListener('pointerleave',()=>{window.PuzzleAxisDisplay?.hover?.(null);dirty=true;});
function endRing(e,cancel){if(!ringDrag||e.pointerId!==ringDrag.pointer)return;const delta=ringDrag.total;ringDrag=null;dirty=true;if(!cancel&&Math.abs(delta)>.20)turn(delta>0?1:-1);}
ringsCanvas.addEventListener('pointerup',e=>endRing(e,false));ringsCanvas.addEventListener('pointercancel',e=>endRing(e,true));ringsCanvas.addEventListener('lostpointercapture',e=>endRing(e,true));
cubeCanvas.addEventListener('pointerdown',e=>{if(e.button>0)return;window.PuzzleSelection3D?.clearHover?.(cubeCanvas);cubePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});cubeCanvas.setPointerCapture(e.pointerId);cubeCanvas.focus({preventScroll:true});if(cubePointers.size===2){cubePointers.forEach(p=>p.moved=true);const [a,b]=[...cubePointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
cubeCanvas.addEventListener('pointermove',e=>{const old=cubePointers.get(e.pointerId);if(!old){const b=cubeCanvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;if(locked()||faceTargets.some(f=>Math.hypot(f.x-x,f.y-y)<17))window.PuzzleSelection3D?.clearHover?.(cubeCanvas);else window.PuzzleSelection3D?.hover?.(cubeCanvas,x,y);return;}window.PuzzleSelection3D?.clearHover?.(cubeCanvas);const next={x:e.clientX,y:e.clientY,startX:old.startX,startY:old.startY,moved:old.moved||Math.hypot(e.clientX-old.startX,e.clientY-old.startY)>6};cubePointers.set(e.pointerId,next);if(cubePointers.size===2){const[a,b]=[...cubePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)view.zoom=clamp(view.zoom*d/pinchDistance,.6,1.5);pinchDistance=d;}else{view.yaw+=(next.x-old.x)*.009;view.pitch=clamp(view.pitch+(next.y-old.y)*.009,-Math.PI/2,Math.PI/2);}dirty=true;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])cubeCanvas.addEventListener(event,e=>{const p=cubePointers.get(e.pointerId);if(event==='pointerup'&&p&&!p.moved&&cubePointers.size===1&&!locked()){const b=cubeCanvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;const hit=faceTargets.find(f=>Math.hypot(f.x-x,f.y-y)<17);if(hit)setSelected(hit.face);else window.PuzzleSelection3D?.select?.(cubeCanvas,x,y);}cubePointers.delete(e.pointerId);pinchDistance=0;});
cubeCanvas.addEventListener('pointerleave',()=>window.PuzzleSelection3D?.clearHover?.(cubeCanvas));
cubeCanvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=clamp(view.zoom*Math.exp(-e.deltaY*.001),.6,1.5);dirty=true;},{passive:false});
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select'))return;
 const key=(e.altKey&&/^Key[A-Z]$/.test(e.code||'')?e.code.slice(3):e.key).toUpperCase();
 if(e.target===cubeCanvas&&['ARROWLEFT','ARROWRIGHT','ARROWUP','ARROWDOWN','+','-','='].includes(key)){e.preventDefault();if(key==='ARROWLEFT')view.yaw-=.15;if(key==='ARROWRIGHT')view.yaw+=.15;if(key==='ARROWUP')view.pitch=clamp(view.pitch-.15,-Math.PI/2,Math.PI/2);if(key==='ARROWDOWN')view.pitch=clamp(view.pitch+.15,-Math.PI/2,Math.PI/2);if(key==='+'||key==='=')view.zoom=clamp(view.zoom+.1,.6,1.5);if(key==='-')view.zoom=clamp(view.zoom-.1,.6,1.5);dirty=true;return;}
 if(locked())return;
 if(key==='ARROWLEFT'||key==='ARROWRIGHT'){e.preventDefault();turn(key==='ARROWRIGHT'?1:-1);return;}
 const moveKey=key+(e.altKey?'i':'');
 if(E.configs[moveKey]&&!e.repeat){e.preventDefault();manual({face:moveKey,dir:e.shiftKey?-1:1});}
});
window.addEventListener('resize',resize);if(typeof ResizeObserver!=='undefined'){const obs=new ResizeObserver(resize);obs.observe(ringsCanvas);obs.observe(cubeCanvas);}resize();updateUI();requestAnimationFrame(frame);
// Small read-only snapshot lets automated integrity checks inspect the running game.
window.RingCubeN=Object.freeze({snapshot:()=>({stickers:stickers.map(s=>({...s,p:s.p.slice(),n:s.n.slice()})),history:history.map(m=>({...m})),mode,paused,selected,seed,userTurns,journal:journal.map(j=>j.move?{...j,move:{...j.move}}:{...j}),animating:!!animation,sequence:{completed:sequenceDone,total:sequenceTotal,remaining:queue.length+(animation&&mode!=='idle'?1:0),active:mode!=='idle',stopping:stopRequested},view:{...view}})});

// Atlas integration: standard notation controls and a small same-origin API.
const notationFaces=['U','R','F','D','L','B',...Object.keys(E.configs).filter(face=>E.configs[face].inner)];
function parseAtlasMove(move){
 if(typeof move!=='string')return E.normalizeMove(move);
 const match=/^([A-Za-z]+)(2?)(['′’]?)$/.exec(move.trim());
 if(!match)throw new Error('Invalid notation move: '+move);
 return E.normalizeMove({face:match[1],turns:match[2]?2:1,dir:match[3]?-1:1});
}
function notationLabel(face){return displayFace(face);}
window.PuzzlePlaybackControls.installNotation({faces:notationFaces,label:notationLabel,onMove:manual});
window.PUZZLE_API=Object.freeze({invertMove:E.invertMove,moveLabel:E.moveLabel,stopAfterCurrentMove,stopScrambleNow,stopPlaybackNow,restorePlaybackDefaults,resumePlayback,
 puzzle:'cube'+N,
 snapshot:()=>window.RingCubeN.snapshot(),
 axisLabel:displayFace,
 move:move=>{if(locked()||window.ConstrainedSolverUI?.blocksManualMoves?.())return false;manual(parseAtlasMove(move));return true;},
 runMoves:(moves,options={})=>{
  if(locked())return false;
  const list=(typeof moves==='string'?moves.trim().split(/\s+/):moves).filter(Boolean).map(parseAtlasMove);
  if(!list.length||list.length>300)return false;
  if(!journal.length)clearJournal();if(options.journalReplay&&!window.PuzzleJournal?.isReplaying())return false;if(!options.journalReplay)addLabel(typeof options?.label==='string'?options.label.slice(0,120):'Guide practice');startSequence(list,options.journalReplay==='undo'?'journal-undo':options.journalReplay==='redo'?'journal-redo':'algorithm');return true;
 },
 reset:()=>{reset();return true;},
 randomize:()=>{if(locked())return false;randomize();return true;},
 solve,
 select:face=>{if(locked()||!E.configs[face])return false;setSelected(face);return true;},
 viewAxis:face=>{const cfg=E.configs[face];if(!cfg)return false;const n=[0,0,0];n[cfg.axis]=Math.sign(cfg.layer)||-Math.sign(cfg.turn);view.yaw=-Math.atan2(n[0],n[2]);view.pitch=Math.atan2(n[1],Math.hypot(n[0],n[2]));dirty=true;return true;},
 
});
window.PuzzleJournal?.attach?.(window.PUZZLE_API);
if(window.parent!==window){
 window.parent.postMessage({type:'puzzle-ready',puzzle:'cube'+N},window.location.origin);
 let lastReportedHeight=0,heightReportPending=false;
 function reportHeight(){
  heightReportPending=false;
  const height=Math.ceil($('puzzleApp').getBoundingClientRect().height)+2;
  if(height!==lastReportedHeight&&height>0){lastReportedHeight=height;window.parent.postMessage({type:'puzzle-height',puzzle:'cube'+N,height},window.location.origin);}
 }
 function scheduleHeightReport(){if(!heightReportPending){heightReportPending=true;requestAnimationFrame(reportHeight);}}
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleHeightReport).observe($('puzzleApp'));
 window.addEventListener('resize',scheduleHeightReport);scheduleHeightReport();
}
})();

