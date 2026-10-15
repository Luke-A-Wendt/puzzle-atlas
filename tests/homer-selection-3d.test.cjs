'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const {createCanvas}=require('@napi-rs/canvas');
const html=fs.readFileSync(require.resolve('../dist/games/cube2.html'),'utf8');
vm.runInThisContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes('root.CubeEngine =')));
const E=globalThis.CubeEngine,G=require('../dist/games/homer-geometry.js'),R=require('../dist/games/homer-renderer.js');
const solved=E.makeSolved(),near=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-8);
function capture(stickers,options={}){
 const canvas=createCanvas(500,560),ctx=canvas.getContext('2d'),tracks=[],strokes=[];let visibility;
 globalThis.PuzzleSelection3D={begin(c,o){visibility=o.isVisible;return{style(id,selected){return{held:id==='F:1:1',selected:!!selected,label:id==='F:1:1'?'A':id==='B:-1:-1'?'B':null};},track(t){tracks.push(t);},stroke(points,style){strokes.push({points,style});},finish(){}};}};
 const result=R.render(ctx,stickers,{width:500,height:560,view:{yaw:-.3,pitch:.08,zoom:1},selected:'R',labels:false,...options});
 delete globalThis.PuzzleSelection3D;return{result,tracks,strokes,visibility};
}
test('Homer maps every logical sticker to a separate stable surface region',()=>{
 const ids=new Set();for(const piece of G.basePieces()){
  const regions=G.selectionRegions(piece);assert.equal(regions.length,3);assert.strictEqual(regions,G.selectionRegions(piece),'partition geometry is cached, not rebuilt per frame');
  for(const r of regions){assert(!ids.has(r.id));ids.add(r.id);assert(r.paths.length>0);assert(Math.abs(Math.hypot(...r.normal)-1)<1e-8);assert(r.center.every((v,i)=>v*piece.home[i]>0));assert(r.paths.every(path=>path.length>1&&path.every(v=>v.p.concat(v.n).every(Number.isFinite))));}
  for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)assert(Math.hypot(...regions[a].center.map((v,i)=>v-regions[b].center[i]))>.3,'three stickers on one corner cannot share an arrow anchor');
 }
 assert.deepEqual([...ids].sort(),solved.map(s=>String(s.id)).sort());
});
test('Homer arrows and boundaries follow all six physical turn transforms',()=>{
 const before=capture(solved),byId=new Map(before.tracks.map(t=>[t.id,t]));assert.equal(byId.size,24);assert(before.strokes.length>0);assert(before.strokes.some(s=>s.style.held));assert(before.strokes.some(s=>s.style.selected));
 for(const face of ['U','R','F','D','L','B']){const move=E.normalizeMove(face),cfg=E.configs[face],middle=capture(solved,{animation:{move,progress:.5}}),end=capture(solved,{animation:{move,progress:1}}),committed=capture(E.applyMove(solved,move)),targets=new Map(committed.tracks.map(t=>[t.id,t]));
  for(const t of end.tracks){const target=targets.get(t.id);assert(near(t.center,target.center),'animation endpoint center matches committed sticker identity');assert(near(t.normal,target.normal),'animation endpoint normal matches committed sticker identity');}
  for(const t of middle.tracks){const sticker=solved.find(s=>s.id===t.id),home=G.basePieces().find(p=>p.id===sticker.p.join(',')),region=G.selectionRegions(home).find(r=>r.id===t.id),turning=sticker.p[cfg.axis]===cfg.layer,expected=R.camera(turning?R.rotate(region.center,cfg.axis,cfg.turn*Math.PI/4):region.center,{yaw:-.3,pitch:.08});assert(near(t.center,expected),'half-turn animation uses the surface center, not the corner center');assert(t.center.concat(t.normal).every(Number.isFinite));}
 }
});
test('Homer depth mask rejects back surfaces and annotations hidden by the nose',()=>{
 const frame=capture(solved,{view:{yaw:0,pitch:0,zoom:1}}),tracks=new Map(frame.tracks.map(t=>[t.id,t]));
 assert.equal(frame.visibility(tracks.get('B:1:1').center),false,'back sticker does not draw through head');
 assert.equal(frame.visibility([.1,.385,.8]),false,'nose occludes an annotation behind its surface');
 assert.equal(frame.visibility([.1,.385,1.8]),true,'outward arrow can extend beyond the nose');
 assert.equal(frame.visibility([0,0,10]),false,'points behind the camera are not projected');
 assert(frame.strokes.length>0);assert(frame.strokes.every(s=>s.style.closed===false&&Number.isFinite(s.style.dashOffset)));assert(frame.strokes.flatMap(s=>s.points).every(p=>p.every(Number.isFinite)));
});
test('production marker painter reacts to Homer hold and 1/2 changes without a move',()=>{
 globalThis.PuzzleSelection3D=require('../dist/games/puzzle-selection-3d.js');
 const canvas=createCanvas(500,560),ctx=canvas.getContext('2d'),letters=[],fillText=ctx.fillText.bind(ctx);ctx.fillText=(s,...args)=>{letters.push(s);return fillText(s,...args);};
 let state={active:true,held:[],pair:[]};globalThis.ConstrainedSolverUI={visualState:()=>state};
 const draw=()=>{letters.length=0;R.render(ctx,solved,{width:500,height:560,view:{yaw:-.3,pitch:.08,zoom:1},selected:'R',labels:false});return Buffer.from(ctx.getImageData(0,0,500,560).data);};
 const unheld=draw();assert.deepEqual(letters,[]);
 state={active:true,held:['F:-1:-1'],pair:['F:1:1','F:-1:1']};const marked=draw();assert.deepEqual([...letters].sort(),['1','2']);assert(!marked.equals(unheld),'hold borders and arrows are actually rasterized');
 state={active:true,held:[],pair:[]};const cleared=draw();assert.deepEqual(letters,[]);assert(cleared.equals(unheld),'removing holds and pair restores the exact render immediately');
 delete globalThis.PuzzleSelection3D;delete globalThis.ConstrainedSolverUI;
});
