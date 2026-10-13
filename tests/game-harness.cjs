'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

// Runs the production scripts and their real event handlers. Canvas operations
// are stubbed by default; pass canvasContexts to rasterize the exact same code.
function emptyDrawing(){return new Proxy({}, {
  get(target,key){
    if(key==='measureText')return text=>({width:String(text).length*6});
    if(key==='createRadialGradient'||key==='createLinearGradient')return()=>({addColorStop(){}});
    return target[key]||((...args)=>{
      if(['arc','moveTo','lineTo','translate','scale','setTransform','clearRect'].includes(key))
        for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),'Nonfinite drawing coordinate in '+key);
    });
  },set(target,key,value){target[key]=value;return true;}
});}
class Element{
  constructor(tag='div',id=''){
    this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.dataset={};this.style={};this.attributes={};this.listeners={};
    this.className='';this.textContent='';this.value='';this.disabled=false;this.hidden=false;this.scrollHeight=0;this.scrollTop=0;
    this.bounds={left:0,top:0,width:500,height:id==='cube'?400:500};this.drawing=emptyDrawing();
    this.classList={
      contains:c=>this.className.split(/\s+/).includes(c),
      add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim();},
      remove:c=>{this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' ');},
      toggle:(c,force)=>{const add=force===undefined?!this.classList.contains(c):force;this.classList[add?'add':'remove'](c);return add;}
    };
  }
  setAttribute(k,v){this.attributes[k]=v;}
  appendChild(el){this.children.push(el);el.parentNode=this;return el;}
  append(...els){els.forEach(el=>this.appendChild(el));}
  replaceChildren(...els){this.children=[];this.append(...els);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}
  set innerHTML(v){this.children=[];this._innerHTML=v;}
  get innerHTML(){return this._innerHTML||'';}
  querySelectorAll(selector){const result=[];for(const child of this.children){if(child.matches(selector))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
  matches(selector){return selector.split(',').some(s=>s.trim().startsWith('.')?this.classList.contains(s.trim().slice(1)):this.tagName===s.trim().toUpperCase());}
  addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
  dispatch(type,props={}){
    if(type==='click'&&this.disabled)return;
    const event={target:this,button:0,pointerId:1,preventDefault(){},...props};
    (this.listeners[type]||[]).forEach(fn=>fn(event));
  }
  getBoundingClientRect(){return this.bounds;}
  getContext(){return this.drawing;}
  setPointerCapture(){}
  focus(){}
  select(){}
}
function createHarness(options={}){
  const elements=new Map(), html=fs.readFileSync(options.htmlPath||path.join(__dirname,'shell.html'),'utf8');
  for(const m of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){
    const el=new Element(m[1],m[2]), value=/\bvalue="([^"]+)"/.exec(m[0]);
    if(value)el.value=value[1];
    if(options.canvasContexts&&options.canvasContexts[m[2]])el.drawing=options.canvasContexts[m[2]];
    if(options.dimensions&&options.dimensions[m[2]])Object.assign(el.bounds,options.dimensions[m[2]]);
    elements.set(m[2],el);
  }
  const body=new Element('body');const bodyTag=/<body([^>]*)>/.exec(html);if(bodyTag)for(const a of bodyTag[1].matchAll(/data-([\w-]+)="([^"]+)"/g))body.dataset[a[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=a[2];for(const el of elements.values())body.appendChild(el);
  const document=new Element('document');document.body=body;document.appendChild(body);
  document.getElementById=id=>{assert(elements.has(id),'Missing DOM element '+id);return elements.get(id);};
  document.createElement=tag=>new Element(tag);
  document.createTextNode=text=>Object.assign(new Element('#text'),{textContent:text});
  document.execCommand=()=>true;
  let now=0,frames=[];
  const context={document,console,crypto:webcrypto,Uint32Array,Math,Date,performance:{now:()=>now},devicePixelRatio:options.devicePixelRatio||1,
    matchMedia:()=>({matches:!!options.reducedMotion}),addEventListener(){},requestAnimationFrame:callback=>{frames.push(callback);},
    setTimeout:()=>0,clearTimeout(){},navigator:{clipboard:{writeText:async text=>{context.copiedText=text;}}}};
  context.window=context;context.globalThis=context;context.parent=context;context.location={search:options.search||'',origin:'https://atlas.test'};context.URLSearchParams=URLSearchParams;vm.createContext(context);
  if(options.bundled){for(const [i,m]of [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].entries()){const src=/src="([^"]+)"/.exec(m[1]);const code=src?fs.readFileSync(path.resolve(path.dirname(options.htmlPath),src[1]),'utf8'):m[2];vm.runInContext(code,context,{filename:src?src[1]:'bundle-'+i});}}
  else for(const name of ['cube-engine.js','ring-geometry.js','bsp.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context,{filename:name});
  const app={context,elements,document,
    snapshot:()=>JSON.parse(JSON.stringify(context.PUZZLE_API.snapshot())),
    click:id=>elements.get(id).dispatch('click'),
    select:face=>document.querySelectorAll('.ring-key').find(b=>b.dataset.face===face).dispatch('click'),
    key:(key,props={})=>document.dispatch('keydown',{key,target:body,...props}),
    frame:(ms=200)=>{now+=ms;const callbacks=frames;frames=[];callbacks.forEach(f=>f(now));},
    complete:()=>{for(let i=0;i<1000;i++){const s=app.snapshot();if(!s.animating&&s.mode==='idle')return;app.frame();}throw new Error('Animation did not finish');},
    ringAt:(face,angle)=>{
      const G=context.RingGeometry,r=G.getRing(face),b=elements.get('rings').bounds;
      const actual=context.PUZZLE_SOLVER_BRIDGE?.viewport();
      if(actual)return {clientX:b.left+actual.x+actual.scale*(r.cx+r.r*Math.cos(angle)),clientY:b.top+actual.y+actual.scale*(r.cy+r.r*Math.sin(angle))};
      const focused=elements.get('ringFocus').attributes['aria-pressed']==='true',selectedRing=G.getRing(app.snapshot().selected);
      const zoom=focused?180/selectedRing.r:1,scale=Math.min((b.width-34)/G.width,(b.height-36)/G.height)*zoom;
      const ox=b.width/2-(focused?selectedRing.cx:G.width/2)*scale,oy=b.height/2-(focused?selectedRing.cy:G.height/2)*scale-5;
      return{clientX:b.left+ox+scale*(r.cx+r.r*Math.cos(angle)),clientY:b.top+oy+scale*(r.cy+r.r*Math.sin(angle))};
    }
  };
  elements.get('speed').value=String(options.speed||5);app.frame(0);return app;
}

module.exports={createHarness,Element};
