'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,'dist',n),'utf8');
const html=read('index.html'),human=require('../dist/human-difficulty.js'),metrics=JSON.parse(read('atlas-metrics.json'));
const cards=[...html.matchAll(/<a class="puzzle-card"([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,body])=>({id:/data-puzzle="([^"]+)"/.exec(attrs)[1],family:/data-family="([^"]+)"/.exec(attrs)[1],mode:/data-mode="([^"]+)"/.exec(attrs)[1],rating:/data-difficulty="([^"]+)"/.exec(attrs)[1],attrs,body}));
const shapes=['axis','flatdiamond','ghost','mastermorphix','mirror','pyramorphix'];
test('36 distinct public puzzles plus six mirror views retain the unadvertised bonus route',()=>{
 assert.equal(cards.length,42);assert.equal(new Set(cards.map(c=>c.id)).size,36);assert(!cards.some(c=>c.id==='homer'));
 assert.equal(new Set(cards.map(c=>c.id+':'+c.mode)).size,42);
 assert.deepEqual(cards.filter(c=>c.mode==='mirror').map(c=>c.id).sort(),shapes);
 assert(cards.slice(0,36).every(c=>c.mode==='color'));assert(cards.slice(36).every(c=>c.mode==='mirror'));
 for(let i=1;i<36;i++)assert(human.puzzles[cards[i].id].rank>human.puzzles[cards[i-1].id].rank);
 const nav=/<nav class="family-nav"[\s\S]*?<\/nav>/.exec(html)[0];
 assert(!nav.includes('axes'));assert(nav.indexOf('data-filter="dodecahedral"')<nav.indexOf('data-filter="shapeshifter"'));assert(nav.indexOf('data-filter="shapeshifter"')<nav.indexOf('class="secret-puzzle"'));
 assert.match(html,/36 puzzles · One collection/);assert(!html.includes('37 puzzles'));assert(!html.includes('card-badge new'));
 assert(html.includes('https://github.com/Luke-A-Wendt'));assert(html.includes('https://openai.com/index/gpt-6-astra/'));assert.match(html,/<time datetime="\d{4}-\d{2}-\d{2}">/);
});
test('cards contain only human rating, group, title, image and Colors/Rings/Nodes',()=>{
 for(const c of cards){const m=metrics.puzzles[c.id],d=human.puzzles[c.id];assert(m&&d);
  const mirror=c.mode==='mirror';assert.equal(c.rating,mirror?'Very Hard':({easy:'Easy',medium:'Medium',hard:'Hard'}[d.difficulty]));
  assert.equal(c.family,m.shapeShifter?'shapeshifter':require('../scripts/atlas-card-data.json').find(p=>p.id===c.id).mechanismFamily);
  assert.deepEqual([...c.body.matchAll(/<dt>([^<]+)<\/dt>/g)].map(m=>m[1]),['Colors','Rings','Nodes']);
  for(const [label,count] of [['Colors',mirror?1:m.colors],['Rings',m.rings],['Nodes',m.nodes]])assert(c.body.includes(`<dt>${label}</dt><dd>${count}</dd>`),c.id+' '+label);
  assert(!/card-description|solve-estimate|map-note|mirror-rating|card-foot|play-link|Junctions|solve moves|node positions|Cubical,/.test(c.body));
  const href=/href="([^"]+)"/.exec(c.attrs)[1].replaceAll('&amp;','&');const route=new URL(href,'https://atlas.test/');
  assert.equal(route.searchParams.get('p'),c.id);assert.equal(route.searchParams.get('mirror'),mirror?'1':null);
  if(mirror){assert.match(c.body,/<h2>Mirror /);assert.match(c.body,/<img[^>]+alt="Solved silver /);}
 }
 assert(!html.includes('id="catalog-key"'));assert(!html.includes('data-solve-moves'));
});
test('category filters count unique puzzles and keep all mirror variants after colored entries',()=>{
 const element=dataset=>({dataset,hidden:false,attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,f){this.listeners[k]=f}});
 const buttons=['all','tetrahedral','cubical','octahedral','dodecahedral','shapeshifter'].map(filter=>element({filter}));
 const nodes=cards.map(c=>element({family:c.family,puzzle:c.id,mode:c.mode}));const status={textContent:''};
 vm.runInNewContext(read('home.js'),{document:{querySelectorAll:q=>q==='[data-filter]'?buttons:q==='[data-family]'?nodes:[],getElementById:()=>status}});
 for(const filter of ['shapeshifter','cubical','all','tetrahedral','octahedral','dodecahedral','shapeshifter','all']){
  const button=buttons.find(b=>b.dataset.filter===filter);button.listeners.click();
  const expected=cards.filter(c=>filter==='all'||c.family===filter),visible=nodes.filter(n=>!n.hidden);
  assert.equal(visible.length,expected.length);assert.equal(button.attributes['aria-pressed'],'true');assert.equal(buttons.filter(b=>b.attributes['aria-pressed']==='true').length,1);
  assert(status.textContent.includes(`Showing ${new Set(expected.map(c=>c.id)).size} puzzles`));
  if(filter==='shapeshifter'){assert.equal(visible.length,12);assert(visible.slice(0,6).every(c=>c.dataset.mode==='color'));assert(visible.slice(6).every(c=>c.dataset.mode==='mirror'));}
  if(filter==='cubical')assert(!visible.some(c=>shapes.includes(c.dataset.puzzle)));
 }
});
test('landing page uses static local previews and input-aware compact help, with no solver or data fetch',()=>{
 assert(!/<script[^>]+(?:https?:|constrained-solver|atlas-metrics|atlas-difficulty|human-difficulty)/.test(html));
 assert(!/fetch\s*\(/.test(read('home.js')));assert(!/\.scramble\(|full-solve/.test(read('home.js')));
 for(const c of cards)assert.match(c.body,/<picture><source srcset="assets\//);
 assert.match(html,/<div class="quick-start">/);assert.equal((html.match(/class="help-touch"/g)||[]).length,5);
 for(const text of ['Pinch with two fingers','Scroll the mouse wheel','Hover over a 3D tile','Drag along a ring','empty ring-map space','looking inward from the selected axis'])assert(html.includes(text));
 const css=read('atlas.css');assert.match(css,/@media\(hover:none\) and \(pointer:coarse\)/);assert.match(css,/\.card-metrics\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
