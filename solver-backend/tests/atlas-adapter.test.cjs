'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadSnapshot,fixedAdapter,shapeAdapter}=require('../tools/export-models.cjs');
const {mapSnapshot,requestFromSnapshot}=require('../src/atlas-adapter.cjs');
function setup(id){const model=require('../data/'+id+'.json'),engine=loadSnapshot(id),adapter=model.requiresOccupiedState?shapeAdapter(engine):fixedAdapter(engine);return{model,engine,adapter};}
test('current cube sticker identity maps to its current spatial node',()=>{
 const {model,adapter}=setup('cube2');adapter.apply({face:'R',dir:1,turns:1});const state=adapter.getState(),mapping=mapSnapshot(model,state),expected=adapter.mapping();
 state.forEach((s,i)=>assert.equal(mapping.stickerToNode[String(s.id)],expected[i]));
 const request=requestFromSnapshot(model,state,{swapStickerIds:state.slice(0,2).map(s=>s.id),mode:'exact_swap'});
 assert.equal(request.protected.length,22);assert.equal(request.mode,'protected_swap');
 assert.throws(()=>requestFromSnapshot(model,state,{swapStickerIds:[state[0].id,state[1].id],protectedStickerIds:[state[0].id]}),/protected/);
});
test('shape-changing nodes protect occupied physical poses, not empty potential slots',()=>{
 const {model,adapter}=setup('pyramorphix');adapter.apply({face:'R',dir:1,turns:1});adapter.apply({face:'U',dir:-1,turns:1});
 const state=adapter.getState(),mapping=mapSnapshot(model,state);assert.equal(mapping.occupiedNodes.length,16);assert.equal(model.degree,32);
 const request=requestFromSnapshot(model,state,{swapStickerIds:state.slice(0,2).map(s=>s.id),mode:'exact_swap'});
 assert.equal(request.protected.length,14);assert.equal(request.occupiedNodes.length,16);
 assert.ok(request.protected.every(p=>request.occupiedNodes.includes(p)));
});
test('reject animation and Helicopter jumbling before attempting mapping',()=>{
 const {model,adapter}=setup('helicopter');const stickers=adapter.getState();
 assert.equal(mapSnapshot(model,{stickers}).occupiedNodes.length,48);
 assert.throws(()=>mapSnapshot(model,{stickers,advanced:true}),/jumbling/);
 assert.throws(()=>mapSnapshot(model,{stickers,axisStops:{UF:1}}),/jumbling/);
 assert.throws(()=>mapSnapshot(model,{stickers,animating:true}),/finish/);
});
