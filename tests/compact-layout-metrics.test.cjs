'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const {createCascade,textBudget,px,measure,match,specificity}=require('./css-budget-helper.cjs');
const games=path.join(__dirname,'../dist/games');
const puzzles=fs.readdirSync(games).filter(name=>name.endsWith('.html')&&fs.readFileSync(path.join(games,name),'utf8').includes('id="notationButtons"')).map(name=>name.slice(0,-5));
const widths=[320,360,412];
function check(el,style,width,height,context){const b=textBudget(el,style,width,height);assert.equal(b.fits,true,`${context}: ${JSON.stringify({...b,rules:undefined})}`);}
function innerWidth(width,app,style){const a=style(app.document.querySelector('.app'));return width-px(a,'padding-left')-px(a,'padding-right')-2;}
test('source-cascade checker distinguishes the v60 specificity conflict and direct children',()=>{
 assert.deepEqual(specificity('.panel>.cube-top .small'),[0,3,0]);
 assert.deepEqual(specificity('.view-primary-tools>.small'),[0,2,0]);
 const app=createPage('tetraminx');assert.equal(match(app.element('viewLabelMode'),'.panel>.cube-top .small'),true);assert.equal(match(app.element('viewLabelMode'),'.panel>.view-primary-tools .small'),false);
});
for(const puzzle of puzzles)test(puzzle+' retains square prime pairs without clipping native monospace labels or legacy grid overrides',async()=>{
 const app=createPage(puzzle);await app.flush();
 for(const width of [...widths,1280]){
  const style=createCascade(app,puzzle,width,width>680?600:width-8),container=app.element('notationButtons');
  assert.equal(style(container).display,'flex',puzzle+' notation must wrap complete prime pairs; later inline grid rules cannot win');
  const sizes=new Set();for(const el of container.querySelectorAll('.notation-key')){const s=style(el),w=px(s,'width'),h=px(s,'height');assert.ok(w>=28&&w<=34);assert.equal(w,h);sizes.add(w);check(el,s,w,h,puzzle+' notation '+width+'px');}assert.equal(sizes.size,1,puzzle+' notation squares have consistent sizes');
  for(const el of app.document.querySelectorAll('*').filter(e=>['.canvas-caption','.ring-hint','.notation-panel>p','.legacy-face-metric'].some(selector=>match(e,selector))))assert.equal(style(el).display,'none',puzzle+' explanatory text/counter must not reserve play-space');
  const selected=app.element('selectedName').parentNode;assert.equal(selected.getAttribute('data-selected'),'false');for(const el of selected.children.filter(e=>e.tagName==='SPAN'))assert.equal(style(el).display,'none','Selected caption hidden until an axis is selected');
 }
});
for(const puzzle of ['cube8','cube9','cube10'])test(puzzle+' ring keys leave room for active bold inner-slice names',async()=>{
 const app=createPage(puzzle);await app.flush();
 for(const width of widths){const style=createCascade(app,puzzle,width),panel=innerWidth(width,app,style),controls=style(app.element('viewRingControls')),available=panel-px(controls,'padding-left')-px(controls,'padding-right');
  for(const row of app.element('viewRingControls').querySelectorAll('.axis-row')){const rs=style(row),label=row.querySelector('.axis-label'),buttons=row.querySelector('.axis-buttons'),bs=style(buttons),keys=buttons.children.filter(e=>e.tagName==='BUTTON');
   let space=available-px(rs,'padding-left')-px(rs,'padding-right')-2;if(rs.display==='flex')space-=px(style(label),'width')+px(rs,'gap');
   const cell=(space-px(bs,'gap')*(keys.length-1))/keys.length;
   for(const key of keys)check(key,{...style(key),'font-weight':'700'},cell,px(style(key),'min-height'),`${puzzle} ring key ${width}px`);
  }
 }
});
function intrinsic(el,style){
 const s=style(el),padding=px(s,'padding-left')+px(s,'padding-right')+2;
 const text=displayedText(el,style).trim(),words=s['white-space']==='nowrap'?[text]:text.split(/\s+/);
 return Math.max(px(s,'min-width'),px(s,'width'),...words.map(word=>measure(word,s)+padding+1));
}
function displayedText(el,style){
 if(el.nodeType===3)return el.textContent;
 if(el.hidden||style(el).display==='none')return '';
 return el.children.length?el.children.map(child=>displayedText(child,style)).join(''):el.textContent;
}
function headerWidth(header,style,context){
 let needed=0,visible=0;
  for(const child of header.children.filter(e=>e.nodeType!==3&&!e.hidden&&style(e).display!=='none')){
   if(child.tagName==='H2'){assert.equal(style(child)['white-space'],'nowrap');if(style(child).position==='absolute')continue;needed+=measure(displayedText(child,style),style(child));visible++;continue;}
   const buttons=child.tagName==='BUTTON'?[child]:child.children.filter(e=>e.tagName==='BUTTON'&&!e.hidden&&style(e).display!=='none');
   if(!buttons.length)continue;visible++;
   needed+=buttons.reduce((sum,button)=>{const st=style(button);assert.equal(st['white-space'],'nowrap',button.id+' caption stays on a single line');const w=intrinsic(button,style),h=px(st,'height',px(st,'min-height'));check({textContent:displayedText(button,style)},st,w,h,context+' '+button.id);return sum+w;},0)+Math.max(0,buttons.length-1)*px(style(child),'gap');
  }
  needed+=Math.max(0,visible-1)*px(style(header),'gap');
 return needed;
}
for(const puzzle of puzzles)test(puzzle+' retains native selector styling in 3D and keeps one readable mobile header line',async()=>{
 const app=createPage(puzzle);await app.flush();app.element('guidePanelToggle').hidden=false;
 const header=app.document.querySelector('.view-header-toolbar');
 assert.equal(header.nextSibling,app.element('cube').parentElement);
 assert.equal(app.document.querySelectorAll('.view-panel-head').length,1);
 assert.deepEqual(app.element('viewDisplayTools').children.filter(e=>e.nodeType!==3).map(e=>e.id),['viewLabelMode','viewHighlightToggle']);
 for(const width of [...widths,1280])for(const mode of ['none','some','all']){
  app.context.PuzzleAxisDisplay.setLabelMode(mode);
  const style=createCascade(app,puzzle,width,width>680?600:width-8),panel=width>680?600:innerWidth(width,app,style),hs=style(header),available=panel-px(hs,'padding-left')-px(hs,'padding-right');
  assert.equal(hs['flex-wrap'],'nowrap');
  const native=app.element('selector').querySelectorAll('*'),copied=app.element('viewRingSelector').querySelectorAll('*');assert.equal(copied.length,native.length);
  for(let i=0;i<native.length;i++)for(const property of ['display','font-size','min-height','padding-left','padding-right','gap','grid-template-columns'])assert.equal(style(copied[i])[property],style(native[i])[property],puzzle+' duplicate '+property);
  const needed=headerWidth(header,style,puzzle+' '+width+'px');
  if(width<=680)for(const button of header.querySelectorAll('button').filter(el=>!el.hidden&&style(el).display!=='none'))for(const side of ['left','right']){
   assert.equal(px(style(button),'padding-'+side),7,button.id+' keeps comfortable text-edge space');
   assert.equal(px(style(button),'padding-'+side),px(style(app.element('csShowGoal')),'padding-'+side),'3D padding matches the full-padding ring-map action');
  }
  if(width<=680)for(const id of ['ringFocus','ringLabelToggle','ringPanelHide'])for(const side of ['left','right'])assert.equal(px(style(app.element(id)),'padding-'+side),3,id+' existing mobile ring-map spacing stays unchanged');
  if(width>=360&&puzzle!=='helicopter')assert.ok(needed<=available,`${puzzle} ${width}px header needs ${needed.toFixed(1)}px, available ${available.toFixed(1)}px`);
  else assert.equal(hs['overflow-x'],'auto','very narrow optional-feature combinations remain reachable without clipped text');
  assert.equal(style(app.element('notationButtons').closest('.notation-panel')).display,'none');
 }
});

