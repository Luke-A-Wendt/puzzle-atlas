'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createPage,Element}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games'),source=fs.readFileSync(path.join(games,'play-timer.js'),'utf8');
function timerHost(){
 let now=0,next=0;const frames=new Map(),footer=new Element('div');footer.className='cube-bottom';const legacy=new Element('div','legend');legacy.className='legend';footer.appendChild(legacy);
 const document={querySelector:s=>s==='.cube-bottom'?footer:null,createElement:tag=>new Element(tag)};
 const context={document,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,footer,legacy,el:id=>footer.querySelector('#'+id),advance:ms=>{now+=ms;const f=[...frames.values()];frames.clear();f.forEach(fn=>fn(now));},loadAgain:()=>vm.runInContext(source,context)};
}
test('Manual timer starts, stops, resumes, resets, and counts long inactive intervals accurately',()=>{
 const h=timerHost(),state=()=>h.context.PuzzlePlayTimer.snapshot();assert.equal(h.el('playTimerReadout').textContent,'0:00.0');assert(h.el('playTimerReset').disabled);assert(h.legacy.hidden);
 h.el('playTimerToggle').click();h.advance(61500);assert.equal(h.el('playTimerReadout').textContent,'1:01.5');assert(state().running);
 h.el('playTimerToggle').click();h.advance(8000);assert.equal(state().elapsedMs,61500);assert.equal(h.el('playTimerToggle').textContent,'Start');
 h.el('playTimerToggle').click();h.advance(500);assert.equal(h.el('playTimerReadout').textContent,'1:02.0');
 h.advance(3600000);assert.equal(h.el('playTimerReadout').textContent,'1:01:02.0');
 h.el('playTimerReset').click();assert.equal(state().elapsedMs,0);assert.equal(state().running,false);assert.equal(h.el('playTimerReadout').textContent,'0:00.0');
 h.loadAgain();assert.equal(h.footer.querySelectorAll('#playTimer').length,1);
});
test('Timer is independent of moves, reset, scramble, and Auto Solve controls',async()=>{
 const app=createPage('cube2'),timer=()=>app.context.PuzzlePlayTimer.snapshot();assert.equal(timer().running,false);
 app.context.PUZZLE_API.move({face:'R',dir:1});await app.settle();assert.equal(timer().elapsedMs,0);
 app.click('playTimerToggle');await app.advance(1200);app.context.PUZZLE_API.reset();assert.equal(timer().running,true);assert(timer().elapsedMs>=1200);
 const before=timer().elapsedMs;app.context.ConstrainedSolverUI={autoSolve(){return Promise.resolve();},state(){return {phase:'off'};}};app.context.PUZZLE_API.move({face:'R',dir:1});await app.settle();app.context.PUZZLE_API.solve();assert.equal(timer().running,true);assert(timer().elapsedMs>=before);
 app.click('playTimerToggle');const stopped=timer().elapsedMs;app.context.PUZZLE_API.randomize();await app.advance(3000);assert.equal(timer().elapsedMs,stopped);assert.equal(timer().running,false);
});
test('Every puzzle includes the timer and engine-updated legend elements survive replacement',()=>{
 const htmls=fs.readdirSync(games).filter(x=>x.endsWith('.html'));assert.equal(htmls.length,28);
 for(const file of htmls){const html=fs.readFileSync(path.join(games,file),'utf8');assert.equal((html.match(/src="play-timer.js"/g)||[]).length,1,file);assert.equal((html.match(/href="play-timer.css"/g)||[]).length,1,file);assert(html.includes('class="cube-bottom"'),file);}
 for(const puzzle of ['mirror','pyraminx','homer','crystal']){const app=createPage(puzzle);assert(app.element('playTimerToggle'),puzzle);assert(app.document.querySelector('.cube-bottom').classList.contains('has-play-timer'),puzzle);const old=app.document.querySelector('.cube-bottom .legend, .cube-bottom .shape-key');assert(old&&old.hidden,puzzle);app.context.PUZZLE_API.reset();assert(app.element('playTimerToggle'),puzzle);}
});
