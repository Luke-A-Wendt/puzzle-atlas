'use strict';
// Inspect actual production paint commands, not a second implementation of layout.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const {recorder,stickerMarks}=require('./connected-map-recorder.cjs');
const names=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/games/constrained-solver-models/manifest.json'),'utf8')).models.map(model=>model.id);
let referenceCount=0;
for(const name of names){
 const htmlPath=path.join(__dirname,'../dist/games',name+'.html'),html=fs.readFileSync(htmlPath,'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1].split(/[?#]/)[0]);
 const styles=[...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map(m=>m[1].split(/[?#]/)[0]);
 assert(styles.includes('constrained-solver.css'),name+' solver stylesheet');
 for(const script of ['ring-panel.js','constrained-solver-core.js','constrained-solver.js'])assert(scripts.includes(script),name+' missing '+script);
 assert(scripts.indexOf('constrained-solver-core.js')>scripts.indexOf('ring-panel.js'),name+' core follows ordinary panel');
 assert(scripts.indexOf('constrained-solver.js')>scripts.indexOf('constrained-solver-core.js'),name+' UI follows core');
 const capture=recorder(),dpr=name==='cube7'||name==='mastermorphix'?2:1;
 const app=createHarness({htmlPath,bundled:true,speed:5,devicePixelRatio:dpr,dimensions:{rings:{width:623,height:517}},canvasContexts:{rings:capture.context}});
 const bridge=app.context.PUZZLE_SOLVER_BRIDGE,api=app.context.PUZZLE_API;
 assert(bridge&&Object.isFrozen(bridge),name+' immutable bridge');
 function check(label){
  const nodes=bridge.nodes(),stickers=app.snapshot().stickers;
  assert.equal(nodes.length,stickers.length,name+' '+label+' all physical stickers represented');
  assert.deepEqual(Array.from(nodes,n=>n.stickerId).sort(),stickers.map(s=>String(s.id)).sort(),name+' '+label+' persistent sticker IDs');
  assert.equal(new Set(nodes.map(n=>n.stickerId)).size,nodes.length,name+' one selector per sticker');
  const marks=stickerMarks(capture,new Set(nodes.map(n=>n.color)));
  assert.equal(marks.length,nodes.length,name+' '+label+' one colored paint command per selector');
  nodes.forEach(n=>{
   assert([n.x,n.y,n.r].every(Number.isFinite)&&n.r>0,name+' finite CSS coordinates/radius');
   const mark=marks.find(m=>m.color===n.color&&Math.hypot(m.x/dpr-n.x,m.y/dpr-n.y)<1e-7);
   assert(mark,name+' '+label+' selector lies on its actual painted color');
   assert(Math.abs(mark.r/dpr-n.r)<1e-7,name+' '+label+' selector radius matches paint');
   assert.equal(mark.kind,'circle',name+' every sticker, including fixed centers, is a circle');
   assert(Math.abs(n.r-nodes[0].r)<1e-7,name+' all sticker nodes have the same radius');
   if(n.reference)referenceCount++;
  });
  if(nodes.length){nodes[0].x=NaN;nodes.splice(1);assert.equal(bridge.nodes().length,stickers.length);assert(Number.isFinite(bridge.nodes()[0].x),name+' caller cannot mutate draw cache');}
  return bridge.nodes();
 }
 const before=check('solved'),initial=app.snapshot();
 bridge.requestRender();app.frame(0);check('requested redraw');assert.deepEqual(app.snapshot(),initial,name+' read-only bridge leaves state and history intact');
 assert.equal(api.move({face:initial.selected,dir:1,turns:1}),true,name+' ordinary move still accepted');
 app.frame(55);check('animated');
 app.complete();app.frame(0);const after=check('turned');
 assert(after.some(n=>{const old=before.find(x=>x.stickerId===n.stickerId);return Math.hypot(n.x-old.x,n.y-old.y)>1e-6;}),name+' identities follow the existing animation');
 if(api.setMirrorMode&&['mirror','pyramorphix','mastermorphix','ghost'].includes(name)){
  assert.equal(api.setMirrorMode(true),true);app.frame(0);assert.equal(bridge.nodes().length,after.length,name+' silver mirror map retains its targets');assert(bridge.nodes().every(n=>n.color==='#c9cdd3'));api.setMirrorMode(false);app.frame(0);check('returned from mirror');
 }
 console.log(name+': actual paint, sticker identity, unchanged controls, animation and CSS pixel mapping PASS');
}
assert(referenceCount>0,'stationary reference circles covered');
console.log('All '+names.length+' puzzle bridges preserve the existing map and expose each physical sticker once.');
