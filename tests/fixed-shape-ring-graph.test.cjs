'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Shape=require('../dist/games/shape-engine'),Ghost=require('../dist/games/ghost-engine'),Rings=require('../dist/games/connected-rings');
const {recorder,stickerMarks}=require('./connected-map-recorder.cjs');
const {quality}=require('./connected-ring-maps.test.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const specs=[['axis',5,48],['ghost',6.2,49],['pyramorphix',12,18],['mastermorphix',10,30],['flatdiamond',7,78]];
for(const [type,radius,ringCount]of specs)test(type+' restores compact physical-tile paths, without vacant-node outlines or post-turn reflow',()=>{
 const model=type==='ghost'?Ghost.create():Shape.create(type),map=Rings.create(model),capture=recorder(),options={width:600,height:500,focus:true,selected:null},data=require('../dist/games/constrained-solver-models/'+type+'.json');
 assert.equal(map.rings.length,ringCount,'solved map retains the compact occupied-orbit inventory');assert.equal(map.nodeRadius,radius);
 if(type!=='ghost')quality(map.views(),radius,type);
 const solved=map.render(capture.context,options),goalPoints=solved.dots.map(d=>[d.sticker,d.color,d.x,d.y,d.r]),counts=solved.dots.map(d=>d.color).sort();
 const verifyDrawing=()=>{assert.equal(stickerMarks(capture,new Set(model.slots.map(s=>s.color))).length,model.slots.length);assert(!capture.strokes.some(s=>!s.filled&&s.path.some(p=>p.arc)),'no vacant-location outline masquerades as a tile');};verifyDrawing();
 model.scramble('compact-physical-map-'+type,25).forEach(move=>model.applyMove(move));
 for(const cfg of model.configs)for(const dir of [-1,1]){
  const move={face:cfg.id,dir,turns:1},before=map.views().map(v=>({...v})),moving=new Set(model.movingPieces(move)),ends=before.map(v=>map.interpolate(v,{move,progress:1}));
  for(const progress of [0,.17,.43,.78,1])for(const v of before){const p=map.interpolate(v,{move,progress});if(distance(v,ends.find(e=>e.id===v.id))>1e-7)assert(Math.min(...map.orbits(cfg.id).map(c=>map.distance(p,c)))<.12,'every moving tile stays on its visible selected orbit');}
  model.applyMove(move);const after=map.views();
  for(const old of before){const next=after.find(v=>v.id===old.id);assert(distance(ends.find(v=>v.id===old.id),next)<1e-6,'no jump between animation endpoint and committed tile position');if(!moving.has(old.piece.id))assert(distance(old,next)<1e-7,'unmoved stickers never reflow');}
  assert.equal(map.nodeRadius,radius,'turns do not shrink all nodes');
 }
 // Verify a long changing sequence, not only move/inverse pairs. Frame ends
 // are compared against independently committed engine poses at every turn.
 for(const move of model.scramble('long-no-reflow-'+type,120)){
  const before=map.views(),moving=new Set(model.movingPieces(move)),ends=new Map(before.map(v=>[v.id,map.interpolate(v,{move,progress:1})]));model.applyMove(move);
  for(const v of map.views()){assert(distance(v,ends.get(v.id))<1e-6);if(!moving.has(v.piece.id))assert(distance(v,before.find(b=>b.id===v.id))<1e-7);}
  assert.equal(map.nodeRadius,radius);
 }
 const live=map.render(capture.context,options);verifyDrawing();assert.equal(live.dots.length,model.slots.length);assert.deepEqual(live.dots.map(d=>d.color).sort(),counts);
 const before=JSON.stringify(model.snapshot()),goal=map.render(capture.context,{...options,goalPreview:true});verifyDrawing();assert.deepEqual(goal.dots.map(d=>[d.sticker,d.color,d.x,d.y,d.r]),goalPoints,'preview uses the actual pristine solved tile map and radius');assert(goal.dots.every(d=>d.goalColor===d.color));assert.equal(JSON.stringify(model.snapshot()),before,'goal preview is read-only');assert.deepEqual(map.render(capture.context,options),live,'release restores exact live geometry');
 // An exact pair-orbit closure covers all pairs that can coexist. This proves
 // the fixed radius safe even for configurations never used as test scrambles.
 const degree=data.degree,pairs=[],seen=new Set(),add=(a,b)=>{if(a>b)[a,b]=[b,a];const key=a*degree+b;if(!seen.has(key)){seen.add(key);pairs.push([a,b]);}};
 for(const a of data.initialOccupied)for(const b of data.initialOccupied)if(a<b)add(a,b);
 for(let i=0;i<pairs.length;i++)for(const m of data.moves)add(m.perm[pairs[i][0]],m.perm[pairs[i][1]]);
 const points=data.nodes.map(n=>map.position(n));let separation=Infinity;for(const [a,b]of pairs)separation=Math.min(separation,distance(points[a],points[b]));assert(separation>2*radius+1,'all legal simultaneously occupied tiles stay separate: '+separation);
});
