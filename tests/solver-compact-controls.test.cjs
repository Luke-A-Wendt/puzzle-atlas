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
 const border=(s,el)=>px(s,'border-left-width',el?.classList.contains('cs-hold-title')?0:1)+px(s,'border-right-width',el?.classList.contains('cs-hold-title')?0:1);
 const intrinsic=el=>{const s=style(el);if(el.classList.contains('cs-tools')||el.classList.contains('cs-manual-hold'))return group(el)+px(s,'padding-left')+px(s,'padding-right')+border(s,el);if(el.classList.contains('cs-pair-chip'))return px(s,'width');return Math.max(px(s,'min-width'),px(s,'width'),measure(el.textContent,s)+px(s,'padding-left')+px(s,'padding-right')+border(s,el))+px(s,'margin-left')+px(s,'margin-right');};
 const group=el=>{const children=el.children.filter(e=>e.nodeType!==3&&!e.hidden&&style(e).display!=='none'&&style(e).position!=='absolute');return children.reduce((sum,e)=>sum+intrinsic(e),0)+px(style(el),'gap')*(children.length-1);};
 return {style,row,toolbar,selection,intrinsic,toolbarWidth:group(toolbar),selectionWidth:group(selection)+px(style(selection),'padding-left')+px(style(selection),'padding-right')+2,gap:px(style(row),'column-gap',8),available:panelWidth-px(style(controls),'padding-left')-px(style(controls),'padding-right')};
}
for(const puzzle of puzzles)test(puzzle+' compact solver controls fit content, keep both pair selectors, in one row on phones',async()=>{
 const app=createPage(puzzle);await app.flush();app.context.ConstrainedSolverUI.setActive(true);
 const controls=app.element('constrainedSolverControls'),row=controls.querySelector('.cs-action-row');assert(row);
 assert.deepEqual(row.children.map(e=>e.className),['cs-toolbar','cs-selection','small outline cs-guide']);
 const group=row.querySelector('.cs-hold-group');assert(group);assert.equal(group.parentNode,row.querySelector('.cs-toolbar'));assert.equal(group.querySelector('.cs-hold-title').textContent,'Hold');
 assert.deepEqual(group.children.filter(e=>e.id).map(e=>e.id),['csHeldCount','csClear','csHold','csSuggestHolds']);
 assert.equal(app.element('csHeldCount').parentNode,group,'shared count is outside Select and Auto');
 assert.equal(app.element('csHold').querySelector('.cs-hold-caption').textContent,'Select');assert.equal(app.element('csClear').textContent,'Clear');assert.equal(app.element('csSuggestHolds').textContent,'Auto');
 const guide=app.element('csGuide');assert.equal(guide.href,'https://atlas.test/solver-handbook.html#using-constrained-solver');assert.equal(guide.target,'_blank');assert.equal(guide.rel,'noopener');
 assert.deepEqual(row.querySelector('.cs-selection').children.filter(e=>e.id).map(e=>e.id),['csSwap','csPairA','csPairB']);
 for(const [width,panelWidth]of [[320,304],[360,344],[412,396],[1280,600]]){
  const b=budget(app,puzzle,width,panelWidth),{style}=b;
  assert.equal(style(row).display,'grid');assert.equal(style(guide)['grid-row'],'1');assert.equal(style(guide)['justify-self'],'end');assert.equal(style(b.toolbar)['flex-wrap'],'nowrap');assert.equal(style(b.selection)['flex-wrap'],'nowrap');
  assert(b.toolbarWidth+b.gap+b.intrinsic(guide)<=b.available,`${puzzle} ${width}px holds ${b.toolbarWidth} + gap ${b.gap} + guide ${b.intrinsic(guide)} <= ${b.available}`);
  assert(b.selectionWidth<=b.available,`${puzzle} ${width}px pair row ${b.selectionWidth} <= ${b.available}`);
  assert(b.toolbarWidth+2*b.gap+b.selectionWidth+b.intrinsic(guide)<=b.available,`${puzzle} ${width}px single row: ${b.toolbarWidth}+${b.selectionWidth}+${b.intrinsic(guide)}+${2*b.gap} <= ${b.available}`);
  for(const id of ['csHold','csClear','csSuggestHolds','csGuide']){const el=app.element(id),s=style(el),height=30;assert.equal(px(s,'height'),height);assert.equal(s['white-space'],'nowrap');assert(textBudget(el,s,b.intrinsic(el),height).fits,id+' caption fits');}
  const badge=app.element('csHeldCount'),badgeStyle=style(badge);assert.equal(badgeStyle.background,'#08090d');for(const count of ['0','24','600']){badge.textContent=count;assert(textBudget(badge,badgeStyle,px(badgeStyle,'min-width'),px(badgeStyle,'height')).fits,`${puzzle} ${width}px count ${count} fits without changing the controls`);}
  assert.equal(style(b.selection)['grid-row'],'1');assert.equal(app.element('csSwap').textContent,'Swap');assert.equal(app.element('csSwap').hidden,false);
  for(const id of ['csPairA','csPairB']){const chip=app.element(id),label=chip.querySelector('.cs-slot-label');assert.equal(chip.children.length,1);assert.equal(px(style(chip),'height'),30);assert.equal(style(label)['grid-column'],'1');assert.equal(style(label).border,'0');assert.equal(style(label)['border-radius'],'0');assert.equal(style(label).background,'transparent');assert(textBudget(label,style(label),20,20).fits,'plain number fits its button');}

  const feedback=controls.querySelector('.cs-feedback'),detail=controls.querySelector('.cs-detail-slot');assert.equal(style(feedback)['grid-template-rows'],'30px','there is no extra line beneath the progress');assert.equal(style(detail)['grid-row'],'1','idle results reuse the reserved progress footprint');assert.equal(style(detail)['max-height'],undefined);
 }
});
