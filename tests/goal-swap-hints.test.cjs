'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {fixturePlan}=require('./auto-holds-plan-fixture.cjs');
const games=path.join(__dirname,'../dist/games'),clean=value=>JSON.parse(JSON.stringify(value));
function host(id='cube2'){
 const requests=[];
 class Worker{
  constructor(){this.listeners=[];}
  postMessage(request){this.request=clean(request);requests.push({worker:this,request:this.request});}
  addEventListener(type,fn){if(type==='message')this.listeners.push(fn);}
  removeEventListener(type,fn){this.listeners=this.listeners.filter(x=>x!==fn);}
  terminate(){this.terminated=true;}
  reply(data,force=false){if(this.terminated&&!force)return;this.onmessage?.({data});for(const fn of this.listeners)fn({data});}
 }
 const app=createPage(id,{globals:{Worker,fetch:async url=>{const p=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(p),text:async()=>fs.readFileSync(p,'utf8')};}}});
 app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));
 app.requests=requests;app.ui=app.context.ConstrainedSolverUI;app.core=app.context.ConstrainedSolverCore;
 app.map=()=>app.core.mapSnapshot(app.model,app.snapshot());app.id=n=>app.map().nodeToSticker[n];
 app.start=async(names=['U','D'])=>{if(names.length){assert(app.context.PUZZLE_API.runMoves(names.map(name=>app.model.moves[typeof name==='number'?name:app.model.moves.findIndex(m=>m.name===name)].engineMove)));await app.settle();}app.ui.setActive(true);for(let i=0;i<80&&app.ui.state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui.state().phase,'selecting');};
 app.pending=async(task='auto-holds-plan')=>{await app.advance(100);const entry=requests.findLast(x=>x.request.task===task);assert(entry,'request '+task);return entry;};
 app.answer=async(entry,result,force=false)=>{const payload={id:entry.request.id,type:'result',result,modelFingerprint:app.core.modelFingerprint(app.model)};entry.worker.reply(payload,force);await app.advance(0);return payload;};
 app.plan=async(chunks=[["U'"],["D'"]],options)=>{const result=fixturePlan(app.model,app.snapshot(),chunks,options);app.click('csSuggestHolds');await app.answer(await app.pending(),result);assert(app.ui.state().guided,'valid route retained');return result;};
 app.hints=()=>Array.from(app.ui.state().eligibility.goalImproving).sort();
 app.heldNodes=()=>Array.from(app.ui.state().held,id=>app.map().stickerToNode[id]).sort((a,b)=>a-b);
 app.finishStep=async()=>{for(let i=0;i<2500;i++){await app.advance(2000);if(app.ui.state().phase==='selecting'&&!app.snapshot().animating)return;}throw Error('guided step did not complete');};
 return app;
}
function readyResult(model,word,pairs){
 const d=model.degree,readyPairs=new Uint8Array(Math.ceil(d*d/8)),readyFirstStatus=new Uint8Array(d);
 for(const [a,b]of pairs)for(const [x,y]of [[a,b],[b,a]]){const k=x*d+y;readyPairs[k>>>3]|=1<<(k&7);readyFirstStatus[x]=1;}
 return {status:'partial',degree:d,exemptSwapEndpoints:true,firstStatus:new Uint8Array(d),knownPairs:new Uint8Array(readyPairs.length),feasiblePairs:readyPairs,readyPairs,readyFirstStatus,readyWitnesses:[{word,pairs:pairs.flat()}]};
}
const completed=state=>state.guided?.completed??state.guided?.stage??0;
function recordStrokes(ctx){let arc,dash=[],records=[];ctx.clearRect=()=>{records=[];};ctx.beginPath=()=>{arc=null;};ctx.arc=(x,y,r)=>{arc={x,y,r};};ctx.setLineDash=value=>{dash=Array.from(value);};ctx.stroke=()=>{if(arc)records.push({...arc,width:ctx.lineWidth,color:ctx.strokeStyle,dash:dash.slice()});};return ()=>records;}