for(const puzzle of ['axis','ghost','mirror','flatdiamond','pyramorphix','mastermorphix'])test(puzzle+' fits mirror-on and longest single-line header captions at phone widths',async()=>{
 const app=createPage(puzzle);await app.flush();app.element('guidePanelToggle').hidden=false;app.click('mirrorMode');await app.flush();
 app.context.PuzzleAxisDisplay.setLabelMode('none');app.context.PuzzleAxisDisplay.setHighlights3D(false);
 assert.equal(app.element('viewLabelMode').textContent,'Some labels');assert.equal(app.element('viewHighlightToggle').textContent,'Show highlights');
 const header=app.document.querySelector('.view-header-toolbar'),heading=header.querySelector('h2');assert.equal(heading.getAttribute('aria-label'),'3D puzzle');
 assert(header.classList.contains('has-mirror-toggle'));
 assert.equal(app.element('guidePanelToggle').getAttribute('aria-label'),'Show guide');
 for(const width of [360,412,1280]){
  const style=createCascade(app,puzzle,width,width>680?600:width-8),panel=width>680?600:innerWidth(width,app,style),hs=style(header),available=panel-px(hs,'padding-left')-px(hs,'padding-right');
  const needed=headerWidth(header,style,puzzle+' mirror-on '+width+'px');
  assert.ok(needed<=available,`${puzzle} mirror-on ${width}px header needs ${needed.toFixed(1)}px, available ${available.toFixed(1)}px`);
  assert.equal(style(heading).position==='absolute',width<=380,'only narrow mirror headers trade visual title space for full button padding');
  assert.equal(displayedText(app.element('guidePanelToggle'),style),width<=680?'Guide ←':'Show guide ←');
  if(process.env.REPORT_HEADER_WIDTHS)console.log(`${puzzle} mirror-on ${width}px: ${needed.toFixed(2)}/${available.toFixed(2)}px`);
 }
});
test('compact guide captions retain their accessible action through guide and ring panel toggles',async()=>{
 const app=createPage('mirror',{skipScripts:['ring-panel.js']}),messages=[];
 app.context.parent={postMessage:message=>messages.push(message)};app.loadScript('ring-panel.js');await app.flush();
 const guide=app.element('guidePanelToggle'),full=guide.querySelector('.view-guide-full'),short=guide.querySelector('.view-guide-short');
 assert(full&&short);app.click('guidePanelToggle');assert(messages.some(message=>message.type==='toggle-guide'));
 for(const open of [true,false]){
  app.win.dispatch('message',{source:app.context.parent,origin:app.context.location.origin,data:{type:'guide-panel-state',open}});await app.flush();
  assert.equal(guide.hidden,open);assert.equal(guide.getAttribute('aria-expanded'),String(open));
  assert.equal(guide.querySelector('.view-guide-full'),full);assert.equal(guide.querySelector('.view-guide-short'),short);
 }
 app.click('ringPanelHide');await app.flush();assert.equal(app.element('ringPanelToggle').hidden,false);
 app.click('ringPanelToggle');await app.flush();assert.equal(app.element('ringPanelToggle').hidden,true);
 assert.equal(guide.getAttribute('aria-label'),'Show guide');assert.equal(guide.title,'Show guide');
 for(const width of [360,412])assert.equal(displayedText(guide,createCascade(app,'mirror',width)),'Guide ←');
});
test('Helicopter Advanced controls retain native visibility without an actions disclosure',async()=>{
 const app=createPage('helicopter');await app.flush();app.click('advanced');await app.flush();
 assert.equal(app.element('mirrorMode').hidden,false);
 assert.equal(app.element('jumbleControls').hidden,false);
 assert.equal(app.element('viewActionsToggle'),null);
 for(const width of widths){const style=createCascade(app,'helicopter',width);assert.notEqual(style(app.element('jumbleControls')).display,'none');assert.equal(style(app.document.querySelector('.view-header-toolbar'))['flex-wrap'],'nowrap');}
});
test('mobile top controls occupy two rows in requested order with a stable Stop caption',async()=>{
 const app=createPage('cube3');await app.flush();
 const group=app.document.querySelector('.action-group'),ids=group.children.filter(e=>e.nodeType!==3).map(e=>e.id||e.className);
 assert.deepEqual(ids.slice(0,6),['randomize','solve','journal-transport','playbackSpeedControl','pause','reset']);
 for(const width of widths){const style=createCascade(app,'cube3',width),panel=innerWidth(width,app,style),ps=style(app.document.querySelector('.action-panel')),available=panel-px(ps,'padding-left')-px(ps,'padding-right'),cell=(available-12)/4;
  assert.equal(ps['grid-template-rows'],'34px 34px');
  for(const id of ['randomize','solve','pause','reset']){const el=app.element(id);const text=el.textContent;el.textContent=text.replace(/[⤨✦]\s*/g,'');check(el,style(el),cell,34,'top '+id+' '+width+'px');el.textContent=text;}
 }
});
test('removed metrics strip does not consume play space at any supported width',async()=>{
 const app=createPage('cube3');await app.flush();
 assert.equal(app.element('playTimer'),null);assert.equal(app.document.querySelector('.play-solved-readout'),null);
 for(const width of [...widths,1280]){const style=createCascade(app,'cube3',width);assert.equal(style(app.document.querySelector('.cube-bottom')).display,'none');}
});
test('10×10 fourth-slice labels agree in both canvases and readouts while click targets retain legal move IDs',async()=>{
 const app=createPage('cube10'),texts={cube:[],rings:[]};
 await app.flush();
 for(const id of Object.keys(texts))app.element(id).drawing.fillText=text=>texts[id].push(String(text));
 app.context.PuzzleAxisDisplay.setLabelMode('all');
 const key=app.element('viewRingSelector').querySelectorAll('.ring-key').find(el=>el.dataset.face==='Riiii');assert.equal(key.textContent,'Riv');key.click();await app.advance(0);
 assert.equal(app.element('selectedName').textContent,'Riv');assert.equal(app.element('viewRingSelectedName').textContent,'Riv');
 for(const [id,labels]of Object.entries(texts)){assert(labels.includes('Riv'),id+' shows the same short label');assert(!labels.includes('Riiii'),id+' does not show a different spelling');}
 assert(app.context.PuzzleAxisDisplay.axisLabelTargets().some(target=>target.face==='Riiii'),'3D click target still selects the canonical legal slice');
 assert.deepEqual(JSON.parse(JSON.stringify(app.context.CubeEngine.normalizeMove('Riv'))),JSON.parse(JSON.stringify(app.context.CubeEngine.normalizeMove('Riiii'))));
 const api=app.context.PUZZLE_API,before=JSON.stringify(app.snapshot().stickers);
 assert.equal(api.moveLabel(app.context.CubeEngine.normalizeMove('Riiii')),'Riv','journal uses the same short label');
 assert.equal(api.runMoves('Riv Riv′'),true,'public guide/replay input accepts the displayed spelling');
 for(let frame=0;frame<10&&(app.snapshot().animating||app.snapshot().mode!=='idle');frame++)await app.advance(2000);
 assert.equal(app.snapshot().mode,'idle');assert.equal(JSON.stringify(app.snapshot().stickers),before,'displayed inverse moves round-trip through the real playback API');
});

test('Solved, In play and Scrambling status matches toolbar height and fits its reserved mobile cell',async()=>{
 const app=createPage('cube3');await app.flush();const status=app.element('status');
 for(const width of [...widths,1280]){
  const style=createCascade(app,'cube3',width),ss=style(status),button=style(app.element('reset'));
  assert.equal(px(ss,'height'),px(button,'height',px(button,'min-height')),'status and buttons share a height');
  const panel=innerWidth(width,app,style),ps=style(app.document.querySelector('.action-panel')),available=panel-px(ps,'padding-left')-px(ps,'padding-right'),cell=width>680?120:(available-12)/4;
  for(const text of ['● Solved','● In play','⤨ Scrambling','✦ Solving']){status.textContent=text;check(status,ss,cell,px(ss,'height'),text+' status '+width+'px');}
 }
});
