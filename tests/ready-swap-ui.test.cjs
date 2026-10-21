'use strict';

// Exercise the shipped UI and cube engine at the eligibility/worker boundary.
// Reachability alone must never masquerade as a sequence ready for playback.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {EligibilityAnalyzer,eligibilityStatus}=require('../solver-backend/src/eligibility.cjs');
const games=path.join(__dirname,'../dist/games');
const clean=value=>JSON.parse(JSON.stringify(value));
const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/cube2.json'),'utf8'));
const analyzer=new EligibilityAnalyzer(model);

function host(){
  const requests=[];
  class DeferredWorker{
    constructor(){this.listeners={};this.terminated=false;}
    postMessage(request){this.request=clean(request);requests.push({worker:this,request:this.request});}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
    terminate(){this.terminated=true;}
    reply(data,force=false){if(this.terminated&&!force)return;const event={data};this.onmessage?.(event);for(const fn of this.listeners.message||[])fn(event);}
  }
  const app=createPage('cube2',{globals:{Worker:DeferredWorker,fetch:async url=>{
    const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));
    return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};
  }}});
  app.requests=requests;app.ui=()=>app.context.ConstrainedSolverUI;app.core=()=>app.context.ConstrainedSolverCore;
  app.mapping=()=>app.core().mapSnapshot(model,app.snapshot());app.id=node=>app.mapping().nodeToSticker[node];
  app.ready=async()=>{app.ui().setActive(true);for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);assert.equal(app.ui().state().phase,'selecting');};
  app.pending=async()=>{await app.advance(200);const entry=requests.findLast(x=>x.request.task==='eligible-swaps');assert(entry);return entry;};
  app.answer=async(entry,result)=>{const payload={id:entry.request.id,type:'result',result,modelFingerprint:app.core().modelFingerprint(model)};entry.worker.reply(payload);await app.advance(0);return payload;};
  app.choose=(a,b)=>{app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(a)),true);assert.equal(app.ui().selectNode(app.id(b)),true);};
  app.settleSolver=async()=>{for(let i=0;i<100;i++){await app.advance(2000);const s=app.snapshot(),u=app.ui().state();if(!s.animating&&s.mode==='idle'&&!['executing','solving','auto-gap'].includes(u.phase))return;}throw Error('Solver did not settle');};
  return app;
}

function fixture(){
  const move=model.moves.findIndex(m=>m.name==='U2'),p=model.moves[move].perm;
  const held=model.nodes.find(n=>n.face==='U'&&p[n.index]!==n.index).index;
  const a=model.nodes.find(n=>n.face!=='U'&&n.piece===model.nodes[held].piece&&p[n.index]!==n.index&&p[p[n.index]]===n.index).index,b=p[a];
  const blocks=model.nodes.find(n=>![a,b].includes(n.index)&&p[n.index]!==n.index&&model.nodes[p[n.index]].color!==n.color).index;
  return {move,a,b,held,blocks};
}
const f=fixture();
function readyResult(app,{word=[f.move],pairs=[f.a,f.b]}={}){
  const result=analyzer.analyze({occupiedNodes:app.mapping().occupiedNodes},{maxMs:5000});
  assert.equal(result.status,'complete');
  result.readyPairs=new Uint8Array(Math.ceil(model.degree*model.degree/8));
  result.readyFirstStatus=new Uint8Array(model.degree);
  for(let i=0;i<pairs.length;i+=2){const a=pairs[i],b=pairs[i+1];for(const [x,y]of [[a,b],[b,a]]){const index=x*model.degree+y;result.readyPairs[index>>>3]|=1<<(index&7);result.readyFirstStatus[x]=1;}}
  result.readyWitnesses=[{word:word.slice(),pairs:pairs.slice()}];
  return result;
}

test('only nodes with a stored verified sequence are bright, including before 1 is chosen',async()=>{
  const app=host();await app.ready();const result=readyResult(app);await app.answer(await app.pending(),result);
  let state=app.ui().state().eligibility;
  assert.deepEqual([...state.ready].sort(),[app.id(f.a),app.id(f.b)].sort(),'first-node readiness requires at least one ready partner');
  const uncertain=result.candidateNodes.find(n=>![f.a,f.b].includes(n)&&eligibilityStatus(result,n)===1);assert.notEqual(uncertain,undefined);
  assert(state.uncertain.includes(app.id(uncertain)),'a proved reachable node without a word is still uncertain for execution');
  assert(state.dimmed.includes(app.id(uncertain)),'uncertain candidates are visibly distinguished from ready candidates');
  app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),true);
  state=app.ui().state().eligibility;assert.deepEqual(clean(state.ready),[app.id(f.b)],'B readiness is specific to the chosen A');
  assert.equal(app.ui().selectNode(app.id(f.b)),true);
  assert.equal(app.element('csGo'),null,'there is no separate Go control');
  assert.equal(app.ui().state().phase,'solving','selecting 2 immediately starts verification');
  await app.advance(0);assert.equal(app.ui().state().phase,'executing');
  assert.equal(app.snapshot().history.length,0,'the verified sequence waits briefly before moving');
});

test('selecting 2 executes the retained word after a pause without another search',async()=>{
  const app=host();await app.ready();await app.answer(await app.pending(),readyResult(app));
  const before=app.mapping(),count=app.requests.length;app.choose(f.a,f.b);await app.advance(0);
  assert.equal(app.ui().state().phase,'executing');
  assert.equal(app.requests.length,count,'a ready pair does not submit another constrained search');
  assert.equal(app.snapshot().history.length,0);assert.equal(app.snapshot().animating,false);
  await app.advance(349);assert.equal(app.snapshot().animating,false,'still paused before the 350ms boundary');
  assert.equal(app.snapshot().history.length,0);
  await app.advance(1);await app.settleSolver();const after=app.mapping();
  assert.equal(app.snapshot().history.length,1);assert.equal(after.stickerToNode[before.nodeToSticker[f.a]],f.b);assert.equal(after.stickerToNode[before.nodeToSticker[f.b]],f.a);
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(String(app.element('speed').value),'5','manual mode retains the independent user rate');
});