test('ordinary manual swaps show local goal hints without claiming a certified solving route',async()=>{
 const app=host();await app.start(['U2']);const index=app.model.moves.findIndex(m=>m.name==='U2'),perm=app.model.moves[index].perm;
 const pairs=app.model.nodes.filter(n=>n.index<perm[n.index]&&perm[perm[n.index]]===n.index).map(n=>[n.index,perm[n.index]]);
 await app.answer(await app.pending('eligible-swaps'),readyResult(app.model,[index],pairs));app.ui.setTool('swap');
 const map=app.map(),colors=app.core.colorsFromSnapshot(app.model,app.snapshot(),map),goals=new Map(Object.entries(app.model.homeBySticker).map(([id,n])=>[n,String(app.model.colorBySticker[id])]));
 const improves=(a,b)=>(colors[a]!==goals.get(a)&&colors[b]===goals.get(a))||(colors[b]!==goals.get(b)&&colors[a]===goals.get(b));
 const expected=[...new Set(pairs.filter(([a,b])=>improves(a,b)).flat().map(n=>app.id(n)))].sort();assert(expected.length);assert.deepEqual(app.hints(),expected);assert.equal(app.ui.state().guided,null);assert.equal(app.ui.state().holdMode,'manual');assert(app.ui.state().eligibility.ready.length);
 const [a,b]=pairs.find(([a,b])=>improves(a,b));assert(app.ui.selectNode(app.id(a)));assert(app.ui.selectNode(app.id(b)));await app.advance(0);assert.equal(app.ui.state().phase,'executing');await app.finishStep();assert.equal(app.ui.state().guided,null);assert.equal(app.ui.state().tool,'swap');assert.equal(app.element('csSwap').getAttribute('aria-pressed'),'true');assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'true');
});

test('Auto installs a verified complete route without moving and marks only its next directed choices',async()=>{
 const app=host();await app.start();const before=clean(app.snapshot()),plan=await app.plan();
 assert.deepEqual(clean(app.snapshot()),before);assert.equal(app.ui.state().autoHolds,false);assert.equal(app.ui.state().autoHold,true);assert.equal(app.ui.state().holdMode,'auto');assert.equal(app.element('csSuggestHolds').getAttribute('aria-pressed'),'true');assert.equal(app.element('csHold').getAttribute('aria-pressed'),'false');assert.equal(app.ui.state().tool,'swap');assert.equal(app.ui.state().pairTarget,0);assert.deepEqual(clean(app.ui.state().pair),[]);
 assert.deepEqual(app.heldNodes(),plan.initialProtectedNodes.slice().sort((a,b)=>a-b));
 const first=Array.from(new Set(plan.stages[0].choices.map(c=>app.id(c.firstNode)))).sort();assert.deepEqual(app.hints(),first);
 assert.equal(app.element('csSwap').textContent,'Move');const beforeMove=clean(app.ui.state().guided);app.click('csSwap');assert.equal(app.ui.state().autoHold,true);assert.equal(app.ui.state().tool,'swap');assert.deepEqual(clean(app.ui.state().guided),beforeMove);
 for(const id of first){app.click('csPairA');assert(app.ui.selectNode(id));const expected=Array.from(new Set(plan.stages[0].choices.filter(c=>app.id(c.firstNode)===id).map(c=>app.id(c.secondNode)))).sort();assert.deepEqual(app.hints(),expected);assert(expected.length);}
 app.click('csPairA');assert.deepEqual(app.hints(),first);
});

