'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));

function host(id='cube2',{withoutHistory=false,globals={}}={}){
  const workers=[],runCalls=[],stopCalls=[];
  class DeferredWorker{
    constructor(url){this.url=String(url);this.listeners={};this.terminated=false;workers.push(this);}
    postMessage(request){this.request=clean(request);}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage(id,{skipScripts:['constrained-solver.js'],globals:{Worker:DeferredWorker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  },...globals}});
  const original=app.context.PUZZLE_API;
  app.context.PUZZLE_API=Object.freeze({...original,
    snapshot:()=>{const snap=original.snapshot();return withoutHistory?{...snap,history:[]}:snap;},
    runMoves:(moves,...options)=>{runCalls.push({at:app.now(),moves:clean(moves)});return original.runMoves(moves,...options);},
    stopAfterCurrentMove:()=>{stopCalls.push(app.now());return original.stopAfterCurrentMove();}
  });
  app.document.currentScript={src:new URL('constrained-solver.js',app.document.baseURI).href};
  app.loadScript('constrained-solver.js');app.document.currentScript=null;
  app.workers=workers;app.runCalls=runCalls;app.stopCalls=stopCalls;app.original=original;
  app.finishMotion=async(max=2000)=>{for(let i=0;i<max;i++){await app.advance(2000);const s=app.snapshot();if(!s.animating&&s.mode==='idle')return;}throw Error('Native sequence did not finish');};
  app.settle=async(max=2000)=>{for(let i=0;i<max;i++){await app.advance(2000);const s=app.snapshot(),u=app.context.ConstrainedSolverUI.state();if(!s.animating&&s.mode==='idle'&&!u.auto?.active&&!['executing','loading','solving','auto-gap'].includes(u.phase))return;}throw Error('Solver did not settle');};
  app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));
  app.home=app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode;
  app.scramble=async(names=['R','U'])=>{assert.equal(original.runMoves(names),true);await app.settle();app.runCalls.length=0;};
  app.start=async()=>{app.click('solve');for(let i=0;i<80&&(!workers.some(w=>w.request?.task==='full-solve')||app.ui().state().phase==='loading');i++)await app.advance(0);};
  app.ready=async()=>{app.ui().setActive(true);for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.fullWorker=()=>workers.findLast(w=>w.request?.task==='full-solve');
  app.payload=async()=>{
    const responses=[],request=workers.at(-1).request;
    const context={URL,performance,TextEncoder,console,fetch:async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(url).pathname.replace(/^\/games\//,'')),'utf8')}),location:{href:'https://atlas.test/games/constrained-solver-worker.js'},postMessage:result=>responses.push(clean(result))};
    context.self=context;context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),context);
    await context.onmessage({data:clean(request)});return responses.at(-1);
  };
  // Construct two known constrained transports for the R,U fixture. This is an
  // independent legal witness, allowing precise animation timing tests without
  // depending on the planner choosing any particular factorization.
  app.stagedReply=(stageNames=[["U'"],["R'"]])=>{
    let current={...app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode};
    const solved=map=>Object.keys(map).filter(id=>map[id]===app.home[id]).map(id=>app.home[id]).sort((a,b)=>a-b);
    const stages=[];let fixed=solved(current);
    for(const names of stageNames){
      const indices=names.map(name=>{const i=app.model.moves.findIndex(m=>m.name===name);assert(i>=0);return i;});
      const before={...current};
      for(const i of indices)for(const id of Object.keys(current))current[id]=app.model.moves[i].perm[current[id]];
      const after=solved(current),newlySolvedNodes=after.filter(node=>!fixed.includes(node));
      assert(newlySolvedNodes.length,'fixture stage makes progress');
      for(const node of fixed){const id=Object.keys(app.home).find(id=>app.home[id]===node);assert.equal(current[id],node,'fixture restores old constraints');}
      const targetNode=newlySolvedNodes[0],targetId=Object.keys(app.home).find(id=>app.home[id]===targetNode);
      stages.push({moveIndices:indices,protectedNodes:fixed.slice(),newlySolvedNodes,targetNode,sourceNode:before[targetId]});fixed=after;
    }
    assert.equal(fixed.length,Object.keys(app.home).length,'fixture solves all labels');
    const result={status:'solved',stages,moveIndices:stages.flatMap(s=>s.moveIndices),finalProtectedNodes:fixed,optimal:false,verified:true,stats:{}};
    return {id:app.fullWorker().request.id,type:'result',result,engineStages:stages.map(s=>({...s,engineMoves:s.moveIndices.map(i=>app.model.moves[i].engineMove)})),modelFingerprint:app.core().modelFingerprint(app.model)};
  };
  app.assertSolved=()=>assert.deepEqual(clean(app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode),clean(app.home));
  return app;
}

