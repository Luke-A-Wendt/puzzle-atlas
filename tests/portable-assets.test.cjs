'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const dist=path.resolve(__dirname,'../dist');
const origin='https://portable.test';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(dist);
function resolveAsset(reference,source,prefix){
 const ref=reference.trim().replace(/&amp;/g,'&');
 if(!ref||ref[0]==='#'||ref==='about:blank'||/^data:/i.test(ref))return;
 assert(!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(ref),`${source}: runtime asset must be relative: ${ref}`);
 const base=new URL(prefix+path.relative(dist,source).split(path.sep).join('/'),origin);
 const target=new URL(ref,base);
 assert.equal(target.origin,origin,`${source}: external runtime asset ${ref}`);
 assert(target.pathname.startsWith(prefix),`${source}: asset escaped deployment subdirectory: ${ref}`);
 let local=path.join(dist,decodeURIComponent(target.pathname.slice(prefix.length)));
 if(fs.existsSync(local)&&fs.statSync(local).isDirectory())local=path.join(local,'index.html');
 assert(fs.existsSync(local),`${source}: missing runtime asset ${ref}`);
}

test('all static runtime assets resolve at both domain root and GitHub project subpath',()=>{
 let checked=0;
 for(const file of files.filter(f=>/\.(html|css|svg)$/.test(f))){
  const text=fs.readFileSync(file,'utf8'),refs=[];
  // Outbound reference anchors are intentionally excluded: they are not loaded by the app.
  for(const tag of text.matchAll(/<(script|link|img|iframe|source|audio|video|image|use)\b[^>]*>/gi)){
   for(const attr of tag[0].matchAll(/\b(src|href|xlink:href|poster)\s*=\s*(["'])(.*?)\2/gi))refs.push(attr[3]);
   for(const attr of tag[0].matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi))for(const item of attr[2].split(','))refs.push(item.trim().split(/\s+/)[0]);
  }
  for(const match of text.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi))refs.push(match[2]);
  for(const match of text.matchAll(/@import\s+(["'])(.*?)\1/gi))refs.push(match[2]);
  assert(!/<base\b/i.test(text),`${file}: base element changes relative asset resolution`);
  for(const ref of refs)for(const prefix of ['/','/puzzle-atlas/']){resolveAsset(ref,file,prefix);checked++;}
 }
 assert(checked>400,`expected full atlas coverage, checked ${checked} references`);
});

test('runtime scripts contain no remote asset loaders or development-host references',()=>{
 const forbiddenHost=/(?:woodsyshore\d*|chatgpt[.]site|chatgpt-team[.]site|appgprj_|appgver_|appgdep_)/i;
 for(const file of files.filter(f=>/\.(html|css|js|json|svg)$/.test(f))){
  const text=fs.readFileSync(file,'utf8');
  assert(!forbiddenHost.test(text),`${file}: development hosting reference`);
  assert(!/(?:fetch\s*\(|importScripts\s*\(|new\s+(?:Worker|WebSocket|EventSource)\s*\(|\.src\s*=)\s*['"`]\s*(?:https?:)?\/\//i.test(text),`${file}: external runtime request`);
  assert(!/navigator\.sendBeacon\s*\(|new\s+XMLHttpRequest\s*\(/.test(text),`${file}: unexpected network API; audit before publishing`);
  for(const ref of text.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,/g)){
   if(ref[1]==='.')continue;
   if(/\.(?:js|json|css|png|svg)(?:[?#].*)?$/.test(ref[1]))resolveAsset(ref[1],file,'/puzzle-atlas/');
  }
 }
});

test('all 34 models load with real integrity checks from the deployed project subdirectory',async()=>{
 const requests=[];
 const context={URL,performance,TextEncoder,AbortController,crypto:webcrypto,setTimeout,clearTimeout,console,
  document:{currentScript:{src:origin+'/puzzle-atlas/games/constrained-solver-core.js'}},
  fetch:async input=>{
   const url=new URL(input);requests.push(url);
   assert.equal(url.origin,origin);
   assert(url.pathname.startsWith('/puzzle-atlas/games/'));
   const file=path.join(dist,url.pathname.slice('/puzzle-atlas/'.length));
   return{ok:fs.existsSync(file),status:fs.existsSync(file)?200:404,text:async()=>fs.readFileSync(file,'utf8')};
  }};
 context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(dist,'games/constrained-solver-core.js'),'utf8'),context);
 const core=context.ConstrainedSolverCore;
 assert.equal(core.modelIds.length,34);
 assert.equal(core.assetBase,origin+'/puzzle-atlas/games/');
 for(const id of core.modelIds){
  const model=await core.loadModel(id);assert.equal(model.id,id);
  resolveAsset(`games/${id}.html`,path.join(dist,'play.html'),'/puzzle-atlas/');
  for(const folder of ['constrained-solver-caches','color-solver-caches']){
   const value=JSON.parse(fs.readFileSync(path.join(dist,'games',folder,id+'.json'),'utf8'));
   assert(value&&typeof value==='object',`${folder}/${id}.json`);
  }
 }
 assert.equal(requests.length,34);
});
