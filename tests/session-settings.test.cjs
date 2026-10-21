'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.resolve(__dirname,'../dist/games'),puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
function host(id){
 const workers=[];
 class DeferredWorker {
  constructor(){this.listeners={};workers.push(this);}
  postMessage(request){this.request=request;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  removeEventListener(){}
  terminate(){this.terminated=true;}
 }
 const app=createPage(id,{speed:3,globals:{Worker:DeferredWorker,fetch:async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};}}});
 app.workers=workers;return app;
}
function read(app){const d=app.context.PuzzleAxisDisplay;return{labels:d.labelMode(),highlights:d.highlights3D(),ringLabels:d.ringLabelsVisible(),focus:app.element('ringFocus').getAttribute('aria-pressed'),speed:String(app.element('speed').value)};}
const defaults={labels:'none',highlights:true,ringLabels:false,focus:'true',speed:'3'};
async function ready(app){app.context.ConstrainedSolverUI.setActive(true);for(let n=0;n<80&&app.context.ConstrainedSolverUI.state().phase==='loading';n++)await app.advance(0);assert.equal(app.context.ConstrainedSolverUI.state().phase,'selecting');}
for(const id of puzzles)test(id+': initial-only preferences survive user moves, modes, reset, randomization and canceled planning',async()=>{
 const app=host(id),D=app.context.PuzzleAxisDisplay,ui=app.context.ConstrainedSolverUI,api=app.context.PUZZLE_API;
 await app.flush();assert.deepEqual(read(app),defaults);
 assert.equal(app.element('viewLabelMode').textContent,'Show some labels');
 assert.equal(app.element('ringLabelToggle').textContent,'Show labels');assert.equal(app.element('ringFocus').textContent,'Show all rings');
 assert.equal(app.element('viewRingCCW').textContent,'↶ Rotate');assert.equal(app.element('viewRingCW').textContent,'Rotate ↷');
 for(const [mode,caption]of [['some','Show all labels'],['all','Show no labels'],['none','Show some labels']]){app.click('viewLabelMode');assert.equal(D.labelMode(),mode);assert.equal(app.element('viewLabelMode').textContent,caption);assert.equal(String(app.element('speed').value),'3','labels do not set speed');}
 D.setLabelMode('all');app.click('viewHighlightToggle');app.click('ringLabelToggle');app.click('ringFocus');app.element('playbackSpeed').value='7';app.element('playbackSpeed').dispatch('change');
 const chosen=read(app);assert.deepEqual(chosen,{labels:'all',highlights:false,ringLabels:true,focus:'false',speed:'7'});
 const steady=label=>assert.deepEqual(read(app),chosen,label);
 await ready(app);steady('manual entry');assert.equal(app.element('ringLabelToggle').hidden,false);
 app.click('ringLabelToggle');assert.equal(D.ringLabelsVisible(),false);assert.equal(app.element('ringLabelToggle').textContent,'Show labels');
 app.click('ringFocus');assert.equal(app.element('ringFocus').textContent,'Show all rings');
 await ui.setActive(false);assert.equal(D.ringLabelsVisible(),false);assert.equal(app.element('ringFocus').textContent,'Show all rings','both modes use the same focus state');
 app.click('ringLabelToggle');app.click('ringFocus');steady('return to turn mode');
 const first=app.element('viewRingSelector').querySelector('button');first.click();await app.advance(0);app.click('viewRingCW');assert.equal(app.snapshot().animating,true);steady('manual turn');await app.settle();steady('manual completion');
 api.randomize();steady('scramble start');await app.advance(20);api.stopScrambleNow();await app.settle();steady('scramble stop');
 if(app.element('mirrorMode')&&!app.element('mirrorMode').hidden){app.click('mirrorMode');steady('mirror on');app.click('mirrorMode');steady('mirror off');}
 api.reset();await app.advance(0);steady('reset solves without resetting preferences');
 first.click();await app.advance(0);app.click('viewRingCW');await app.settle();
 app.click('solve');for(let n=0;n<80&&!app.workers.some(w=>w.request?.task==='full-solve');n++)await app.advance(0);
 assert(app.workers.some(w=>w.request?.task==='full-solve'),'Auto Solve started');steady('auto planning');
 app.click('pause');await app.advance(0);steady('auto cancellation');
 await ready(app);ui.setTool('swap');const available=app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.stickerId!=null);assert.equal(ui.selectNode(available[0].stickerId),false);assert.equal(ui.selectNode(available[1].stickerId),false);await app.advance(0);steady('blocked unverified choices');assert.equal(ui.state().phase,'selecting');assert(!app.workers.some(w=>w.request?.task==='manual-swap'),'unverified choices do not launch a search');await ui.setActive(false);steady('exit solver');
 const beforeReturn=JSON.stringify(app.snapshot());
 app.win.dispatch('pageshow',{persisted:false});steady('ordinary pageshow does not reset an existing session');
 app.win.dispatch('pageshow',{persisted:true});assert.deepEqual(read(app),defaults,'BFcache re-entry starts a new visit with defaults');assert.equal(JSON.stringify(app.snapshot()),beforeReturn,'fresh-visit preferences do not reset the physical puzzle or journal');
 const fresh=host(id);assert.deepEqual(read(fresh),defaults,'a fresh puzzle instance resets all defaults');
});
