'use strict';
// Small deterministic browser host for integration tests. This loads the actual
// game/solver scripts; it models DOM hierarchy and capture/bubble propagation,
// but deliberately makes no assertions about CSS layout or browser rendering.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {Element: LegacyElement} = require('./game-harness.cjs');

const decode = text => String(text).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '}[x]));
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

class Element extends LegacyElement {
  constructor(tag='div', id='') {
    super(tag,id);
    this.ownerDocument = null; this.nodeType = tag === '#text' ? 3 : 1;
    this._text = ''; this.checked=false; this.inert=false; this.tabIndex=-1;
    this.classList.add = (...tokens) => {for(const token of tokens) if(!this.classList.contains(token)) this.className=(this.className+' '+token).trim();};
    this.classList.remove = (...tokens) => {this.className=this.className.split(/\s+/).filter(x=>!tokens.includes(x)).join(' ');};
  }
  get parentElement(){return this.parentNode || null;}
  get firstChild(){return this.children[0] || null;}
  get nextSibling(){const c=this.parentNode?.children||[];return c[c.indexOf(this)+1]||null;}
  get textContent(){return (this._text||'') + (this.children||[]).map(c=>c.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get innerHTML(){return this._innerHTML || '';}
  set innerHTML(value){this.replaceChildren();this._text='';this._innerHTML=String(value);parseInto(this,String(value));}
  appendChild(el){if(el.parentNode)el.remove();el.ownerDocument=this.ownerDocument;return super.appendChild(el);}
  append(...els){super.append(...els.map(el=>typeof el==='string'?Object.assign(new Element('#text'),{textContent:el}):el));}
  prepend(...els){for(const el of [...els].reverse())this.insertBefore(el,this.firstChild);}
  insertBefore(el,before){if(!before)return this.appendChild(el);if(el.parentNode)el.remove();const i=this.children.indexOf(before);if(i<0)throw Error('Missing reference child');el.parentNode=this;el.ownerDocument=this.ownerDocument;this.children.splice(i,0,el);return el;}
  replaceChildren(...els){for(const child of this.children||[])child.parentNode=null;this.children=[];this._text='';this.append(...els);}
  cloneNode(deep=false){
    // Browser clones preserve markup/reflected attributes, but do not copy
    // listeners registered through addEventListener or a node's parent.
    const clone=new Element(this.tagName.toLowerCase(),this.id);clone.ownerDocument=this.ownerDocument;
    for(const [key,value]of Object.entries(this.attributes))clone.setAttribute(key,value);
    for(const key of ['className','title','value','disabled','hidden','checked','tabIndex','type','name','role'])if(this[key]!==undefined)clone[key]=this[key];
    clone.dataset={...this.dataset};clone.style={...this.style};clone._text=this._text;
    if(deep)for(const child of this.children)clone.appendChild(child.cloneNode(true));
    return clone;
  }
  setAttribute(k,v){super.setAttribute(k,String(v));if(k==='id')this.id=String(v);if(k==='class')this.className=String(v);if(k==='value')this.value=String(v);if(k==='tabindex')this.tabIndex=Number(v);if(k==='hidden')this.hidden=true;if(k==='disabled')this.disabled=true;if(k==='checked')this.checked=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v);}
  getAttribute(k){if(k==='id')return this.id||null;if(k==='class')return this.className||null;return Object.hasOwn(this.attributes,k)?this.attributes[k]:null;}
  hasAttribute(k){return this.getAttribute(k)!==null;}
  removeAttribute(k){delete this.attributes[k];if(k==='id')this.id='';if(k==='class')this.className='';if(k==='hidden')this.hidden=false;if(k==='disabled')this.disabled=false;}
  contains(el){for(let n=el;n;n=n.parentNode)if(n===this)return true;return false;}
  closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
  matches(selector){return selector.split(',').some(part=>{
    const tokens=part.trim().split(/\s+/);let current=this;
    if(!simpleMatch(current,tokens.pop()))return false;
    while(tokens.length){const next=tokens.pop();current=current.parentNode;while(current&&!simpleMatch(current,next))current=current.parentNode;if(!current)return false;}return true;
  });}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(type, listener, options){(this.listeners[type]||=[]).push({listener,capture:options===true||!!options?.capture,once:!!options?.once});}
  removeEventListener(type, listener){this.listeners[type]=(this.listeners[type]||[]).filter(entry=>entry.listener!==listener);}
  dispatch(type,props={}){
    if(type==='click'&&this.disabled)return null;
    const event={type,target:this,currentTarget:null,button:0,pointerId:1,clientX:0,clientY:0,bubbles:true,cancelable:true,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this._stopped=true;},stopImmediatePropagation(){this._stopped=true;this._immediate=true;},...props};
    const route=[];for(let p=this;p;p=p.parentNode)route.push(p);
    const invoke=(el,capture)=>{event.currentTarget=el;for(const entry of [...(el.listeners[type]||[])]){if(entry.capture!==capture)continue;entry.listener(event);if(entry.once)el.removeEventListener(type,entry.listener);if(event._immediate)break;}};
    for(const el of [...route].reverse()){invoke(el,true);if(event._stopped)break;}
    if(!event._stopped){invoke(this,false);if(!event._stopped&&event.bubbles)for(const el of route.slice(1)){invoke(el,false);if(event._stopped)break;}}
    return event;
  }
  dispatchEvent(event){return !this.dispatch(event.type,event).defaultPrevented;}
  click(){return this.dispatch('click');}
  focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}
  blur(){if(this.ownerDocument?.activeElement===this)this.ownerDocument.activeElement=null;}
  releasePointerCapture(){}
  scrollIntoView(){}
}
function simpleMatch(el,selector){
  if(!selector||el.nodeType===3)return false;
  const not=/\:not\(([^)]+)\)/.exec(selector);if(not){if(simpleMatch(el,not[1]))return false;selector=selector.replace(not[0],'');}
  for(const m of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/g)){if(!el.hasAttribute(m[1]))return false;if(m[2]!==undefined&&el.getAttribute(m[1])!==m[2])return false;}
  selector=selector.replace(/\[[^\]]+\]/g,'');
  const tag=/^[\w-]+/.exec(selector);if(tag&&el.tagName!==tag[0].toUpperCase())return false;
  const id=/#([\w-]+)/.exec(selector);if(id&&el.id!==id[1])return false;
  for(const m of selector.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(m[1]))return false;
  return true;
}
function parseInto(root,html){
  const stack=[root];
  for(const token of html.matchAll(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<![^>]*>|<\/?[\w-]+\b[^>]*>|[^<]+/gi)){
    const text=token[0];if(/^<!--|^<!|^<(script|style)\b/i.test(text))continue;
    if(text.startsWith('</')){const tag=text.slice(2).split(/[\s>]/)[0].toUpperCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}continue;}
    if(text.startsWith('<')){const name=/^<([\w-]+)/.exec(text)[1],el=new Element(name);for(const a of text.slice(name.length+1,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));stack.at(-1).appendChild(el);if(!voidTags.has(name.toLowerCase())&&!text.endsWith('/>'))stack.push(el);}
    else if(text.trim())stack.at(-1).appendChild(Object.assign(new Element('#text'),{textContent:decode(text)}));
  }
}