// Tests below deliberately use real puzzle scripts and the public solver UI;
// canvas layout/rendering remains covered by the existing ring-map tests.

test('hiding the map cancels planning, resets speed, and reopens ordinary ring controls',async()=>{
  const app=host();await app.scramble();app.element('speed').value='2';app.element('speed').dispatch('input');await app.start();
  assert.equal(String(app.element('speed').value),'5');const worker=app.fullWorker(),stale=app.stagedReply();
  app.click('ringPanelHide');await app.advance(0);assert.equal(worker.terminated,true);assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');
  assert.equal(String(app.element('speed').value),'3');assert.equal(app.document.body.classList.contains('rings-collapsed'),true);
  worker.reply(stale,true);await app.advance(1000);assert.equal(app.runCalls.length,0,'hidden stale plan cannot execute');
  app.click('ringPanelToggle');assert.equal(app.ui().state().active,false);assert.equal(app.element('csNodeOverlay').hidden,true);assert.equal(app.document.body.classList.contains('rings-collapsed'),false);
  const before=app.snapshot().history.length;app.click('cw');await app.settle();assert.equal(app.snapshot().history.length,before+1,'ordinary ring turn controls work after reopen');
});

test('hiding during playback finishes only the current atomic move and exits instead of finishing the queued stage',async()=>{
  const app=host();await app.scramble();await app.start();const payload=app.stagedReply([['F',"F'",'F',"F'","U'"],["R'"]]);
  app.fullWorker().reply(payload);await app.advance(0);assert.equal(app.snapshot().animating,true);const before=app.snapshot().history.length;
  app.click('ringPanelHide');await app.settle();assert.equal(app.stopCalls.length,1);assert.equal(app.snapshot().history.length,before+1,'queued moves stop after current legal atomic move');
  assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().animating,false);
  assert.equal(String(app.element('speed').value),'3');assert.equal(app.runCalls.length,1);assert.equal(app.document.body.classList.contains('cs-working'),false);
  app.click('ringPanelToggle');assert.equal(app.element('ringPanel').classList.contains('cs-active'),false);
});

test('top Stop completes the constraint restoration then leaves the solver and restores normal speed',async()=>{
  const app=host();await app.scramble();await app.start();const payload=app.stagedReply([['F',"F'","U'"],["R'"]]);
  app.fullWorker().reply(payload);await app.advance(0);assert.match(app.element('pause').textContent,/^Stop$/);
  const state=app.ui().state(),anchors=clean(state.anchors);assert(state.held.length>0);assert.equal(anchors.length,state.held.length+state.pair.length);assert.equal(anchors.filter(a=>a.label).length,2);
  const layer=app.element('csAnchorBackdrop'),marks=[];assert.equal(layer.hidden,false);layer.drawing.clearRect=()=>marks.length=0;layer.drawing.arc=(x,y,r)=>marks.push({x,y,r});
  await app.advance(40);assert.deepEqual(clean(app.ui().state().anchors),anchors,'Auto Solve references remain at the start of the constrained step');
  const v=app.context.PUZZLE_SOLVER_BRIDGE.viewport();for(const a of anchors)assert(marks.some(m=>Math.hypot(m.x-v.x-a.x*v.scale,m.y-v.y-a.y*v.scale)<1e-6),'backdrop stays fixed while Auto Solve nodes move');
  app.click('pause');
  await app.settle();assert.equal(app.runCalls.length,1);assert.equal(app.snapshot().history.length,5,'all three stage moves finish but no second stage starts');
  assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');assert.equal(String(app.element('speed').value),'3');
  assert.equal(layer.hidden,true);assert.equal(app.ui().state().anchors.length,0,'ordinary mode has no leftover reference marks');
  const positions=app.core().mapSnapshot(app.model,app.snapshot()).stickerToNode;
  for(const n of [...payload.result.stages[0].protectedNodes,...payload.result.stages[0].newlySolvedNodes]){
    const id=Object.keys(app.home).find(id=>app.home[id]===n);assert.equal(positions[id],n,'exiting restores every secured node at the stage boundary');
  }
});

