'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist'),read=name=>fs.readFileSync(path.join(dist,name),'utf8');
const allFiles=['cube-guides.js','poly-guides.js','skewb-guides.js','tetraminx-guide.js','large-cube-guides.js','fto-guides.js','shape-guides.js','dino-guides.js','homer-guide.js','skewb-expansion-guides.js','edge-crystal-guides.js','diamond-guides.js','master-guide-data.js','addition-guides.js','solver-guide.js'];
function fixture({failOnce}={}){
 const requests=[],document={baseURI:'https://atlas.test/puzzle-atlas/play.html',addEventListener(){},createElement:()=>({remove(){}})},context={window:{},document,URL,console};
 vm.createContext(context);document.head={appendChild(node){
  requests.push(new URL(node.src));queueMicrotask(()=>{
   const file=new URL(node.src).pathname.split('/').at(-1);
   if(file===failOnce){failOnce=null;node.onerror();return;}
   try{vm.runInContext(read(file),context,{filename:file});node.onload();}catch(error){node.onerror(error);}
  });
 }};
 vm.runInContext(read('puzzle-guide-loader.js'),context,{filename:'puzzle-guide-loader.js'});
 return {context,requests,loader:context.window.PuzzleGuideLoader};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('every puzzle loads its unchanged complete guide with only local required dependencies',async()=>{
 const baseline={window:{},document:{addEventListener(){}},console};vm.createContext(baseline);
 for(const file of allFiles)vm.runInContext(read(file),baseline,{filename:file});
 const guides=Object.assign({},...Object.entries(baseline.window).filter(([key])=>key.endsWith('_GUIDES')).map(([,value])=>value));
 assert.equal(Object.keys(guides).length,37);
 for(const [key,expected]of Object.entries(guides)){
  const h=fixture();assert.equal(h.requests.length,0,'loader has no startup downloads');
  const actual=await h.loader.load(key,'test-release');
  assert.deepEqual(plain(actual),plain(expected),key+' retains all solution steps, builders and sources');
  assert.deepEqual(plain(h.context.window.SOLVER_GUIDE.render({key,name:key,guide:actual})),plain(baseline.window.SOLVER_GUIDE.render({key,name:key,guide:expected})),key+' retains guide supplement and citations');
  assert.equal(h.requests.length,new Set(h.requests.map(url=>url.href)).size,key+' no duplicate downloads');
  assert.deepEqual(h.requests.map(url=>url.pathname.split('/').at(-1)).sort(),plain(h.loader.sources(key)).sort(),key+' dependency closure');
  for(const url of h.requests){assert.equal(url.origin,'https://atlas.test');assert.equal(url.pathname.startsWith('/puzzle-atlas/'),true);assert.equal(url.searchParams.get('v'),'test-release');}
  const count=h.requests.length;await h.loader.load(key,'test-release');assert.equal(h.requests.length,count,key+' cache reused');
 }
});
test('guide loading never reads unrelated Window getters',async()=>{
 const h=fixture();let reads=0;
 Object.defineProperty(h.context.window,'localStorage',{enumerable:true,get(){reads++;throw Error('SecurityError: storage denied');}});
 Object.defineProperty(h.context.window,'UNRELATED_GUIDES',{enumerable:true,get(){reads++;throw Error('Unrelated application export');}});
 const guide=await h.loader.load('cube3','test-release');assert(guide.steps.length>2);assert.equal(reads,0);
});
test('failed guide scripts can retry without reloading successful dependencies',async()=>{
 const h=fixture({failOnce:'cube-guides.js'});
 await assert.rejects(h.loader.load('cube3','test-release'),/could not load/);
 const guide=await h.loader.load('cube3','test-release');assert(guide.steps.length>2);
 assert.equal(h.requests.filter(url=>url.pathname.endsWith('/cube-guides.js')).length,2);
 assert.equal(h.requests.filter(url=>url.pathname.endsWith('/solver-guide.js')).length,1);
});
test('cube guide avoids unrelated families and keeps optional rating metadata small',()=>{
 const h=fixture(),oldBytes=allFiles.reduce((sum,file)=>sum+fs.statSync(path.join(dist,file)).size,0);
 const newBytes=plain(h.loader.sources('cube3')).reduce((sum,file)=>sum+fs.statSync(path.join(dist,file)).size,0);
 const ratingBytes=['human-difficulty.js','difficulty-guide.js'].reduce((sum,file)=>sum+fs.statSync(path.join(dist,file)).size,0);
 assert(newBytes-ratingBytes<oldBytes*.1,'family-specific guide keeps the original reduction');assert(ratingBytes<25000,'human rating and local benchmark renderer stay compact');assert.equal(oldBytes>1e6,true);
 const html=read('play.html'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
 assert(scripts.includes('puzzle-guide-loader.js'));for(const file of allFiles)assert(!scripts.includes(file),file+' no longer blocks game startup');
});
test('play starts the iframe without hidden guide work, and opening the guide remains retryable',async()=>{
 const elements=new Map(),listeners={},events=[];function element(id){if(!elements.has(id)){const classes=new Set(id==='play-layout'?['guide-hidden']:[]);elements.set(id,{textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},attributes:{},classList:{contains:x=>classes.has(x),toggle(x,yes){if(yes)classes.add(x);else classes.delete(x);}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){listeners[id+':'+k]=f;},focus(){},contentWindow:{postMessage(){}}});}return elements.get(id);}
 let ready,resolveGuide,rejectGuide,loadCount=0;
 const document={baseURI:'https://atlas.test/puzzle-atlas/play.html',getElementById:element,querySelector:selector=>selector.startsWith('meta')?{content:'release'}:element('skip-link'),querySelectorAll:()=>[]};
 const context={window:{PuzzleFrameReadiness:{create(options){events.push('start iframe');ready=options.onReady;}},PuzzleGuideLoader:{load(){events.push('load guide');loadCount++;return new Promise((resolve,reject)=>{resolveGuide=resolve;rejectGuide=reject;});}},addEventListener(){}},document,URLSearchParams,location:{search:'?p=cube3',origin:'https://atlas.test'},console};
 vm.runInNewContext(read('play.js'),context);
 assert.deepEqual(events,['start iframe']);assert.equal(loadCount,0);assert.equal(ready,undefined,'a ready game does not request a hidden guide');
 listeners['guide-toggle:click']();assert.equal(loadCount,1,'the first guide request starts only when opened');
 assert.equal(element('play-layout').classList.contains('guide-hidden'),false);
 listeners['guide-toggle:click']();listeners['guide-toggle:click']();assert.equal(loadCount,1,'reopening a pending guide reuses the request');
 rejectGuide(Error('offline'));await new Promise(resolve=>setImmediate(resolve));
 assert.match(element('guide-intro').innerHTML,/keep playing/);assert.equal(element('guide').attributes['aria-busy'],'false');
 listeners['guide-retry:click']();assert.equal(loadCount,2,'retry does not restart iframe');assert.equal(events.filter(x=>x==='start iframe').length,1);
 resolveGuide({title:'Test',intro:'Intro',notation:[],steps:[],sources:[]});await Promise.resolve();await Promise.resolve();
 assert.equal(element('guide-jump').disabled,false);
});
