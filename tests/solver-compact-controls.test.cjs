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
 const intrinsic=el=>{const s=style(el);if(el.classList.contains('cs-tools'))return group(el)+px(s,'padding-left')+px(s,'padding-right')+border(s);if(el.id==='csHold')return px(style(app.element('csHeldCount')),'min-width')+measure('Hold',s)+px(s,'gap')+px(s,'padding-left')+px(s,'padding-right')+border(s);if(el.classList.contains('cs-pair-chip'))return Math.max(px(s,'min-width'),20+Math.max(px(style(el.querySelector('.cs-slot-value')),'min-width'),measure('Swap',style(el.querySelector('.cs-slot-value'))))+px(s,'column-gap')+px(s,'padding-left')+px(s,'padding-right')+border(s));return Math.max(px(s,'min-width'),px(s,'width'),measure(el.textContent,s)+px(s,'padding-left')+px(s,'padding-right')+border(s));};
 const group=el=>{const children=el.children.filter(e=>e.nodeType!==3&&!e.hidden&&style(e).display!=='none');return children.reduce((sum,e)=>sum+intrinsic(e),0)+px(style(el),'gap')*(children.length-1);};
 return {style,row,toolbar,selection,intrinsic,toolbarWidth:group(toolbar),selectionWidth:group(selection),gap:px(style(row),'column-gap',8),available:panelWidth-px(style(controls),'padding-left')-px(style(controls),'padding-right')};
}
for(const puzzle of puzzles)test(puzzle+' compact solver controls fit content, keep both pair selectors, and wrap intact on phones',async()=>{
 const app=createPage(puzzle);await app.flush();app.context.ConstrainedSolverUI.setActive(true);
 const controls=app.element('constrainedSolverControls'),row=controls.querySelector('.cs-action-row');assert(row);
 assert.deepEqual(row.children.map(e=>e.className),['cs-toolbar','cs-selection','small outline cs-guide']);
 assert.deepEqual(row.querySelector('.cs-toolbar').children.map(e=>e.id||e.className),['cs-tools']);
 assert.deepEqual(row.querySelector('.cs-tools').children.filter(e=>e.id!=='csSwap').map(e=>e.id),['csHold','csClear','csSuggestHolds']);
 assert.equal(app.element('csHeldCount').parentNode,app.element('csHold'));
 assert.equal(app.element('csHold').children[0].id,'csHeldCount','count appears before the one Hold caption');
 assert.equal(app.element('csClear').textContent,'Clear');assert.equal(app.element('csSuggestHolds').textContent,'Suggest');
 const guide=app.element('csGuide');assert.equal(guide.href,'https://atlas.test/solver-handbook.html#using-constrained-solver');assert.equal(guide.target,'_blank');assert.equal(guide.rel,'noopener');
 assert.deepEqual(row.querySelector('.cs-selection').children.filter(e=>e.id).map(e=>e.id),['csPairA','csPairB','csGo']);
 for(const [width,panelWidth]of [[320,304],[360,344],[412,396],[1280,600]]){
  const b=budget(app,puzzle,width,panelWidth),{style}=b;
  assert.equal(style(row).display,'grid');assert.equal(style(guide)['grid-row'],'1');assert.equal(style(guide)['justify-self'],'end');assert.equal(style(b.toolbar)['flex-wrap'],'nowrap');assert.equal(style(b.selection)['flex-wrap'],'nowrap');
  assert(b.toolbarWidth+b.gap+b.intrinsic(guide)<=b.available,`${puzzle} ${width}px holds row ${b.toolbarWidth} <= ${b.available}`);
  assert(b.selectionWidth<=b.available,`${puzzle} ${width}px pair row ${b.selectionWidth} <= ${b.available}`);
  if(width>680)assert(b.toolbarWidth+2*b.gap+b.selectionWidth+b.intrinsic(guide)<=b.available,'desktop controls occupy one line without stretched fields');
  for(const id of ['csHold','csClear','csSuggestHolds','csGo','csGuide']){const el=app.element(id),s=style(el),height=id==='csGo'||id==='csGuide'?32:26;assert.equal(px(s,'height'),height);assert.equal(s['white-space'],'nowrap');assert(textBudget(el,s,b.intrinsic(el),height).fits,id+' caption fits');}
  const badge=app.element('csHeldCount'),badgeStyle=style(badge);assert.equal(badgeStyle.background,'#08090d');for(const count of ['0','24','600','1000']){badge.textContent=count;assert(textBudget(badge,badgeStyle,px(badgeStyle,'min-width'),px(badgeStyle,'height')).fits,`${puzzle} ${width}px count ${count} fits without changing the controls`);}
  for(const id of ['csPairA','csPairB']){const chip=app.element(id),field=chip.querySelector('.cs-slot-value'),s=style(field);assert.equal(s.width,'max-content');assert.equal(px(s,'min-width'),42);assert.equal(s.overflow,'visible');assert.equal(s['text-overflow'],'clip');assert.equal(px(style(chip),'height'),32);assert.equal(field.textContent,'Swap');assert(measure(field.textContent,s)<=42,'Swap fits before the circled number');assert.equal(style(chip.querySelector('.cs-slot-label'))['grid-column'],'2');}
  const feedback=controls.querySelector('.cs-feedback'),detail=controls.querySelector('.cs-detail-slot');assert.equal(style(feedback)['grid-template-rows'],'30px','there is no extra line beneath the progress');assert.equal(style(detail)['grid-row'],'1','idle results reuse the reserved progress footprint');assert.equal(style(detail)['max-height'],undefined);
 }
});