test('hiding after requesting Stop cannot leave the 3D puzzle locked or the solver suspended',async()=>{
  const app=host();await app.scramble();await app.start();app.fullWorker().reply(app.stagedReply([['F',"F'","U'"],["R'"]]));await app.advance(0);
  app.click('pause');assert.equal(app.element('pause').disabled,true);app.click('ringPanelHide');await app.settle();
  assert.equal(app.ui().state().active,false);assert.equal(app.snapshot().mode,'idle');assert.equal(app.snapshot().paused,false);assert.equal(app.snapshot().animating,false);
  assert.equal(app.context.PUZZLE_API.move('B'),true,'3D/game engine accepts another move after closing a paused solver');await app.settle();
});

test('zero-size hidden ring canvas does not throw negative-radius errors or stop the 3D render loop',async()=>{
  for(const id of ['cube2','cube7','tetraminx','fto','pyramorphix']){
    const app=host(id);let cubeDraws=0;app.element('cube').drawing.clearRect=()=>cubeDraws++;
    app.element('rings').drawing.arc=(x,y,r)=>{assert(Number.isFinite(r)&&r>=0,id+' must not draw an invalid radius while hidden');};
    await app.ready();app.click('ringPanelHide');app.element('rings').bounds={left:0,top:0,width:0,height:0};app.win.dispatch('resize');
    await app.advance(0);const first=cubeDraws;app.context.PUZZLE_SOLVER_BRIDGE.requestRender();await app.advance(0);
    assert(cubeDraws>first,id+' continues drawing the 3D canvas after the hidden ring draw');assert.equal(app.ui().state().active,false);
  }
});

test('a mixed lasso flips enclosed holds once, preserves outside holds, and cancellation makes no changes',async()=>{
  const app=host();await app.ready();const overlay=app.element('csNodeOverlay'),nodes=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes());
  const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),left=Math.min(...xs)-15,right=(Math.min(...xs)+Math.max(...xs))/2+3.14,top=Math.min(...ys)-15,bottom=Math.max(...ys)+15;
  const polygon=[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]];
  const expected=nodes.filter(n=>n.x>left&&n.x<right&&n.y>top&&n.y<bottom).map(n=>n.stickerId).sort();assert(expected.length>1&&expected.length<nodes.length);
  const drag=async(altKey=false,cancel=false)=>{const event=([x,y])=>({clientX:x,clientY:y,pointerId:89,altKey});overlay.dispatch('pointerdown',event(polygon[0]));for(const p of polygon.slice(1)){overlay.dispatch('pointermove',event(p));await app.advance(0);}overlay.dispatch(cancel?'pointercancel':'pointerup',event(polygon.at(-1)));await app.advance(0);};
  const outside=nodes.find(n=>!expected.includes(n.stickerId)).stickerId;
  app.ui().selectNode(expected[0]);app.ui().selectNode(outside);
  const initial=[expected[0],outside].sort();
  await drag();assert.deepEqual(Array.from(app.ui().state().held).sort(),[...expected.slice(1),outside].sort());assert.equal(app.snapshot().history.length,0);
  await drag();assert.deepEqual(Array.from(app.ui().state().held).sort(),initial,'repeating the selection restores the original holds');
  await drag(false,true);assert.deepEqual(Array.from(app.ui().state().held).sort(),initial,'cancelled lasso has no effect');assert.equal(app.snapshot().history.length,0);
  await drag(true);assert.deepEqual(Array.from(app.ui().state().held).sort(),[...expected.slice(1),outside].sort(),'modifier keys do not switch to a hidden removal tool');
});