test('unknown choices are gray and cannot launch another search',async()=>{
  const app=host();await app.ready();await app.answer(await app.pending(),{status:'unknown',reason:'time_limit'});
  const state=app.ui().state().eligibility;assert.deepEqual(clean(state.ready),[]);
  assert(state.dimmed.includes(app.id(f.a)));
  app.ui().setTool('swap');const count=app.requests.length;
  assert.equal(app.ui().selectNode(app.id(f.a)),false);
  assert.equal(app.ui().selectNode(app.id(f.b)),false);
  assert.equal(app.requests.length,count);assert.equal(app.requests.some(x=>x.request.task==='manual-swap'),false);
  assert.equal(app.snapshot().history.length,0);assert.equal(app.ui().state().phase,'selecting');
  assert.match(app.ui().state().status,/No verified swap ready/);
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().pairTarget,0);
  assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'true');
  assert.equal(app.element('csGo'),null);
});

test('Stop during the pre-animation pause cancels the swap without making any move',async()=>{
  const app=host();await app.ready();await app.answer(await app.pending(),readyResult(app));
  const before=app.mapping();app.choose(f.a,f.b);await app.advance(0);
  assert.equal(app.ui().state().phase,'executing');await app.advance(100);
  assert.equal(app.ui().stop(),true);await app.advance(1000);
  assert.equal(app.ui().state().phase,'selecting');assert.equal(app.snapshot().animating,false);
  assert.equal(app.snapshot().history.length,0);assert.deepEqual(app.mapping(),before);
  assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().pairTarget,0);
  assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'true');
});

test('an unresolved partner stays gray; changing first-node selection restores aggregate readiness',async()=>{
  const app=host();await app.ready();const result=readyResult(app);await app.answer(await app.pending(),result);
  const unresolvedPartner=result.candidateNodes.find(n=>n!==f.a&&n!==f.b&&eligibilityStatus(result,f.a,n)===1);
  assert.notEqual(unresolvedPartner,undefined);
  app.ui().setTool('swap');assert.equal(app.ui().selectNode(app.id(f.a)),true);
  assert.equal(app.ui().selectNode(app.id(unresolvedPartner)),false);
  assert.deepEqual(clean(app.ui().state().pair),[app.id(f.a)]);
  assert.equal(app.requests.some(x=>x.request.task==='manual-swap'),false);
  app.click('csPairA');assert.deepEqual(clean(app.ui().state().pair),[]);assert.equal(app.ui().state().pairTarget,0);
  assert.equal(app.element('csPairA').getAttribute('aria-pressed'),'true');
  assert.deepEqual([...app.ui().state().eligibility.ready].sort(),[app.id(f.a),app.id(f.b)].sort());
  assert(app.ui().state().eligibility.dimmed.includes(app.id(unresolvedPartner)));
  assert.equal(app.snapshot().history.length,0);
});

test('adding a conflicting hold withdraws readiness immediately and stale replies cannot restore it',async()=>{
  const app=host();await app.ready();const old=await app.pending(),payload=await app.answer(old,readyResult(app));
  app.ui().setTool('swap');app.ui().selectNode(app.id(f.a));
  assert(app.ui().state().eligibility.ready.includes(app.id(f.b)));
  app.ui().setTool('hold');app.ui().selectNode(app.id(f.blocks));
  assert.deepEqual(clean(app.ui().state().eligibility.ready),[],'adding constraints cannot retain an unverified old witness');
  const fresh=await app.pending();assert.notEqual(fresh,old);old.worker.reply(payload,true);await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility.ready),[]);
  await app.answer(fresh,{status:'unknown',reason:'time_limit'});assert.deepEqual(clean(app.ui().state().eligibility.ready),[]);
  assert.equal(app.snapshot().history.length,0);
});

test('a changed color state invalidates all old readiness and rejects late old responses',async()=>{
  const app=host();await app.ready();const old=await app.pending(),payload=await app.answer(old,readyResult(app));
  assert(app.ui().state().eligibility.ready.length);assert.equal(app.context.PUZZLE_API.move('R'),false,'manual puzzle turns are locked in constrained mode');
  app.ui().setActive(false);assert.equal(app.context.PUZZLE_API.move('R'),true);await app.settleSolver();await app.ready();
  const fresh=await app.pending();assert.notEqual(fresh,old);old.worker.reply(payload,true);await app.advance(0);
  assert.deepEqual(clean(app.ui().state().eligibility.ready),[],'old color-state witnesses cannot be advertised for a new state');
  assert.equal(app.snapshot().history.length,1);
});

test('an advertised witness that does not satisfy this request is rejected before any moves',async()=>{
  const app=host();await app.ready();const wrong=model.moves.findIndex(m=>m.name==='R');
  await app.answer(await app.pending(),readyResult(app,{word:[wrong]}));app.choose(f.a,f.b);await app.advance(0);
  assert.equal(app.snapshot().history.length,0,'UI independently verifies the retained word before animation');
  assert.notEqual(app.ui().state().phase,'executing');
  assert.deepEqual(clean(app.ui().state().eligibility.ready),[],'invalid readiness is discarded');
});
