'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const games=path.resolve(__dirname,'../dist/games');
const script=name=>fs.readFileSync(path.join(games,name),'utf8');

test('core pins its worker to the same generated release at a GitHub project subpath',()=>{
 const c={URL,document:{currentScript:{src:'https://example.test/puzzle-atlas/games/constrained-solver-core.js?v=page'}},globalThis:null};
 c.globalThis=c;vm.createContext(c);vm.runInContext(script('constrained-solver-core.js'),c);
 const core=c.ConstrainedSolverCore,url=new URL(core.workerURL);
 assert.match(core.assetRelease,/^[a-f0-9]{20}$/);
 assert.equal(url.pathname,'/puzzle-atlas/games/constrained-solver-worker.js');
 assert.equal(url.searchParams.get('v'),core.assetRelease);
});

test('a mixed-release worker rejects every task before fetching data or planning moves',async()=>{
 const responses=[];let fetches=0;
 const c={URL,performance,console,location:{href:'https://example.test/puzzle-atlas/games/constrained-solver-worker.js'},postMessage:x=>responses.push(JSON.parse(JSON.stringify(x))),fetch:async()=>{fetches++;throw Error('must not fetch a model for a stale page');}};
 c.self=c;c.globalThis=c;vm.createContext(c);vm.runInContext(script('constrained-solver-worker.js'),c);
 for(const task of ['eligible-swaps','manual-swap','full-solve','guided-solve']){
  await c.onmessage({data:{id:task,task,modelId:'tetraminx',expectedRelease:'stale-tab-release'}});
  const reply=responses.at(-1);
  assert.equal(reply.id,task);assert.equal(reply.type,'result');
  assert.equal(reply.result.status,'unknown');assert.equal(reply.result.reason,'release_mismatch');
  assert.match(reply.result.detail,/reload/i);assert.match(reply.result.detail,/no moves/i);
  assert.match(reply.workerRelease,/^[a-f0-9]{20}$/);
  assert(!reply.engineMoves?.length&&!reply.engineStages?.length);
 }
 assert.equal(fetches,0);
});
