'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {quality}=require('./connected-ring-maps.test.cjs');
const {recorder,visiblePaths,stickerMarks,pathIndex}=require('./connected-map-recorder.cjs');
const {physicalAxes}=require('./ring-intersection-audit.cjs');
const geometryOnly=process.argv.includes('--geometry-only');
for(const [name,count,faces]of [['pyraminx',36,4],['tetraminx',24,4],['megaminx',132,12]]){
 const app=createHarness({htmlPath:path.join(__dirname,'../dist/games/'+name+'.html'),bundled:true,speed:5}),E=app.context[name==='megaminx'?'MegaEngine':'TetraEngine'],G=app.context[name==='megaminx'?'MegaRings':'TetraRings'],capture=recorder();
 assert.equal(G.slots.length,count);const radius=G.nodeRadius||G.layout().radius,metrics=geometryOnly?{min:Math.min(...G.slots.flatMap((a,i)=>G.slots.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.y-b.y))))}:quality(G.slots,radius,name),solved=E.makeSolved(),palette=new Set(solved.map(s=>s.color)),mobility=physicalAxes(E,solved,'fixed'),immobile=new Set([...mobility].filter(([,axes])=>!axes.length).map(([id])=>id));
 assert.equal(new Set(E.slots.map(s=>s.face)).size,faces);
 for(const guide of G.guides){assert.equal(guide.guide,true);assert.equal(guide.draggable,false);assert(!G.rings.includes(guide),name+' faint face guide is not a rotation ring');for(const face of Object.keys(E.configs))assert(!G.orbits(face).includes(guide),name+' face guide cannot be an animation route');for(const p of guide.points.filter((_,i)=>i%Math.max(1,Math.floor(guide.points.length/8))===0))assert.notEqual(G.nearestRing(p)?.ring,guide,name+' face guides cannot be dragged as puzzle axes');}
 const mixed=E.scramble('connected-inline-'+name,25).reduce((s,m)=>E.applyMove(s,m),solved),colors=new Map();
 for(const s of mixed){const p=G.position(s),face=E.slots[s.slot].face;assert(Math.hypot(p.x-G.position(s.slot).x,p.y-G.position(s.slot).y)<1e-7);if(!colors.has(face))colors.set(face,new Set());colors.get(face).add(s.color);}
 assert([...colors.values()].some(c=>c.size>1),name+' represents actual scrambled face colors');let checked=0;
 for(const state of [solved,mixed])for(const face of Object.keys(E.configs))for(const dir of [-1,1]){
  const move={face,dir,turns:1},after=E.applyMove(state,move),ring=G.getRing(face),orbits=G.allByFace[face];assert(orbits&&orbits.length,name+' '+face+' axis has transport paths');
  for(const t of [0,.17,.43,.79,1]){
   const result=G.render(capture.context,{width:600,height:600,selected:face,state,animation:{move,after},progress:t,showPaths:false,pieceLabels:false}),v=result.viewport,toScreen=p=>({x:(v.cx??v.ox)+p.x*v.scale,y:(v.cy??v.oy)+p.y*v.scale}),paths=visiblePaths(capture),drawnDistance=pathIndex(paths.filter(s=>s.width>Math.max(...paths.map(t=>t.width))-.05).map(s=>s.path)),selectedDistance=pathIndex(orbits.map(r=>[{points:r.points.map(toScreen)}]));
   assert(paths.length>=4,name+' principal rings remain visible');const dots=stickerMarks(capture,palette);assert.equal(dots.length,count,name+' one filled mark per sticker');assert(dots.every(d=>!d.invalid&&d.alpha>=.95),name+' opaque unsplit circles');dots.forEach((d,i)=>{assert.equal(d.kind,'circle',name+' all stickers use circular nodes');assert(Math.abs(d.r-dots[0].r)<1e-7,name+' fixed and moving nodes have the same radius');assert.equal(d.outlineColor==='#ffffff',state[i].slot!==after[i].slot,name+' white outline matches actual selected-axis travel');});
   state.forEach((s,i)=>{const p=G.interpolateSticker(s,after[i],ring,t,dir),a=G.position(s),b=G.position(after[i]),screen=toScreen(p);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(dots.some(d=>d.color===s.color&&Math.hypot(d.x-screen.x,d.y-screen.y)<1e-5),name+' interpolation agrees with actual canvas');if(t===0)assert(Math.hypot(p.x-a.x,p.y-a.y)<1e-6);if(t===1)assert(Math.hypot(p.x-b.x,p.y-b.y)<1e-6,name+' exact engine endpoint');if(s.slot===after[i].slot)assert(Math.hypot(p.x-a.x,p.y-a.y)<1e-6,name+' stationary sticker stays fixed');else{assert(drawnDistance(screen)<1.1,name+' moving sticker follows a visible stroke');assert(selectedDistance(screen)<1.1,name+' moving sticker follows selected axis path');checked++;}});
  }
 }
 console.log(name+': '+count+' single-color marks ('+immobile.size+' fixed references), '+checked+' visible transport-path incidences, exact endpoints, stationary nodes, solved minimum spacing '+metrics.min.toFixed(1)+(geometryOnly?' (readability not checked)':'')+' PASS');
}
