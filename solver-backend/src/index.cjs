'use strict';
const {search}=require('./search.cjs');
const crypto=require('node:crypto');
function validateOptions(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('options must be an object');
 const ranges={maxMs:[1,60000],searchMs:[0,60000],memoryMb:[16,256],maxSearchStates:[0,250000],maxSearchDepth:[0,20000],maxStrongGenerators:[0,10000],maxDagNodes:[0,300000],maxOutputMoves:[0,20000],maxOrbitStates:[0,250000],maxSchreierTests:[0,3000000],maxStorageBytes:[0,128*1024*1024],cacheBytes:[0,64*1024*1024]};
 for(const [name,[min,max]] of Object.entries(ranges)){const value=options[name];if(value!==undefined&&(!Number.isSafeInteger(value)||value<min||value>max))throw Error(`${name} must be an integer from ${min} to ${max}`);}
 for(const name of ['group','shorten'])if(options[name]!==undefined&&typeof options[name]!=='boolean')throw Error(`${name} must be boolean`);
 return {...options};
}
function freezeTree(value,seen=new WeakSet()){
 if(!value||typeof value!=='object'||seen.has(value))return value;
 seen.add(value);for(const child of Object.values(value))freezeTree(child,seen);return Object.freeze(value);
}
function normalize(model,request={}){
 if(!model||!Number.isInteger(model.degree)||model.degree<2||model.degree>4096)throw Error('degree must be an integer from 2 to 4096');
 if(model.supported===false||model.fixedPermutation===false)throw Error('model is marked unsupported or does not have fixed move permutations');
 const d=model.degree;if(!Array.isArray(model.moves)||!model.moves.length||model.moves.length>512)throw Error('moves must contain 1 to 512 moves');
 const names=new Set();for(const m of model.moves){if(typeof m.name!=='string'||names.has(m.name))throw Error('move names must be unique strings');names.add(m.name);if(!Array.isArray(m.perm)||m.perm.length!==d||new Set(m.perm).size!==d||m.perm.some(x=>!Number.isInteger(x)||x<0||x>=d))throw Error('invalid source-to-destination permutation');if(m.cost!==undefined&&m.cost!==1)throw Error('only unit move costs are supported');}
 if(model.adapter?.fixedPermutation===false||model.stateDependentLegality===true)throw Error('state-dependent move legality is unsupported');
 const ids=model.nodeIds??Array.from({length:d},(_,i)=>String(i));if(!Array.isArray(ids)||ids.length!==d||ids.some(id=>typeof id!=='string')||new Set(ids).size!==d)throw Error('nodeIds must be unique strings and match degree');
 const node=x=>{const i=typeof x==='number'?x:ids.indexOf(x);if(!Number.isInteger(i)||i<0||i>=d)throw Error('unknown node '+String(x));return i;};
 if(!Array.isArray(request.swap)||request.swap.length!==2)throw Error('swap must contain two nodes');const swap=request.swap.map(node);if(swap[0]===swap[1])throw Error('swap nodes must differ');
 if(request.protected!==undefined&&!Array.isArray(request.protected))throw Error('protected must be an array');
 let occupied;
 if(model.requiresOccupiedState||model.adapter?.requiresOccupiedState){
  if(!Array.isArray(request.occupiedNodes))throw Error('this geometric model requires occupiedNodes from a current engine snapshot');
  occupied=request.occupiedNodes.map(node);
  if(new Set(occupied).size!==occupied.length)throw Error('occupiedNodes must not contain duplicate pose addresses');
  occupied.sort((a,b)=>a-b);
  if(occupied.length!==(model.stickerCount??model.adapter.stickerCount))throw Error('occupiedNodes count must equal physical sticker count');
  if(swap.some(i=>!occupied.includes(i))||(request.protected??[]).map(node).some(i=>!occupied.includes(i)))throw Error('selected nodes must be occupied in the current snapshot');
 }
 const protection=request.protection??'endpoint';if(!['endpoint','throughout'].includes(protection))throw Error('protection must be endpoint or throughout');
 const mode=request.mode??'protected_swap';if(!['protected_swap','exact_swap'].includes(mode))throw Error('mode must be protected_swap or exact_swap');
 let protect=[...new Set((request.protected??[]).map(node))];if(swap.some(x=>protect.includes(x)))throw Error('swap nodes cannot be protected');
 if(mode==='exact_swap')protect=(occupied??Array.from({length:d},(_,i)=>i)).filter(i=>!swap.includes(i));protect.sort((a,b)=>a-b);
 return {protected:protect,swap,mode,protection,...(occupied?{occupiedNodes:occupied}:{})};
}
function permutation(model,indices){let p=Array.from({length:model.degree},(_,i)=>i);for(const i of indices){if(!Number.isInteger(i)||!model.moves[i])throw Error('invalid witness move');const q=model.moves[i].perm;p=p.map(v=>q[v]);}return p;}
function verify(model,req,indices){const p=permutation(model,indices),ok=p[req.swap[0]]===req.swap[1]&&p[req.swap[1]]===req.swap[0]&&req.protected.every(x=>p[x]===x);if(!ok)return false;if(req.protection==='throughout'&&indices.some(i=>req.protected.some(x=>model.moves[i].perm[x]!==x)))return false;return true;}
function finish(model,req,result,t,maxOutputMoves=5000){
 // Internal group engines may retain a legacy moves alias. Never publish a
 // second sequence that could be stale after index remapping or shortening.
 const {moves:legacyMoves,...clean}=result;result=clean;
 if(result.status==='solved'&&result.moveIndices.length>maxOutputMoves)result={status:'unknown',reason:'output_limit',optimal:false,requiredMoves:result.moveIndices.length,lowerBound:result.lowerBound,stats:result.stats};
 const stats={...result.stats,totalMs:performance.now()-t};
 const occupancy=req.occupiedNodes?{occupiedNodes:req.occupiedNodes}:{};
 if(result.optimal===undefined)result.optimal=false;
 if(result.status!=='solved')return {...result,protected:req.protected,swap:req.swap,mode:req.mode,protection:req.protection,...occupancy,stats};
 if(!verify(model,req,result.moveIndices))return {status:'unknown',reason:'internal_witness_verification_failed',optimal:false,stats};
 const p=permutation(model,result.moveIndices),allChanged=p.map((v,i)=>v!==i?i:-1).filter(i=>i>=0),occupiedSet=req.occupiedNodes?new Set(req.occupiedNodes):null,changed=occupiedSet?allChanged.filter(i=>occupiedSet.has(i)):allChanged;
 return {...result,sequence:result.moveIndices.map(i=>model.moves[i].name),permutation:p,changedNodes:changed,collateralNodes:changed.filter(i=>!req.swap.includes(i)),...(occupiedSet?{allChangedPoseAddresses:allChanged}:{}),protected:req.protected,swap:req.swap,mode:req.mode,protection:req.protection,...occupancy,verified:true,stats};
}
function solveSync(model,request,options={}){
 const t=performance.now();let req;try{options=validateOptions(options);req=normalize(model,request);}catch(e){return {status:'invalid',reason:e.message,optimal:false};}
 const maxMs=options.maxMs??3000,budget={maxMs,maxStrongGenerators:options.maxStrongGenerators??2000,maxDagNodes:options.maxDagNodes??100000,maxOutputMoves:options.maxOutputMoves??5000,maxOrbitStates:options.maxOrbitStates??100000,maxSchreierTests:options.maxSchreierTests??3000000,maxStorageBytes:options.maxStorageBytes??64*1024*1024};
 const done=result=>finish(model,req,result,t,budget.maxOutputMoves);
 let working=model,map=model.moves.map((_,i)=>i);
 if(req.protection==='throughout'){
  map=map.filter(i=>req.protected.every(x=>model.moves[i].perm[x]===x));working={...model,moves:map.map(i=>model.moves[i])};
  if(!map.length)return done({status:'impossible',optimal:false,reason:'no_move_preserves_protected_nodes_at_each_step'});
 }
 let r=search(working,req.protected,req.swap,{maxMs:Math.min(maxMs,options.searchMs??500),maxStates:Math.min(250000,options.maxSearchStates??25000),maxDepth:options.maxSearchDepth??12,maxBytes:Math.min(32*1024*1024,options.maxStorageBytes??32*1024*1024)});
 if(r.status==='solved')r.moveIndices=r.moveIndices.map(i=>map[i]);
 if(r.status!=='unknown'||options.group===false)return done(r);
 const remaining=maxMs-(performance.now()-t);if(remaining<=0)return done({...r,reason:'request_time_limit'});
 try{
  const {solveGroup}=require('./group.cjs');const g=solveGroup({model:working,protected:req.protected,swap:req.swap,budget:{...budget,maxMs:remaining}});
  if(g.status==='solved'){g.moveIndices=g.moveIndices.map(i=>map[i]);g.optimal=Boolean(g.optimal);g.lowerBound=r.lowerBound;
   if(!g.optimal&&options.shorten!==false&&req.protection!=='throughout'){const left=maxMs-(performance.now()-t);if(left>10){const short=require('./shorten.cjs').shorten(model,g.moveIndices,{maxMs:Math.min(150,left)});g.moveIndices=short.moveIndices;g.stats={...g.stats,shortening:short.shortenedBy};}}
   if(g.moveIndices.length===r.lowerBound)g.optimal=true;
  }
  g.stats={...g.stats,shortSearch:r.stats};return done(g);
 }catch(e){return done({status:'unknown',reason:'group_backend_error',detail:e.message,optimal:false,stats:{shortSearch:r.stats}});}
}
function solve(model,request,options={}){
 try{options=validateOptions(options);normalize(model,request);}catch(e){return Promise.resolve({status:'invalid',reason:e.message,optimal:false});}
 const {Worker}=require('node:worker_threads');return new Promise(resolve=>{
  const maxMs=options.maxMs??3000;let settled=false,worker;
  try{worker=new Worker(require.resolve('./worker.cjs'),{workerData:{model,request,options},resourceLimits:{maxOldGenerationSizeMb:options.memoryMb??192,maxYoungGenerationSizeMb:16}});}catch(e){resolve({status:'invalid',reason:'worker_input_or_configuration_error',detail:e.message,optimal:false});return;}
  const done=r=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(r);};
  const timer=setTimeout(()=>done({status:'unknown',reason:'worker_time_limit',optimal:false}),maxMs+500);
  worker.once('message',done);worker.once('error',e=>done({status:'unknown',reason:'worker_resource_or_runtime_error',detail:e.message,optimal:false}));worker.once('exit',code=>{if(!settled)done({status:'unknown',reason:'worker_exited',detail:String(code),optimal:false});});
 });
}
class Solver{
 constructor(model,options={}){options=validateOptions(options);const snapshot=freezeTree(structuredClone(model));Object.defineProperty(this,'model',{value:snapshot,enumerable:true});Object.defineProperty(this,'options',{value:freezeTree(structuredClone(options)),enumerable:true});this.cache=new Map();this.bytes=0;this.maxBytes=options.cacheBytes??8*1024*1024;this.fingerprint=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');}
 async solve(request,options={}){let req,effective;try{validateOptions(options);effective=validateOptions({...this.options,...options});req=normalize(this.model,request);}catch(e){return {status:'invalid',reason:e.message,optimal:false};}
  const key=JSON.stringify({request:req,options:effective}),prior=this.cache.get(key);if(prior){this.cache.delete(key);this.cache.set(key,prior);return {...JSON.parse(prior),cacheHit:true};}
  const result=await solve(this.model,req,effective);if(['solved','impossible'].includes(result.status)){const s=JSON.stringify(result),bytes=Buffer.byteLength(s);if(bytes<=this.maxBytes){while(this.bytes+bytes>this.maxBytes&&this.cache.size){const k=this.cache.keys().next().value;this.bytes-=Buffer.byteLength(this.cache.get(k));this.cache.delete(k);}this.cache.set(key,s);this.bytes+=bytes;}}
  return result;
 }
}
// Pure preview/execution on a caller-owned array. Does not touch any website.
function applySequence(model,values,moveIndices){if(values.length!==model.degree)throw Error('state length does not match degree');let state=values.slice();for(const i of moveIndices){if(!model.moves[i])throw Error('unknown move index');const next=new Array(model.degree);model.moves[i].perm.forEach((to,from)=>next[to]=state[from]);state=next;}return state;}
module.exports={solve,solveSync,Solver,normalize,verify,permutation,applySequence,validateOptions};
