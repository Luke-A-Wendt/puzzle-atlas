'use strict';
// A deliberately bounded source-cascade checker, NOT a browser layout engine.
// It reads linked, inline, and runtime-injected styles in their real order so
// width-budget tests cannot overlook an inline rule or a stronger selector.
// Native font measurement covers text; actual phone rendering remains separate.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const canvas=createCanvas(1,1).getContext('2d');
function split(text,separator=','){
 let depth=0,quote='',start=0,out=[];
 for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote&&text[i-1]!=='\\')quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===separator&&!depth){out.push(text.slice(start,i).trim());start=i+1;}}
 out.push(text.slice(start).trim());return out.filter(Boolean);
}
function rules(text,conditions=[],out=[]){
 text=text.replace(/\/\*[\s\S]*?\*\//g,'');let start=0;
 while(start<text.length){let open=text.indexOf('{',start);if(open<0)break;const head=text.slice(start,open).trim();let depth=1,end=open+1,quote='';for(;end<text.length&&depth;end++){const c=text[end];if(quote){if(c===quote&&text[end-1]!=='\\')quote='';continue;}if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}')depth--;}
 const body=text.slice(open+1,end-1);if(/^@(media|container)\b/.test(head))rules(body,conditions.concat(head),out);else if(!head.startsWith('@'))out.push({selectors:split(head),declarations:split(body,';').flatMap(d=>{const colon=d.indexOf(':');if(colon<0)return[];return[{name:d.slice(0,colon).trim(),value:d.slice(colon+1).replace(/\s*!important\s*$/,'').trim(),important:/!important\s*$/.test(d)}]}),conditions});start=end;
 }return out;
}
function allows(condition,width,containerWidth){
 const isContainer=condition.startsWith('@container'),w=isContainer?containerWidth:width;
 return split(condition.replace(/^@(media|container)\s*/,'' )).some(branch=>{
  if(/prefers-reduced-motion/.test(branch))return false;
  if(/orientation\s*:\s*portrait/.test(branch)&&width>850)return false;
  if(/orientation\s*:\s*landscape/.test(branch)&&width<=850)return false;
  for(const m of branch.matchAll(/(min|max)-width\s*:\s*([\d.]+)px/g))if(m[1]==='min'?w<+m[2]:w>+m[2])return false;
  return true;
 });
}
function selectorParts(selector){
 let depth=0,quote='',word='',parts=[];
 const push=()=>{if(word.trim())parts.push(word.trim());word='';};
 for(const c of selector){if(quote){word+=c;if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;word+=c;continue;}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(!depth&&(c==='>'||c==='+'||c==='~')){push();if(parts.at(-1)===' ')parts.pop();parts.push(c);}else if(!depth&&/\s/.test(c)){push();if(parts.length&&![' ','>','+','~'].includes(parts.at(-1)))parts.push(' ');}else word+=c;}push();if(parts.at(-1)===' ')parts.pop();return parts;
}
function attr(el,name){if(name==='hidden')return el.hidden?'':null;if(name==='disabled')return el.disabled?'':null;return el.getAttribute?.(name);}
function simple(el,selector){
 if(!el||el.nodeType===3)return false;
 if(/::|:(hover|active|focus|focus-visible|checked)\b/.test(selector))return false;
 let rest=selector;
 for(;;){const m=/:((?:not|is|where|has))\(/.exec(rest);if(!m)break;let d=1,end=m.index+m[0].length;for(;end<rest.length&&d;end++){if(rest[end]==='(')d++;else if(rest[end]===')')d--;}
  const inside=rest.slice(m.index+m[0].length,end-1),matches=split(inside).some(s=>m[1]==='has'?el.querySelectorAll('*').some(n=>match(n,s)):match(el,s));
  if(m[1]==='not'?matches:!matches)return false;rest=rest.slice(0,m.index)+rest.slice(end);
 }
 if(/:empty/.test(rest)){if(el.textContent.trim()||el.children.some(c=>c.nodeType!==3))return false;rest=rest.replace(/:empty/g,'');}
 if(/:(first|last)-child/.test(rest)){const siblings=el.parentNode?.children.filter(c=>c.nodeType!==3)||[];if(rest.includes(':first-child')&&siblings[0]!==el)return false;if(rest.includes(':last-child')&&siblings.at(-1)!==el)return false;rest=rest.replace(/:(first|last)-child/g,'');}
 const nth=/:nth-child\((\d+)\)/.exec(rest);if(nth){const siblings=el.parentNode?.children.filter(c=>c.nodeType!==3)||[];if(siblings.indexOf(el)!==+nth[1]-1)return false;rest=rest.replace(nth[0],'');}
 for(const m of rest.matchAll(/\[([\w-]+)(?:\s*([~|^$*]?=)\s*["']?([^\]"']+)["']?)?\]/g)){const value=attr(el,m[1]);if(value==null)return false;if(m[2]==='='&&value!==m[3])return false;if(m[2]&&m[2]!=='=')throw Error('Unsupported attribute operator in budget check: '+m[0]);}
 rest=rest.replace(/\[[^\]]+\]/g,'');
 for(const m of rest.matchAll(/#([\w-]+)/g))if(el.id!==m[1])return false;
 for(const m of rest.matchAll(/\.([\w-]+)/g))if(!el.classList.contains(m[1]))return false;
 const tag=/^[\w-]+/.exec(rest);if(tag&&el.tagName!==tag[0].toUpperCase())return false;
 if(/:/.test(rest))return false;return true;
}
function match(el,selector){const parts=selectorParts(selector);let i=parts.length-1,current=el;if(!simple(current,parts[i--]))return false;while(i>=0){const relation=parts[i--],target=parts[i--];if(relation==='>'){current=current.parentNode;if(!simple(current,target))return false;}else if(relation===' '){current=current.parentNode;while(current&&!simple(current,target))current=current.parentNode;if(!current)return false;}else if(relation==='+'){const c=current.parentNode?.children.filter(n=>n.nodeType!==3)||[];current=c[c.indexOf(current)-1];if(!simple(current,target))return false;}else return false;}return true;}
function specificity(selector){
 let score=[0,0,0],rest=selector;for(;;){const m=/:((?:not|is|where|has))\(/.exec(rest);if(!m)break;let d=1,end=m.index+m[0].length;for(;end<rest.length&&d;end++){if(rest[end]==='(')d++;else if(rest[end]===')')d--;}
  if(m[1]!=='where'){const best=split(rest.slice(m.index+m[0].length,end-1)).map(specificity).sort(compare).at(-1)||[0,0,0];score=score.map((v,i)=>v+best[i]);}rest=rest.slice(0,m.index)+rest.slice(end);
 }
 score[0]+=(rest.match(/#[\w-]+/g)||[]).length;score[1]+=(rest.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?/g)||[]).length;
 rest=rest.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g,'');score[2]+=selectorParts(rest).filter(s=>/^[\w-]+$/.test(s)).length;return score;
}
function compare(a,b){for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
function expand(d){
 const out=[d],p=d.name,v=d.value;
 if(/^(padding|margin)$/.test(p)){const t=v.split(/\s+/),s=[t[0],t[1]||t[0],t[2]||t[0],t[3]||t[1]||t[0]];['top','right','bottom','left'].forEach((x,i)=>out.push({...d,name:p+'-'+x,value:s[i]}));}
 if(/^(padding|margin)-(inline|block)$/.test(p)){const [kind,axis]=p.split('-'),t=v.split(/\s+/);(axis==='inline'?['left','right']:['top','bottom']).forEach((x,i)=>out.push({...d,name:kind+'-'+x,value:t[i]||t[0]}));}
 if(p==='border'){const w=/^([\d.]+px)\b/.exec(v);if(w)for(const x of ['top','right','bottom','left'])out.push({...d,name:'border-'+x+'-width',value:w[1]});}
 if(p==='font'&&v!=='inherit'){const m=/([\d.]+px)(?:\/([^\s]+))?\s+(.+)$/.exec(v);if(m){out.push({...d,name:'font-size',value:m[1]},{...d,name:'font-family',value:m[3]});const weight=/^(\d+|bold)\s+/.exec(v);if(weight)out.push({...d,name:'font-weight',value:weight[1]});if(m[2])out.push({...d,name:'line-height',value:m[2]});}}
 return out;
}
function createCascade(app,puzzle,width,containerWidth=width-8){
 const dir=path.join(__dirname,'../dist/games'),html=fs.readFileSync(path.join(dir,puzzle+'.html'),'utf8');let all=[];
 for(const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>|<style\b[^>]*>([\s\S]*?)<\/style>/g)){if(m[1]!==undefined)all.push(...rules(m[1]));else{const name=/href="([^"]+)"/.exec(m[0])?.[1];if(name)all.push(...rules(fs.readFileSync(path.resolve(dir,name.split('?')[0]),'utf8')));}}
 for(const el of app.document.querySelectorAll('style'))all.push(...rules(el.textContent));
 const enabled=all.filter(r=>r.conditions.every(c=>allows(c,width,containerWidth))),cache=new Map();
 return function style(el){if(cache.has(el))return cache.get(el);const result=el.parentNode?{...style(el.parentNode)}:{};for(const key of Object.keys(result))if(!['font-size','font-family','font-weight','line-height','white-space','letter-spacing'].includes(key))delete result[key];const winners={};
  enabled.forEach((r,index)=>{for(const s of r.selectors){if(!match(el,s))continue;const spec=specificity(s);for(const d of r.declarations.flatMap(expand)){const priority=[d.important?1:0,...spec,index];if(!winners[d.name]||compare(priority,winners[d.name].priority)>=0)winners[d.name]={...d,priority,selector:s};}}});
  for(const[name,d]of Object.entries(winners))if(d.value!=='inherit')result[name]=d.value;
  result._rules=Object.fromEntries(Object.entries(winners).map(([n,d])=>[n,d.selector]));cache.set(el,result);return result;
 };
}
const px=(s,key,fallback=0)=>Number.parseFloat(s[key])||fallback;
function measure(text,style,mono=false){const weight=Number.parseInt(style['font-weight'])>=600?'700':'400';canvas.font=`${weight} ${px(style,'font-size',13)}px "${mono?'DejaVu Sans Mono':'DejaVu Sans'}"`;return canvas.measureText(text).width+px(style,'letter-spacing')*Math.max(0,text.length-1);}
function textBudget(el,style,width,height){
 const x=px(style,'padding-left')+px(style,'padding-right')+px(style,'border-left-width',1)+px(style,'border-right-width',1),y=px(style,'padding-top')+px(style,'padding-bottom')+px(style,'border-top-width',1)+px(style,'border-bottom-width',1),available=width-x,mono=/mono|Consolas/.test(style['font-family']||''),text=el.textContent.trim().replace(/\s+/g,' ');let lines=1,longest=0,current=0;
 const units=style['white-space']==='nowrap'?[text]:text.split(/\s+/);for(const word of units){const w=measure(word,style,mono),space=current?measure(' ',style,mono):0;if(current&&current+space+w>available){lines++;current=w;}else current+=space+w;longest=Math.max(longest,w);}
 const lh=style['line-height'],font=px(style,'font-size',13),lineHeight=lh?.endsWith('px')?parseFloat(lh):font*(parseFloat(lh)||1.5);
 return{text,width,height,available,longest,lines,neededHeight:lines*lineHeight+y,fits:longest<=available+.5&&lines*lineHeight+y<=height+.5,whiteSpace:style['white-space'],rules:style._rules};
}
module.exports={createCascade,textBudget,px,measure,match,specificity,rules,allows};