function createPage(puzzle='cube2',options={}){
  const games=path.join(__dirname,'../dist/games'),htmlPath=path.join(games,puzzle+'.html'),html=fs.readFileSync(htmlPath,'utf8');
  const document=new Element('document');document.nodeType=9;document.ownerDocument=document;parseInto(document,html);
  document.documentElement=document.querySelector('html');document.body=document.querySelector('body');document.head=document.querySelector('head');
  document.getElementById=id=>document.querySelector('#'+id);document.createElement=tag=>{const el=new Element(tag);el.ownerDocument=document;return el;};document.createElementNS=(_,tag)=>document.createElement(tag);document.createTextNode=text=>Object.assign(document.createElement('#text'),{textContent:text});document.execCommand=()=>true;document.activeElement=document.body;
  document.baseURI='https://atlas.test/games/'+puzzle+'.html';
  for(const canvas of document.querySelectorAll('canvas'))canvas.bounds={left:0,top:0,width:500,height:canvas.id==='cube'?400:500};
  let now=0,nextTimer=0,nextFrame=0,frames=new Map(),timers=new Map();
  const win=new Element('window');
  const context={document,console,crypto:webcrypto,Uint32Array,Math,Date,performance:{now:()=>now},devicePixelRatio:1,URL,URLSearchParams,AbortController,Event,TextEncoder,TextDecoder,Map,Set,ArrayBuffer,Uint8Array,
    matchMedia:()=>({matches:false}),addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win),
    requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,ms=0)=>{timers.set(++nextTimer,{fn,at:now+ms});return nextTimer;},clearTimeout:id=>timers.delete(id),
    navigator:{clipboard:{writeText:async()=>{}}},location:{search:'',origin:'https://atlas.test',href:'https://atlas.test/games/'+puzzle+'.html'},
    getComputedStyle:el=>({display:el.hidden?'none':'block',position:'relative'}),...options.globals};
  context.window=context;context.globalThis=context;context.parent=context;vm.createContext(context);
  for(const [i,m]of [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].entries()){
    const src=/src="([^"]+)"/.exec(m[1]),localName=src?.[1].split(/[?#]/)[0];if(src&&options.skipScripts?.includes(localName))continue;
    document.currentScript=src?{src:new URL(src[1],document.baseURI).href}:null;
    // Fault-injection tests can omit one component. Normal tests execute the
    // actual production bundle, with its actual same-directory script base.
    const components=/data-sources="([^"]+)"/.exec(m[1])?.[1].split(' ');
    if(components?.some(name=>options.skipScripts?.includes(name))){
      for(const name of components)if(!options.skipScripts?.includes(name))vm.runInContext(fs.readFileSync(path.resolve(games,name),'utf8'),context,{filename:name});
      continue;
    }
    const code=src?fs.readFileSync(path.resolve(games,localName),'utf8'):m[2];vm.runInContext(code,context,{filename:src?src[1]:'page-inline-'+i});
  }
  document.currentScript=null;
  const app={context,document,element:id=>document.getElementById(id),snapshot:()=>JSON.parse(JSON.stringify(context.PUZZLE_API.snapshot())),
    click:id=>document.getElementById(id).click(),frame:(ms=200)=>{now+=ms;const callbacks=frames;frames=new Map();for(const fn of callbacks.values())fn(now);for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}},
    flush:async(n=5)=>{for(let i=0;i<n;i++)await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));},
    advance:async(ms=200)=>{app.frame(ms);await app.flush();},
    settle:async(max=2000)=>{for(let i=0;i<max;i++){await app.advance(2000);const snap=app.snapshot();if(!snap.animating&&snap.mode==='idle'&&(!context.ConstrainedSolverUI||!['executing','loading'].includes(context.ConstrainedSolverUI.state().phase)))return;}throw Error('Game did not settle');},
    loadScript:name=>vm.runInContext(fs.readFileSync(path.resolve(games,name.split(/[?#]/)[0]),'utf8'),context,{filename:name}),now:()=>now,win};
  app.element('speed').value=String(options.speed ?? 5);app.frame(0);return app;
}

module.exports={createPage,Element};
