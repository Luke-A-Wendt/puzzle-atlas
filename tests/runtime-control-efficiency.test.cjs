'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');

// Deliver observed attribute changes after the current task, like a browser's
// MutationObserver checkpoint. Only instrument the native controls needed by
// this test; this is not a rendering or network performance benchmark.
function observerHost(){
 const observers=[];let pending=false;
 class MutationObserver{
  constructor(callback){this.callback=callback;this.targets=[];this.records=[];observers.push(this);}
  observe(target,options){this.targets.push({target,options});}
  disconnect(){this.targets=[];this.records=[];}
 }
 function mutation(target,attributeName){
  for(const observer of observers)if(observer.targets.some(({target:root,options})=>options.attributes&&(root===target||options.subtree&&root.contains(target))&&(!options.attributeFilter||options.attributeFilter.includes(attributeName))))observer.records.push({type:'attributes',target,attributeName});
  if(!pending){pending=true;queueMicrotask(()=>{pending=false;for(const observer of observers){const records=observer.records;observer.records=[];if(records.length)observer.callback(records,observer);}});}
 }
 return{MutationObserver,mutation};
}

for(const puzzle of ['dino','jewel','ghost','cube10'])test(puzzle+' control synchronization happens at turn boundaries, not on every animation frame',async()=>{
 const app=createPage(puzzle,{speed:1});await app.flush();const api=app.context.PUZZLE_API;
 const source=app.element('ringPanel').querySelector('.ring-controls');
 const axes=app.element('viewRingSelector').querySelectorAll('.ring-key').map(button=>button.dataset.face);
 let selectorWalks=0;const query=source.querySelectorAll.bind(source);
 source.querySelectorAll=selector=>{if(selector==='*')selectorWalks++;return query(selector);};
 const face=axes[0],move={face,dir:-1,turns:1};
 assert.equal(api.runMoves([move,move],{label:'Repeated primitive'}),true);await app.flush();
 assert(selectorWalks>0,'new primitive updates available controls and playback accent');
 const token=app.element('viewRingCCW').getAttribute('data-turn-pulse');selectorWalks=0;
 for(let n=0;n<12;n++)await app.advance(5);
 assert.equal(app.snapshot().sequence.completed,0);
 assert.equal(selectorWalks,0,'interpolating one primitive does not traverse the selector DOM');
 assert.equal(app.element('viewRingCCW').getAttribute('data-turn-pulse'),token);
 await app.advance(2000);
 assert(selectorWalks>0,'next primitive updates the controls even for the identical axis and sign');
 assert.notEqual(app.element('viewRingCCW').getAttribute('data-turn-pulse'),token);
 await app.advance(2000);
 assert.equal(app.element('viewRingCCW').hasAttribute('data-turn-active'),false,'end removes playback accent');
 api.select(face);await app.flush();assert.equal(app.element('viewRingCCW').disabled,false,'manual controls return');
});

test('native control mutations still synchronize through the batched observer',async()=>{
 const host=observerHost(),app=createPage('dino',{globals:{MutationObserver:host.MutationObserver}});await app.flush();
 const native=app.element('selector').querySelector('.ring-key'),copy=app.element('viewRingSelector').querySelector('.ring-key');
 const original=native.setAttribute.bind(native);
 native.setAttribute=(attribute,value)=>{original(attribute,value);host.mutation(native,attribute);};
 native.setAttribute('aria-label','Updated native axis description');
 native.setAttribute('aria-pressed','true');
 assert.notEqual(copy.getAttribute('aria-label'),'Updated native axis description','mutation does not synchronously run the observer');
 await app.flush();
 assert.equal(copy.getAttribute('aria-label'),'Updated native axis description');
 assert.equal(copy.getAttribute('aria-pressed'),'true');
});

test('animation does not repeatedly write the already hidden node tooltip',async()=>{
 const app=createPage('dino',{speed:1});await app.flush();
 const tip=app.element('pieceReferenceTooltip');let hidden=tip.hidden,writes=0;
 Object.defineProperty(tip,'hidden',{get:()=>hidden,set:value=>{hidden=value;writes++;},configurable:true});
 const face=app.element('viewRingSelector').querySelector('.ring-key').dataset.face;
 app.context.PUZZLE_API.move({face,dir:1});await app.flush();writes=0;
 for(let n=0;n<12;n++)await app.advance(5);
 assert.equal(writes,0,'hidden tooltip creates no repeated attribute mutations');
 assert.equal(tip.hidden,true);
});
