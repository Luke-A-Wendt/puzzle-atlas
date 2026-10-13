'use strict';
const assert=require('node:assert/strict');
const E=require('../dist/games/skewb-engine.js');
const {distance,transform,dot}=E.vector;

// Check rigid mesh positions against the independently precomputed sticker-slot
// permutations, not just against the move/inverse implementation.
function consistent(model) {
  assert.equal(new Set(model.pieces.map(p=>p.pos.join(','))).size,14);
  assert.equal(new Set(model.stickerState.map(s=>s.slot)).size,model.slots.length);
  for(const piece of model.pieces) {
    assert.ok(piece.orientation.flat().every(v=>Number.isInteger(v)&&Math.abs(v)<=1));
    assert.deepEqual(transform(piece.orientation,piece.home),piece.pos);
    for(const sticker of piece.stickers) {
      const slot=model.slots[model.stickerState[sticker.id].slot];
      assert.ok(distance(transform(piece.orientation,sticker.center),slot.center)<1e-8);
      assert.ok(distance(transform(piece.orientation,sticker.normal),slot.normal)<1e-8);
    }
  }
}

for(const type of ['ultimate','diamond']) {
  const m=E.create(type),initial=m.snapshot();
  assert.equal(m.faces.length,type==='ultimate'?12:8);
  assert.equal(m.slots.length,type==='ultimate'?48:32);
  assert.equal(m.pieces.length,14);
  assert.ok(m.isSolved());
  for(const config of m.configs) {
    assert.equal(m.movingPieces(config.id).length,7);
    const permutation=m.permutations[config.id];
    assert.equal(new Set(permutation).size,m.slots.length);
    assert.ok(permutation.some((slot,i)=>slot!==i));
    m.applyMove(config.id);consistent(m);assert.equal(m.isSolved(),false);
    m.applyMove(config.id);consistent(m);
    m.applyMove(config.id);assert.deepEqual(m.snapshot(),initial);
    m.applyMove(config.id).applyMove(config.id,-1);assert.deepEqual(m.snapshot(),initial);
    // A turn and the opposite hemisphere's inverse produce a whole-object
    // rotation: the colors are still solved even though their world frame moves.
    m.applyMove(config.id).applyMove(config.opposite,-1);
    consistent(m);assert.ok(m.isSolved());m.reset();
    assert.equal(m.pieces.filter(p=>dot(p.pos,config.anchor)>0).length,7);
  }
  for(let seed=0;seed<100;seed++) {
    const moves=m.scramble('regression-'+seed,40);
    assert.deepEqual(moves,m.scramble('regression-'+seed,40));
    if(seed>0)assert.notDeepEqual(moves,m.scramble('regression-'+(seed-1),40));
    for(const move of moves)m.applyMove(move);
    consistent(m);
    const manual=m.configs.map(c=>({face:c.id,dir:seed%2?1:-1}));
    manual.forEach(move=>m.applyMove(move));consistent(m);
    m.invertMoves([...moves,...manual]).forEach(move=>m.applyMove(move));
    assert.deepEqual(m.snapshot(),initial);assert.ok(m.isSolved());
  }
  assert.throws(()=>m.applyMove('invalid'));
  assert.throws(()=>m.applyMove('L',0));
  console.log(type+': rigid geometry, slot bijections, 8 hemispheres, inverses and 100 scrambles pass');
}

// An exhaustive graph check against Jaap Scherphuis's published Diamond depth
// distribution validates the actual puzzle, including its orientation rules.
// https://www.jaapsch.net/puzzles/diamond.htm
const m=E.create('diamond'),n=m.slots.length;
const initial=String.fromCharCode(...Array.from({length:n},(_,i)=>i));
const maps=m.configs.slice(0,4).flatMap(c=>{
  const p=m.permutations[c.id];return[p,p.map(i=>p[i])];
});
const states=[initial],seen=new Set(states),histogram=[1];
let head=0,end=1;
while(head<states.length) {
  const state=states[head++];
  for(const map of maps) {
    const result=Array(n);
    for(let i=0;i<n;i++)result[map[i]]=state[i];
    const next=result.join('');
    if(!seen.has(next)){seen.add(next);states.push(next);}
  }
  if(head===end){if(states.length>end)histogram.push(states.length-end);end=states.length;}
}
assert.equal(seen.size,138240);
assert.deepEqual(histogram,[1,8,48,288,1632,8568,36114,74799,16547,220,15]);
console.log('Diamond: every one of 138,240 positions matches the published distance distribution');
