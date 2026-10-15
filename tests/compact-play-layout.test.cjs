'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const puzzles=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/manifest.json'),'utf8')).models.map(x=>x.id);
for(const puzzle of puzzles)test(puzzle+' keeps compact controls outside the canvas and preserves native Stop behavior',async()=>{
 const app=createPage(puzzle);await app.flush();
 const stop=app.element('pause'),toolbar=app.document.querySelector('.cube-top'),primary=app.element('viewRingControls'),settings=app.element('viewDisplayTools');
 assert.equal(primary.parentElement,toolbar.parentElement);assert.equal(settings.parentElement,toolbar);assert.equal(app.element('cube').parentElement.nextSibling,primary);assert.equal(app.element('viewActionsToggle'),null);
 assert.equal(primary.contains(app.element('viewRingSelector')),true);assert.equal(settings.contains(app.element('homeView')),false);assert.equal(app.element('homeView').hidden,true);
 assert.equal(settings.contains(app.element('viewLabelMode')),true);assert.equal(settings.contains(app.element('viewHighlightToggle')),true);
 const mirror=app.element('mirrorMode');if(mirror){assert.equal(mirror.parentElement,toolbar,'native mirror button stays in the header');assert.ok(toolbar.children.indexOf(mirror)<toolbar.children.indexOf(settings),'mirror precedes labels and highlighting');assert.ok(toolbar.children.indexOf(mirror)<toolbar.children.indexOf(app.element('ringTab')),'mirror precedes panel toggles');}
 assert.equal(toolbar.nextSibling,app.element('cube').parentElement,'controls always reserve space outside canvas');
 assert.equal(settings.children.filter(e=>e.nodeType!==3).length,2);assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
 assert.equal(app.document.querySelector('.cube-bottom').hidden,true,'retired counters consume no space');
 assert.equal(app.element('selectedName').parentElement.getAttribute('data-selected'),'false');
 const axis=app.document.querySelector('.notation-key').dataset.face;app.context.PUZZLE_API.select(axis);app.context.PuzzleAxisDisplay.syncTurnControls();
 assert.equal(app.element('selectedName').parentElement.getAttribute('data-selected'),'true');
 app.context.PuzzleAxisDisplay.clear();app.context.PuzzleAxisDisplay.syncTurnControls();
 assert.equal(app.element('selectedName').parentElement.getAttribute('data-selected'),'false');
 assert.equal(stop.hidden,true);assert.equal(stop.disabled,true);assert.equal(stop.getAttribute('aria-disabled'),'true');
 const initial=app.snapshot();app.click('pause');assert.deepEqual(app.snapshot().stickers,initial.stickers);assert.equal(app.snapshot().animating,false);
 app.click('randomize');await app.flush();assert.equal(stop.hidden,false);assert.equal(stop.disabled,false,'native busy Stop is available');assert.equal(stop.getAttribute('aria-disabled'),'false');
 await app.advance(2000);const committed=app.snapshot();await app.advance(20);app.click('pause');await app.flush();
 assert.equal(app.snapshot().animating,false);assert.deepEqual(app.snapshot().stickers,committed.stickers,'unfinished random turn is discarded');assert.equal(stop.hidden,true);assert.equal(stop.disabled,true);
 app.document.dispatch('DOMContentLoaded');await app.flush();assert.equal(app.document.querySelectorAll('#viewRingControls').length,1);assert.equal(app.document.querySelectorAll('#viewDisplayTools').length,1);
});
test('compact CSS removes prose and blank placeholders without reducing the live-view minima',()=>{
 const game=fs.readFileSync(path.join(games,'game-theme.css'),'utf8'),cs=fs.readFileSync(path.join(games,'constrained-solver.css'),'utf8'),journal=fs.readFileSync(path.join(games,'move-journal.css'),'utf8');
 assert.match(game,/grid-template-rows:34px 34px/);assert.match(game,/\.action-group>#pause\[hidden\]\{display:inline-flex!important;[^}]*pointer-events:none/);
 assert.match(game,/\.canvas-caption,\.ring-hint,\.notation-panel>p,\.cube-footnote,\.legacy-face-metric\{display:none!important/);
 assert.match(game,/\.panel>\.cube-top\.view-header-toolbar \.puzzle-display-control\{[^}]*white-space:nowrap/,'header captions stay on one line');
 assert.match(game,/\.log-panel>\.log-tools\{position:absolute/);assert.match(game,/height:clamp\(300px,79vw,500px\);min-height:300px/);
 assert.doesNotMatch(cs,/\[hidden\][^{]*\{[^}]*visibility:hidden/,'unavailable solver controls reserve no rows');
 assert.match(journal,/\.journal-activity:empty\{display:none\}/);
 assert.match(game,/\.cube-bottom,\.cube-bottom\.view-metrics\{display:none!important\}/,'the removed metrics strip cannot reserve a row');
});