test('Select held flips pointer and keyboard selections and A/B switch out of hold mode',async()=>{
  const app=host();await app.ready();const overlay=app.element('csNodeOverlay'),hold=app.element('csHold'),node=app.context.PUZZLE_SOLVER_BRIDGE.nodes()[0];
  assert.equal(hold.textContent,'Select held');assert.equal(app.element('csRelease'),null);assert.equal(hold.getAttribute('aria-pressed'),'true');
  const point={clientX:node.x,clientY:node.y,pointerId:17};
  overlay.dispatch('pointerdown',point);overlay.dispatch('pointerup',point);
  assert.deepEqual(Array.from(app.ui().state().held),[node.stickerId]);assert.match(overlay.getAttribute('aria-label'),/Enter to release/);
  overlay.dispatch('pointerdown',point);overlay.dispatch('pointerup',point);
  assert.deepEqual(Array.from(app.ui().state().held),[]);assert.match(overlay.getAttribute('aria-label'),/Enter to hold/);
  overlay.dispatch('keydown',{key:'Enter'});assert.deepEqual(Array.from(app.ui().state().held),[node.stickerId]);
  overlay.dispatch('keydown',{key:' '});assert.deepEqual(Array.from(app.ui().state().held),[]);
  app.click('csPairA');assert.equal(hold.getAttribute('aria-pressed'),'false');assert.equal(app.ui().state().tool,'swap');
  app.ui().selectNode(node.stickerId);app.click('csHold');assert.equal(hold.getAttribute('aria-pressed'),'true');assert.deepEqual(Array.from(app.ui().state().pair),[node.stickerId]);
  app.click('csPairB');assert.equal(hold.getAttribute('aria-pressed'),'false');assert.equal(app.ui().state().pairTarget,1);assert.deepEqual(Array.from(app.ui().state().pair),[node.stickerId]);
  app.click('csHold');app.click('csPairA');assert.equal(hold.getAttribute('aria-pressed'),'false');assert.deepEqual(Array.from(app.ui().state().pair),[]);
  assert.equal(app.snapshot().history.length,0);
});

test('both progress bars fill the same width while reporting cumulative nodes and current-stage moves independently',async()=>{
  const app=host();await app.scramble();await app.start();const payload=app.stagedReply([['F',"F'",'F',"F'","U'"],["R'"]]);app.fullWorker().reply(payload);await app.advance(0);
  const nodes=app.element('csAutoProgressBar'),moves=app.element('csStepProgressBar');assert(nodes&&moves);assert.equal(app.element('csAutoProgress').querySelectorAll('progress').length,2);
  assert.equal(nodes.parentNode,moves.parentNode);assert.equal(app.element('csAutoProgress').hidden,false);assert.equal(app.element('speedText').textContent,'Fast');
  const initial=Number(nodes.value);assert.equal(Number(moves.value),0);assert.equal(Number(moves.max),5);
  await app.advance(2000);assert.equal(Number(moves.value),1);assert.equal(Number(nodes.value),initial,'an intermediate atomic move does not falsely secure nodes');
  for(let i=0;i<15&&app.ui().state().auto?.completed!==1;i++)await app.advance(2000);
  assert.equal(app.ui().state().auto.completed,1);assert.equal(Number(moves.value),5);assert(Number(nodes.value)>initial);
  const css=fs.readFileSync(path.join(games,'constrained-solver.css'),'utf8'),shared=/\.cs-auto-progress progress\{([^}]+)\}/.exec(css)?.[1];
  assert(shared);assert.match(shared,/width:100%/);assert.match(shared,/height:6px/);assert.doesNotMatch(css,/#cs(?:Auto|Step)ProgressBar\s*\{/,'both bars use the identical shared style');
  app.click('pause');await app.settle();assert.equal(app.element('speedText').textContent,'Normal');
});

