'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const games=path.join(__dirname,'../dist/games');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));};
function host(filename='constrained-solver-core.js',options={}){
 const messages=[],timers=new Map();let next=0;
 const read=async url=>({ok:true,status:200,text:async()=>fs.readFileSync(path.join(games,new URL(url).pathname.replace(/^\/games\//,'')),'utf8')});
 const context={URL,performance,TextEncoder,AbortController,console,crypto:webcrypto,
  setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  fetch:options.fetch||read,...options.globals,
  document:{currentScript:{src:'https://atlas.test/games/'+filename}},location:{href:'https://atlas.test/games/'+filename},
  postMessage:message=>messages.push(JSON.parse(JSON.stringify(message)))};
 context.self=context;context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(games,filename),'utf8'),context,{filename});
 return{context,messages,timers,read,expire(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};
}
const homeSnapshot=id=>{const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8'));return{stickers:Object.entries(model.homeBySticker).map(([id,node])=>({id,slot:model.nodes[node].engineSlotId}))};};

test('model asset failures distinguish HTTP, network, verification, and unreadable data',async()=>{
 const cases=[
  {code:'model_http_error',options:{fetch:async()=>({ok:false,status:503})}},
  {code:'model_network_error',options:{fetch:async()=>{throw Error('Offline');}}},
  {code:'model_integrity_unavailable',options:{globals:{crypto:{subtle:{digest:async()=>{throw Error('Digest unsupported');}}}}}},
  {code:'model_integrity_unavailable',options:{globals:{crypto:{subtle:{digest:async()=>{const error=Error('Algorithm not supported');error.name='NotSupportedError';error.code=9;throw error;}}}}}},
  {code:'model_parse_error',options:{globals:{crypto:undefined},fetch:async()=>({ok:true,text:async()=>'{not json'})}},
  {code:'model_integrity_error',options:{fetch:async()=>({ok:true,text:async()=>'{}'})}}
 ];
 for(const {code,options}of cases){const app=host(undefined,options);await assert.rejects(app.context.ConstrainedSolverCore.loadModel('megaminx'),error=>error.code===code,code);assert.equal(app.timers.size,0,code+' clears its watchdog');}
});

test('stalled model fetch and response body time out and abort without poisoning a later retry',async()=>{
 for(const stage of ['fetch','body']){
  let signal,slow=true;
  const app=host(undefined,{fetch:async(url,options)=>{signal=options.signal;if(!slow)return app.read(url);return stage==='fetch'?new Promise(()=>{}):{ok:true,text:()=>new Promise(()=>{})};}});
  const pending=app.context.ConstrainedSolverCore.loadModel('megaminx');await flush();app.expire();
  await assert.rejects(pending,error=>error.code==='model_load_timeout');assert.equal(signal.aborted,true);
  slow=false;const loaded=await app.context.ConstrainedSolverCore.loadModel('megaminx');assert.equal(loaded.id,'megaminx');assert.equal(app.timers.size,0);
 }
});

test('full solve reports ordered asset, planning, and verification stages for Megaminx',async()=>{
 const app=host('constrained-solver-worker.js');
 await app.context.onmessage({data:{id:41,task:'full-solve',modelId:'megaminx',snapshot:homeSnapshot('megaminx')}});
 assert.deepEqual(app.messages.filter(m=>m.type==='progress').map(m=>[m.id,m.stage]),[[41,'loading-model'],[41,'loading-cache'],[41,'planning'],[41,'verifying']]);
 assert.equal(app.messages.at(-1).result.status,'solved');assert.equal(app.timers.size,0);
});

test('cache timeout is reported as a load failure, not a solver compute limit',async()=>{
 let cacheSignal;
 const app=host('constrained-solver-worker.js',{fetch:async(url,options)=>{if(String(url).includes('constrained-solver-caches')){cacheSignal=options.signal;return new Promise(()=>{});}return app.read(url);}});
 const pending=app.context.onmessage({data:{id:42,task:'full-solve',modelId:'megaminx',snapshot:homeSnapshot('megaminx')}});
 for(let i=0;i<100&&!cacheSignal;i++)await flush();assert(cacheSignal,'worker reached cache download');app.expire();await pending;
 const response=app.messages.at(-1);assert.equal(response.type,'result');assert.equal(response.result.status,'unknown');assert.equal(response.result.reason,'cache_load_timeout');assert.match(response.result.detail,/20 seconds/);assert.equal(cacheSignal.aborted,true);
 assert.deepEqual(app.messages.filter(m=>m.type==='progress').map(m=>m.stage),['loading-model','loading-cache']);
});
