'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mapSnapshot}=require('../solver-backend/src/atlas-adapter.cjs');
const {autoRequestFromSnapshot,verifyAutoPlan,solvedProgress}=require('../solver-backend/src/auto-adapter.cjs');
const {solveFull}=require('../solver-backend/src/full-solve.cjs');
const root=path.resolve(__dirname,'../dist/games');
const model=JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-models/megaminx.json'),'utf8'));
const cache=JSON.parse(fs.readFileSync(path.join(root,'constrained-solver-caches/megaminx.json'),'utf8'));
const html=fs.readFileSync(path.join(root,'megaminx.html'),'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>/root\.MegaEngine\s*=/.test(s));
const plain=x=>JSON.parse(JSON.stringify(x));

function engine(method,ulps=0){
  const context={Math:Object.create(Math)};
  // ECMAScript transcendental implementations may differ in their last bits.
  // Reproduce the branch-cut failure without changing the legal puzzle cuts.
  if(method)context.Math[method]=(...args)=>Math[method](...args)*(1+ulps*Number.EPSILON);
  vm.createContext(context);vm.runInContext(source,context);
  return context.MegaEngine;
}

const canonical=engine().slots.map(s=>s.face+':'+s.kind+':'+s.pieceFaces.join(''));
for(const [method,ulps] of [[null,0],...['sin','cos'].flatMap(method=>[-4,-1,1,4].map(ulps=>[method,ulps]))]){
  const label=method?`${method} ${ulps>0?'+':''}${ulps} relative epsilon`:'native arithmetic';
  test(`Megaminx keeps cached sticker identities and solves legal scrambles with ${label}`,()=>{
    const E=engine(method,ulps),solved=plain(E.makeSolved());
    assert.deepEqual(plain(E.slots.map(s=>s.face+':'+s.kind+':'+s.pieceFaces.join(''))),plain(canonical));
    assert.deepEqual({...mapSnapshot(model,solved).stickerToNode},model.homeBySticker);
    // Every legal turn must remain byte-for-byte compatible with the shipped
    // model, which is used by both manual constrained swaps and Auto Solve.
    for(const move of model.moves){
      const actual=plain(E.applyMove(solved,move.engineMove));
      assert.deepEqual(actual.map(s=>s.slot),move.perm,move.name);
    }
    let state=solved;
    for(const move of E.scramble('S9 repro',40))state=E.applyMove(state,move);
    const snapshot={stickers:plain(state),history:[]};
    const plan=solveFull(model,autoRequestFromSnapshot(model,snapshot),{cache,maxMs:10000,maxOutputMoves:20000});
    assert.equal(plan.status,'solved',JSON.stringify(plan));
    assert(verifyAutoPlan(model,snapshot,plan));
    const protectedIds=new Map();
    for(const stage of plan.stages){
      const before=mapSnapshot(model,{stickers:plain(state)});
      for(const node of stage.protectedNodes)protectedIds.set(node,before.nodeToSticker[node]);
      for(const index of stage.moveIndices)state=E.applyMove(state,model.moves[index].engineMove);
      const after=mapSnapshot(model,{stickers:plain(state)});
      for(const [node,id]of protectedIds)assert.equal(after.stickerToNode[id],node);
    }
    assert.equal(solvedProgress(model,{stickers:plain(state)}).solvedCount,132);
    assert(E.isSolved(state));
  });
}
