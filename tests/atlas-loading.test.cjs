'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
function el(){const classes=new Set(),listeners={};return {hidden:false,textContent:'',attributes:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){(listeners[k]||=[]).push(fn);},emit(k,data={}){for(const fn of listeners[k]||[])fn(data);}};}
function frameHarness({early=false,complete=false,api=true}={}){
 const win=el(),frame=el(),cover=el(),message=el(),retry=el(),area=el(),raf=[],timers=new Map();let next=1;
 const document={readyState:complete?'complete':'loading',querySelectorAll:()=>[{sheet:{}}],getElementById:()=>({width:960,height:720})};
 frame.contentDocument=document;frame.contentWindow={location:{href:early?'https://atlas.test/games/cube3.html?v=release':'about:blank'},PUZZLE_API:api?{puzzle:'cube3'}:undefined};
 let source=early?'games/cube3.html?v=release':'about:blank',navigations=0;Object.defineProperty(frame,'src',{get:()=>source,set:value=>{source=value;navigations++;}});
 const context={window:win,location:{origin:'https://atlas.test',href:'https://atlas.test/play.html?p=cube3'},URL,requestAnimationFrame:f=>raf.push(f),setTimeout:f=>{const id=next++;timers.set(id,f);return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dist,'puzzle-frame-readiness.js'),'utf8'),context);
 const controller=win.PuzzleFrameReadiness.create({frame,cover,message,retry,area,puzzle:'cube3',name:'Cube 3×3',url:'games/cube3.html?v=release'});
 function readyEvent(props={}){win.emit('message',{source:frame.contentWindow,origin:context.location.origin,data:{type:'puzzle-ready',puzzle:'cube3'},...props});}
 return {win,frame,cover,message,retry,area,document,controller,readyEvent,navigations:()=>navigations,paint(){const f=raf.splice(0);f.forEach(fn=>fn());},timeout(){[...timers.values()].forEach(fn=>fn());},load(){frame.contentWindow.location.href=new URL(frame.src,context.location.href).href;document.readyState='complete';frame.emit('load');}};
}
test('early game navigation is adopted without a second request while still loading',()=>{
 const h=frameHarness({early:true});assert.equal(h.navigations(),0);h.paint();h.paint();assert.equal(h.controller.isReady(),false);
 h.readyEvent();h.load();h.paint();h.paint();assert.equal(h.controller.isReady(),true);assert.equal(h.navigations(),0);
});
test('readiness recovers both events if the early game finished before the parent scripts',()=>{
 const h=frameHarness({early:true,complete:true});assert.equal(h.navigations(),0);h.paint();assert.equal(h.controller.isReady(),false);h.paint();assert.equal(h.controller.isReady(),true);
});
test('an early game with failed initialization stays covered and can retry',()=>{
 const h=frameHarness({early:true,complete:true,api:false});h.paint();h.paint();assert.equal(h.controller.isReady(),false);assert.equal(h.retry.hidden,false);assert.match(h.message.textContent,/could not finish/);
 h.retry.emit('click');assert.equal(h.navigations(),1);assert.equal(new URL(h.frame.src).searchParams.get('v'),'release');
});
test('inline bootstrap starts only registered same-origin games before parent runtime downloads',()=>{
 const html=fs.readFileSync(path.join(dist,'play.html'),'utf8'),bootstrap=/<script id="puzzle-frame-bootstrap">([\s\S]*?)<\/script>/.exec(html)[1];
 assert(html.indexOf('puzzle-frame-bootstrap')<html.indexOf('src="puzzle-frame-readiness.js'));assert.match(html,/<html[^>]+class="page-pending"/);assert.match(html,/<script defer src="page-readiness\.js/);
 const manifest=JSON.parse(fs.readFileSync(path.join(dist,'games/constrained-solver-models/manifest.json'),'utf8'));
 for(const key of [...manifest.models.map(model=>model.id),'https://evil.test/','../homer','missing','__proto__']){
  const frame={src:'about:blank'},document={getElementById:()=>frame,querySelector:()=>({content:'release'})};
  vm.runInNewContext(bootstrap,{document,location:{search:'?p='+encodeURIComponent(key)+'&mirror=1'},URLSearchParams});
  const url=new URL(frame.src,'https://atlas.test/puzzle-atlas/play.html'),valid=manifest.models.some(model=>model.id===key),expected=valid?key:'cube3';
  assert.equal(url.origin,'https://atlas.test');assert.equal(url.pathname,'/puzzle-atlas/games/'+expected+'.html');assert.equal(url.searchParams.get('v'),'release');
  assert.equal(url.searchParams.get('mirror'),['axis','mirror','flatdiamond','pyramorphix','mastermorphix','ghost'].includes(expected)?'1':null);
 }
});
test('puzzle cover waits for initialized engine, stylesheet completion and two paint frames',()=>{
 const h=frameHarness();assert.equal(h.area.attributes['aria-busy'],'true');assert.equal(h.cover.hidden,false);
 h.frame.emit('load');h.paint();h.paint();assert.equal(h.controller.isReady(),false,'about:blank cannot reveal the game');
 h.readyEvent();h.paint();h.paint();assert.equal(h.controller.isReady(),false,'engine initialization alone cannot reveal unstyled content');
 h.load();h.paint();assert.equal(h.controller.isReady(),false);h.paint();
 assert.equal(h.controller.isReady(),true);assert.equal(h.cover.hidden,true);assert.equal(h.frame.classList.contains('puzzle-frame-ready'),true);assert.equal(h.area.attributes['aria-busy'],'false');
});
test('iframe failures produce retry feedback and preserve the release pin',()=>{
 const h=frameHarness();h.document.querySelectorAll=()=>[{sheet:null}];h.readyEvent();h.load();h.paint();h.paint();
 assert.equal(h.controller.isReady(),false);assert.match(h.message.textContent,/styling could not load/);assert.equal(h.retry.hidden,false);
 h.retry.emit('click');assert.equal(new URL(h.frame.src).searchParams.get('v'),'release');assert.equal(new URL(h.frame.src).searchParams.get('retry'),'1');
 h.document.querySelectorAll=()=>[{sheet:{}}];h.readyEvent();h.load();h.paint();h.paint();assert.equal(h.controller.isReady(),true);
});
test('delayed iframe startup remains informative and late success can recover',()=>{
 const h=frameHarness();h.timeout();assert.match(h.message.textContent,/taking longer/);assert.equal(h.retry.hidden,false);assert.equal(h.cover.hidden,false);
 h.load();h.paint();h.paint();assert.equal(h.controller.isReady(),true);
});
test('untrusted or wrong puzzle messages never bypass the readiness gate',()=>{
 const h=frameHarness();delete h.frame.contentWindow.PUZZLE_API;
 h.readyEvent({origin:'https://other.test'});h.readyEvent({source:{}});h.readyEvent({data:{type:'puzzle-ready',puzzle:'homer'}});
 h.load();h.paint();h.paint();assert.equal(h.controller.isReady(),false);assert.match(h.message.textContent,/could not finish/);
});
test('atlas and play have an immediate dark shell, bounded retry and back-forward recovery',()=>{
 for(const name of ['index.html','play.html']){
  const html=fs.readFileSync(path.join(dist,name),'utf8');
  assert(html.indexOf('id="page-critical"')<html.indexOf('rel="stylesheet"'));
  assert(html.includes('page-readiness.js'));assert(html.includes('id="page-load-retry"'));assert(html.includes('id="page-load-message"'));
 }
 const root=el(),document=el(),win=el(),message=el(),retry=el(),raf=[];
 document.documentElement=root;document.querySelectorAll=()=>[{sheet:{}}];document.getElementById=id=>id==='page-load-message'?message:retry;
 const ctx={document,window:win,location:{reload(){}},requestAnimationFrame:f=>raf.push(f),setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(dist,'page-readiness.js'),'utf8'),ctx);
 assert(root.classList.contains('page-pending'));document.emit('DOMContentLoaded');raf.shift()();raf.shift()();assert(!root.classList.contains('page-pending'));
 win.emit('pageshow',{persisted:true});raf.shift()();raf.shift()();assert(!root.classList.contains('page-pending'));
});
test('play iframe propagates release and mirror query parameters',()=>{
 const source=fs.readFileSync(path.join(dist,'play.js'),'utf8');
 assert.match(source,/meta\[name="atlas-release"\]/);assert.match(source,/gameParams\.set\('v',release\)/);assert.match(source,/gameParams\.set\('mirror','1'\)/);
 assert.match(source,/PuzzleFrameReadiness\.create/);
});
test('all visible atlas previews are eager local WebPs with matching real PNG fallbacks',async()=>{
 const {loadImage}=require('@napi-rs/canvas'),html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
 const pictures=[...html.matchAll(/<picture><source srcset="([^"]+)" type="image\/webp">(<img[^>]+>)<\/picture>/g)];
 assert.equal(pictures.length,JSON.parse(fs.readFileSync(path.join(dist,'games/constrained-solver-models/manifest.json'),'utf8')).models.filter(model=>model.id!=='homer').length+6);let smallBytes=0,originalBytes=0;
 for(const [,source,img]of pictures){
  const src=/src="([^"]+)"/.exec(img)[1],small=source.split('?')[0],original=src.split('?')[0];
  assert.equal(small.replace(/\.webp$/,'.png'),original);assert.match(img,/loading="eager"/);assert.match(img,/decoding="async"/);
  const bytes=fs.readFileSync(path.join(dist,small));smallBytes+=bytes.length;originalBytes+=fs.statSync(path.join(dist,original)).size;
  const image=await loadImage(bytes);assert.equal(image.width,640,small);assert.equal(image.height,480,small);
 }
 assert(smallBytes<originalBytes*.3,'compressed previews should remove at least 70% of thumbnail transfer bytes');
});
test('failed preferred previews retry the real PNG once and show a clear fallback',()=>{
 const img=el(),wrapper=el(),source={removed:false,remove(){this.removed=true;}},status=el();
 img.complete=false;img.getAttribute=()=> 'assets/jing.png?v=release';img.closest=()=>wrapper;img.parentElement={querySelectorAll:()=>[source]};
 const context={document:{querySelectorAll:q=>q==='.card-image img'?[img]:[],getElementById:()=>status},URL,location:{href:'https://atlas.test/index.html'}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dist,'home.js'),'utf8'),context);
 img.emit('error');assert(source.removed);assert.equal(new URL(img.src).pathname,'/assets/jing.png');assert.equal(new URL(img.src).searchParams.get('v'),'release');assert.equal(new URL(img.src).searchParams.get('preview-retry'),'1');
 img.emit('error');assert(wrapper.classList.contains('preview-missing'));img.emit('load');assert(!wrapper.classList.contains('preview-missing'));
});