test('one Auto toggle and successive white choices finish with strictly increasing secured holds',async()=>{
 const app=host();await app.start();const plan=await app.plan();let locked=app.heldNodes(),count=0;
 while(count<plan.stages.length){
  const requests=app.requests.filter(r=>r.request.task==='auto-holds-plan').length;
  assert.equal(app.ui.state().autoHold,true);assert.equal(app.element('csSuggestHolds').getAttribute('aria-pressed'),'true');assert.deepEqual(app.heldNodes(),locked,'Auto does not release secured nodes between steps');assert.equal(app.requests.filter(r=>r.request.task==='auto-holds-plan').length,requests);
  const stage=plan.stages[count],first=app.hints();assert(first.length,'every incomplete checkpoint has a certified choice');
  for(const id of first){app.click('csPairA');assert(app.ui.selectNode(id));assert(app.hints().length);for(const second of app.hints())assert(stage.choices.some(c=>app.id(c.firstNode)===id&&app.id(c.secondNode)===second),'every white second choice belongs to the same certified step');}
  const second=app.hints().at(-1);assert(app.ui.selectNode(second));await app.advance(0);assert.deepEqual(app.hints(),[],'no next-step recommendation during playback');
  await app.finishStep();count++;
  const after=app.heldNodes();assert(after.length>locked.length,'each completed guided step adds holds');assert(locked.every(n=>after.includes(n)),'no previously secured location is dropped');locked=after;
  assert.equal(completed(app.ui.state()),count);assert(count<=app.model.stickerCount,'strictly growing holds bound the number of guided steps');
 }
 assert.equal(locked.length,app.model.stickerCount);assert.deepEqual(app.hints(),[]);assert.deepEqual(clean(app.map().stickerToNode),app.model.homeBySticker);assert.match(app.ui.state().status,/goal|solved|complete/i);
 assert.equal(app.ui.state().autoHold,true);assert.equal(app.ui.state().holdMode,'auto');assert.equal(app.requests.filter(r=>r.request.task==='auto-holds-plan').length,1,'one plan serves the entire guided solve');assert.equal(app.heldNodes().length,app.model.stickerCount);assert.deepEqual(app.hints(),[]);
});

test('Auto is a persistent toggle, its API activation is idempotent, and Select restores manual editing',async()=>{
 const app=host();await app.start(['R','U']);await app.plan([["U'"],["R'"]]);const locked=app.heldNodes(),count=app.requests.filter(r=>r.request.task==='auto-holds-plan').length;
 assert.equal(app.ui.suggestHolds(),true);await app.advance(0);assert.equal(app.ui.state().autoHold,true);assert.equal(app.requests.filter(r=>r.request.task==='auto-holds-plan').length,count);assert.deepEqual(app.heldNodes(),locked);
 app.click('csSuggestHolds');await app.advance(0);assert.equal(app.ui.state().autoHold,false);assert.equal(app.ui.state().holdMode,'manual');assert.equal(app.ui.state().guided,null);assert.equal(app.ui.state().tool,'swap');assert.deepEqual(app.heldNodes(),locked);assert.equal(app.element('csHold').getAttribute('aria-pressed'),'true');assert.equal(app.element('csSuggestHolds').getAttribute('aria-pressed'),'false');
 app.click('csHold');assert.equal(app.ui.state().tool,'hold');const id=app.id(locked[0]);assert(app.ui.selectNode(id));assert.equal(app.heldNodes().length,locked.length-1);assert.equal(app.element('csClear').disabled,false);app.click('csClear');assert.deepEqual(app.heldNodes(),[]);
});

test('Auto holds resist tile edits and lasso until Select is chosen',async()=>{
 const app=host();await app.start(['R','U']);await app.plan([["U'"],["R'"]]);const locked=app.heldNodes(),overlay=app.element('csNodeOverlay'),nodes=Array.from(app.context.PUZZLE_SOLVER_BRIDGE.nodes());assert(locked.length);
 assert.equal(app.element('csClear').disabled,false,'Clear can exit Auto between complete steps');
 const heldId=app.id(locked[0]);app.ui.selectNode(heldId);assert.deepEqual(app.heldNodes(),locked,'tile selection never changes holds while Auto is on');
 const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),left=Math.min(...xs)-20,right=Math.max(...xs)+20,top=Math.min(...ys)-20,bottom=Math.max(...ys)+20,polygon=[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]],event=([x,y])=>({clientX:x,clientY:y,pointerId:69});
 overlay.dispatch('pointerdown',event(polygon[0]));for(const point of polygon.slice(1)){overlay.dispatch('pointermove',event(point));await app.advance(0);}overlay.dispatch('pointerup',event(polygon.at(-1)));await app.advance(0);assert.deepEqual(app.heldNodes(),locked,'lasso cannot paint Auto holds');
 app.click('csHold');assert.equal(app.ui.state().autoHold,false);assert.equal(app.ui.state().guided,null);assert.equal(app.ui.state().tool,'hold');assert.deepEqual(app.heldNodes(),locked);assert(app.ui.selectNode(heldId));assert(!app.heldNodes().includes(locked[0]));
});

