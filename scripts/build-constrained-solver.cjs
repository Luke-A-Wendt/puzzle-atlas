#!/usr/bin/env node
'use strict';
/* Build the optional browser solver from the separately tested backend.
 * Usage: node scripts/build-constrained-solver.cjs [path/to/puzzle-backend]
 * Only generated constrained-solver assets are written. Puzzle engines and
 * ring renderers are deliberately not involved in this build.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),backend=path.resolve(process.argv[2]||path.join(root,'solver-backend'));
const out=path.join(root,'dist/games'),modelDir=path.join(out,'constrained-solver-models');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const modules={},provenance={};
function read(name){const source=fs.readFileSync(path.join(backend,'src',name+'.cjs'),'utf8');provenance[name+'.cjs']=hash(source);return source;}
function replaceOnce(source,from,to){if(!source.includes(from)||source.indexOf(from)!==source.lastIndexOf(from))throw Error('Backend source changed; inspect browser adaptation: '+from);return source.replace(from,to);}
const index=read('index'),adapter=read('atlas-adapter'),autoAdapter=read('auto-adapter');
let portable=replaceOnce(index,"const crypto=require('node:crypto');\n",'');
const asyncStart=portable.indexOf('function solve(model,request,options={}){'),previewStart=portable.indexOf('// Pure preview/execution');
if(asyncStart<0||previewStart<asyncStart)throw Error('Backend source changed; inspect Node worker/cache boundaries');
portable=portable.slice(0,asyncStart)+portable.slice(previewStart);
portable=replaceOnce(portable,'module.exports={solve,solveSync,Solver,normalize,verify,permutation,applySequence,validateOptions};','module.exports={solveSync,normalize,verify,permutation,applySequence,validateOptions};');
modules['./index.cjs']=portable;
modules['./search.cjs']=read('search');
modules['./shorten.cjs']=read('shorten');
modules['./group.cjs']=replaceOnce(read('group'),'const now = () => Number(process.hrtime.bigint()) / 1e6;','const now = () => performance.now();');
modules['./atlas-adapter.cjs']=adapter;
modules['./auto-adapter.cjs']=autoAdapter;
modules['./guided-plan.cjs']=read('guided-plan');
modules['./full-solve.cjs']=read('full-solve');
modules['./eligibility.cjs']=read('eligibility');
modules['./eligibility-status.cjs']=read('eligibility-status');
modules['./color-solve.cjs']=read('color-solve');
modules['./macro-index.cjs']=read('macro-index');
modules['./color-eligibility.cjs']=read('color-eligibility');
modules['./cached-swap.cjs']=read('cached-swap');
modules['./permutation-membership.cjs']=read('permutation-membership');
modules['./color-compensation.cjs']=read('color-compensation');
modules['./manual-session.cjs']=read('manual-session');
const manifest=JSON.parse(fs.readFileSync(path.join(backend,'data/manifest.json'),'utf8'));
fs.mkdirSync(modelDir,{recursive:true});
const modelHashes={},modelList=[],fullCacheHashes={},colorCacheHashes={};
const fullCacheDir=path.join(out,'constrained-solver-caches');fs.mkdirSync(fullCacheDir,{recursive:true});
const colorCacheDir=path.join(out,'color-solver-caches');fs.mkdirSync(colorCacheDir,{recursive:true});
function addSolvedTarget(model){
 const spec=model.adapter.source,ctx={CUBE_SIZE:Number(model.id.slice(4))};ctx.window=ctx;vm.createContext(ctx);
 let code=fs.readFileSync(path.join(out,path.basename(spec.file)),'utf8');
 if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 if(!code)throw Error('Cannot locate solved-state engine for '+model.id);
 vm.runInContext(code,ctx,{filename:spec.file});const engine=ctx[spec.rootName],puzzle=spec.kind==='model'?engine.create(model.id):null;
 const solved=JSON.parse(JSON.stringify(puzzle?puzzle.stickerState:engine.makeSolved()));
 const bridge=require(path.join(backend,'src/atlas-adapter.cjs'));
 model.homeBySticker={...bridge.mapSnapshot(model,solved).stickerToNode};
 model.colorBySticker=Object.fromEntries(solved.map(s=>{
  if(typeof s.color!=='string'&&typeof s.color!=='number')throw Error('Missing solved sticker color for '+model.id);
  return [String(s.id),String(s.color)];
 }));
 // Identical colors do not imply interchangeable geometry or picture tiles.
 model.colorRelaxationSafe=!model.requiresOccupiedState&&!['mirror','homer'].includes(model.id);
 require(path.join(backend,'src/auto-adapter.cjs')).targetMapping(model);
 return model;
}
for(const {id}of manifest.models){
 if(!/^[a-z0-9]+$/.test(id))throw Error('Unsafe model ID');
 const source=JSON.stringify(addSolvedTarget(JSON.parse(fs.readFileSync(path.join(backend,'data',id+'.json'),'utf8'))))+'\n';
 modelHashes[id]=hash(source);fs.writeFileSync(path.join(modelDir,id+'.json'),source);
 const cacheSource=path.join(backend,'data/full-solver',id+'.json');
 if(!fs.existsSync(cacheSource))throw Error('Missing complete full-solve cache: '+id);
 const cacheText=fs.readFileSync(cacheSource,'utf8'),cache=JSON.parse(cacheText);
 if(cache.status!=='ready'||cache.complete!==true||cache.schemaVersion!==1||cache.degree!==JSON.parse(source).degree||cache.modelSignature!==require(path.join(backend,'src/full-solve.cjs')).modelSignature(JSON.parse(source)))throw Error('Full-solve cache is incomplete or mismatched: '+id);
 fullCacheHashes[id]=hash(cacheText);fs.writeFileSync(path.join(fullCacheDir,id+'.json'),cacheText);
 const colorText=fs.readFileSync(path.join(backend,'data/color-solver',id+'.json'),'utf8'),colorCache=JSON.parse(colorText);
 if(colorCache.schemaVersion!==1||colorCache.kind!=='color-macros'||colorCache.degree!==JSON.parse(source).degree||colorCache.modelSignature!==cache.modelSignature)throw Error('Color cache is mismatched: '+id);
 colorCacheHashes[id]=hash(colorText);fs.writeFileSync(path.join(colorCacheDir,id+'.json'),colorText);
 const model=JSON.parse(source);modelList.push({id,name:model.name,degree:model.degree,stickerCount:model.stickerCount,moves:model.moves.length,bytes:Buffer.byteLength(source),sha256:modelHashes[id]});
}
const banner='/* Generated by scripts/build-constrained-solver.cjs. Do not hand-edit.\n * Exact backend algorithms; Node-only worker/cache removed, monotonic clock adapted.\n */\n';
// Tie the page helper and worker to the same generated backend and data set.
const assetRelease=hash(fs.readFileSync(__filename,'utf8')+JSON.stringify({provenance,modelHashes,fullCacheHashes,colorCacheHashes})).slice(0,20);
function bundle(sources){return 'const factories={\n'+Object.entries(sources).map(([name,source])=>JSON.stringify(name)+':function(module,exports,require){\n'+source+'\n}').join(',\n')+'\n};\nconst loaded={};function require(name){if(!factories[name])throw Error("Unknown bundled module "+name);if(!loaded[name]){const module={exports:{}};loaded[name]=module;factories[name](module,module.exports,require);}return loaded[name].exports;}\n';}
const loading=`
const assetRelease=${JSON.stringify(assetRelease)};
const fingerprints=${JSON.stringify(modelHashes)};
const fullCacheFingerprints=${JSON.stringify(fullCacheHashes)};
const colorCacheFingerprints=${JSON.stringify(colorCacheHashes)};
const modelCache=new Map();
function modelFingerprint(modelOrId){return fingerprints[typeof modelOrId==='string'?modelOrId:modelOrId?.id]??null;}
function assetError(kind,reason,message){const error=new Error(message);error.code=kind+'_'+reason;return error;}
async function loadAsset(path,expected,kind){
 const label=kind==='model'?'Puzzle move model':kind==='color'?'Puzzle short-move library':'Puzzle stabilizer cache';
 if(assetBase?.protocol==='file:')throw assetError(kind,'file_protocol','Open this website through a local HTTP server or your hosted site. Browsers block solver data when HTML is opened directly from disk.');
 const controller=typeof AbortController==='function'?new AbortController():null;
 let timer=null,stage='network';
 const operation=(async()=>{
  try{
   for(let attempt=0;attempt<2;attempt++){
    stage='network';
    const response=await fetch(new URL(path,assetBase),{...(controller?{signal:controller.signal}:{}),...(attempt?{cache:'reload'}:{})});
    if(!response.ok)throw assetError(kind,'http_error',label+' could not be loaded from this website (HTTP '+response.status+'). Check that the complete dist folder was published.');
    const text=await response.text();stage='integrity';
    if(globalThis.crypto?.subtle){
     const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
     const actual=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
     if(actual!==expected){
      if(attempt===0)continue; // One fresh read repairs a stale cached asset.
      throw assetError(kind,'integrity_error',label+' does not match this release after a fresh reload. Reload the page; if this persists, publish all dist files from the same ZIP.');
     }
    }
    stage='parse';return JSON.parse(text);
   }
  }catch(error){
   if(typeof error.code==='string'&&error.code.startsWith(kind+'_'))throw error;
   const reason=stage==='integrity'?'integrity_unavailable':stage==='parse'?'parse_error':'network_error';
   const action=stage==='integrity'?'could not be verified by this browser':stage==='parse'?'contains unreadable data':'could not be downloaded';
   throw assetError(kind,reason,label+' '+action+': '+(error.message||String(error)));
  }
 })();
 // Browser and Worker globals always provide timers. The guard also keeps the
 // pure bundle usable in non-browser model-verification hosts.
 if(typeof setTimeout!=='function')return operation;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
  reject(assetError(kind,'load_timeout',label+' did not finish loading within 20 seconds. Check your connection and retry.'));
  controller?.abort();
 },20000);});
 try{return await Promise.race([operation,timeout]);}finally{clearTimeout(timer);}
}
async function loadModel(id){
 if(typeof id!=='string'||!Object.hasOwn(fingerprints,id))throw Error('Unknown puzzle model');
 if(modelCache.has(id)){const model=modelCache.get(id);modelCache.delete(id);modelCache.set(id,model);return model;}
 const model=await loadAsset('constrained-solver-models/'+id+'.json?v='+fingerprints[id],fingerprints[id],'model');
 if(model.id!==id||model.schemaVersion!==1)throw Error('Unsupported puzzle model version');
 const initial=model.initialOccupied??[0,1];core.normalize(model,{swap:initial.slice(0,2),occupiedNodes:initial});
 autoBridge.targetMapping(model);freeze(model);modelCache.set(id,model);while(modelCache.size>2)modelCache.delete(modelCache.keys().next().value);
 return model;
}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
`;
const coreIndex=portable.slice(0,portable.indexOf('function solveSync(')).replace("const {search}=require('./search.cjs');\n",'')+'\nmodule.exports={normalize,verify,permutation};\n';
const helper=banner+'(function(root){\n\'use strict\';\n'+bundle({'./index.cjs':coreIndex,'./atlas-adapter.cjs':adapter,'./auto-adapter.cjs':autoAdapter,'./guided-plan.cjs':modules['./guided-plan.cjs'],'./eligibility-status.cjs':modules['./eligibility-status.cjs']})+`
const core=require('./index.cjs'),bridge=require('./atlas-adapter.cjs'),autoBridge=require('./auto-adapter.cjs');
const scriptURL=typeof document==='object'?(document.currentScript?.src||document.baseURI):null;
const assetBase=scriptURL&&typeof URL==='function'?new URL('.',scriptURL):null;
${loading}
root.ConstrainedSolverCore=Object.freeze({...core,...bridge,...autoBridge,...require('./guided-plan.cjs'),...require('./eligibility-status.cjs'),loadModel,modelFingerprint,modelIds:Object.freeze(Object.keys(fingerprints)),assetBase:assetBase?.href??null,assetRelease,workerURL:assetBase?new URL('constrained-solver-worker.js?v='+assetRelease,assetBase).href:null});
})(globalThis);
`;
fs.writeFileSync(path.join(out,'constrained-solver-core.js'),helper);
const worker=banner+'\'use strict\';\n'+bundle(modules)+`
const core=require('./index.cjs'),bridge=require('./atlas-adapter.cjs'),autoBridge=require('./auto-adapter.cjs');
const assetBase=new URL('.',self.location.href);
${loading}
const resultCache=new Map();let cacheBytes=0,busy=false,manualSession=null,manualKey=null;
const fullSolver=require('./full-solve.cjs');
const {ColorEligibilityAnalyzer:EligibilityAnalyzer}=require('./color-eligibility.cjs');let eligibilityAnalyzer=null;
const fullCache=new Map();
const colorCaches=new Map();
async function loadColorCache(id){
 if(colorCaches.has(id))return colorCaches.get(id);
 if(!Object.hasOwn(colorCacheFingerprints,id))return null;
 const value=await loadAsset('color-solver-caches/'+id+'.json?v='+colorCacheFingerprints[id],colorCacheFingerprints[id],'color');
 colorCaches.clear();colorCaches.set(id,value);return value;
}
async function loadFullCache(id){
 if(fullCache.has(id))return fullCache.get(id);
 if(!Object.hasOwn(fullCacheFingerprints,id))return null;
 const value=await loadAsset('constrained-solver-caches/'+id+'.json?v='+fullCacheFingerprints[id],fullCacheFingerprints[id],'cache');
 fullCache.clear();fullCache.set(id,value);return value;
}
function autoOptionsFor(raw={}){
 const o=core.validateOptions(raw);
 return {...o,maxMs:Math.min(o.maxMs??15000,30000),maxOutputMoves:Math.min(o.maxOutputMoves??20000,20000),maxStorageBytes:Math.min(o.maxStorageBytes??64*1024*1024,96*1024*1024)};
}
function eligibilityOptionsFor(raw={}){
 // Keep this independent of path-search budgets; zero is useful for a safe
 // immediate unknown result. Analyzer validates all remaining numeric ranges.
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Options must be an object');
 for(const name of ['maxMs','maxStorageBytes','maxStrongGenerators','maxOperations','maxBaseSwaps'])if(raw[name]!==undefined&&(!Number.isSafeInteger(raw[name])||raw[name]<0))throw Error('Invalid eligibility budget '+name);
 return {...raw,maxMs:Math.min(raw.maxMs??3000,3000),maxStorageBytes:Math.min(raw.maxStorageBytes??48*1024*1024,48*1024*1024),maxStrongGenerators:Math.min(raw.maxStrongGenerators??2000,2000),maxOperations:Math.min(raw.maxOperations??100000000,100000000),maxBaseSwaps:Math.min(raw.maxBaseSwaps??50000,50000)};
}
const cacheLimit=2*1024*1024;
function optionsFor(raw={}){
 const o=core.validateOptions(raw);
 return {...o,maxMs:Math.min(o.maxMs??3000,10000),searchMs:Math.min(o.searchMs??450,1500),maxSearchStates:Math.min(o.maxSearchStates??15000,25000),maxSearchDepth:Math.min(o.maxSearchDepth??12,30),maxStrongGenerators:Math.min(o.maxStrongGenerators??2000,2000),maxDagNodes:Math.min(o.maxDagNodes??100000,100000),maxOutputMoves:Math.min(o.maxOutputMoves??5000,5000),maxOrbitStates:Math.min(o.maxOrbitStates??100000,100000),maxSchreierTests:Math.min(o.maxSchreierTests??3000000,3000000),maxStorageBytes:Math.min(o.maxStorageBytes??48*1024*1024,48*1024*1024)};
}
function manualOptionsFor(raw={}){
 const o=core.validateOptions(raw);
 return {...o,maxMs:Math.min(o.maxMs??3000,60000),maxSearchStates:Math.min(o.maxSearchStates??100000,100000),maxSearchDepth:Math.min(o.maxSearchDepth??30,30),maxOutputMoves:Math.min(o.maxOutputMoves??5000,5000),maxOrbitStates:Math.min(o.maxOrbitStates??100000,100000),maxDagNodes:Math.min(o.maxDagNodes??100000,100000),maxStorageBytes:Math.min(o.maxStorageBytes??48*1024*1024,48*1024*1024)};
}
function cacheResult(key,result){if(!['solved','impossible'].includes(result.status))return;const text=JSON.stringify(result),bytes=text.length*2;if(bytes>cacheLimit)return;while(cacheBytes+bytes>cacheLimit&&resultCache.size){const k=resultCache.keys().next().value;cacheBytes-=resultCache.get(k).length*2;resultCache.delete(k);}resultCache.set(key,text);cacheBytes+=bytes;}
self.onmessage=async event=>{
 const message=event.data||{},id=message.id;
 if(message.expectedRelease&&message.expectedRelease!==assetRelease){self.postMessage({id,type:'result',workerRelease:assetRelease,result:{status:'unknown',reason:'release_mismatch',detail:'This puzzle tab and its solver are from different releases. Reload the puzzle to use the current release; no moves were made.',optimal:false}});return;}
 if(busy){self.postMessage({id,type:'result',result:{status:'unknown',reason:'worker_busy',optimal:false}});return;}
 busy=true;
 try{
  const progress=stage=>{if(message.task!=='eligible-swaps')self.postMessage({id,type:'progress',stage});};
  let model;
  progress('loading-model');
  try{model=await loadModel(message.modelId);}catch(e){self.postMessage({id,type:'result',result:{status:'unknown',reason:e.code||'model_unavailable',detail:e.message,optimal:false}});return;}
  if(message.task==='eligible-swaps'){
   const mapping=bridge.mapSnapshot(model,message.snapshot),selection=message.selection??{};
   const ids=selection.protectedStickerIds??[];if(!Array.isArray(ids))throw Error('Protected sticker IDs must be an array');
   const held=ids.map(id=>{const n=mapping.stickerToNode[String(id)];if(n===undefined)throw Error('Unknown current sticker '+id);return n;});
   const request={protected:held,occupiedNodes:mapping.occupiedNodes,mode:selection.mode??'protected_swap',protection:selection.protection??'endpoint',...(selection.holdSemantics==='color'?{holdSemantics:'color',colorByNode:bridge.colorsFromSnapshot(model,message.snapshot,mapping),...(selection.exemptSwapEndpoints!==undefined?{exemptSwapEndpoints:selection.exemptSwapEndpoints}:{})}:{})},options=eligibilityOptionsFor(message.options);
   if(!eligibilityAnalyzer||eligibilityAnalyzer.model!==model)eligibilityAnalyzer=new EligibilityAnalyzer(model,null,{cacheBytes:2*1024*1024});
   let cacheError;
   if(held.length&&request.protection==='endpoint'&&!eligibilityAnalyzer.cache){try{eligibilityAnalyzer.setCache(await loadFullCache(model.id));}catch(e){cacheError=e.message;}}
   if(request.holdSemantics==='color'&&!eligibilityAnalyzer.colorCache){try{eligibilityAnalyzer.setColorCache(await loadColorCache(model.id));}catch(e){cacheError=e.message;}}
   const result=eligibilityAnalyzer.analyze(request,options);
   if(cacheError)result.detail=cacheError;
   self.postMessage({id,type:'result',result,modelFingerprint:modelFingerprint(model.id)});return;
  }
  if(message.task==='full-solve'||message.task==='guided-solve'){
   const request=autoBridge.autoRequestFromSnapshot(model,message.snapshot),options=autoOptionsFor(message.options);
   progress('loading-cache');
   let cache;try{cache=await loadFullCache(model.id);}catch(e){self.postMessage({id,type:'result',result:{status:'unknown',reason:e.code||'cache_unavailable',detail:e.message,optimal:false}});return;}
   progress('planning');
   let result=fullSolver.solveFull(model,request,{...options,cache});
   if(result.status==='solved')progress('verifying');
   if(result.status==='solved'&&!autoBridge.verifyAutoPlan(model,message.snapshot,result))result={status:'unknown',reason:'internal_auto_witness_verification_failed',optimal:false};
   if(result.status==='solved'&&message.task==='guided-solve'){
    const guided=require('./guided-plan.cjs'),mapping=bridge.mapSnapshot(model,message.snapshot),ids=message.selection?.protectedStickerIds??[];
    if(!Array.isArray(ids))throw Error('Protected sticker IDs must be an array');
    const protectedNodes=ids.map(id=>{const n=mapping.stickerToNode[String(id)];if(n===undefined)throw Error('Unknown current sticker '+id);return n;});
    const checkpoints=guided.groupGuidedPlan(model,request,result,{protectedNodes,exactProgress:!!message.snapshot?.mirrorMode});
    if(checkpoints.status==='solved'&&!guided.verifyGuidedPlan(model,message.snapshot,checkpoints))result={status:'unknown',reason:'internal_guided_witness_verification_failed',optimal:false};
    else result=checkpoints;
   }

   const engineStages=result.status==='solved'?result.stages.map(stage=>({...stage,engineMoves:stage.moveIndices.map(i=>({...model.moves[i].engineMove}))})):[];
   self.postMessage({id,type:'result',result,engineStages,modelFingerprint:modelFingerprint(model.id)});return;
  }
  if(message.task==='manual-swap'){
   const request=bridge.requestFromSnapshot(model,message.snapshot,message.selection),normalized=core.normalize(model,request),options=manualOptionsFor(message.options);
   const key=JSON.stringify([model.id,normalized]);
   if(!manualSession||manualKey!==key){
    manualSession=null;manualKey=null;progress('loading-cache');
    const caches=await Promise.allSettled([
     normalized.holdSemantics==='color'?loadColorCache(model.id):Promise.resolve(null),
     normalized.protection==='endpoint'&&normalized.protected.length?loadFullCache(model.id):Promise.resolve(null)
    ]);
    const colorCache=caches[0].status==='fulfilled'?caches[0].value:null,swapCache=caches[1].status==='fulfilled'?caches[1].value:null;
    const {ManualSwapSession}=require('./manual-session.cjs');
    manualSession=new ManualSwapSession(model,normalized,{...options,colorCache,fullCache:swapCache});manualKey=key;
   }
   progress('planning');
   let result=manualSession.advance({budgetMs:options.maxMs,onProgress:search=>self.postMessage({id,type:'progress',stage:'searching',search})});
   if(result.status==='solved'&&(!Array.isArray(result.moveIndices)||result.moveIndices.length>5000||!core.verify(model,normalized,result.moveIndices))){
    result={status:'unknown',reason:'internal_witness_verification_failed',optimal:false,search:{...result.search,canContinue:false,nextBudgetMs:null,terminalReason:'verification_failed'}};manualSession=null;manualKey=null;
   }
   const engineMoves=result.status==='solved'?result.moveIndices.map(i=>({...model.moves[i].engineMove})):[];
   self.postMessage({id,type:'result',result,request,engineMoves,modelFingerprint:modelFingerprint(model.id)});return;
  }
  const request=bridge.requestFromSnapshot(model,message.snapshot,message.selection),normalized=core.normalize(model,request),options=optionsFor(message.options);
  let colorCache,swapCache;
  if(normalized.holdSemantics==='color'||normalized.protected.length){
   progress('loading-cache');
   const caches=await Promise.allSettled([
    normalized.holdSemantics==='color'?loadColorCache(model.id):Promise.resolve(null),
    normalized.protection==='endpoint'&&normalized.protected.length?loadFullCache(model.id):Promise.resolve(null)
   ]);
   if(caches[0].status==='fulfilled')colorCache=caches[0].value;
   if(caches[1].status==='fulfilled')swapCache=caches[1].value;
  }
  progress('planning');
  const key=JSON.stringify([model.id,normalized,options]);let result;
  if(resultCache.has(key)){const value=resultCache.get(key);resultCache.delete(key);resultCache.set(key,value);result={...JSON.parse(value),cacheHit:true};}else{result=core.solveSync(model,request,{...options,colorCache,fullCache:swapCache});cacheResult(key,result);}
  if(result.status==='solved'&&!core.verify(model,normalized,result.moveIndices))result={status:'unknown',reason:'internal_witness_verification_failed',optimal:false};
  const engineMoves=result.status==='solved'?result.moveIndices.map(i=>({...model.moves[i].engineMove})):[];
  self.postMessage({id,type:'result',result,request,engineMoves,modelFingerprint:modelFingerprint(model.id)});
 }catch(e){self.postMessage({id,type:'result',result:{status:'invalid',reason:e.message,optimal:false}});}finally{busy=false;}
};
`;
fs.writeFileSync(path.join(out,'constrained-solver-worker.js'),worker);
const build={schemaVersion:1,backendVersion:JSON.parse(fs.readFileSync(path.join(backend,'package.json'),'utf8')).version,sourceHashes:provenance,adaptations:['Remove Node worker_threads API and Node cache class; keep solveSync unchanged.','Use performance.now() in place of process.hrtime.bigint().','Bound browser resource budgets and use worker termination for cancellation.'],fullSolveCaches:fullCacheHashes,colorSolveCaches:colorCacheHashes,models:modelList};
fs.writeFileSync(path.join(modelDir,'manifest.json'),JSON.stringify(build,null,2)+'\n');
console.log('Generated constrained solver: '+modelList.length+' models, '+modelList.reduce((sum,m)=>sum+m.bytes,0)+' model bytes.');
