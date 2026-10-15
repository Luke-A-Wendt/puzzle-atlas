'use strict';
// Native font metrics plus the full stylesheet cascade. This verifies budgets,
// not browser layout, while the lifecycle suite exercises real phase changes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {createCascade,px,measure,textBudget}=require('./css-budget-helper.cjs');
const games=path.join(__dirname,'../dist/games');
const puzzles=fs.readdirSync(games).filter(f=>f.endsWith('.html')&&fs.readFileSync(path.join(games,f),'utf8').includes('id="notationButtons"')).map(f=>f.slice(0,-5));
function budget(app,puzzle,width,panelWidth){
 const style=createCascade(app,puzzle,width,panelWidth),controls=app.element('constrainedSolverControls'),row=controls.querySelector('.cs-action-row'),toolbar=row.querySelector('.cs-toolbar'),selection=row.querySelector('.cs-selection');
 const border=s=>px(s,'border-left-width',1)+px(s,'border-right-width',1);
 const intrinsic=el=>{const s=style(el);if(el.classList.contains('cs-tools'))return intrinsic(app.element('csHold'));if(el.classList.contains('cs-pair-chip'))return 20+52+px(s,'column-gap')+px(s,'padding-left')+px(s,'padding-right')+border(s);return Math.max(px(s,'min-width'),px(s,'width'),measure(el.textContent,s)+px(s,'padding-left')+px(s,'padding-right')+border(s));};
 const group=el=>{const children=el.children.filter(e=>e.nodeType!==3&&!e.hidden&&style(e).display!=='none');return children.reduce((sum,e)=>sum+intrinsic(e),0)+px(style(el),'gap')*(children.length-1);};
 return {style,row,toolbar,selection,intrinsic,toolbarWidth:group(toolbar),selectionWidth:group(selection),gap:px(style(row),'column-gap',8),available:panelWidth-px(style(controls),'padding-left')-px(style(controls),'padding-right')};
}
for(const puzzle of puzzles)test(puzzle+' compact solver controls fit content, keep both pair selectors, and wrap intact on phones',async()=>{
 const app=createPage(puzzle);await app.flush();app.element('ringPanel').classList.add('cs-active');
 const controls=app.element('constrainedSolverControls'),row=controls.querySelector('.cs-action-row');assert(row);
 assert.deepEqual(row.children.map(e=>e.className),['cs-toolbar','cs-selection']);
 assert.deepEqual(row.querySelector('.cs-toolbar').children.filter(e=>e.id||e.className==='cs-tools').map(e=>e.id||e.className),['cs-tools','csHeldCount','csClear','csSuggestHolds']);
 assert.deepEqual(row.querySelector('.cs-selection').children.filter(e=>e.id).map(e=>e.id),['csPairA','csPairB','csGo']);
 for(const [width,panelWidth]of [[320,304],[360,344],[412,396],[1280,600]]){
  const b=budget(app,puzzle,width,panelWidth),{style}=b;
  assert.equal(style(row)['flex-wrap'],'wrap');assert.equal(style(b.toolbar)['flex-wrap'],'nowrap');assert.equal(style(b.selection)['flex-wrap'],'nowrap');
  assert(b.toolbarWidth<=b.available,`${puzzle} ${width}px holds row ${b.toolbarWidth} <= ${b.available}`);
  assert(b.selectionWidth<=b.available,`${puzzle} ${width}px pair row ${b.selectionWidth} <= ${b.available}`);
  if(width>680)assert(b.toolbarWidth+b.gap+b.selectionWidth<=b.available,'desktop controls occupy one line without stretched fields');
  for(const id of ['csHold','csClear','csSuggestHolds','csGo']){const el=app.element(id),s=style(el);assert.equal(px(s,'height'),32);assert.equal(s['white-space'],'nowrap');assert(textBudget(el,s,b.intrinsic(el),32).fits,id+' caption fits');}
  for(const id of ['csPairA','csPairB']){const chip=app.element(id),field=chip.querySelector('.cs-slot-value'),s=style(field);assert.equal(px(s,'width'),52);assert.equal(px(style(chip),'height'),32);for(const tile of app.snapshot().stickers){const name=(tile.face?tile.face+' · ':'')+tile.id;assert(measure(name,s)<=52,`${puzzle} actual tile ${name} fits pair field`);}}
  const feedback=controls.querySelector('.cs-feedback'),detail=controls.querySelector('.cs-detail-slot');assert.equal(style(feedback)['grid-template-rows'],'30px','there is no extra line beneath the progress');assert.equal(style(detail)['grid-row'],'1','idle results reuse the reserved progress footprint');assert.equal(style(detail)['max-height'],undefined);
 }
});