for(const action of ['csHold','csSuggestHolds'])test(action+' cancels Auto planning and ignores its delayed plan',async()=>{
 const app=host();await app.start();const plan=fixturePlan(app.model,app.snapshot(),[["U'"],["D'"]]),node=app.context.PUZZLE_SOLVER_BRIDGE.nodes()[0];assert(app.ui.selectNode(node.stickerId));const held=app.heldNodes();
 app.click('csSuggestHolds');const pending=await app.pending();assert.equal(app.ui.state().autoHold,true);assert.equal(app.element(action).disabled,false);app.click(action);assert.equal(pending.worker.terminated,true);assert.equal(app.ui.state().autoHold,false);assert.equal(app.ui.state().autoHolds,false);assert.equal(app.ui.state().phase,'selecting');assert.equal(app.ui.state().tool,action==='csHold'?'hold':'swap');assert.deepEqual(app.heldNodes(),held);
 await app.answer(pending,plan,true);assert.equal(app.ui.state().guided,null);assert.equal(app.ui.state().autoHold,false);assert.deepEqual(app.heldNodes(),held);assert.equal(app.snapshot().history.length,2);
});

test('Auto and Select remain locked throughout guided playback without changing settings',async()=>{
 const app=host();await app.start();await app.plan();app.element('speed').value='2';app.element('speed').dispatch('input');const labels=app.context.PuzzleAxisDisplay.labelMode(),highlights=app.context.PuzzleAxisDisplay.highlights3D();
 assert(app.ui.selectNode(app.hints()[0]));assert(app.ui.selectNode(app.hints()[0]));await app.advance(0);assert.equal(app.ui.state().phase,'executing');assert.equal(app.element('csHold').disabled,true);assert.equal(app.element('csSuggestHolds').disabled,true);assert.equal(app.element('csClear').disabled,true);assert.equal(app.ui.setTool('hold'),false);app.click('csHold');app.click('csSuggestHolds');assert.equal(app.ui.state().autoHold,true);
 await app.finishStep();assert.equal(app.ui.state().autoHold,true);assert.equal(app.element('csHold').disabled,false);assert.equal(app.element('csSuggestHolds').disabled,false);assert.equal(String(app.element('speed').value),'2');assert.equal(app.context.PuzzleAxisDisplay.labelMode(),labels);assert.equal(app.context.PuzzleAxisDisplay.highlights3D(),highlights);
});

