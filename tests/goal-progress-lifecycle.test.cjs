'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {offerVerifiedSwap}=require('./verified-swap-fixture.cjs');
const games=path.join(__dirname,'../dist/games'),clean=x=>JSON.parse(JSON.stringify(x));
function host(id='cube2'){
 const workers=[];class Worker{constructor(){workers.push(this);}postMessage(request){this.request=clean(request);}terminate(){}addEventListener(){}removeEventListener(){}}
 const fetch=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
 const app=createPage(id,{globals:{fetch,Worker}});app.workers=workers;app.api=app.context.PUZZLE_API;app.ui=app.context.ConstrainedSolverUI;app.core=app.context.ConstrainedSolverCore;app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));
 app.until=async predicate=>{for(let i=0;i<4000;i++){if(predicate())return;await app.advance(100);}throw Error('condition did not settle: '+JSON.stringify(app.ui.state()));};
 app.ready=async()=>{await app.advance(0);};
 app.worker=task=>workers.findLast(w=>w.request?.task===task);
 app.reply=(worker,result)=>worker.onmessage({data:{id:worker.request.id,type:'result',result,modelFingerprint:app.core.modelFingerprint(app.model)}});
 app.baseline=names=>{const start=app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode,indices=names.map(name=>app.model.moves.findIndex(m=>m.name===name)),targetId=Object.keys(start).find(id=>start[id]!==app.model.homeBySticker[id]);assert(targetId);return {status:'solved',goalSemantics:'identity',stages:[{sourceNode:start[targetId],targetNode:app.model.homeBySticker[targetId],moveIndices:indices,protectedNodes:[],newlySolvedNodes:Object.values(app.model.homeBySticker)}],moveIndices:indices,finalProtectedNodes:Object.values(app.model.homeBySticker)};};
 return app;
}
function assertBar(app){const state=app.ui.state(),bar=app.element('csAutoProgressBar'),count=state.auto?.lockedNodes.length||0;assert.equal(bar.value,count);assert.equal(bar.max,app.model.stickerCount);assert.match(app.element('csAutoProgressLabel').textContent,/secured|Planning/);}

test('manual constrained Stop still finishes the current permutation and discards remaining sequence after metric removal',async()=>{
 const app=host();await app.ready();await app.ui.setActive(true);
 const map=app.core.mapSnapshot(app.model,app.snapshot()),move=app.model.moves.find(m=>m.name==='R2'),a=map.occupiedNodes.find(n=>move.perm[n]!==n),b=move.perm[a];
 const index=app.model.moves.findIndex(m=>m.name==='R');await offerVerifiedSwap(app,app.model,a,b,Array(6).fill(index));
 app.ui.setTool('swap');assert(app.ui.selectNode(map.nodeToSticker[a]));assert(app.ui.selectNode(map.nodeToSticker[b]));
 assert(!app.worker('manual-swap'),'stored witness needs no speculative search');
 await app.until(()=>app.context.PuzzleJournal.state().cursor===1);
 app.ui.stop();assert(app.snapshot().animating,'active permutation finishes smoothly');await app.until(()=>app.ui.state().phase==='selecting');assert.equal(app.context.PuzzleJournal.state().cursor,2);assert.equal(app.ui.state().held.length,0);assert.equal(app.ui.state().pair.length,0);assert.match(app.ui.state().status,/unfinished sequence/);await app.advance(5000);assert.equal(app.context.PuzzleJournal.state().cursor,2,'remaining turns discarded');
});

test('Auto Solve top bar advances only at secured checkpoints and leaves the verified plan unchanged',async()=>{
 const app=host();await app.ready();app.api.runMoves(['R','U']);await app.settle();const startCursor=app.context.PuzzleJournal.state().cursor;
 const home=app.model.homeBySticker,current={...app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode};
 const stageWords=[['F',"F'","U'"],['R','R','R']],words=stageWords.map(names=>names.map(name=>app.model.moves.findIndex(m=>m.name===name)));
 const compose=indices=>{const p=Array.from({length:app.model.degree},(_,n)=>n);for(const i of indices)for(let n=0;n<p.length;n++)p[n]=app.model.moves[i].perm[p[n]];return p;},perms=words.map(compose);
 const initial=Object.keys(home).filter(id=>current[id]===home[id]&&perms.every(p=>p[home[id]]===home[id])).slice(0,1).map(id=>home[id]);assert.equal(initial.length,1);
 let locked=initial.slice();const stages=[];
 for(let step=0;step<words.length;step++){
  const after=Object.fromEntries(Object.entries(current).map(([id,node])=>[id,perms[step][node]]));
  const candidates=Object.keys(home).filter(id=>after[id]===home[id]&&!locked.includes(home[id])&&(step===1||perms[1][home[id]]===home[id]));
  const newly=(step===0?candidates.slice(0,2):candidates).map(id=>home[id]),targetId=candidates[0];assert(newly.length);
  stages.push({sourceNode:current[targetId],targetNode:home[targetId],moveIndices:words[step],protectedNodes:locked.slice(),newlySolvedNodes:newly});
  Object.assign(current,after);locked.push(...newly);
 }
 const plan={status:'solved',goalSemantics:'identity',initialProtectedNodes:initial,stages,moveIndices:words.flat(),finalProtectedNodes:Object.values(home)},original=JSON.stringify(plan);assert(app.core.verifyAutoPlan(app.model,app.snapshot(),plan));
 await app.ui.autoSolve();app.reply(app.worker('full-solve'),plan);assertBar(app);assert.equal(app.element('csAutoProgressBar').value,1);
 for(let step=0;step<stages.length;step++){
  const checkpoint=app.element('csAutoProgressBar').value;
  while(app.ui.state().phase==='executing'){
   await app.advance(100);if(app.ui.state().phase==='executing')assert.equal(app.element('csAutoProgressBar').value,checkpoint,'upper progress stays fixed through individual turns');
  }
  assert.equal(app.ui.state().phase,'auto-gap');assertBar(app);
  const secured=stages[step].protectedNodes.length+stages[step].newlySolvedNodes.length;assert.equal(app.element('csAutoProgressBar').value,secured);assert(secured>=checkpoint);
  if(step+1<stages.length)await app.until(()=>app.ui.state().phase==='executing');
 }
 await app.until(()=>!app.ui.state().active);
 assert.equal(app.context.PuzzleJournal.state().cursor,startCursor+words.flat().length,'exactly the original planned moves executed');assert.equal(JSON.stringify(plan),original,'UI removal must not alter the supplied plan');
 assert.equal(app.element('playSolvedReadout'),null);
});

