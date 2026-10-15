const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
/* Portable UI/interaction regression checks. Optional raster output:
 * SKEWB_EXPANSION_RENDER_DIR=/tmp/octa-renders node tests/octa-ui.test.cjs
 * Install @napi-rs/canvas (or provide it via NODE_PATH) only for raster output.
 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {dragPath,dispatchPath}=require('./connected-ring-drag-helper.cjs');
const base=path.resolve(__dirname,'../dist/games')+'/',renderDir=process.env.SKEWB_EXPANSION_RENDER_DIR;
let createCanvas;
if(renderDir){({createCanvas}=require('@napi-rs/canvas'));fs.mkdirSync(renderDir,{recursive:true});}
else createCanvas=(width,height)=>{const canvas={width,height};const ctx=new Proxy({canvas,createRadialGradient:()=>({addColorStop(){}}),measureText:text=>({width:String(text).length*6})},{get:(obj,key)=>key in obj?obj[key]:(()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});canvas.getContext=()=>ctx;return canvas;};
function writeRender(name,element){if(renderDir)fs.writeFileSync(path.join(renderDir,name),element.png());}

function makeApp(type){
 const html=fs.readFileSync(base+type+'.html','utf8'),all=[],raf=[],events={};let now=0;
 class El{constructor(tag,id){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.className='';this.events={};this.style={};this.value='3';this.checked=false;this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim();},remove:c=>{this.className=this.className.split(/\s+/).filter(v=>v!==c).join(' ');},toggle:(c,force)=>{const on=force===undefined?!this.classList.contains(c):force;this.classList[on?'add':'remove'](c);return on;}};all.push(this);}
 appendChild(e){this.children.push(e);return e;}append(...e){this.children.push(...e);}replaceChildren(...e){this.children=e;}setAttribute(){}addEventListener(n,fn){this.events[n]=fn;}querySelectorAll(s){return all.filter(e=>e.className.split(' ').includes(s.slice(1)));}getBoundingClientRect(){return{width:560,height:500,left:0,top:0};}matches(){return false;}setPointerCapture(){}focus(){}select(){}remove(){} }
 const els={};for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){let el=new El(m[1],m[2]);els[m[2]]=el;if(m[1]==='canvas'){const c=createCanvas(560,500);el.getContext=()=>c.getContext('2d');el.png=()=>c.toBuffer('image/png');}}
 const body=new El('body');body.dataset.puzzle=type;const doc={body,getElementById:id=>els[id]||null,createElement:tag=>new El(tag),createTextNode:t=>({textContent:t}),querySelectorAll:s=>all.filter(e=>e.className.split(' ').includes(s.slice(1))),addEventListener:(n,fn)=>events[n]=fn};
 const context={console,document:doc,requestAnimationFrame:fn=>raf.push(fn),performance:{now:()=>now},crypto:require('crypto').webcrypto,Uint32Array,Map,Set,Math,JSON,setTimeout:()=>0,clearTimeout:()=>{},navigator:{clipboard:{writeText:async()=>{}}}};context.URL=URL;doc.baseURI='https://atlas.test/games/'+type+'.html';context.window=context;context.parent=context;context.location={origin:'https://atlas.test',search:''};context.matchMedia=()=>({matches:false});context.devicePixelRatio=1;context.addEventListener=()=>{};vm.createContext(context);for(const file of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1])){doc.currentScript={src:new URL(file,doc.baseURI).href};vm.runInContext(fs.readFileSync(base+file.split(/[?#]/)[0],'utf8'),context,{filename:file});}doc.currentScript=null;
 function tick(ms=1000){now+=ms;const callbacks=raf.splice(0);for(const f of callbacks)f(now);}
 function settle(){let loops=0;while(context.PUZZLE_API.snapshot().animating||context.PUZZLE_API.snapshot().mode!=='idle'){tick();assert(++loops<400);}tick();}
 tick(0);return{api:context.PUZZLE_API,els,tick,settle,context};
}
for(const type of ['skewb','jing','masterskewb']){
 const app=makeApp(type),{api,els,tick,settle,context}=app;const model=context.SkewbEngine.create(type);
 assert(api.snapshot().solved);assert.equal(els.notationButtons.children.length,type==='jing'?4:8);
 assert.equal(els.selector.children.length,4);assert(!els.mirrorMode);
 writeRender(type+'-rings.png',els.rings);writeRender(type+'-solved.png',els.cube);
 for(const cfg of model.configs){
  api.reset();assert(api.select(cfg.id));assert(api.move(cfg.id));assert.equal(api.move(cfg.id),false);tick(165);writeRender(type+'-midturn-'+cfg.id+'.png',els.cube);settle();assert(!api.snapshot().solved);assert.equal(api.snapshot().history.length,1);
  els.undo.events.click();settle();assert(api.snapshot().solved);assert.equal(api.snapshot().history.length,0);
  assert(api.move(cfg.id));settle();assert(api.move(cfg.id+"'"));settle();assert(api.snapshot().solved);
 }
 // Actual slider handler governs manual moves, scrambles, solves, and speed
 // changes during an active move. Stop discards only the unfinished turn and remaining queue.
 api.reset();els.speed.value='1';els.speed.events.input();api.move('L');tick(1300);assert(api.snapshot().animating);tick(100);assert(!api.snapshot().animating);
 els.undo.events.click();settle();assert(api.snapshot().solved);
 els.speed.value='5';els.speed.events.input();api.move('L');tick(110);assert(!api.snapshot().animating);api.reset();
 els.speed.value='1';els.speed.events.input();api.randomize();assert.equal(els.speed.value,'5');tick(50);assert.equal(api.snapshot().history.length,0);els.pause.events.click();const stopped=JSON.stringify(api.snapshot().pieces);tick(3000);assert.equal(JSON.stringify(api.snapshot().pieces),stopped);assert.equal(api.snapshot().paused,false);assert.equal(api.snapshot().mode,'idle');assert.equal(els.speed.value,'3');
 api.randomize();tick(110);assert.equal(api.snapshot().history.length,1);settle();assert(!api.snapshot().solved);assert.equal(api.snapshot().history.length,24);const seed=api.snapshot().seed;
 assert(api.runMoves("L R' D B L2"));settle();assert.equal(api.snapshot().history.length,29);
 assertAutoSolveDelegates(context);
 // A constrained stage uses this same playback API and honors live speed changes.
 els.speed.value='1';els.speed.events.input();assert(api.runMoves("L R'",{label:'Auto Solve · animation fixture'}));tick(1000);assert.equal(api.snapshot().history.length,29);assert(api.snapshot().animating);els.speed.value='5';els.speed.events.input();settle();assert.equal(api.snapshot().history.length,31);assert.equal(api.snapshot().journal.filter(j=>j.source==='algorithm').length,7);assert(api.snapshot().journal.some(j=>j.label==='Auto Solve · animation fixture'));
 api.randomize();settle();assert.notEqual(api.snapshot().seed,seed);api.reset();assert.equal(api.snapshot().journal.length,0);
 assert.throws(()=>api.runMoves('INVALID'));if(type==='jing')assert.throws(()=>api.runMoves('l'));
 els.pieceLabels.events.click();tick();writeRender(type+'-labels.png',els.cube);els.pieceLabels.events.click();
 // Every displayed axis path supports native pointer dragging.
 const geometry=context.OctaRingGeometry.create(model);
 for(const cfg of model.configs){api.reset();api.select(cfg.id);tick();const viewport=geometry.render(els.rings.getContext('2d'),{width:560,height:500,selected:cfg.id}).viewport;dispatchPath({dispatch:(name,event)=>els.rings.events[name](event)},dragPath(geometry,cfg.id,1),viewport);settle();assert.equal(api.snapshot().history.at(-1).face,cfg.id);assert.equal(api.snapshot().history.at(-1).dir,1);}
 api.reset();api.select('R');els.ringFocus.events.click();tick();writeRender(type+'-paths.png',els.rings);
 console.log(type+': controls, all sides, guide moves, undo, fresh scramble, Stop, real speed handlers, Auto Solve delegation, connected ring dragging and canvas render PASS');
}