test('manual white hints update with holds and selected first endpoint while held swaps remain bright',async()=>{
 const app=host();await app.start(['U2']);const index=app.model.moves.findIndex(m=>m.name==='U2'),perm=app.model.moves[index].perm,map=app.map(),colors=app.core.colorsFromSnapshot(app.model,app.snapshot(),map),goals=new Map(Object.entries(app.model.homeBySticker).map(([id,n])=>[n,String(app.model.colorBySticker[id])]));
 const a=map.occupiedNodes.find(n=>perm[n]!==n&&perm[perm[n]]===n&&colors[n]!==goals.get(n)&&colors[perm[n]]===goals.get(n)),b=perm[a],idA=app.id(a),idB=app.id(b);assert.notEqual(a,undefined);
 await app.answer(await app.pending('eligible-swaps'),readyResult(app.model,[index],[[a,b]]));app.click('csPairA');assert.deepEqual(app.hints(),[idA,idB].sort());
 app.click('csHold');assert(app.ui.selectNode(idB));await app.answer(await app.pending('eligible-swaps'),readyResult(app.model,[index],[[a,b]]));app.click('csPairA');assert.deepEqual(app.hints(),[idB],'an A hint needs an unheld partner');assert(app.ui.state().eligibility.ready.includes(idA),'swaps with held endpoints stay bright');assert.equal(app.element('csHold').getAttribute('aria-pressed'),'true','manual policy stays selected when choosing a pair');
 assert(app.ui.selectNode(idA));assert.deepEqual(app.hints(),[],'held second endpoint has no recommendation ring');assert(app.ui.state().eligibility.ready.includes(idB));
 app.click('csPairA');assert(app.ui.selectNode(idB));assert.deepEqual(app.hints(),[idA],'unheld goal-improving second endpoint is recommended');
 app.click('csHold');assert(app.ui.selectNode(idB));app.click('csPairA');await app.advance(0);assert.deepEqual(app.hints(),[idA,idB].sort(),'releasing the hold restores both first choices');
});

test('manual goal hints are cached over idle frames instead of rescanning witness pairs',async()=>{
 const app=host();await app.start(['U2']);const index=app.model.moves.findIndex(m=>m.name==='U2'),perm=app.model.moves[index].perm,pairs=app.model.nodes.filter(n=>n.index<perm[n.index]&&perm[perm[n.index]]===n.index).map(n=>[n.index,perm[n.index]]),result=readyResult(app.model,[index],pairs);let reads=0;const flat=pairs.flat();Object.defineProperty(result.readyWitnesses[0],'pairs',{get(){reads++;return flat;}});
 await app.answer(await app.pending('eligible-swaps'),result);app.click('csPairA');const hints=app.hints();assert(hints.length);reads=0;const requestCount=app.requests.length;
 for(let frame=0;frame<60;frame++){await app.advance(16);assert.deepEqual(app.hints(),hints);}assert.equal(reads,0,'same state does not scan all published witnesses every frame');assert.equal(app.requests.length,requestCount,'hover/idle does not replan');
});

test('goal rings stay bold, clear during goal preview, and return to the unchanged retained route',async()=>{
 const app=host();await app.start();await app.plan();const strokes=recordStrokes(app.element('csNodeOverlay').drawing);app.document.activeElement=app.document.body;await app.advance(0);
 const ids=app.hints();for(const id of ids){const node=app.context.PUZZLE_SOLVER_BRIDGE.nodes().find(n=>String(n.stickerId)===id);assert(strokes().some(s=>Math.hypot(s.x-node.x,s.y-node.y)<.001&&!s.dash.length&&s.width>=3.2&&s.color==='#ffffff'),'certified choice has solid white bold circle');}
 const before=clean(app.ui.state().guided);app.element('csShowGoal').dispatch('pointerdown',{pointerId:4});await app.advance(0);assert.deepEqual(app.hints(),[]);
 app.element('csShowGoal').dispatch('pointerup',{pointerId:4});await app.advance(0);assert.deepEqual(app.hints(),ids);assert.deepEqual(clean(app.ui.state().guided),before);
});

for(const change of ['clear','hold'])test('manual '+change+' exits guidance before any later recommendation can be reused',async()=>{
 const app=host();await app.start();await app.plan();app.click('csHold');assert.equal(app.ui.state().holdMode,'manual');if(change==='clear')app.ui.clearSelection();else{assert(app.ui.selectNode(String(app.context.PUZZLE_SOLVER_BRIDGE.nodes()[0].stickerId)));}
 assert.equal(app.ui.state().guided,null);assert.deepEqual(app.hints(),[]);assert.equal(app.element('csSwap').textContent,'Swap');
});

