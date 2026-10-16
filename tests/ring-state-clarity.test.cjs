'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/games/shape-engine.js'),R=require('../dist/games/connected-rings.js');
const {quality,recorder}=require('./connected-ring-maps.test.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
for(const [type,degree,minimum,radius]of [['axis',168,11.37,5],['mastermorphix',80,21.86,10],['pyramorphix',32,42.87,12]])test(type+': certified pose spacing prevents node shrink through any legal state',()=>{
 const model=E.create(type),map=R.create(model),spec=require('../dist/games/constrained-solver-models/'+type+'.json');
 assert.equal(spec.degree,degree);const points=spec.nodes.map(s=>map.project(map.direction(s)));let separation=Infinity;
 if(type==='axis'){
  // Occupied-pair closure is exact and small: every legal configuration pair
  // is an image of a solved occupied pair. It does not enumerate states.
  const pairs=[],seen=new Set(),add=(a,b)=>{if(a>b)[a,b]=[b,a];const key=a*degree+b;if(!seen.has(key)){seen.add(key);pairs.push([a,b]);}};
  for(const a of spec.initialOccupied)for(const b of spec.initialOccupied)if(a<b)add(a,b);
  for(let k=0;k<pairs.length;k++)for(const move of spec.moves)add(move.perm[pairs[k][0]],move.perm[pairs[k][1]]);
  assert.equal(pairs.length,13632);for(const [a,b]of pairs)separation=Math.min(separation,distance(points[a],points[b]));
  const solved=map.views();let largestFace=0;for(const a of solved)for(const b of solved)if(a.color===b.color)largestFace=Math.max(largestFace,distance(a,b));assert(largestFace<250,'solved face groups stay compact within the 500px map');
 }else for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)separation=Math.min(separation,distance(points[i],points[j]));
 assert(separation>minimum,'complete legal pose set separates all nodes: '+separation);assert(separation>2*radius+1);
 quality(map.views(),radius,type);assert.equal(map.nodeRadius,radius);
 for(let seed=0;seed<12;seed++){model.reset();model.scramble('stable-ring-'+seed,25).forEach(move=>model.applyMove(move));assert.equal(map.nodeRadius,radius);const result=map.render(recorder().context,{width:600,height:600});assert(result.dots.every(d=>d.r===result.dots[0].r));assert(result.dots[0].r*result.viewport.scale<=10.0001);}
});
for(const type of ['axis','flatdiamond','pyramorphix','mastermorphix'])test(type+': Show goal renders actual solved colors and restores live geometry without mutation',()=>{
 const m=E.create(type),map=R.create(m),capture=recorder(),opts={width:500,height:500,selected:null};
 const home=map.render(capture.context,opts).dots.map(d=>({id:d.sticker,x:d.x,y:d.y,color:d.color,r:d.r}));
 m.scramble('goal-layout-'+type,25).forEach(move=>m.applyMove(move));const state=JSON.stringify(m.snapshot()),before=map.render(capture.context,opts).dots;
 const preview=map.render(capture.context,{...opts,goalPreview:true});
 assert.deepEqual(preview.dots.map(d=>({id:d.sticker,x:d.x,y:d.y,color:d.color,r:d.r})),home);
 assert(preview.dots.every(d=>d.goalColor===d.color));assert.equal(JSON.stringify(m.snapshot()),state);
 assert.deepEqual(map.render(capture.context,opts).dots,before);
});
test('selected ring arrows consistently denote native inverse (positive CCW) turns',()=>{
 for(const type of E.types){const model=E.create(type),map=R.create(model);for(const cfg of model.configs){const cap=recorder(),result=map.render(cap.context,{width:600,height:600,selected:cfg.id}),arrows=cap.strokes.filter(s=>s.path.length===1&&s.path[0].points.length===3),orbits=map.orbits(cfg.id);assert.equal(arrows.length,orbits.length*2);
  let k=0;for(const ring of orbits)for(const fraction of [.18,.58]){const direction=-Math.sign(ring.advance),a=ring.at(ring.period*fraction-.012*direction),b=ring.at(ring.period*fraction+.012*direction),pts=arrows[k++].path[0].points,tail={x:(pts[0].x+pts[2].x)/2,y:(pts[0].y+pts[2].y)/2};assert((pts[1].x-tail.x)*(b.x-a.x)+(pts[1].y-tail.y)*(b.y-a.y)>0,type+' '+cfg.id+' positive direction');}
 }}
});
test('ring focus changes only idle path contrast, preserving selected strokes, dots and viewport',()=>{
 for(const type of E.types){const model=E.create(type),map=R.create(model),a=recorder(),b=recorder(),options={width:600,height:600,selected:model.configs[0].id};const focused=map.render(a.context,{...options,focus:true}),all=map.render(b.context,{...options,focus:false});assert.deepEqual(focused,all);assert.deepEqual(a.strokes.filter(s=>s.width>=2),b.strokes.filter(s=>s.width>=2));assert(a.strokes.some((s,i)=>s.color!==b.strokes[i].color));}
});
