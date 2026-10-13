'use strict';
const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./game-harness.cjs');
const base=path.join(__dirname,'../dist/games');
const appFor=(name,search='')=>createHarness({htmlPath:path.join(base,name+'.html'),bundled:true,search});
const state=s=>JSON.stringify({pieces:s.pieces,stickers:s.stickers,history:s.history,journal:s.journal,view:s.view,seed:s.seed,selected:s.selected,mode:s.mode,paused:s.paused,userTurns:s.userTurns,animating:s.animating});
for(const name of ['mirror','flatdiamond','pyramorphix','mastermorphix']){
 const app=appFor(name),api=app.context.PUZZLE_API;
 assert.equal(app.snapshot().mirrorMode,false,name+' starts colored');assert.equal(app.snapshot().mirrorEligible,true);
 app.click('mirrorMode');
 assert.equal(app.snapshot().mirrorMode,true);assert.equal(app.elements.get('ringPanel').hidden,true);assert(app.document.body.classList.contains('mirror-active'));
 assert.equal(app.elements.get('mirrorMode').attributes['aria-pressed'],'true');
 if(name!=='mirror'){assert(app.elements.get('pieceLabels').hidden);assert(app.elements.get('identityMetric').hidden);}
 assert(api.move('R'));app.frame(30);const before=state(app.snapshot());assert(api.setMirrorMode(false));assert.equal(before,state(app.snapshot()),name+' toggles preserve moving state');app.complete();assert(!app.snapshot().solved);
 const settled=state(app.snapshot());api.setMirrorMode(true);assert.equal(settled,state(app.snapshot()),name+' toggles preserve history and view');assert.equal(app.elements.get('ringPanel').hidden,true);assertAutoSolveDelegates(app.context);app.click('undo');app.complete();assert(app.snapshot().solved);
 api.randomize();app.complete();assert(!app.snapshot().solved);assertAutoSolveDelegates(app.context);api.reset();assert(app.snapshot().solved);
 api.setMirrorMode(false);assert(!app.elements.get('ringPanel').hidden);assert(!app.document.body.classList.contains('mirror-active'));
 const advanced=appFor(name,'?mirror=1');assert(advanced.snapshot().mirrorMode);assert(advanced.elements.get('ringPanel').hidden);
 console.log(name+': colored default, advanced mode, preserved state, controls, scramble/Undo/Auto Solve delegation, explicit URL PASS');
}
for(const name of ['rhombic','cornerocta','trajber','jewel']){
 const app=appFor(name,'?mirror=1');assert.equal(app.snapshot().mirrorMode,false);assert.equal(app.snapshot().mirrorEligible,false);assert(app.elements.get('mirrorMode').hidden);assert.equal(app.context.PUZZLE_API.setMirrorMode(true),false);
}
const master=appFor('mastermorphix');master.context.PUZZLE_API.move('U2');master.complete();assert.equal(master.snapshot().solved,false);master.context.PUZZLE_API.setMirrorMode(true);assert.equal(master.snapshot().solved,true,'monochrome geometry can be solved with color permutation');master.context.PUZZLE_API.setMirrorMode(false);assert.equal(master.snapshot().solved,false,'switching mode restores color completion rule');
const m=appFor('mirror'),E=m.context.MirrorEngine;
let solved=E.makeSolved();assert(E.isSolved(solved));assert(E.isShapeSolved(solved));
// A global rigid rotation and an invisible quarter-turn of a square center
// remain solved. The physical checker must not leak hidden piece orientation.
for(const move of ['R',"M'","L'"])solved=E.applyMove(solved,move);assert(E.isSolved(solved));assert(E.isShapeSolved(solved));
const misoriented=E.makeSolved();const center=misoriented.find(s=>s.homeP[0]===0&&s.homeP[1]===1&&s.homeP[2]===0);center.frame=center.frame.map(v=>E.rotateVector(v,1,1));assert(E.isSolved(misoriented));assert(E.isShapeSolved(misoriented));
assert.equal(appFor('mirror','?color=1').snapshot().mirrorMode,false);assert.equal(appFor('mirror','?color=0').snapshot().mirrorMode,true);
const html=fs.readFileSync(path.join(base,'mirror.html'),'utf8');assert(!html.includes('rc.rect('),'mirror ring nodes must all be circular');assert(html.includes('rc.arc(p.x,p.y,5.8'));
const css=fs.readFileSync(path.join(base,'game-theme.css'),'utf8');assert(css.includes('.mirror-active .workspace{grid-template-columns:minmax(0,1fr)}'));assert(css.includes('#ringPanel[hidden]'));
console.log('Symmetric puzzles exclude mirror mode; mode-specific physical completion and one-column layout PASS');