test('selected swap endpoints use a solid white 4.8px outline with no teal selection styling',async()=>{
  const app=host();await app.ready();const ctx=app.element('csNodeOverlay').drawing,strokes=[];let arc=null,dash=[];
  ctx.clearRect=()=>{strokes.length=0;};ctx.beginPath=()=>{arc=null;};ctx.arc=(x,y,r)=>{arc={x,y,r};};ctx.setLineDash=value=>{dash=Array.from(value);};ctx.stroke=()=>strokes.push({arc,color:ctx.strokeStyle,width:ctx.lineWidth,dash:dash.slice()});
  const node=app.context.PUZZLE_SOLVER_BRIDGE.nodes()[0];app.ui().setTool('swap');assert.equal(app.ui().selectNode(node.stickerId),true);await app.advance(0);
  const marks=strokes.filter(s=>s.arc&&Math.hypot(s.arc.x-node.x,s.arc.y-node.y)<.001);assert.equal(marks.length,1);assert.equal(marks[0].color,'#ffffff');assert.equal(marks[0].width,4.8);assert.deepEqual(marks[0].dash,[]);
  const css=fs.readFileSync(path.join(games,'constrained-solver.css'),'utf8');assert.match(css,/\.cs-pair-chip\.chosen\{[^}]*background:#33303f[^}]*border-color:#78718c/);
});

function eligibilityReply(app,worker,{blockedFirst=[],blockedPairs=[],feasible=[],status='partial'}={}){
  const degree=app.model.degree,knownPairs=new Uint8Array(Math.ceil(degree*degree/8)),feasiblePairs=new Uint8Array(knownPairs.length),firstStatus=new Uint8Array(degree);
  const mark=(a,b)=>{const i=a*degree+b;knownPairs[i>>>3]|=1<<(i&7);};
  for(const a of blockedFirst){firstStatus[a]=2;for(let b=0;b<degree;b++){mark(a,b);mark(b,a);}}
  for(const [a,b]of blockedPairs){mark(a,b);mark(b,a);}
  for(const [a,b]of feasible){mark(a,b);mark(b,a);for(const [x,y]of [[a,b],[b,a]]){const i=x*degree+y;feasiblePairs[i>>>3]|=1<<(i&7);}firstStatus[a]=firstStatus[b]=1;}
  return {id:worker.request.id,type:'result',result:{status,degree,knownPairs,feasiblePairs,firstStatus},modelFingerprint:app.core().modelFingerprint(app.model)};
}
async function eligibilityWorker(app){app.ui().setTool('swap');await app.advance(181);const worker=app.workers.findLast(w=>w.request?.task==='eligible-swaps');assert(worker,'background eligibility query started');return worker;}

test('only proved-impossible swap choices reject selection; visibly uncertain choices can start the full solver',async()=>{
  const app=host();await app.ready();const worker=await eligibilityWorker(app),map=app.core().mapSnapshot(app.model,app.snapshot());
  const [blocked,a,b,unknown]=map.occupiedNodes.slice(0,4),id=n=>map.nodeToSticker[n];
  const fills=[],ctx=app.element('csNodeOverlay').drawing;let circle=null;ctx.clearRect=()=>{fills.length=0;};ctx.beginPath=()=>{circle=null;};ctx.arc=(x,y,r)=>{circle={x,y,r};};ctx.fill=()=>{if(circle)fills.push({...circle,color:ctx.fillStyle});};
  worker.reply(eligibilityReply(app,worker,{blockedFirst:[blocked],blockedPairs:[[a,b]]}));await app.advance(0);
  const drawn=app.context.PUZZLE_SOLVER_BRIDGE.nodes(),blockedDot=drawn.find(n=>n.stickerId===id(blocked)),unknownDot=drawn.find(n=>n.stickerId===id(unknown));
  assert(fills.some(f=>Math.hypot(f.x-blockedDot.x,f.y-blockedDot.y)<.001&&/^rgba\(/.test(f.color)),'proved-impossible node is visibly dimmed on the overlay');assert(fills.some(f=>Math.hypot(f.x-unknownDot.x,f.y-unknownDot.y)<.001),'unknown node receives a distinct uncertain overlay');assert(app.ui().state().eligibility.uncertain.includes(id(unknown)));
  assert.equal(app.ui().state().eligibility.status,'partial');assert.deepEqual(Array.from(app.ui().state().eligibility.blocked),[id(blocked)]);
  assert.equal(app.ui().selectNode(id(blocked)),false);assert.equal(app.ui().state().pair.length,0);assert.equal(app.snapshot().history.length,0);
  assert.equal(app.ui().selectNode(id(a)),true);assert(app.ui().state().eligibility.blocked.includes(id(b)));
  assert.equal(app.ui().selectNode(id(b)),false);assert.deepEqual(Array.from(app.ui().state().pair),[id(a)]);
  assert.equal(app.ui().selectNode(id(unknown)),true);assert.equal(app.ui().state().phase,'selecting');app.click('csGo');assert.equal(app.ui().state().phase,'solving');
  assert.equal(app.workers.filter(w=>w.request.task==='manual-swap').length,1,'unknown partner launches the full exact swap search');
});

test('eligibility timeouts leave every unresolved node selectable and never imply impossibility',async()=>{
  const app=host();await app.ready();const worker=await eligibilityWorker(app);worker.reply(eligibilityReply(app,worker,{status:'unknown'}));await app.advance(0);
  assert.equal(app.ui().state().eligibility.status,'unknown');assert.deepEqual(Array.from(app.ui().state().eligibility.blocked),[]);
  const ids=app.context.PUZZLE_SOLVER_BRIDGE.nodes().slice(0,2).map(n=>n.stickerId);
  for(const id of ids)assert.equal(app.ui().selectNode(id),true);app.click('csGo');assert.equal(app.ui().state().phase,'solving');assert.equal(app.snapshot().history.length,0);
});

test('changing held nodes invalidates old eligibility results before accepting a new constraint-specific table',async()=>{
  const app=host();await app.ready();const first=await eligibilityWorker(app),map=app.core().mapSnapshot(app.model,app.snapshot());
  const [blocked,held]=map.occupiedNodes.slice(0,2),id=n=>map.nodeToSticker[n];
  const stale=eligibilityReply(app,first,{blockedFirst:[blocked]});app.ui().setTool('hold');app.ui().selectNode(id(held));const second=await eligibilityWorker(app);
  assert.notEqual(second,first);assert.deepEqual(second.request.selection.protectedStickerIds,[id(held)]);assert.equal(first.terminated,true);
  first.reply(stale,true);await app.advance(0);assert.equal(app.ui().state().eligibility.status,'pending');assert.deepEqual(Array.from(app.ui().state().eligibility.blocked),[]);
  second.reply(eligibilityReply(app,second,{blockedFirst:[blocked]}));await app.advance(0);assert.equal(app.ui().state().eligibility.status,'partial');assert.deepEqual(Array.from(app.ui().state().eligibility.blocked),[id(blocked)]);
  app.click('ringPanelHide');assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().eligibility.status,'idle');
});

test('changing A after an unresolved request clears both endpoints and the stale result',async()=>{
  const app=host();await app.ready();const worker=await eligibilityWorker(app),map=app.core().mapSnapshot(app.model,app.snapshot()),[a,b,c,d]=map.occupiedNodes.slice(0,4),id=n=>map.nodeToSticker[n];
  worker.reply(eligibilityReply(app,worker,{blockedPairs:[[a,c]],feasible:[[c,d]]}));await app.advance(0);
  assert.equal(app.ui().selectNode(id(a)),true);assert.equal(app.ui().selectNode(id(b)),true);app.click('csGo');const search=app.workers.findLast(w=>w.request.task==='manual-swap');assert(search);
  search.reply({id:search.request.id,type:'result',result:{status:'unknown',reason:'time_limit'}});await app.advance(0);
  assert.equal(app.ui().state().phase,'selecting');assert.equal(app.ui().state().pair.length,2);app.click('csPairA');assert(!app.ui().state().eligibility.blocked.includes(id(c)));
  assert.equal(app.ui().selectNode(id(c)),true,'C can replace A even though exchanging it with old A is impossible');assert.deepEqual(Array.from(app.ui().state().pair),[id(c)]);assert.equal(app.ui().state().result,null);assert.equal(app.element('csGo').disabled,true);
});

test('mirror mode hiding the ring panel exits selection mode and releases ordinary keyboard controls',async()=>{
  const callbacks=[];class ObservedMutation{constructor(callback){callbacks.push(callback);}observe(){}disconnect(){}}
  const app=host('mirror',{globals:{MutationObserver:ObservedMutation}});await app.ready();assert.equal(app.ui().state().active,true);
  app.click('mirrorMode');for(const callback of callbacks)callback();await app.advance(0);
  assert.equal(app.snapshot().mirrorMode,true);assert.equal(app.ui().state().active,false);assert.equal(app.ui().state().phase,'off');assert.equal(app.element('csNodeOverlay').hidden,true);
  app.element('cube').dispatch('keydown',{key:'R'});await app.settle();assert.equal(app.snapshot().history.length,1,'keyboard move is no longer swallowed by a hidden solver');
});
