'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),read=file=>fs.readFileSync(path.join(dist,file),'utf8');
function fixture({failOnce=false}={}){
 const requests=[],window={HUMAN_DIFFICULTY:{puzzles:{cube3:{difficulty:'medium',rationale:'Cross, corners and edge stages require several reusable rules.',sources:[{title:'Cube method',url:'https://example.test/cube'}]},axis:{difficulty:'hard',rationale:'Recognize oblique pieces and oriented centers.',sources:[]}}}},benchmark=JSON.parse(read('atlas-difficulty.json'));
 const context={window,URL,document:{baseURI:'https://atlas.test/puzzle-atlas/play.html'},fetch:async url=>{requests.push(url);if(failOnce){failOnce=false;throw Error('offline');}return {ok:true,json:async()=>benchmark};}};
 vm.runInNewContext(read('difficulty-guide.js'),context);return {module:window.PuzzleDifficultyGuide,window,requests,benchmark};
}
test('human guide ratings render without startup requests and distinguish mirror recognition',()=>{
 const h=fixture();assert.equal(h.requests.length,0);
 const normal=h.module.render('cube3',false);assert.match(normal,/Medium in color/);assert.match(normal,/Cross, corners/);assert.doesNotMatch(normal,/Auto Solve benchmark/);assert.equal(h.requests.length,0);
 const mirror=h.module.render('axis',true);assert.match(mirror,/Very Hard in mirror mode/);assert.match(mirror,/colored version is rated Hard/);assert.match(mirror,/Recognize oblique/);
 assert.equal(h.module.render('homer',false),'');assert.equal(h.module.render('unknown',false),'');
});
test('benchmark data is local, lazy, reused and separate from human difficulty',async()=>{
 const h=fixture();await Promise.all([h.module.loadEstimate('r76'),h.module.loadEstimate('r76')]);await h.module.loadEstimate('r76');
 assert.equal(h.requests.length,1);assert.equal(h.requests[0],'https://atlas.test/puzzle-atlas/atlas-difficulty.json?v=r76');
 const html=h.module.render('cube3',false);assert.match(html,/Medium in color/);assert(html.includes(h.benchmark.puzzles.cube3.averageMoves.toFixed(1)+' legal moves'));assert.match(html,/across 3 scrambles/);assert.match(html,/discarded the move journal/);assert.match(html,/not human difficulty or a proven shortest distance/);
});
test('missing benchmark never blocks the human explanation and can retry',async()=>{
 const h=fixture({failOnce:true});await assert.rejects(h.module.loadEstimate('r76'),/offline/);assert.match(h.module.render('cube3',false),/Medium in color/);
 await h.module.loadEstimate('r76');assert.equal(h.requests.length,2);assert.match(h.module.render('cube3',false),/Auto Solve benchmark/);
});
test('rating text is escaped and sources permit only ordinary HTTPS links',()=>{
 const h=fixture();h.window.HUMAN_DIFFICULTY.puzzles.cube3.rationale='<script>bad()</script>';h.window.HUMAN_DIFFICULTY.puzzles.cube3.sources.push({title:'bad',url:'javascript:bad()'});
 const html=h.module.render('cube3',false);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('javascript:'));assert(html.includes('rel="noopener noreferrer"'));
});
test('difficulty disclosure is below puzzle-specific solving and before references',()=>{
 const html=read('play.html');assert(html.indexOf('id="puzzle-difficulty"')>html.indexOf('id="solver-puzzle-method"'));assert(html.indexOf('id="puzzle-difficulty"')<html.indexOf('class="guide-sources"'));assert(/id="puzzle-difficulty" hidden/.test(html));
 const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);assert(!scripts.some(src=>/human-difficulty|difficulty-guide|atlas-difficulty/.test(src)),'difficulty never enters the startup script chain');
});
test('every public puzzle has a human guide rating and mirror variants retain both explanations',()=>{
 const context={window:{},URL,document:{baseURI:'https://atlas.test/puzzle-atlas/play.html'}};vm.runInNewContext(read('human-difficulty.js'),context);vm.runInNewContext(read('difficulty-guide.js'),context);
 const keys=JSON.parse(read('games/constrained-solver-models/manifest.json')).models.map(model=>model.id).filter(key=>key!=='homer');assert.equal(keys.length,36);
 for(const key of keys){const rating=context.window.HUMAN_DIFFICULTY.puzzles[key];assert(rating,key);assert.match(context.window.PuzzleDifficultyGuide.render(key,false),/(Easy|Medium|Hard) in color/,key);}
 for(const key of ['axis','mirror','flatdiamond','pyramorphix','mastermorphix','ghost'])assert.match(context.window.PuzzleDifficultyGuide.render(key,true),/Very Hard in mirror mode/,key);
});
test('open guides follow live mirror toggles without touching puzzle or disclosure state',async()=>{
 const nodes=new Map(),listeners={},calls=[],bodyClasses=new Set(['mirror-active']);let observeCallback,loads=0;
 function element(id){if(!nodes.has(id)){const classes=new Set(id==='play-layout'?['guide-hidden']:[]);nodes.set(id,{innerHTML:'',textContent:'',disabled:false,open:true,style:{setProperty(){}},classList:{contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x);}},setAttribute(){},addEventListener(type,listener){listeners[id+':'+type]=listener;},focus(){},contentDocument:{body:{classList:{contains:x=>bodyClasses.has(x)}}},contentWindow:{postMessage(){}}});}return nodes.get(id);}
 const document={getElementById:element,querySelector:selector=>selector.startsWith('meta')?{content:'r76'}:element('skip-link'),querySelectorAll:()=>[]};
 const window={addEventListener(){},PuzzleFrameReadiness:{create(){}},PuzzleGuideLoader:{load(){loads++;return Promise.resolve({title:'Axis method',intro:'Steps',notation:[],steps:[],sources:[]});}},PuzzleDifficultyGuide:{render(key,mirror){calls.push({key,mirror});return mirror?'Mirror explanation':'Color explanation';},loadEstimate(){return Promise.resolve();}},MutationObserver:class{constructor(callback){observeCallback=callback;}observe(){}disconnect(){}}};
 vm.runInNewContext(read('play.js'),{window,document,URLSearchParams,location:{search:'?p=axis&mirror=1',origin:'https://atlas.test'}});
 assert.equal(loads,0);assert.equal(calls.length,0);
 listeners['guide-toggle:click']();await new Promise(resolve=>setImmediate(resolve));assert.equal(element('puzzle-difficulty-body').innerHTML,'Mirror explanation');
 bodyClasses.delete('mirror-active');observeCallback();assert.equal(element('puzzle-difficulty-body').innerHTML,'Color explanation');assert.equal(element('puzzle-difficulty').open,true);
 const before=calls.length;observeCallback();assert.equal(calls.length,before,'unrelated body class mutations do not rebuild guide content');assert.equal(loads,1);
});
