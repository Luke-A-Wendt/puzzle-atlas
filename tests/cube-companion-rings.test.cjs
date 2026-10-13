'use strict';
// Exercise the production HTML and native animation loop. Incidence is measured
// against captured Canvas strokes, independently of the geometry's hit tester.
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./game-harness.cjs');
const {recorder,circleNodes,visiblePaths,pathIndex}=require('./connected-map-recorder.cjs');

const pages=['cube2','cube3','cube4','cube5','cube6','cube7','mirror','homer'];
const faces=['U','R','F','D','L','B'];
const palette=new Set(['#eeeef6','#f4ce48','#39bd8b','#4c90ef','#ee596e','#f29a4b']);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clone=value=>JSON.parse(JSON.stringify(value));
const selectedPaths=capture=>visiblePaths(capture).filter(p=>p.color==='#baacfb');
const shapeSignature=capture=>JSON.stringify(visiblePaths(capture).map(s=>s.path.map(p=>p.points)));
const fractions=[.13,.37,.61,.89];

function verifyPage(name){
 const capture=recorder();
 const app=createHarness({htmlPath:path.resolve(__dirname,'../dist/games',name+'.html'),bundled:true,
  canvasContexts:{rings:capture.context},dimensions:{rings:{width:600,height:600}},speed:1,search:'?color=1'});
 const E=app.context.MirrorEngine||app.context.CubeEngine,G=app.context.RingGeometry,api=app.context.PUZZLE_API;
 const solved=E.makeSolved(),side=Math.sqrt(solved.length/6);
 let incidences=0,nativeFrames=0;
 const nodes=()=>{const result=circleNodes(capture,palette);assert.equal(result.length,solved.length,name+' one node per sticker');assert(result.every(n=>!n.invalid),name+' unsplit colored nodes');return result;};

 // Fit the viewport from the unchanged solved node layout rather than duplicating
 // per-page scaling constants. Verify the fit against every sticker.
 const initial=nodes(),initialPositions=solved.map(G.position);
 const ref=initialPositions.findIndex(p=>Math.abs(p.x-initialPositions[0].x)>1);
 const scale=(initial[ref].x-initial[0].x)/(initialPositions[ref].x-initialPositions[0].x);
 const ox=initial[0].x-scale*initialPositions[0].x,oy=initial[0].y-scale*initialPositions[0].y;
 const screen=p=>({x:ox+scale*p.x,y:oy+scale*p.y});
 initialPositions.forEach((p,i)=>assert(dist(screen(p),initial[i])<1e-6,name+' retains the existing node layout'));

 assert(Array.isArray(G.faceRings),name+' has own-face companion rings');
 assert.equal(G.faceRings.length,6*Math.floor(side/2),name+' one loop per noncentral face perimeter');
 for(const face of faces){
  const cfg=E.configs[face],tracks=G.faceRings.filter(r=>r.name===face);
  assert.equal(tracks.length,Math.floor(side/2),name+' '+face+' all face perimeters');
  const covered=new Set(tracks.flatMap(r=>r.slots.map(s=>s.p.join(',')+'/'+s.n.join(','))));
  assert.equal(covered.size,side*side-(side%2),name+' '+face+' each moving face node covered once');
  for(const track of tracks){
   assert.equal(track.period%4,0,name+' quarter-turn closes on exact slots');
   assert(dist(track.points[0],track.points.at(-1))<1e-8,name+' closed companion path');
   assert(track.slots.every(s=>s.p[cfg.axis]===cfg.layer&&Math.abs(s.n[cfg.axis])===1),name+' companion belongs to its physical face');
  }
 }

 // Check both solved and mixed color states, every available slice, both signs,
 // and double turns. Actual Canvas lines must contain every moving node.
 const mixed=['R','U',"F'",'L2','B','D2','R2'].reduce((s,m)=>E.applyMove(s,m),solved);
 for(const state of [solved,mixed])for(const [face,cfg]of Object.entries(E.configs)){
  api.select(face);app.frame(0);
  const paths=selectedPaths(capture),distance=pathIndex(paths.map(s=>s.path));
  const companions=G.faceRings.filter(r=>r.name===face);
  assert.equal(paths.length,1+companions.length,name+' '+face+' draws its belt and all selected companion loops');
  assert.equal(visiblePaths(capture).length,G.rings.length+G.faceRings.length,name+' every axis remains visible');
  const allDistance=pathIndex(visiblePaths(capture).map(s=>s.path));
  for(const track of G.faceRings)for(const p of track.nodes){
   assert(allDistance(screen(p))<.35,name+' all companion rings are visible even when inactive');
  }
  for(const dir of [1,-1])for(const turns of [1,2]){
   const move={face,dir,turns},after=E.applyMove(state,move),quarters=cfg.turn*dir*turns;
   state.forEach((s,i)=>{
    assert(dist(G.interpolateSticker(s,after[i],face,0,quarters),G.position(s))<1e-8,name+' exact initial node');
    assert(dist(G.interpolateSticker(s,after[i],face,1,quarters),G.position(after[i]))<1e-8,name+' exact engine endpoint');
   });
   for(const t of fractions){
    const movingFace=[];
    state.forEach((s,i)=>{
     const start=G.position(s),end=G.position(after[i]),p=G.interpolateSticker(s,after[i],face,t,quarters);
     if(dist(start,end)<1e-8)assert(dist(p,start)<1e-8,name+' '+face+' fixed sticker stays fixed, including odd face centers');
     else{
      const error=distance(screen(p));
      assert(error<.35,name+' '+face+' '+dir+'×'+turns+' '+s.id+' stays on a drawn selected path at '+t+' (error '+error+')');
      incidences++;
      if(s.p[cfg.axis]===cfg.layer&&s.n[cfg.axis]!==0)movingFace.push(p);
     }
    });
    for(let i=0;i<movingFace.length;i++)for(let j=i+1;j<movingFace.length;j++)assert(dist(movingFace[i],movingFace[j])>1e-6,name+' face-turning nodes do not collapse into one point');
   }
  }
 }

 // Native draws verify the app passes the correct signed angle, actually renders
 // the new paths, and keeps those paths stationary throughout each animation.
 api.reset();app.frame(0);
 for(const face of faces)for(const dir of [1,-1])for(const turns of [1,2]){
  api.select(face);app.frame(0);
  const before=app.snapshot().stickers,beforeNodes=nodes(),cfg=E.configs[face];
  const move={face,dir,turns},after=E.applyMove(before,move),signature=shapeSignature(capture);
  assert(api.move(move),name+' accepts test move');
  const duration=1400*(turns===2?1.35:1);let previous=0;
  for(const fraction of fractions){
   app.frame((fraction-previous)*duration);previous=fraction;
   assert(app.snapshot().animating,name+' samples a live native move');
   assert.equal(shapeSignature(capture),signature,name+' transport loops remain stationary during rotation');
   const drawn=nodes(),distance=pathIndex(selectedPaths(capture).map(s=>s.path));
   const eased=fraction*fraction*(3-2*fraction);
   before.forEach((s,i)=>{
    const target=screen(G.interpolateSticker(s,after[i],face,eased,cfg.turn*dir*turns));
    assert(dist(drawn[i],target)<1e-6,name+' native draw follows the signed geometric turn');
    if(dist(G.position(s),G.position(after[i]))<1e-8)assert(dist(drawn[i],beforeNodes[i])<1e-6,name+' native fixed node does not move');
    else{assert(distance(drawn[i])<.35,name+' native '+face+' moving dot has a visible selected path');incidences++;}
   });
   nativeFrames++;
  }
  app.complete();
  assert.deepEqual(app.snapshot().stickers,clone(after),name+' native move reaches the exact engine state');
  nodes().forEach((n,i)=>assert(dist(n,screen(G.position(after[i])))<1e-6,name+' native final nodes match engine endpoint'));
 }
 console.log(name+': '+G.faceRings.length+' companion loops; '+incidences+' visible-path incidences; '+nativeFrames+' native frames; endpoints and fixed nodes PASS');
 return{incidences,nativeFrames};
}

if(require.main===module){const totals=pages.map(verifyPage).reduce((a,b)=>({incidences:a.incidences+b.incidences,nativeFrames:a.nativeFrames+b.nativeFrames}),{incidences:0,nativeFrames:0});console.log(totals.incidences+' cube-family path incidences and '+totals.nativeFrames+' production animation frames checked.');}
module.exports={verifyPage};
