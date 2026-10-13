'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games'),models=require('../solver-backend/data/manifest.json').models;
const fetchAsset=async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(url).pathname.replace(/^\/games\//,'')),'utf8')});

test('all 34 ring maps expose a working display toggle in normal and constrained modes without moving stickers',async()=>{
 for(const {id}of models){
  const app=createPage(id,{globals:{fetch:fetchAsset}}),button=app.element('ringFocus');
  assert(button,id+' has the focus control');
  const before=JSON.stringify(app.snapshot().stickers),pressed=button.getAttribute('aria-pressed');
  assert(['true','false'].includes(pressed));
  app.click('ringFocus');app.frame(0);
  assert.equal(button.getAttribute('aria-pressed'),String(pressed!=='true'),id+' toggles display');
  assert.equal(button.textContent,pressed==='true'?'Focus selected rings':'Show all rings',id+' shows the next action');
  assert.equal(JSON.stringify(app.snapshot().stickers),before,id+' display toggle does not turn the puzzle');
  await app.context.ConstrainedSolverUI.setActive(true);await app.flush();
  assert.equal(app.context.ConstrainedSolverUI.state().active,true,id+' opens constrained mode');
  assert.equal(button.hidden,false);assert.equal(button.disabled,false);
  app.click('ringFocus');app.frame(0);
  assert.equal(button.getAttribute('aria-pressed'),pressed,id+' toggle also works during constrained selection');
  assert.equal(JSON.stringify(app.snapshot().stickers),before);
  app.context.ConstrainedSolverUI.closePanel();
 }
 const css=fs.readFileSync(path.join(games,'constrained-solver.css'),'utf8');
 assert(!/\.cs-active[^{}]*#ringFocus[^{}]*\{[^}]*display\s*:\s*none/.test(css),'solver stylesheet must not hide the display control');
});

test('cube display options change belt and companion brightness while keeping nodes and selected tracks intact',()=>{
 for(const id of ['cube2','cube3','cube4','cube5','cube6','cube7','cube8','mirror','homer']){
  const app=createPage(id),G=app.context.RingGeometry,selected=app.snapshot().selected;
  const capture=focus=>{const strokes=[],stack=[];const ctx={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},beginPath(){},arc(){},moveTo(){},lineTo(){},closePath(){},stroke(){strokes.push({alpha:this.globalAlpha,color:this.strokeStyle});}};G.drawTracks(ctx,selected,1,{focus});return strokes;};
  const quiet=capture(true),all=capture(false);
  assert.equal(quiet.length,all.length,id+' keeps every path');
  let changed=0;
  quiet.forEach((s,i)=>{if(s.color==='#baacfb')assert.equal(all[i].alpha,s.alpha,id+' active paths stay bright');else{assert(all[i].alpha>s.alpha,id+' inactive paths become clearer');changed++;}});
  assert(changed>0);
 }
});
