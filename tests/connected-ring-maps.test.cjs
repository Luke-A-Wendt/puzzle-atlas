'use strict';
// These checks use the engine for movement and an independent Canvas recorder
// for visible paths. A map's own hit-testing helper cannot make them pass.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../dist/games/face-grouped-rings.js');
const {recorder,pathDistance,visiblePaths,circleNodes,stickerMarks,pathIndex}=require('./connected-map-recorder.cjs');
const {physicalAxes}=require('./ring-intersection-audit.cjs');
const sets=[['shape-engine',['rhombic','flatdiamond','cornerocta','trajber','pyramorphix','jewel','mastermorphix','diamondstyle','diamondcube']],['dino-engine',['dino','rainbow']],['skewb-engine',['ultimate','diamond','skewb','jing','masterskewb']],['fto-engine',['fto']],['helicopter-engine',['helicopter']],['crystal-engine',['crystal']]];
const normalKey=n=>{const l=Math.hypot(...n);return n.map(v=>Math.round(v/l*1e8)).join(',');};
const quantile=(list,q)=>list.slice().sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(q*list.length))],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),pieceId=v=>typeof v.piece==='object'?v.piece.id:v.piece;
// A face can have close same-color neighbors yet wrap around the entire map.
// Convex hull exclusion independently rejects those misleading annular groups.
const cross2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function convexHull(points){
 const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),lower=[],upper=[];
 for(const p of sorted){while(lower.length>=2&&cross2(lower.at(-2),lower.at(-1),p)<=1e-9)lower.pop();lower.push(p);}
 for(const p of sorted.slice().reverse()){while(upper.length>=2&&cross2(upper.at(-2),upper.at(-1),p)<=1e-9)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function strictlyInsideHull(point,hull){return hull.length>=3&&hull.every((a,i)=>{const b=hull[(i+1)%hull.length];return cross2(a,b,point)>1e-7*Math.hypot(b.x-a.x,b.y-a.y);});}
function faceHullViolations(nodes){
 const groups=new Map();for(const n of nodes){const k=normalKey(n.normal);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);}
 const violations=[];for(const [face,group]of groups){const hull=convexHull(group);if(hull.length<3)continue;const inside=nodes.filter(n=>normalKey(n.normal)!==face&&strictlyInsideHull(n,hull));if(inside.length)violations.push({face,foreignStickers:inside.map(n=>n.id)});}
 return violations;
}
function quality(nodes,radius,tag){
 assert(nodes.length>0);assert(radius>=3,tag+' solved dots must remain large enough to read');assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,tag+' unique sticker nodes');
 for(const n of nodes)assert(Number.isFinite(n.x)&&Number.isFinite(n.y),tag+' finite positions');
 let min=Infinity;const near=[];for(let i=0;i<nodes.length;i++){const list=nodes.filter((_,j)=>i!==j);const nearest=Math.min(...list.map(n=>distance(nodes[i],n)));near.push(nearest);min=Math.min(min,nearest);}
 assert(min>2*radius+.5,tag+' stable nodes must not overlap ('+min.toFixed(2)+' spacing, radius '+radius+')');
 const groups=new Map();for(const n of nodes){const k=normalKey(n.normal);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);}
 let close=0,count=0;const localSpacing=[];
 for(const group of groups.values())if(group.length>1)for(const a of group){const inside=Math.min(...group.filter(n=>n.id!==a.id).map(n=>distance(a,n))),outside=Math.min(...nodes.filter(n=>normalKey(n.normal)!==normalKey(a.normal)).map(n=>distance(a,n)));localSpacing.push(inside);count++;if(inside<outside)close++;}
 assert(!count||close/count>=.75,tag+' current face groups should dominate nearest neighbors ('+close+'/'+count+')');
 assert(!localSpacing.length||quantile(localSpacing,.9)/quantile(localSpacing,.1)<=2.6,tag+' broadly uniform spacing within face groups');
 const hullViolations=faceHullViolations(nodes);assert.equal(hullViolations.length,0,tag+' face groups must not wrap around other faces: '+JSON.stringify(hullViolations));
 return{min,faceNeighborFraction:count?close/count:1,spacingRatio:localSpacing.length?quantile(localSpacing,.9)/quantile(localSpacing,.1):1};
}
function verifyModel(engine,type,{geometryOnly=false}={}){
 const model=engine.create(type),mobility=physicalAxes(model,model.stickerState,'solid'),immobile=new Set([...mobility].filter(([,axes])=>!axes.length).map(([id])=>id)),G=F.create(model),capture=recorder(),palette=new Set(model.slots.map(s=>s.color)),expected=model.slots.length,configs=Array.isArray(model.configs)?model.configs:Object.values(model.configs);let samples=0,currentMobility=mobility,selectedNow=null;
 const draw=(selected,animation)=>{selectedNow=selected;const result=G.render(capture.context,{width:600,height:600,selected,animation,showPaths:false,pieceLabels:false});const v=result.viewport;return p=>({x:(v.cx??v.ox)+p.x*v.scale,y:(v.cy??v.oy)+p.y*v.scale});};
 const checkDots=tag=>{const dots=stickerMarks(capture,palette),views=G.views();assert.equal(dots.length,expected,tag+' one visible filled mark per real sticker');for(const color of palette)assert.equal(dots.filter(d=>d.color===color).length,model.slots.filter(s=>s.color===color).length,tag+' exact physical color count '+color);dots.forEach((d,i)=>{assert(!d.invalid,tag+' unsplit circle');assert(d.alpha>=.95,tag+' solid color opacity');assert.equal(d.kind,'circle',tag+' all stickers use circular nodes');assert(Math.abs(d.r-dots[0].r)<1e-7,tag+' fixed and moving nodes have the same radius');assert.equal(!!views[i].reference,immobile.has(views[i].id),tag+' reference metadata matches independent engine mobility');assert.equal(d.outlineColor==='#ffffff',currentMobility.get(views[i].id).includes(selectedNow),tag+' white outline identifies exactly the stickers physically relocated by this axis');});return dots;};
 const solved=G.views(),metrics=geometryOnly?{min:Math.min(...solved.flatMap((a,i)=>solved.slice(i+1).map(b=>distance(a,b)))),faceNeighborFraction:NaN}:quality(solved,G.nodeRadius,type+' solved');
 // All complete physical axes must draw actual transport loops, without a
 // secondary "show paths" switch. Highlighting may change their contrast only.
 for(const cfg of configs){const id=cfg.id||cfg.face,toScreen=draw(id),paths=visiblePaths(capture);checkDots(type+' '+id+' at rest');assert(paths.length>=2,type+' displays the connected map, not one isolated dial');const widest=Math.max(...paths.map(s=>s.width)),activeDistance=pathIndex(paths.filter(s=>s.width>widest-.05).map(s=>s.path));assert(paths.some(s=>s.width<widest-.1),type+' selected axis is visually emphasized');const orbits=G.orbits(id);assert(orbits.length,type+' '+id+' has physical orbit paths');for(const orbit of orbits){const pts=orbit.points||[];assert(pts.length>=8,type+' '+id+' sampled closed path');const sampled=pts.filter((_,i)=>i%Math.max(1,Math.floor(pts.length/16))===0).map(toScreen);assert(sampled.every(p=>activeDistance(p)<1.1),type+' '+id+' orbit is actually drawn and selected');}}
 for(const mixed of [false,true]){
  model.reset();if(mixed)model.scramble('connected-'+type,9).forEach(move=>model.applyMove(move));currentMobility=physicalAxes(model,model.stickerState,'solid');
  for(const guide of G.guides){assert.equal(guide.guide,true,type+' reference circle is explicitly a guide');assert.equal(guide.draggable,false,type+' reference circle does not invent a turn');assert(!G.rings.includes(guide),type+' guide is not a physical rotation ring');for(const cfg of configs)assert(!G.orbits(cfg.id||cfg.face).includes(guide),type+' guide is not an animation route');for(const p of guide.points.filter((_,i)=>i%Math.max(1,Math.floor(guide.points.length/8))===0))assert.notEqual(G.nearestRing(p)?.ring,guide,type+' guide cannot be selected for dragging');}
  for(const cfg of configs)for(const dir of [1,-1]){
   const id=cfg.id||cfg.face,move={face:id,dir,turns:1},nodes=G.views(),moving=new Set(model.movingPieces(id)),initial=new Map(nodes.map(n=>[n.id,n])),ends=nodes.map(n=>G.interpolate(n,{move,progress:1}));
   for(const n of nodes){const s=model.stickerState.find(s=>s.id===n.id),pose=s.normal?s:model.slots[s.slot];assert.equal(n.color,s.color,type+' actual current sticker color');assert.equal(normalKey(n.normal),normalKey(pose.normal),type+' actual current face direction');}
   for(const t of [0,.13,.37,.61,.89,1]){
    const toScreen=draw(id,{move,progress:t}),paths=visiblePaths(capture),drawnDistance=pathIndex(paths.filter(s=>s.width>Math.max(...paths.map(t=>t.width))-.05).map(s=>s.path)),selectedDistance=pathIndex(G.orbits(id).map(r=>[{points:r.points.map(toScreen)}])),dots=checkDots(type+' '+id+' t='+t);
    for(const n of nodes){const p=G.interpolate(n,{move,progress:t}),screen=toScreen(p);assert.equal(p.color,n.color);assert(dots.some(d=>d.color===n.color&&distance(d,screen)<1e-5),type+' returned animation matches rendered nodes');
     if(immobile.has(n.id))assert(distance(p,n)<1e-6,type+' fixed reference '+n.id+' stays stationary under every axis');
     if(!moving.has(pieceId(n)))assert(distance(p,n)<1e-6,type+' stationary sticker '+n.id+' must not reflow');
     else if(distance(initial.get(n.id),ends.find(e=>e.id===n.id))>1e-5){assert(drawnDistance(screen)<1.1,type+' '+id+' sticker '+n.id+' must stay on an actual visible stroke at '+t);assert(selectedDistance(screen)<1.1,type+' '+id+' sticker '+n.id+' must stay on the selected axis path at '+t);samples++;}
    }
   }
   model.applyMove(move);const after=new Map(G.views().map(n=>[n.id,n]));for(const p of ends)assert(distance(p,after.get(p.id))<1e-6,type+' '+id+' exact engine endpoint '+p.id);model.applyMove({...move,dir:-dir});
  }
 }
 console.log(type+': connected visible paths, '+samples+' animated path incidences, '+immobile.size+' fixed references, stationary nodes, exact endpoints; solved spacing '+metrics.min.toFixed(1)+', face-neighbor '+(geometryOnly?'not checked':Math.round(metrics.faceNeighborFraction*100)+'%')+' PASS');return samples;
}
if(require.main===module){const geometryOnly=process.argv.includes('--geometry-only');let count=0;for(const [file,types]of sets){const full=path.join(__dirname,'../dist/games',file+'.js');if(!fs.existsSync(full))continue;const E=require(full);for(const type of types)count+=verifyModel(E,type,{geometryOnly});}console.log(count+' independent rendered-path incidences checked.');}
module.exports={sets,verifyModel,quality,convexHull,strictlyInsideHull,faceHullViolations,recorder,pathDistance,visiblePaths,circleNodes};
