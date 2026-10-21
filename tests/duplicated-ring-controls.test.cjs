'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const {createCascade}=require('./css-budget-helper.cjs');
const puzzles=require('../dist/games/constrained-solver-models/manifest.json').models.map(model=>model.id);
for(const puzzle of puzzles)test(puzzle+' keeps one visible 3D selector with native legal commands and no duplicate IDs',async()=>{
 const app=createPage(puzzle);await app.flush();
 const native=app.element('selector'),copy=app.element('viewRingSelector');
 const retired=native.closest('.ring-controls'),active=copy.closest('.ring-controls');
 assert.equal(retired.hidden,true);assert.equal(retired.inert,true);assert.equal(retired.getAttribute('aria-hidden'),'true');
 assert(retired.classList.contains('ring-native-controls'));assert.equal(retired.contains(app.element('rings')),false,'only native controls retire; the draggable map stays outside them');
 assert.equal(active.hidden,false);assert.equal(active.inert,false);assert.equal(active.getAttribute('aria-hidden'),null);
 for(const width of [360,1280]){const style=createCascade(app,puzzle,width);assert.equal(style(retired).display,'none','native controls reserve no play space');assert.notEqual(style(active).display,'none','3D controls remain visible');}
 const buttons=()=>native.querySelectorAll('.ring-key'),copies=()=>app.element('viewRingSelector').querySelectorAll('.ring-key');
 assert.equal(copy.className,native.className);assert.equal(buttons().length,copies().length);assert(buttons().length>0);
 const ids=app.document.querySelectorAll('*').map(e=>e.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length,'all copied IDs are namespaced');
 for(const [original,duplicate]of [['ccw','viewRingCCW'],['cw','viewRingCW']]){
  assert.equal(app.element(duplicate).querySelector('.direction').textContent,app.element(original).querySelector('.direction').textContent);
  assert.match(app.element(original).textContent,/Turn (left|right)/);
  assert.equal(app.element(duplicate).textContent.trim(),original==='ccw'?app.element(original).querySelector('.direction').textContent+' Rotate':'Rotate '+app.element(original).querySelector('.direction').textContent);
  assert.doesNotMatch(app.element(duplicate).textContent,/CCW|CW|Turn/);
  assert.match(app.element(duplicate).title,/looking inward/);
 }
 for(let index=0;index<buttons().length;index++){
  const a=buttons()[index],b=copies()[index];assert.equal(b.dataset.face,a.dataset.face);assert.equal(b.textContent,a.textContent);
 }
 // Visible selection retains the exact native legal move vocabulary.
 for(const index of [0,buttons().length-1]){
  copies()[index].click();await app.flush();
  for(let i=0;i<buttons().length;i++){
   assert.equal(copies()[i].className,buttons()[i].className);
   assert.equal(copies()[i].getAttribute('aria-pressed'),buttons()[i].getAttribute('aria-pressed'));
  }
  assert.equal(app.element('viewRingSelectedName').textContent,'');
 }
 // Hiding the map cannot remove or make its separate 3D controls inert.
 app.click('ringPanelHide');await app.flush();assert.equal(app.element('ringPanel').inert,true);
 copies()[0].click();await app.flush();assert.equal(app.element('viewRingCW').disabled,false);app.click('viewRingCW');assert.equal(app.snapshot().animating,true);
 for(let i=0;i<50&&(app.snapshot().animating||app.snapshot().mode!=='idle');i++)await app.advance(2000);
 assert.equal(app.snapshot().animating,false);
 app.context.PuzzleAxisDisplay.clear();await app.flush();assert.equal(app.element('viewRingSelectedName').textContent,'Select axis');assert.equal(app.element('viewRingCCW').disabled,true);assert.equal(app.element('viewRingCW').disabled,true);
});
test('native selector replacement is reflected without stale event targets or duplicate camera controls',async()=>{
 const app=createPage('cube3');await app.flush();const selector=app.element('selector'),first=selector.querySelector('.ring-key'),oldCopy=app.element('viewRingSelector').querySelector('.ring-key');
 let forwarded=0;const replacement=first.cloneNode(true);replacement.dataset.face='test-axis';replacement.textContent='Test';replacement.addEventListener('click',()=>{forwarded++;});
 first.parentNode.insertBefore(replacement,first);first.remove();app.context.PuzzleAxisDisplay.syncTurnControls();
 const newCopy=app.element('viewRingSelector').querySelector('.ring-key');assert.notEqual(newCopy,oldCopy);assert.equal(newCopy.textContent,'Test');newCopy.click();assert.equal(forwarded,1);
 oldCopy.click();assert.equal(forwarded,1,'detached native button is never invoked');
 app.document.dispatch('DOMContentLoaded');await app.flush();for(const id of ['viewRingControls','viewDisplayTools','homeView'])assert.equal(app.document.querySelectorAll('#'+id).length,1);assert.equal(app.element('faceView'),null,'removed camera control is never synthesized');
});