test('failed or canceled auto planning does not make a move or leave a removed metric',async()=>{
 const app=host();await app.ready();app.api.runMoves(['R']);await app.settle();const before=clean(app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode),cursor=app.context.PuzzleJournal.state().cursor;
 await app.ui.autoSolve();app.reply(app.worker('full-solve'),{status:'unknown',reason:'time_limit'});assert.equal(app.context.PuzzleJournal.state().cursor,cursor);
 await app.ui.autoSolve();app.ui.cancel();assert.equal(app.context.PuzzleJournal.state().cursor,cursor);assert.deepEqual(clean(app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode),before);assert.equal(app.element('playSolvedReadout'),null);
});

const catalog=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'))).models;
test('all puzzles keep native secured progress and Auto Solve completion without the removed readout',async()=>{
 for(const {id} of catalog){
  const app=host(id);await app.ready();const move=app.model.moves.find(m=>m.perm.some((n,i)=>n!==i));
  let order=1,p=move.perm.slice();while(p.some((n,i)=>n!==i)&&order<10){p=p.map(n=>move.perm[n]);order++;}assert(order<10,id+' finite native move order');
  assert(app.api.runMoves([move.engineMove]),id);await app.settle();
  const plan=app.baseline(Array(order-1).fill(move.name)),map=app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode;
  const initial=Object.entries(app.model.homeBySticker).filter(([key,node])=>map[key]===node&&move.perm[node]===node).slice(0,1).map(([,node])=>node);
  plan.initialProtectedNodes=initial;plan.stages[0].protectedNodes=initial;assert(app.core.verifyAutoPlan(app.model,app.snapshot(),plan),id+' verified fixture');
  await app.ui.autoSolve();app.reply(app.worker('full-solve'),plan);assert.equal(app.element('csAutoProgressBar').value,initial.length,id);assertBar(app);
  await app.until(()=>app.ui.state().phase==='auto-gap');assert.equal(app.element('csAutoProgressBar').value,app.model.stickerCount,id);assertBar(app);
  await app.until(()=>!app.ui.state().active);assert.equal(app.core.solvedProgress(app.model,app.snapshot()).solvedCount,app.model.stickerCount,id+' complete native solve');assert.equal(app.element('playSolvedReadout'),null,id);
 }
});

test('all puzzles retain randomize stop, further moves and reset without metric hooks',async()=>{
 for(const {id} of catalog){const app=host(id);await app.ready();const journal=app.context.PuzzleJournal;
  assert(app.api.randomize(),id);await app.until(()=>journal.state().cursor>=1);assert(app.api.stopScrambleNow(),id);await app.advance(0);const stopped=journal.state().cursor;
  const move=app.model.moves[0].engineMove;assert(app.api.runMoves([move,move]),id);await app.settle();assert.equal(journal.state().cursor,stopped+2,id+' follow-up sequence intact');
  app.api.reset();await app.advance(0);assert.equal(journal.state().cursor,0,id+' reset');assert.equal(app.element('playTimer'),null,id);
 }
});

test('journal sequence Stop preserves the actual partial state and redo without metric hooks',async()=>{
 const app=host();await app.ready();const journal=app.context.PuzzleJournal;
 journal.beginSequence('Example solve sequence');app.api.runMoves(['R','U','F']);await app.settle();journal.endSequence();const before=clean(app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode);
 assert(journal.navigate(-1,true));await app.until(()=>journal.state().cursor===2);assert(app.api.stopPlaybackNow());await app.advance(0);assert.equal(journal.state().cursor,2);
 assert(journal.navigate(1,false));await app.settle();assert.deepEqual(clean(app.core.mapSnapshot(app.model,app.snapshot()).stickerToNode),before);
});
