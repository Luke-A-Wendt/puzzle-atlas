'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const catalog=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'))).models;
function host(id='cube2'){
 const requests=[],observers=[];
 class MutationObserver{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}}
 const fetch=async url=>{requests.push(String(url));const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
 const app=createPage(id,{globals:{fetch,MutationObserver}});app.requests=requests;app.observers=observers;app.model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));
 app.ready=async()=>{await app.advance(0);};
 app.mutation=(target,type='attributes')=>observers.forEach(o=>o.callback([{target,type,addedNodes:[]}]));return app;
}
test('feedback captures a quiet baseline, ignores equal mutations and coalesces repeated accents',async()=>{
 const app=host(),feedback=app.context.PuzzleFeedback,button=app.element('viewHighlightToggle');await app.ready();
 assert.equal(button.classList.contains('puzzle-feedback'),false,'normal controls do not pulse on load');
 app.mutation(button);assert.equal(button.classList.contains('puzzle-feedback'),false,'same attribute value');
 button.setAttribute('aria-pressed','false');app.mutation(button);assert(button.classList.contains('puzzle-feedback'),'changed toggle');
 assert.equal(feedback.pulse(button),false,'in-flight duplicates do not extend/restart');await app.advance(520);assert(!button.classList.contains('puzzle-feedback'));
 app.mutation(button);assert(!button.classList.contains('puzzle-feedback'),'identical repeated assignment stays quiet');
 button.hidden=true;app.mutation(button);assert(!button.classList.contains('puzzle-feedback'),'hidden controls do not pulse');
 button.hidden=false;app.mutation(button);assert(!button.classList.contains('puzzle-feedback'),'visibility alone is not a changed setting');
 button.disabled=true;app.mutation(button);button.disabled=false;app.mutation(button);assert(!button.classList.contains('puzzle-feedback'),'busy lock changes are quiet');
 assert.equal(feedback.pulse(button),false,'explicit unchanged requests cannot force an accent');await app.flush();assert(!button.classList.contains('puzzle-feedback'));
});
test('programmatic speed changes pulse even though value is a property, while idle work remains quiet',async()=>{
 const app=host(),speed=app.element('playbackSpeed'),nativeSpeed=app.element('speed');await app.ready();app.context.PuzzleFeedback.refresh();await app.advance(520);
 nativeSpeed.value='1';nativeSpeed.dispatch('input');assert(speed.classList.contains('puzzle-feedback'));
 await app.advance(520);app.mutation(app.element('speedText'),'childList');assert(!speed.classList.contains('puzzle-feedback'));
 for(let i=0;i<20;i++)await app.advance(100);
 assert(!speed.classList.contains('puzzle-feedback'));assert.equal(app.requests.length,0,'removed percentage does not load a passive model');
 assert.equal(app.context.PuzzleSolvedProgress,undefined);assert.equal(app.context.PuzzlePlayTimer,undefined);
});
test('mirror callout appears once for eligible puzzles and reduced motion uses only a static accent',async()=>{
 const app=host('mirror');await app.ready();await app.advance(180);const button=app.element('mirrorMode');assert(button.classList.contains('puzzle-feedback'));await app.advance(520);app.context.PuzzleFeedback.refresh();assert(!button.classList.contains('puzzle-feedback'),'no repeated callout');
 const css=fs.readFileSync(path.join(games,'play-timer.css'),'utf8'),reduced=css.slice(css.indexOf('@media(prefers-reduced-motion:reduce)'));
 assert(reduced.includes('puzzle-control-feedback-still'));assert(!reduced.split('.play-solved-face')[0].includes('scale:'));
});


test('move, Auto Solve gap, and Stop captions never pulse action buttons or unchanged settings',async()=>{
 const app=host(),feedback=app.context.PuzzleFeedback;await app.ready();feedback.refresh();await app.advance(520);
 const actions=['randomize','solve','pause','undo','redo','undoSequence','redoSequence','csPairB','csRetry'];
 for(let stage=0;stage<4;stage++){
  for(const id of actions){const button=app.element(id);button.hidden=false;button.disabled=stage%2===0;button.textContent=stage%2?'Stop':'Solving '+stage;app.mutation(button);feedback.pulse(button);}
  app.context.PuzzleAxisDisplay.resetDefaults({pulse:true});feedback.refresh();await app.flush();
  for(const id of [...actions,'viewLabelMode','viewHighlightToggle','ringLabelToggle'])assert(!app.element(id).classList.contains('puzzle-feedback'),id+' stays quiet at stage '+stage);
 }
});
test('only meaningful axis, tile, highlight, ring-focus, mirror, speed and panel settings accent',async()=>{
 const app=host('mirror'),feedback=app.context.PuzzleFeedback;await app.ready();await app.advance(180);await app.advance(520);feedback.refresh();await app.advance(520);
 for(const id of ['viewLabelMode','viewHighlightToggle','ringLabelToggle','ringFocus']){
  app.click(id);await app.flush();assert(app.element(id).classList.contains('puzzle-feedback'),id+' changed setting');await app.advance(520);feedback.pulse(id);await app.flush();assert(!app.element(id).classList.contains('puzzle-feedback'),id+' unchanged explicit pulse ignored');
 }
 app.click('mirrorMode');await app.flush();assert(app.element('mirrorMode').classList.contains('puzzle-feedback'),'mirror callback before DOM still detects the change');await app.advance(520);feedback.pulse('mirrorMode');await app.flush();assert(!app.element('mirrorMode').classList.contains('puzzle-feedback'));
 const tile=app.element('pieceLabels')||app.document.createElement('button');if(!tile.id){tile.id='pieceLabels';tile.setAttribute('aria-pressed','false');app.document.body.appendChild(tile);feedback.refresh();}tile.setAttribute('aria-pressed','true');feedback.pulse(tile);assert(tile.classList.contains('puzzle-feedback'),'retained tile toggles are semantic settings');
 const speed=app.element('playbackSpeed'),nativeSpeed=app.element('speed');nativeSpeed.value='1';nativeSpeed.dispatch('input');assert(speed.classList.contains('puzzle-feedback'));await app.advance(520);feedback.pulse(speed);assert(!speed.classList.contains('puzzle-feedback'));
 app.click('ringPanelHide');feedback.refresh();assert(app.element('ringPanelToggle').classList.contains('puzzle-feedback'),'new visible show-panel control reflects actual closed state');
});
