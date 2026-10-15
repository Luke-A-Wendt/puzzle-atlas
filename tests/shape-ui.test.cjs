const assertAutoSolveDelegates=require('./auto-solve-delegate.cjs');
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{createCanvas}=require('@napi-rs/canvas');
const base=require('path').resolve(__dirname,'../dist/games')+'/';
function makeApp(type){
 const html=fs.readFileSync(base+type+'.html','utf8'),all=[],raf=[],events={};let now=0;
 class El{constructor(tag,id){this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.attributes={};this.className='';this.events={};this.style={};this.value='3';this.checked=false;this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim();},remove:c=>{this.className=this.className.split(/\s+/).filter(v=>v!==c).join(' ');},toggle:(c,force)=>{const on=force===undefined?!this.classList.contains(c):force;this.classList[on?'add':'remove'](c);return on;}};all.push(this);}
 appendChild(e){this.children.push(e);return e;}append(...e){this.children.push(...e);}replaceChildren(...e){this.children=e;}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return Object.hasOwn(this.attributes,k)?this.attributes[k]:null;}addEventListener(n,fn){this.events[n]=fn;}querySelectorAll(s){return all.filter(e=>e.className.split(' ').includes(s.slice(1)));}getBoundingClientRect(){return{width:600,height:540,left:0,top:0};}matches(){return false;}setPointerCapture(){}focus(){}select(){}remove(){} }
 const els={};for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){let el=new El(m[1],m[2]);els[m[2]]=el;if(m[1]==='canvas'){const c=createCanvas(600,540);el.getContext=()=>c.getContext('2d');el.png=()=>c.toBuffer('image/png');}}
 const body=new El('body');body.dataset.puzzle=type;const doc={body,getElementById:id=>els[id]||null,createElement:tag=>new El(tag),createTextNode:t=>({textContent:t}),querySelectorAll:s=>all.filter(e=>e.className.split(' ').includes(s.slice(1))),addEventListener:(n,fn)=>events[n]=fn};
 const context={console,document:doc,requestAnimationFrame:fn=>raf.push(fn),performance:{now:()=>now},crypto:require('crypto').webcrypto,Uint32Array,Map,Set,Math,JSON,setTimeout:()=>0,clearTimeout:()=>{},navigator:{clipboard:{writeText:async()=>{}}}};context.URL=URL;doc.baseURI='https://atlas.test/games/'+type+'.html';context.window=context;context.parent=context;context.location={origin:'https://atlas.test',search:''};context.matchMedia=()=>({matches:true});context.devicePixelRatio=1;context.addEventListener=()=>{};vm.createContext(context);for(const file of [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1])){doc.currentScript={src:new URL(file,doc.baseURI).href};vm.runInContext(fs.readFileSync(base+file.split(/[?#]/)[0],'utf8'),context,{filename:file});}doc.currentScript=null;
 function tick(ms=2000){now+=ms;const callbacks=raf.splice(0);for(const f of callbacks)f(now);}
 function settle(){let loops=0;while(context.PUZZLE_API.snapshot().animating||context.PUZZLE_API.snapshot().mode!=='idle'){tick();assert(++loops<500);}tick();}
 tick(0);return{api:context.PUZZLE_API,els,tick,settle,context};
}
for(const type of ['axis','rhombic','flatdiamond','cornerocta','trajber','pyramorphix','jewel','mastermorphix']){
 const app=makeApp(type),{api,els,tick,settle}=app;assert(api.snapshot().solved);
 els.speed.value='1';els.speed.events.input();assert(api.move('R'));assert.equal(api.move('U'),false);tick(450);assert(api.snapshot().animating,'0.5× takes900ms even reducedMotion');els.speed.value='5';els.speed.events.input();tick(112);assert(api.snapshot().animating,'progress preserved');tick(1);assert(!api.snapshot().animating,'live acceleration works');assert(!api.snapshot().solved);assert.equal(api.snapshot().history.length,1);
 els.undo.events.click();settle();assert(api.snapshot().solved);assert.equal(api.snapshot().history.length,0);
 for(const side of ['U','R','F','D','L','B'].concat(type==='cornerocta'?['u','r','f','d','l','b']:[])){api.reset();assert(api.select(side));api.move(side);settle();api.move(side+"'");settle();assert(api.snapshot().solved,side);}
 api.reset();api.randomize();tick(50);els.pause.events.click();const before=JSON.stringify(api.snapshot().pieces);tick(3000);assert.equal(before,JSON.stringify(api.snapshot().pieces));assert.equal(api.snapshot().paused,false);assert.equal(api.snapshot().mode,'idle');assert.equal(api.snapshot().history.length,0);api.randomize();settle();assert(!api.snapshot().solved);const seed=api.snapshot().seed,count=api.snapshot().history.length;assert(count>=20);
 assert(api.runMoves("R U' F2 B L2 D"));settle();assert.equal(api.snapshot().history.length,count+6);assertAutoSolveDelegates(app.context);assert.equal(api.snapshot().history.length,count+6);
 api.randomize();settle();assert.notEqual(api.snapshot().seed,seed);api.reset();assert(api.snapshot().solved);assert.equal(api.snapshot().journal.length,0);
 assert.throws(()=>api.runMoves('Q'));assert.equal(api.snapshot().history.length,0);
 els.pieceLabels.events.click();tick();
 console.log(type+': all moves, undo, fresh scramble, Stop, live speed under reduced-motion, algorithm playback and Auto Solve delegation, reset, full canvas render PASS');
}
module.exports={makeApp};
