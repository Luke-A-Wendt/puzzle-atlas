'use strict';
// Build-time only. Executes the shipped Auto Solve worker and each real engine,
// without a move journal or network. Never runs while someone visits the atlas.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),games=path.join(root,'dist/games');
const plain=x=>JSON.parse(JSON.stringify(x));
const seeds=['ATLAS-2026-EASY-17','ATLAS-2026-MEDIUM-83','ATLAS-2026-HARD-269'];
const thresholds={easyMax:100,mediumMax:300};
function sha(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function engineFor(id){
 const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'),'utf8')),spec=model.adapter.source;
 const context={CUBE_SIZE:Number(id.slice(4))};context.window=context;vm.createContext(context);
 let code=fs.readFileSync(path.join(games,path.basename(spec.file)),'utf8');
 if(spec.file.endsWith('.html'))code=[...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>new RegExp('root\\.'+spec.rootName+'\\s*=').test(s));
 assert(code,'Missing engine '+id);vm.runInContext(code,context,{filename:spec.file});
 const E=context[spec.rootName],M=spec.kind==='model'?E.create(id):null;let state=M?M.stickerState:E.makeSolved();
 const html=fs.readFileSync(path.join(games,id+'.html'),'utf8');
 const app=[...html.matchAll(/<script\b[^>]*src="([^"?]+)(?:\?[^"]*)?"[^>]*>/gi)].map(m=>m[1]).find(src=>src.endsWith('-app.js'));
 const appSource=app?fs.readFileSync(path.join(games,app),'utf8'):html;
 const randomize=appSource.match(/function randomize\(\)[\s\S]*?\.scramble\(seed,(\d+|SCRAMBLE_LENGTH)\)/);
 assert(randomize,'Randomize definition unavailable '+id);
 const expression=randomize[1]==='SCRAMBLE_LENGTH'?appSource.match(/const SCRAMBLE_LENGTH\s*=\s*([^;]+);/)?.[1]:randomize[1];
 assert(expression,'Scramble length unavailable '+id);
 const count=vm.runInNewContext(expression,{N:Number(id.slice(4)),type:id});
 assert(Number.isInteger(count)&&count>0&&count<1000,'Invalid scramble length '+id);
 return {model,get:()=>plain(M?M.stickerState:state),scramble:seed=>(M||E).scramble(seed,count),isSolved:()=>M?M.isSolved():E.isSolved(state),apply:move=>{if(M)M.applyMove(move);else state=E.applyMove(state,move);}};
}
function worker(){
 const responses=[],context={URL,performance,TextEncoder,crypto:webcrypto,console,fetch:async url=>{
  const parsed=new URL(url);assert.equal(parsed.origin,'https://atlas.test','Unexpected remote access');
  const file=path.resolve(games,parsed.pathname.replace(/^\/games\//,''));assert(file.startsWith(games+path.sep),'Asset path escapes games');
  const content=fs.readFileSync(file,'utf8');return {ok:true,text:async()=>content};
 }};
 context.location={href:'https://atlas.test/games/constrained-solver-worker.js'};context.self=context;context.globalThis=context;
 context.postMessage=data=>responses.push(plain(data));vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(games,'constrained-solver-worker.js'),'utf8'),context,{filename:'constrained-solver-worker.js'});
 return {send:async message=>{responses.length=0;await context.onmessage({data:plain(message)});return responses.at(-1);}};
}
async function main(){
 const ids=fs.readdirSync(path.join(games,'constrained-solver-models')).filter(name=>name.endsWith('.json')&&!['manifest.json','homer.json'].includes(name)).map(name=>name.slice(0,-5)).sort();
 assert.equal(ids.length,36,'Visible atlas puzzle count');
 const report={schemaVersion:1,methodology:{metric:'verified Auto Solve move count',samplesPerPuzzle:seeds.length,seeds,scramble:'Each real game Randomize generator, with its normal length, starting solved; the move journal is discarded before solving.',counting:'One returned legal solver move is one step. A half-turn counts as one move when it is a single legal move in the puzzle vocabulary.',interpretation:'An estimate of effort for this website\u2019s solver, not a proven shortest solution or a universal measure of human difficulty. Mirror mode is presented separately as Very Hard.',optimal:false,solverBudgetMs:15000,colorOptimizerBudgetMs:250,reproducibility:'Scramble inputs are deterministic. The existing solver uses time-bounded optimization, so recomputing on a different device may produce slightly different valid move counts.',thresholds,workerSha256:sha(path.join(games,'constrained-solver-worker.js'))},puzzles:{}};
 const service=worker();
 for(const id of ids){
  const samples=[];
  for(const seed of seeds){
   const engine=engineFor(id),scramble=engine.scramble(seed);scramble.forEach(engine.apply);
   const snapshot={stickers:engine.get(),history:[]};
   const reply=await service.send({task:'full-solve',id:id+'-'+seed,modelId:id,snapshot});
   assert.equal(reply?.result?.status,'solved',id+': '+JSON.stringify(reply?.result));
   assert(reply.engineStages,'Missing verified worker plan '+id);
   let count=0;for(const stage of reply.engineStages)for(const move of stage.engineMoves){engine.apply(move);count++;}
   assert.equal(count,reply.result.moveIndices.length,id+' plan length mismatch');
   assert.equal(engine.isSolved(),true,id+' actual engine endpoint is not solved');
   samples.push({seed,scrambleMoves:scramble.length,solveMoves:count,stages:reply.engineStages.length,verified:true,engineSolved:true});
  }
  const sum=samples.reduce((s,sample)=>s+sample.solveMoves,0),mean=sum/samples.length;
  const entry={difficulty:mean<=thresholds.easyMax?'Easy':mean<=thresholds.mediumMax?'Medium':'Hard',averageMoves:Math.round(mean*10)/10,minMoves:Math.min(...samples.map(s=>s.solveMoves)),maxMoves:Math.max(...samples.map(s=>s.solveMoves)),samples};
  report.puzzles[id]=entry;process.stdout.write(`${id}: ${entry.difficulty}, ${entry.averageMoves} moves (${entry.minMoves}\u2013${entry.maxMoves})\n`);
 }
 const destination=path.resolve(process.argv[2]||path.join(root,'dist/atlas-difficulty.json'));
 fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
 process.stdout.write(`Saved ${ids.length} puzzles, ${ids.length*seeds.length} independently replayed solutions.\n`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
