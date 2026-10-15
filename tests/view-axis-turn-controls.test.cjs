'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games'),puzzles=fs.readdirSync(games).filter(n=>n.endsWith('.html')&&fs.readFileSync(path.join(games,n),'utf8').includes('id="ccw"')).map(n=>n.slice(0,-5));
const plain=x=>JSON.parse(JSON.stringify(x));
function physical(app){const s=app.snapshot();return plain(s.stickers||s.pieces);}
function settle(app){for(let n=0;n<500;n++){const s=app.snapshot();if(!s.animating&&s.mode==='idle')return;app.frame(2000);}throw Error('Unfinished turn');}
for(const puzzle of puzzles)test(puzzle+' reserved 3D toolbar requests physical notation turns and preserves disabled state',async()=>{
 const app=createPage(puzzle),api=app.context.PUZZLE_API,display=app.context.PuzzleAxisDisplay;
 await app.flush();
 const cube=app.element('cube'),wrap=cube.parentElement,toolbar=app.document.querySelector('.cube-top'),panel=wrap.parentElement;
 assert.equal(toolbar.parentElement,panel);assert.equal(toolbar.nextSibling,wrap);assert.equal(wrap.contains(toolbar),false,'settings never overlay the puzzle canvas');
 const primary=app.element('viewRingControls'),group=primary.querySelector('.turn-bar');
 assert.equal(toolbar.getAttribute('role'),'toolbar');assert.equal(primary.parentElement,panel);assert.equal(wrap.nextSibling,primary);assert.equal(app.element('viewActionsToggle'),null);
 for(const id of ['faceView','homeView']){const camera=app.element(id);if(camera){assert.equal(camera.hidden,true);assert.equal(camera.disabled,true);assert.equal(camera.getAttribute('aria-hidden'),'true');assert.equal(camera.getAttribute('tabindex'),'-1');}}
 assert.deepEqual(app.element('viewDisplayTools').children.filter(e=>e.nodeType!==3).map(e=>e.id),['viewLabelMode','viewHighlightToggle']);
 for(const id of ['viewRingCCW','viewRingCW','ccw','cw'])assert.equal(app.element(id).disabled,true,id+' initially disabled');
 assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
 const axes=app.document.querySelectorAll('.notation-key').map(button=>button.dataset.face);assert(axes.length>0);
 // The 3D arrows request physical turns through the same native notation
 // handler; ring-map screen direction stays independently defined.
 for(const axis of [axes[0],axes.at(-1)])for(const [native,duplicate]of [['ccw','viewRingCCW'],['cw','viewRingCW']]){
  api.reset();api.select(axis);display.syncTurnControls();assert.equal(app.element(duplicate).disabled,app.element(native).disabled);assert.equal(app.element('viewRingSelectedName').textContent,api.axisLabel?.(axis)||axis);
  const direction=native==='ccw'?-1:1;
  api.move({face:axis,dir:direction,turns:1});settle(app);const expected=physical(app),expectedMove=plain(app.snapshot().history.at(-1));
  api.reset();api.select(axis);display.syncTurnControls();app.click(duplicate);display.syncTurnControls();
  assert.equal(app.element('viewRingCCW').disabled,true,'no duplicate turn while animating');assert.equal(app.element('viewRingCW').disabled,true);settle(app);
  assert.deepEqual(physical(app),expected,duplicate+' physical result for '+axis);assert.deepEqual(app.snapshot().history.at(-1),expectedMove,duplicate+' exact signed move for '+axis);
 }
 display.clear();display.syncTurnControls();for(const id of ['viewRingCCW','viewRingCW','ccw','cw'])assert.equal(app.element(id).disabled,true,id+' disabled after deselection');assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');
 const before=physical(app);app.click('viewRingCW');assert.deepEqual(physical(app),before);assert.equal(app.snapshot().animating,false);
 api.select(axes[0]);display.syncTurnControls();app.element('cw').disabled=true;display.syncTurnControls();assert.equal(app.element('viewRingCW').disabled,true,'native legality/blocking is authoritative');
 // Same controls stay available when the ring panel is collapsed.
 app.element('ringPanel').hidden=true;api.select(axes[0]);display.syncTurnControls();assert.equal(app.element('viewRingCW').disabled,false);app.click('viewRingCW');assert.equal(app.snapshot().animating,true);settle(app);
});
test('toolbar CSS reserves space and explicitly dims both sets of disabled turn buttons',()=>{
 const css=fs.readFileSync(path.join(games,'game-theme.css'),'utf8');assert.match(css,/\.panel>\.cube-top\{position:static;[^}]*flex:0 0 auto;[^}]*flex-wrap:wrap/);assert.match(css,/\.turn-bar button:disabled,\.cube-top \.view-axis-turn:disabled\{[^}]*opacity:\.33;[^}]*cursor:not-allowed/);assert.match(css,/@media\(max-width:680px\)\{\.panel>\.cube-top/);
});
test('short landscape retains intrinsic control height without bitmap-driven growth; portrait stays auto-height',()=>{
 const css=fs.readFileSync(path.join(games,'game-theme.css'),'utf8'),parentCss=fs.readFileSync(path.join(games,'../play.css'),'utf8');
 assert.match(css,/\.workspace\{[^}]*min-height:420px;min-height:min-content/,'desktop workspace may extend the scrollable document to fit controls');
 assert.match(css,/\.workspace>section>\.canvas-wrap\{contain:size\}/,'bitmap backing dimensions cannot inflate the minimum on repeated ResizeObserver callbacks');
 assert.match(css,/\.ring-wrap,\.cube-wrap\{height:auto;flex:1 1 0;min-height:280px/);
 assert.match(css,/\.app\{height:auto;min-height:0/,'portrait document expands for toolbar and panels');
 assert.match(css,/\.workspace\{display:flex;flex-direction:column;gap:8px;min-height:0\}/,'portrait override removes desktop intrinsic constraint');
 assert.match(css,/\.ring-wrap,\.cube-wrap\{flex:none;height:clamp\(300px,79vw,500px\);min-height:300px/);
 assert.match(parentCss,/\.game-area iframe\{[^}]*height:100%/,'desktop iframe keeps its viewport instead of growing indefinitely');
 assert.match(parentCss,/\.play-layout \.game-area\{height:var\(--game-height,1120px\)\}/,'portrait iframe honors its child document height');
});
for(const puzzle of ['cube2','cube8','ghost','helicopter','homer','megaminx'])test(puzzle+' initializes once and naturally resynchronizes after hiding/resizing the ring panel',async()=>{
 const observed=[];
 class ResizeObserver {constructor(callback){this.callback=callback;this.targets=[];observed.push(this);}observe(target){this.targets.push(target);}disconnect(){}}
 const app=createPage(puzzle,{globals:{ResizeObserver}}),api=app.context.PUZZLE_API;await app.flush();
 app.document.dispatch('DOMContentLoaded');await app.flush();assert.equal(app.document.querySelectorAll('#viewRingControls').length,1,'DOMContentLoaded does not duplicate or reposition controls');
 const primary=app.element('viewRingControls'),group=primary.querySelector('.turn-bar'),wrap=app.element('cube').parentElement,toolbar=app.document.querySelector('.cube-top');assert.equal(toolbar.nextSibling,wrap);assert.equal(wrap.nextSibling,primary);
 assert.equal(app.element('viewRingCW').disabled,true);const axis=app.document.querySelectorAll('.notation-key')[0].dataset.face;api.select(axis);await app.flush();assert.equal(app.element('viewRingCW').disabled,false,'native updateUI synchronizes after its current task without a public test hook');
 app.click('ringPanelHide');await app.flush();assert(app.document.body.classList.contains('rings-collapsed'));assert.equal(app.element('ringPanel').inert,true);assert.equal(app.element('ringPanelToggle').hidden,false);
 app.element('rings').bounds={left:0,top:0,width:0,height:0};app.element('cube').bounds={left:0,top:0,width:620,height:330};
 for(const observer of observed)if(observer.targets.includes(app.element('cube')))observer.callback([]);app.frame(0);await app.flush();
 assert.equal(app.element('cube').width,620);assert.equal(app.element('cube').height,330);assert.equal(group.parentElement,primary);assert.equal(wrap.nextSibling,primary);assert.equal(toolbar.nextSibling,wrap);
 api.select(axis);await app.flush();assert.equal(app.element('viewRingCW').disabled,false);app.click('viewRingCW');await app.flush();assert.equal(app.element('viewRingCW').disabled,true);settle(app);await app.flush();
 app.click('ringPanelToggle');await app.flush();assert.equal(app.element('ringPanel').inert,false);assert.equal(app.document.body.classList.contains('rings-collapsed'),false);
 app.element('rings').bounds={left:0,top:0,width:320,height:300};app.element('cube').bounds={left:0,top:0,width:320,height:300};
 for(const observer of observed)if(observer.targets.includes(app.element('cube')))observer.callback([]);app.frame(0);await app.flush();assert.equal(app.element('cube').width,320);assert.equal(app.element('cube').height,300);assert.equal(toolbar.nextSibling,wrap);
 api.reset();await app.flush();for(const id of ['ccw','cw','viewRingCCW','viewRingCW'])assert.equal(app.element(id).disabled,true,id+' returns to unselected default');
});
