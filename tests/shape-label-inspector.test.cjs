'use strict';
// Critical UI checks: axis targets stay attached to their actions after orbit,
// and every real piece remains identifiable from the map after shape changes.
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
for(const type of ['rhombic','flatdiamond','cornerocta','trajber','pyramorphix']){
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games',type+'.html'),bundled:true,speed:5}),api=app.context.PUZZLE_API,engine=app.context.ShapeEngine;
 let targets=[];const original=app.context.ShapeRenderer;
 app.context.ShapeRenderer={...original,render:(...args)=>{const result=original.render(...args);targets=result.targets;return result;}};
 const cube=app.elements.get('cube'),ring=app.elements.get('rings');
 app.click('homeView');app.frame(0);
 const startView=app.snapshot().view;cube.dispatch('pointerdown',{clientX:0,clientY:0});cube.dispatch('pointermove',{clientX:(-.62-startView.yaw)/.009,clientY:(.48-startView.pitch)/.009});cube.dispatch('pointerup',{clientX:(-.62-startView.yaw)/.009,clientY:(.48-startView.pitch)/.009});app.frame(0);
 const starting=targets.map(t=>t.face).sort();assert.deepEqual(Array.from(starting),['F','R','U']);
 // Arbitrary camera orbit, retaining the original fixed mechanism frame.
 cube.dispatch('pointerdown',{clientX:80,clientY:80});cube.dispatch('pointermove',{clientX:217,clientY:111});cube.dispatch('pointerup',{clientX:217,clientY:111});app.frame(0);
 assert.deepEqual(Array.from(targets.map(t=>t.face).sort()),['F','L','U']);
 for(const target of targets.slice()){
  cube.dispatch('pointerdown',{clientX:target.x,clientY:target.y});cube.dispatch('pointerup',{clientX:target.x,clientY:target.y});
  assert.equal(app.snapshot().selected,target.face,'badge selects '+type+' '+target.face);
  app.click('cw');app.complete();assert.equal(app.snapshot().history.at(-1).face,target.face,'turn follows badge '+type+' '+target.face);
 }
 api.reset();api.runMoves("R U F' L2 B");app.complete();app.click('pieceLabels');app.frame(0);
 assert.equal(app.elements.get('pieceLabels').attributes['aria-pressed'],'true');
 const reference=engine.create(type);for(const move of ['R','U',"F'",'L2','B'])reference.applyMove(move);
 const views=app.context.ShapeRings.create(reference).views();
 for(const piece of reference.pieces){
  let point=views.find(v=>v.piece.id===piece.id);
  assert(point,'every real piece, including tips, has a sticker node');
  // The connected map computes its viewport from the current geometry. Use
  // the production bridge's current node pose rather than a historical scale.
  const node=app.context.PUZZLE_SOLVER_BRIDGE.nodes().find(n=>String(n.stickerId)===String(point.id)),bounds=ring.getBoundingClientRect();
  assert(node,'every real sticker is exposed by the live ring map');
  const pointer={clientX:bounds.left+node.x,clientY:bounds.top+node.y};
  ring.dispatch('pointerdown',pointer);ring.dispatch('pointerup',pointer);app.frame(0);
  const text=app.elements.get('pieceInfo').textContent,home=piece.name||original.slotName(piece.home),slot=original.slotName(piece.pos),orientation=app.context.ShapeGuideOrientation.describe(piece);
  assert(text.startsWith(home+' → '+slot+' · '),'inspect correct piece '+type+' '+home+': '+text);
  assert(text.includes(orientation),'orientation readable '+type+' '+home);
  assert(!text.includes('[object Object]')&&!text.includes('undefined'));
 }
 // Turning while a piece is inspected refreshes its live location/orientation.
 const last=reference.pieces.at(-1);api.move('R');app.complete();reference.applyMove('R');
 const home=last.name||original.slotName(last.home);assert(app.elements.get('pieceInfo').textContent.startsWith(home+' → '+original.slotName(last.pos)+' · '));
 console.log(type+': orbited axis badge selection, turn routing, all real-piece map inspection, guide orientation, and live inspector update PASS');
}
