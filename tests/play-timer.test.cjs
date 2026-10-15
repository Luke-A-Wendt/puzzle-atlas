'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const catalog=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'))).models;

test('all puzzles omit the removed timer and percentage UI without passive solver-model requests',async()=>{
 for(const {id} of catalog){
  const requests=[],app=createPage(id,{globals:{fetch:async url=>{requests.push(String(url));throw Error('unexpected passive fetch');}}});
  await app.advance(0);
  for(const node of ['playTimer','playTimerReadout','playTimerToggle','playTimerReset','playSolvedReadout'])assert.equal(app.element(node),null,id+' removed '+node);
  assert.equal(app.context.PuzzlePlayTimer,undefined,id+' no timer runtime');
  assert.equal(app.context.PuzzleSolvedProgress,undefined,id+' no goal percentage runtime');
  assert(app.context.PuzzleFeedback,id+' semantic control feedback retained');
  assert.equal(requests.length,0,id+' no idle solver model fetch');
  const footer=app.document.querySelector('.cube-bottom');assert(footer,id+' native engine targets preserved');
  // Native engines still update their legacy counters. They must remain safe
  // even though CSS removes the complete row from the visible puzzle panel.
  const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json')));
  assert(app.context.PUZZLE_API.runMoves([model.moves[0].engineMove]),id);await app.settle();
  app.context.PUZZLE_API.reset();await app.advance(0);
  assert.equal(requests.length,0,id+' move/reset do not request the deleted metric model');
 }
});

test('removed metric assets retain only shared semantic feedback without metric allocation or polling',()=>{
 const js=fs.readFileSync(path.join(games,'play-timer.js'),'utf8'),css=fs.readFileSync(path.join(games,'play-timer.css'),'utf8');
 assert.match(js,/root\.PuzzleFeedback=Object\.freeze/);
 assert.doesNotMatch(js,/PuzzlePlayTimer|PuzzleSolvedProgress|requestAnimationFrame|loadModel|solvedProgress|playSolvedReadout/);
 assert.doesNotMatch(css,/play-timer-readout|play-solved|has-play-timer/);
 assert.match(css,/prefers-reduced-motion/);
 const htmls=fs.readdirSync(games).filter(x=>x.endsWith('.html'));
 for(const file of htmls){const html=fs.readFileSync(path.join(games,file),'utf8');assert.equal((html.match(/src="play-timer\.js(?:[?#][^"]*)?"/g)||[]).length,1,file+' one shared feedback script');assert.equal((html.match(/href="play-timer\.css(?:[?#][^"]*)?"/g)||[]).length,1,file+' one shared feedback stylesheet');}
});
