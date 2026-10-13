const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
/* Portable UI/interaction regression checks. Optional raster output:
 * OCTA_RENDER_DIR=/tmp/octa-renders node tests/octa-ui.test.cjs
 * Install @napi-rs/canvas (or provide it via NODE_PATH) only for raster output.
 */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {dragPath,dispatchPath}=require('./connected-ring-drag-helper.cjs');
const base=path.resolve(__dirname,'../dist/games')+'/',renderDir=process.env.OCTA_RENDER_DIR;
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
 const context={console,document:doc,requestAnimationFrame:fn=>raf.push(fn),performance:{now:()=>now},crypto:require('crypto').webcrypto,Uint32Array,Map,Set,Math,JSON,setTimeout:()=>0,clearTimeout:()=>{},navigator:{clipboard:{writeText:async()=>{}}}};context.window=context;context.parent=context;context.location={origin:'https://atlas.test',search:''};context.matchMedia=()=>({matches:false});context.devicePixelRatio=1;context.addEventListener=()=>{};vm.createContext(context);for(const file of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]))vm.runInContext(fs.readFileSync(base+file,'utf8'),context,{filename:file});
 function tick(ms=1000){now+=ms;const callbacks=raf.splice(0);for(const f of callbacks)f(now);}
 function settle(){let loops=0;while(context.PUZZLE_API.snapshot().animating||context.PUZZLE_API.snapshot().mode!=='idle'){tick();assert(++loops<400);}tick();}
 tick(0);return{api:context.PUZZLE_API,els,tick,settle,context};
}
for(const type of ['ultimate','diamond','fto']){
 const app=makeApp(type),{api,els,tick,settle}=app;assert(api.snapshot().solved);writeRender(type+'-rings.png',els.rings);writeRender(type+'-solved.png',els.cube);
 assert(api.move(type==='fto'?'A':'L'));assert.equal(api.move(type==='fto'?'B':'R'),false);tick(165);writeRender(type+'-midturn.png',els.cube);settle();assert(!api.snapshot().solved);assert.equal(api.snapshot().history.length,1);
 els.undo.events.click();settle();assert(api.snapshot().solved);assert.equal(api.snapshot().history.length,0);
 for(const side of (type==='fto'?['A','B','C','D','E','F','G','H','Am','Bm','Cm','Dm']:['L','R','D','B','l','r','d','b'])){api.reset();assert(api.select(side));api.move(side);settle();api.move(side+"'");settle();assert(api.snapshot().solved,side);}
 api.randomize();tick(165);els.pause.events.click();const before=JSON.stringify(api.snapshot().pieces);tick(3000);assert.equal(before,JSON.stringify(api.snapshot().pieces));assert(api.snapshot().paused);els.pause.events.click();settle();assert(!api.snapshot().solved);const seed=api.snapshot().seed;assert.equal(api.snapshot().history.length,24);
 assert(api.runMoves(type==='fto'?"A B' C G Am Bm2":"L R' D b l R2"));settle();assert.equal(api.snapshot().history.length,30);assertAutoSolveDelegates(app.context);assert.equal(api.snapshot().history.length,30);
 api.randomize();settle();assert.notEqual(api.snapshot().seed,seed);api.reset();assert(api.snapshot().solved);assert.equal(api.snapshot().journal.length,0);
 assert.throws(()=>api.runMoves('U'));assert.equal(api.snapshot().history.length,0);
 els.pieceLabels.events.click();tick();writeRender(type+'-labels.png',els.cube);
 // Exercise real connected-curve hit testing and path-parameter dragging,
 // with all rings visible and with nonselected rings dimmed.
 const engine=type==='fto'?app.context.FTOEngine:app.context.SkewbEngine,geometry=app.context.OctaRingGeometry.create(engine.create(type));
 for(const focused of [false,true]){
  if(focused)els.ringFocus.events.click();
  for(const cfg of engine.configs){
   api.reset();api.select(cfg.id);tick();const viewport=geometry.render(els.rings.getContext('2d'),{width:560,height:500,selected:cfg.id,focus:focused}).viewport;dispatchPath({dispatch:(name,event)=>els.rings.events[name](event)},dragPath(geometry,cfg.id,1),viewport);settle();const played=api.snapshot().history.at(-1);assert(played,'ring drag moves '+cfg.id);assert.equal(played.face,cfg.id);assert.equal(played.dir,1);
  }
 }
 api.reset();api.select(type==='fto'?'Am':'R');tick();writeRender(type+'-focused-rings.png',els.rings);
 console.log(type+': all sides and slices, undo, fresh seeded scramble, pause/resume, manual+algorithm journal, Auto Solve delegation, reset, validation, ring selection/drag/focus and canvas drawing PASS');
}
