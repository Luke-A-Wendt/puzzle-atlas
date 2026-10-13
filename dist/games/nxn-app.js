
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
function displayFace(face){return face;}
const SCRAMBLE_LENGTH=N*12;
const axisGroups=[['LEFT / RIGHT',G.rings.filter(r=>r.axis===0).map(r=>r.name)],['DOWN / UP',G.rings.filter(r=>r.axis===1).map(r=>r.name)],['BACK / FRONT',G.rings.filter(r=>r.axis===2).map(r=>r.name)]];
function currentMove(){return animation?animation.move:null;}
function locked(){return !!animation||mode!=='idle';}
function uniformFaces(){const groups=new Map();stickers.forEach(s=>{const k=s.n.join(',');if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(s.color);});return [...groups.values()].filter(v=>v.size===1).length;}
let scrambleSpeedActive=false;
function updateUI(){
 if(scrambleSpeedActive&&mode!=='scramble'){scrambleSpeedActive=false;$('speed').value='3';$('speedText').textContent='Normal';}
 const solved=E.isSolved(stickers),busy=locked();
 document.querySelectorAll('.notation-key').forEach(b=>b.disabled=busy);
 $('status').className='status'+(busy?' busy':solved?'':' mixed');
 $('status').textContent=busy?(paused?'Ⅱ Paused':mode==='solve'?'✦ Solving':mode==='scramble'?'⤨ Scrambling':mode==='algorithm'?'↻ Solving':'↻ Turning'):(solved?'● Solved':'● In play');
 $('moveCount').textContent=userTurns;$('solvedFaces').textContent=uniformFaces()+' / 6';
 $('selectedName').textContent=displayFace(selected);
 $('ringFocus').textContent=ringFocused?'Show all rings':'Focus ring';$('ringFocus').setAttribute('aria-pressed',String(ringFocused));
 document.querySelectorAll('.ring-key').forEach(b=>{b.classList.toggle('active',b.dataset.face===selected);b.setAttribute('aria-pressed',String(b.dataset.face===selected));b.disabled=busy;});
 $('ccw').disabled=busy;$('cw').disabled=busy;$('randomize').disabled=busy;
 $('solve').disabled=busy||solved;$('undo').disabled=busy||!history.length;
 $('pause').hidden=mode==='idle';$('pause').textContent=mode==='scramble'?'Stop':paused?'Resume':'Pause';$('pause').disabled=false;
 $('copy').disabled=!journal.some(j=>j.move);
 $('cubeNote').textContent=selected+' · '+G.getRing(selected).label+' layer. Highlighted stickers belong to this slice. '+(E.configs[selected].inner?'This inner slice moves '+(4*N)+' stickers; the outer layers stay in place.':'This outer layer moves '+(N*N+4*N)+' stickers, including the '+(N*N)+' on its face.');
 const cw={face:selected,dir:-E.configs[selected].turn},ccw=E.invertMove(cw);
 $('cw').title='Clockwise on diagram · '+E.moveLabel(cw);$('ccw').title='Counterclockwise on diagram · '+E.moveLabel(ccw);
 dirty=true;window.ConstrainedSolverUI?.syncTransport?.();
}
function setSelected(face){selected=face;updateUI();}
function addLabel(label){journal.push({label});const el=document.createElement('div');el.className='log-label';el.textContent=label;$('log').appendChild(el);}
function clearJournal(){journal=[];$('log').replaceChildren();}
function addMove(move,source){
 if(!journal.length)$('log').replaceChildren();
 $('log').querySelectorAll('.current').forEach(n=>n.classList.remove('current'));
 journal.push({move:E.normalizeMove(move),source});
 const el=document.createElement('span');el.className='move current'+(source==='solve'?' solve':'');
 const index=document.createElement('span');index.className='move-index';index.textContent=journal.filter(j=>j.move).length;
 el.append(index,document.createTextNode(E.moveLabel(move).replace("'",'′')));$('log').appendChild(el);$('log').scrollTop=$('log').scrollHeight;
}
// Explicit puzzle turns always honor the speed chosen in this control.
function duration(){return [0,1400,850,450,240,110][+$('speed').value];}
function beginMove(move,source){
 const m=E.normalizeMove(move);selected=m.face;ringDrag=null;
 animation={move:m,source,before:stickers,after:E.applyMove(stickers,m),start:performance.now(),duration:duration()*(m.turns===2?1.35:1)};
 updateUI();
}
function manual(move){if(locked())return;if(!journal.length)clearJournal();beginMove(move,'manual');}
function turn(screenDirection){manual({face:selected,dir:-screenDirection*E.configs[selected].turn,turns:1});}
function finishMove(){
 const a=animation;stickers=a.after;animation=null;
 if(a.source==='solve'||a.source==='undo')history.pop();else history.push(a.move);
 if(a.source==='manual'||a.source==='algorithm')userTurns++;
 if(a.source==='undo')userTurns=Math.max(0,userTurns-1);
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
function startSequence(moves,type){if(type==='scramble'){scrambleSpeedActive=true;$('speed').value='5';$('speedText').textContent='Fast';}stopRequested=false;mode=type;queue=moves.slice();sequenceTotal=queue.length;sequenceDone=0;paused=false;const first=queue.shift();if(first)beginMove(first,type);else{mode='idle';updateUI();}}
function randomize(){
 if(locked())return;ringFocused=false;seed=makeSeed();
 const moves=E.scramble(seed,SCRAMBLE_LENGTH);addLabel('Scramble · '+SCRAMBLE_LENGTH+' legal turns');$('seedLabel').textContent='Fresh seed · continues current state';$('seed').textContent=seed;
 $('logTitle').textContent='Move journal';$('message').textContent='Scrambling the current position…';startSequence(moves,'scramble');
}
function solve(){if(locked()||E.isSolved(stickers))return false;const solver=window.ConstrainedSolverUI;if(!solver||typeof solver.autoSolve!=='function'){toast('Constrained Solver is unavailable. Reload this puzzle to try again.');return false;}return solver.autoSolve();}
function reset(){animation=null;queue=[];mode='idle';paused=false;sequenceTotal=0;sequenceDone=0;stopRequested=false;ringDrag=null;stickers=E.makeSolved();history=[];userTurns=0;seed=null;clearJournal();$('log').innerHTML='<span class="empty">Your moves will appear here. Try a ring or press Randomize.</span>';$('seedLabel').textContent='Start solved, or try a new scramble.';$('seed').textContent='NO SEED YET';$('logTitle').textContent='Move journal';$('message').textContent='Reset to the solved starting state.';updateUI();}
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
function resize(){for(const [name,canvas]of [['rings',ringsCanvas],['cube',cubeCanvas]]){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);sizes[name]={w:b.width,h:b.height};canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}dirty=true;}
function ringPoint(event){const b=ringsCanvas.getBoundingClientRect();return{x:(event.clientX-b.left-ringViewport.ox)/ringViewport.scale,y:(event.clientY-b.top-ringViewport.oy)/ringViewport.scale};}
function nearestRing(p){return G.rings.map(r=>({r,d:Math.abs(Math.hypot(p.x-r.cx,p.y-r.cy)-r.r)})).sort((a,b)=>a.d-b.d)[0];}
// Read-only overlay bridge: these are the exact marks from the existing draw pass.
let solverRingNodes=[];
window.PUZZLE_SOLVER_BRIDGE=Object.freeze({
 viewport:()=>({x:ringViewport.ox??ringViewport.cx??0,y:ringViewport.oy??ringViewport.cy??0,scale:ringViewport.scale}),
 nodes:()=>solverRingNodes.map(node=>({...node})),
 refreshControls:updateUI,
 requestRender:()=>{dirty=true;}
});
function drawRings(t){
 solverRingNodes=[];
 if(!(sizes.rings.w>40&&sizes.rings.h>40))return;
 const{w,h}=sizes.rings;rc.clearRect(0,0,w,h);const ring=G.getRing(selected),zoom=ringFocused?180/ring.r:1,scale=Math.min((w-34)/500,(h-36)/500)*zoom;
 ringViewport={scale,ox:w/2-(ringFocused?ring.cx:250)*scale,oy:h/2-(ringFocused?ring.cy:250)*scale-5};
 rc.save();rc.translate(ringViewport.ox,ringViewport.oy);rc.scale(scale,scale);
 for(const r of G.rings){if(r.name===selected)continue;rc.beginPath();rc.arc(r.cx,r.cy,r.r,0,Math.PI*2);rc.strokeStyle='#484450';rc.lineWidth=1.2/zoom;rc.stroke();}
 rc.beginPath();rc.arc(ring.cx,ring.cy,ring.r,0,Math.PI*2);rc.strokeStyle='#baacfb';rc.shadowColor='#9e83ff';rc.shadowBlur=7;rc.lineWidth=2.6/zoom;rc.stroke();rc.shadowBlur=0;
 const active=animation,conf=active?E.configs[active.move.face]:null;
 const fraction=ringDrag?clamp(Math.abs(ringDrag.total)/.24,0,1):0;
 if(ringDrag&&fraction>0.1){const angle=ringDrag.angle;rc.beginPath();rc.arc(ring.cx,ring.cy,ring.r,angle-ringDrag.total,angle,ringDrag.total<0);rc.lineWidth=6/zoom;rc.strokeStyle='rgba(212,195,255,.65)';rc.stroke();}
 const list=active?active.before:stickers;
 list.forEach((s,i)=>{
  const p=active?G.interpolateSticker(s,active.after[i],ring,t,conf.turn*active.move.dir*active.move.turns):G.position(s);
  const onLayer=s.p[ring.axis]===ring.layer;
  solverRingNodes.push({stickerId:String(s.id),x:ringViewport.ox+p.x*scale,y:ringViewport.oy+p.y*scale,r:(onLayer?4.5-(N-5)*.2:3.3-(N-5)*.15)/zoom*scale,color:palette[s.color],highlighted:onLayer,highlightLineWidth:1.15/zoom*scale,highlightOuterRadius:(onLayer?4.5-(N-5)*.2:3.3-(N-5)*.15)/zoom*scale});
  rc.globalAlpha=onLayer?1:.52;rc.beginPath();rc.arc(p.x,p.y,(onLayer?4.5-(N-5)*.2:3.3-(N-5)*.15)/zoom,0,Math.PI*2);rc.fillStyle=palette[s.color];rc.fill();rc.strokeStyle=onLayer?'#eee6ff99':'#13131c';rc.lineWidth=(onLayer?1.15:.7)/zoom;rc.stroke();
 });rc.globalAlpha=1;
 const a=ring.axis===0?0:ring.axis===1?-Math.PI/2:Math.PI,x=ring.cx+ring.r*Math.cos(a),y=ring.cy+ring.r*Math.sin(a),tagRadius=(selected.length>2?14:10)/scale;
 rc.beginPath();rc.arc(x,y,tagRadius,0,Math.PI*2);rc.fillStyle='#c3b1ff';rc.fill();rc.strokeStyle='#e2d7ff';rc.lineWidth=1/scale;rc.stroke();rc.font='600 '+(11/scale)+'px system-ui';rc.textAlign='center';rc.textBaseline='middle';rc.fillStyle='#20172d';rc.fillText(displayFace(selected),x,y+.5/scale);
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
function drawCubeFaceLabels(project,eye,distance){
 faceTargets=[];
 for(const face of ['U','R','F','D','L','B']){
  const cfg=E.configs[face],normal=[0,0,0];normal[cfg.axis]=Math.sign(cfg.layer);
  const nv=camera(normal),cv=camera(mul(normal,typeof distance==='function'?distance(normal):distance));
  if(dot(nv,[-cv[0],-cv[1],eye-cv[2]])<.32)continue;
  const [x,y]=project(cv),chosen=selected[0]===face;
  faceTargets.push({face,x,y});cc.beginPath();cc.arc(x,y,chosen?13:12,0,Math.PI*2);
  cc.fillStyle=chosen?'#e1d5ff':'rgba(13,12,20,.86)';cc.fill();
  cc.strokeStyle=chosen?'#fff':'rgba(255,255,255,.62)';cc.lineWidth=1.2;cc.stroke();
  cc.fillStyle=chosen?'#292037':'#fff';cc.font='700 12px system-ui';cc.textAlign='center';cc.textBaseline='middle';cc.fillText(face,x,y+.4);
 }
}
function drawCube(t){
 const{w,h}=sizes.cube;cc.clearRect(0,0,w,h);
 const scale=Math.min(w,h)*.118*view.zoom*4/N,eye=9.7*N/4;
 function project(v){const q=eye/(eye-v[2]);return[w/2+v[0]*scale*q,h*.50-v[1]*scale*q];}
 cc.save();cc.translate(w/2,h*.86);cc.scale(1,.22);const shadow=cc.createRadialGradient(0,0,2,0,0,w*.28);shadow.addColorStop(0,'rgba(0,0,0,.35)');shadow.addColorStop(1,'rgba(0,0,0,0)');cc.fillStyle=shadow;cc.beginPath();cc.arc(0,0,w*.28,0,Math.PI*2);cc.fill();cc.restore();
 const faces=[],active=animation,cfg=active?E.configs[active.move.face]:null,angle=active?cfg.turn*active.move.dir*active.move.turns*Math.PI/2*t:0;
 function transform(v,p){return camera(active&&p[cfg.axis]===cfg.layer?rot(v,cfg.axis,angle):v);}
 function polygon(p,n,offset,half,color,sticker){
  const center=add(mul(p,.5075),mul(n,offset));const cv=transform(center,p),nv=transform(n,p);
  if(dot(nv,[-cv[0],-cv[1],eye-cv[2]])<=0)return;
  const [u,v]=basis(n),k=half*.17;
  const coords=sticker?[[-half+k,-half],[half-k,-half],[half,-half+k],[half,half-k],[half-k,half],[-half+k,half],[-half,half-k],[-half,-half+k]]:[[-half,-half],[half,-half],[half,half],[-half,half]];
  const points=coords.map(([a,b])=>transform(add(center,add(mul(u,a),mul(v,b))),p));
  const chosen=p[E.configs[selected].axis]===E.configs[selected].layer;
  faces.push({points,outline:points,normal:nv,depth:cv[2]+(sticker?.001:0),color,sticker,chosen,light:clamp(.77+.23*dot(nv,[-.2,.55,.81]),.62,1)});
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
 for(const s of active?active.before:stickers)polygon(s.p,s.n,.486,.411,palette[s.color],true);
 for(const f of CubeBSP.order(faces,[0,0,eye])){const pts=f.points.map(project);cc.beginPath();pts.forEach((p,i)=>i?cc.lineTo(...p):cc.moveTo(...p));cc.closePath();cc.fillStyle=f.color;cc.fill();if(f.sticker){cc.fillStyle='rgba(0,0,0,'+(1-f.light)+')';cc.fill();}
  cc.save();cc.clip();cc.beginPath();f.outline.map(project).forEach((p,i)=>i?cc.lineTo(...p):cc.moveTo(...p));cc.closePath();cc.strokeStyle=f.sticker?(f.chosen?'rgba(243,229,255,.75)':'rgba(255,255,255,.09)'):(f.chosen?'#675777':'#302e3b');cc.lineWidth=f.sticker?(f.chosen?1.15:.6):.6;cc.stroke();cc.restore();}

 drawCubeFaceLabels(project,eye,Math.max(...E.levels)*.5075+.53);
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
$('ccw').addEventListener('click',()=>turn(-1));$('cw').addEventListener('click',()=>turn(1));$('randomize').addEventListener('click',randomize);$('solve').addEventListener('click',solve);$('pause').addEventListener('click',togglePause);$('reset').addEventListener('click',reset);
$('undo').addEventListener('click',()=>{if(!locked()&&history.length)beginMove(E.invertMove(history[history.length-1]),'undo');});
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
 if(locked()||e.button>0)return;const p=ringPoint(e),nearest=ringFocused?{r:G.getRing(selected),d:Math.abs(Math.hypot(p.x-G.getRing(selected).cx,p.y-G.getRing(selected).cy)-G.getRing(selected).r)}:nearestRing(p);if(nearest.d*ringViewport.scale>13)return;setSelected(nearest.r.name);
 ringDrag={pointer:e.pointerId,angle:Math.atan2(p.y-nearest.r.cy,p.x-nearest.r.cx),total:0,startX:e.clientX,startY:e.clientY};ringsCanvas.setPointerCapture(e.pointerId);ringsCanvas.focus({preventScroll:true});dirty=true;
});
ringsCanvas.addEventListener('pointermove',e=>{if(!ringDrag||e.pointerId!==ringDrag.pointer)return;const p=ringPoint(e),r=G.getRing(selected),a=Math.atan2(p.y-r.cy,p.x-r.cx);ringDrag.total+=mod(a-ringDrag.angle+Math.PI,Math.PI*2)-Math.PI;ringDrag.angle=a;dirty=true;});
function endRing(e,cancel){if(!ringDrag||e.pointerId!==ringDrag.pointer)return;const delta=ringDrag.total;ringDrag=null;dirty=true;if(!cancel&&Math.abs(delta)>.20)turn(delta>0?1:-1);}
ringsCanvas.addEventListener('pointerup',e=>endRing(e,false));ringsCanvas.addEventListener('pointercancel',e=>endRing(e,true));ringsCanvas.addEventListener('lostpointercapture',e=>endRing(e,true));
cubeCanvas.addEventListener('pointerdown',e=>{if(e.button>0)return;cubePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});cubeCanvas.setPointerCapture(e.pointerId);cubeCanvas.focus({preventScroll:true});if(cubePointers.size===2){cubePointers.forEach(p=>p.moved=true);const [a,b]=[...cubePointers.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});
cubeCanvas.addEventListener('pointermove',e=>{const old=cubePointers.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY,startX:old.startX,startY:old.startY,moved:old.moved||Math.hypot(e.clientX-old.startX,e.clientY-old.startY)>6};cubePointers.set(e.pointerId,next);if(cubePointers.size===2){const[a,b]=[...cubePointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)view.zoom=clamp(view.zoom*d/pinchDistance,.6,1.5);pinchDistance=d;}else{view.yaw+=(next.x-old.x)*.009;view.pitch=clamp(view.pitch+(next.y-old.y)*.009,-Math.PI/2,Math.PI/2);}dirty=true;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])cubeCanvas.addEventListener(event,e=>{const p=cubePointers.get(e.pointerId);if(event==='pointerup'&&p&&!p.moved&&cubePointers.size===1&&!locked()){const b=cubeCanvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;const hit=faceTargets.find(f=>Math.hypot(f.x-x,f.y-y)<17);if(hit)setSelected(hit.face);}cubePointers.delete(e.pointerId);pinchDistance=0;});
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
function notationLabel(face){return face;}
function updateNotationLabels(){
 const inverse=$('notationInverse').checked;
 document.querySelectorAll('.notation-key').forEach(b=>{
  b.textContent=notationLabel(b.dataset.face)+(inverse?'′':'');
  b.setAttribute('aria-label','Turn '+notationLabel(b.dataset.face)+(inverse?' counterclockwise':' clockwise')+' using puzzle notation');
 });
}
for(const face of notationFaces){
 const b=document.createElement('button');b.type='button';b.className='notation-key';b.dataset.face=face;
 b.addEventListener('click',()=>manual({face,dir:$('notationInverse').checked?-1:1}));
 $('notationButtons').appendChild(b);
}
$('notationInverse').addEventListener('change',updateNotationLabels);updateNotationLabels();
window.PUZZLE_API=Object.freeze({stopAfterCurrentMove,stopScrambleNow,resumePlayback,
 puzzle:'cube'+N,
 snapshot:()=>window.RingCubeN.snapshot(),
 move:move=>{if(locked())return false;manual(parseAtlasMove(move));return true;},
 runMoves:(moves,options={})=>{
  if(locked())return false;
  const list=(typeof moves==='string'?moves.trim().split(/\s+/):moves).filter(Boolean).map(parseAtlasMove);
  if(!list.length||list.length>300)return false;
  if(!journal.length)clearJournal();addLabel(typeof options?.label==='string'?options.label.slice(0,120):'Guide practice');startSequence(list,'algorithm');return true;
 },
 reset:()=>{reset();return true;},
 randomize:()=>{if(locked())return false;randomize();return true;},
 solve,
 select:face=>{if(locked()||!E.configs[face])return false;setSelected(face);return true;},
 
});
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