test('a canceled preview keeps the same guided checkpoint because no permutation was executed',async()=>{
 const app=host();await app.start();await app.plan();const locked=app.heldNodes(),before=clean(app.snapshot());assert(app.ui.selectNode(app.hints()[0]));assert(app.ui.selectNode(app.hints()[0]));await app.advance(0);
 assert.equal(app.ui.state().phase,'executing');assert(app.ui.stop());await app.advance(0);assert.equal(app.ui.state().phase,'selecting');assert.deepEqual(app.heldNodes(),locked);assert.equal(completed(app.ui.state()),0);assert(app.hints().length);assert.deepEqual(clean(app.snapshot()),before);
});

test('stopping an unfinished guided sequence clears the route and unconfirmed holds',async()=>{
 const app=host();await app.start();const padding=Array.from({length:8},()=>['F',"F'"]).flat();await app.plan([[...padding,"U'"],["D'"]]);
 assert(app.ui.selectNode(app.hints()[0]));assert(app.ui.selectNode(app.hints()[0]));await app.advance(400);await app.advance(500);assert(app.ui.stop());await app.finishStep();
 assert.equal(app.ui.state().guided,null);assert.deepEqual(clean(app.ui.state().held),[]);assert.deepEqual(app.hints(),[]);assert.match(app.ui.state().status,/stopp|unfinished|cleared/i);
});

test('closing Auto planning rejects a late response without starting or retaining a route',async()=>{
 const app=host();await app.start();const plan=fixturePlan(app.model,app.snapshot(),[["U'"],["D'"]]);app.click('csSuggestHolds');const pending=await app.pending();
 app.ui.closePanel();await app.answer(pending,plan,true);assert.equal(app.ui.state().active,false);assert.equal(app.ui.state().autoHolds,false);assert.equal(app.ui.state().guided,null);assert.deepEqual(clean(app.ui.state().held),[]);assert.equal(app.snapshot().history.length,2);
});

for(const invalid of ['word','progress','choices','fingerprint'])test('a forged guided '+invalid+' is rejected before moves or white recommendations',async()=>{
 const app=host();await app.start();const plan=fixturePlan(app.model,app.snapshot(),[["U'"],["D'"]]);app.click('csSuggestHolds');const pending=await app.pending();
 if(invalid==='word'){plan.stages[0].moveIndices=[app.model.moves.findIndex(m=>m.name==='R')];plan.moveIndices=plan.stages.flatMap(s=>s.moveIndices);}
 if(invalid==='progress')plan.stages[0].newlySolvedNodes=[];
 if(invalid==='choices')plan.stages[0].choices[0].firstNode=plan.stages[0].choices[0].secondNode;
 const payload={id:pending.request.id,type:'result',result:plan,modelFingerprint:invalid==='fingerprint'?'old-model':app.core.modelFingerprint(app.model)};pending.worker.reply(payload);await app.advance(0);
 assert.equal(app.ui.state().phase,'selecting');assert.equal(app.ui.state().autoHolds,false);assert.equal(app.ui.state().guided,null);assert.deepEqual(app.hints(),[]);assert.equal(app.snapshot().history.length,2);assert.match(app.ui.state().status,/verif|model|reload|route|plan/i);
});

test('Auto reports unavailable planning without claiming that a legal route is impossible',async()=>{
 const app=host();await app.start();app.click('csSuggestHolds');await app.answer(await app.pending(),{status:'unknown',reason:'time_limit',stages:[],moveIndices:[]});
 assert.equal(app.ui.state().phase,'selecting');assert.equal(app.ui.state().guided,null);assert.deepEqual(app.hints(),[]);assert.doesNotMatch(app.ui.state().status,/no legal|mathematically impossible/i);assert.equal(app.snapshot().history.length,2);
});

test('Auto recognizes an already solved puzzle without inventing further steps',async()=>{
 const app=host();await app.start([]);app.click('csSuggestHolds');await app.advance(0);assert.equal(app.ui.state().held.length,app.model.stickerCount);assert.deepEqual(app.hints(),[]);assert.deepEqual(clean(app.ui.state().pair),[]);assert.equal(app.ui.state().phase,'selecting');assert.match(app.ui.state().status,/solved|goal/i);assert.equal(app.snapshot().history.length,0);
});

