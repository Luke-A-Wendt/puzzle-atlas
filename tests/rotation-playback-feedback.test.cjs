'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);

function marked(app){return app.element('viewRingControls').querySelectorAll('button').filter(button=>button.getAttribute('data-turn-active')==='true');}
function action(app,face,dir){
 const buttons=marked(app),axis=buttons.find(button=>button.classList.contains('ring-key')),turn=buttons.find(button=>button.id===(dir<0?'viewRingCCW':'viewRingCW'));
 assert.equal(buttons.length,2,'exactly one axis and one direction show the primitive');
 assert.equal(axis?.dataset.face,face,'the actual rotating axis is emphasized');
 assert.ok(turn,'physical inward-facing turn sign matches the move');
 assert.equal(axis.disabled,true);assert.equal(turn.disabled,true,'feedback never enables commands during playback');
 assert.equal(axis.getAttribute('data-turn-pulse'),turn.getAttribute('data-turn-pulse'),'axis and direction flash in the same event');
 return turn.getAttribute('data-turn-pulse');
}

for(const puzzle of puzzles)test(puzzle+' flashes actual signed moves once per primitive, including repetitions, then clears',async()=>{
 const app=createPage(puzzle);await app.flush();const api=app.context.PUZZLE_API;
 const axes=app.element('viewRingSelector').querySelectorAll('.ring-key').map(button=>button.dataset.face);
 const steps=[{face:axes[0],dir:1,turns:1},{face:axes[0],dir:1,turns:1},{face:axes.at(-1),dir:-1,turns:1},{face:axes.at(-1),dir:-1,turns:1}];
 assert.equal(marked(app).length,0);
 assert.equal(api.runMoves(steps,{label:'Feedback verification'}),true);await app.flush();
 let previous=null;
 for(const [index,move]of steps.entries()){
  assert.equal(app.snapshot().animating,true);const token=action(app,move.face,move.dir);
  if(previous!=null)assert.notEqual(token,previous,'every new primitive restarts even an identical axis and direction');
  for(let frame=0;frame<3;frame++){
   await app.advance(10);assert.equal(action(app,move.face,move.dir),token,'rendering frames and animation wrappers do not restart the flash');
  }
  assert.equal(app.snapshot().sequence.completed,index);
  previous=token;await app.advance(2000);
 }
 assert.equal(app.snapshot().animating,false);assert.equal(marked(app).length,0,'completion removes every playback emphasis');
 for(const button of app.element('viewRingControls').querySelectorAll('button'))assert.equal(button.hasAttribute('data-turn-pulse'),false,'no stale animation after completion');
 api.select(axes[0]);await app.flush();assert.equal(marked(app).length,0,'idle selection is not a playback flash');
 // An explicit stop completes one current permutation, not the remainder.
 assert.equal(api.runMoves(steps,{label:'Stop verification'}),true);await app.flush();action(app,steps[0].face,1);
 api.stopAfterCurrentMove();await app.advance(2000);
 assert.equal(app.snapshot().animating,false);assert.equal(marked(app).length,0,'stopping leaves no stale flash');
});

test('a selection query cannot erase ongoing action feedback, and a reset clears it',async()=>{
 const app=createPage('cube3');await app.flush();const api=app.context.PUZZLE_API;
 api.move({face:'R',dir:-1});await app.flush();const token=action(app,'R',-1);
 app.context.PuzzleAxisDisplay.selection('R');await app.flush();assert.equal(action(app,'R',-1),token);
 api.reset();await app.flush();assert.equal(marked(app).length,0);
});

test('half-turn feedback follows its actual animation direction, and immediate cancellation clears it',async()=>{
 const app=createPage('cube3');await app.flush();const api=app.context.PUZZLE_API;
 for(const dir of [-1,1]){
  api.move({face:'R',dir,turns:2});await app.flush();const token=action(app,'R',dir);
  await app.advance(40);assert.equal(action(app,'R',dir),token);
  api.stopPlaybackNow();await app.flush();assert.equal(app.snapshot().animating,false);assert.equal(marked(app).length,0);
 }
});

test('playback emphasis stays readable while disabled and honors reduced motion without changing layout',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../dist/games/game-theme.css'),'utf8');
 assert.match(css,/#ringPanel>\.ring-controls\{display:none!important\}/,'only the native ring-panel controls are hidden on first paint');
 assert.match(css,/#viewRingControls button\[data-turn-active="true"\]\{opacity:1;filter:none/,'disabled controls have a visible active accent');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#viewRingControls button\[data-turn-active="true"\]\{animation:none!important\}\}/);
 const frames=Array.from(css.matchAll(/@keyframes puzzle-turn-flash-[ab]\{[^\n]+/g),match=>match[0]);
 assert.equal(frames.length,2);assert.ok(frames.every(rule=>!/(?:transform|padding|margin|width|height):/.test(rule)),'flash cannot resize or displace controls');
});