for(const id of ['ghost','pyramorphix'])test('guided '+id+' completion supports shape poses and honest participant choices',async()=>{
 const app=host(id),move=Math.max(0,app.model.moves.findIndex(m=>m.name==='U')),perm=app.model.moves[move].perm;
 const inverse=app.model.moves.findIndex(m=>perm.every((n,i)=>m.perm[n]===i));assert(inverse>=0,'fixture move has a legal inverse');
 await app.start([move]);const plan=await app.plan([[inverse]]),choices=app.ui.state().guided.choices;
 const choice=choices.find(c=>c.kind==='participants')||choices[0];assert(choice,'shape step exposes a certified choice');
 const locked=app.heldNodes();assert(app.ui.selectNode(choice.firstStickerId));assert(app.hints().includes(choice.secondStickerId));assert(app.ui.selectNode(choice.secondStickerId));await app.finishStep();
 assert.equal(completed(app.ui.state()),plan.stages.length);assert.equal(app.heldNodes().length,app.model.stickerCount);assert(app.heldNodes().length>locked.length);assert.deepEqual(clean(app.map().stickerToNode),app.model.homeBySticker);assert.deepEqual(app.hints(),[]);
});

test('manual shared Swap stays selected until Select or Clear is chosen',async()=>{
 const app=host();await app.start();assert.equal(app.ui.state().tool,'hold');
 app.click('csSwap');assert.equal(app.ui.state().tool,'swap');assert.equal(app.element('csHold').getAttribute('aria-pressed'),'true');assert.equal(app.element('csSwap').getAttribute('aria-pressed'),'true');assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'true');
 app.click('csSwap');assert.equal(app.ui.state().tool,'swap');assert.equal(app.element('csSwap').getAttribute('aria-pressed'),'true');app.click('csHold');assert.equal(app.ui.state().tool,'hold');assert.equal(app.element('csSwap').getAttribute('aria-pressed'),'false');assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'false');
 app.click('csPairA');assert.equal(app.ui.state().tool,'swap');assert.equal(app.element('csSwap').getAttribute('aria-pressed'),'true');
});

for(const scenario of ['manual','auto','planning'])test('Clear resets holds and both hold policies from '+scenario,async()=>{
 const app=host();await app.start();let pending;
 if(scenario==='auto')await app.plan();
 else if(scenario==='planning'){app.click('csSuggestHolds');pending=await app.pending();}
 else {app.ui.selectNode(app.id(app.map().occupiedNodes[0]));app.click('csSwap');}
 assert.equal(app.element('csClear').disabled,false);app.click('csClear');
 assert.deepEqual(app.heldNodes(),[]);assert.deepEqual(clean(app.ui.state().pair),[]);assert.equal(app.ui.state().holdMode,'none');assert.equal(app.ui.state().tool,'none');assert.equal(app.ui.state().guided,null);assert.equal(app.element('csHeldCount').textContent,'0');
 for(const id of ['csHold','csSuggestHolds','csSwap','csPairA','csPairB'])assert.equal(app.element(id).getAttribute('aria-pressed'),'false',id+' is inactive');
 assert.equal(app.ui.selectNode(app.id(app.map().occupiedNodes[0])),false,'neutral mode does not silently hold or swap');
 if(pending){assert(pending.worker.terminated);await app.answer(pending,fixturePlan(app.model,app.snapshot(),[["U'"],["D'"]]),true);assert.equal(app.ui.state().holdMode,'none');assert.deepEqual(app.heldNodes(),[]);}
 app.click('csSwap');assert.equal(app.ui.state().tool,'swap');assert.equal(app.ui.state().holdMode,'none');
 app.click('csHold');assert.equal(app.ui.state().holdMode,'manual');assert.equal(app.ui.state().tool,'hold');
});
