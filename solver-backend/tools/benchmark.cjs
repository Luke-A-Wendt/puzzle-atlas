'use strict';const fs=require('fs'),path=require('path'),os=require('node:os'),{solve}=require('../src/index.cjs');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/manifest.json'))),out=path.join(root,'benchmarks.json');
const budget={maxMs:1200,searchMs:150,maxSearchStates:6000,maxSearchDepth:6,maxOutputMoves:2000};
(async()=>{const resumed=process.argv.includes('--resume')&&fs.existsSync(out),rows=resumed?JSON.parse(fs.readFileSync(out,'utf8')):[];
const envPath=path.join(root,'benchmark-environment.json'),previous=resumed&&fs.existsSync(envPath)?JSON.parse(fs.readFileSync(envPath,'utf8')):{};
const now=new Date().toISOString(),cpus=os.cpus(),environment={...previous,startedAt:previous.startedAt||now,node:process.version,v8:process.versions.v8,platform:process.platform,architecture:process.arch,osRelease:os.release(),cpuModel:cpus[0]?.model||null,logicalCpuCount:cpus.length||null,cpuMetadataNote:cpus.length?undefined:'os.cpus() returned an empty array; hardware CPU model/count are not exposed by this sandbox.',totalSystemMemoryBytes:os.totalmem(),budget,scope:'Deterministic selected smoke tests from solved labeled states; not random or representative workload.',...(resumed?{resumedAt:now,rowsBeforeResume:rows.length}: {})};
fs.writeFileSync(path.join(root,'benchmark-environment.json'),JSON.stringify(environment,null,2)+'\n');
for(const info of manifest.models){
 const model=JSON.parse(fs.readFileSync(path.join(root,'data',info.id+'.json'))),occupied=model.initialOccupied??model.nodes.map((_,i)=>i),occupiedSet=new Set(occupied);
 let pair=null,known=null;
 for(let mi=0;mi<model.moves.length&&!pair;mi++){const p=model.moves[mi].perm;for(const a of occupied){const b=p[a];if(a!==b&&occupiedSet.has(b)&&p[b]===a){pair=[a,b];known=mi;break;}}}
 if(!pair){for(const a of occupied){let b=occupied.find(x=>x!==a&&model.moves.some(m=>m.perm[a]===x));if(b!==undefined){pair=[a,b];break;}}}
 if(!pair)pair=occupied.slice(0,2);
 const protect=occupied.filter(x=>!pair.includes(x)).slice(0,8),requests=[{label:'free',protected:[],swap:pair},{label:'one_protected',protected:protect.slice(0,1),swap:pair},{label:'protected8',protected:protect,swap:pair},{label:'exact_swap',protected:[],swap:pair,mode:'exact_swap'}];
 if(known!==null)requests.push({label:'known_one_move',protected:occupied.filter(x=>model.moves[known].perm[x]===x),swap:pair});
 for(const request of requests){if(rows.some(r=>r.puzzle===info.id&&r.request.label===request.label))continue;const begin=performance.now(),r=await solve(model,{...request,...(model.requiresOccupiedState?{occupiedNodes:occupied}:{})},budget);
 const row={puzzle:info.id,degree:model.degree,moves:model.moves.length,request,wallMs:performance.now()-begin,status:r.status,reason:r.reason,moveCount:r.sequence?.length,optimal:r.optimal,stats:r.stats,moveIndices:r.moveIndices};rows.push(row);fs.writeFileSync(out,JSON.stringify(rows,null,2));console.log(JSON.stringify({puzzle:info.id,query:request.label,status:r.status,moves:r.sequence?.length,optimal:r.optimal,ms:Math.round(row.wallMs),reason:r.reason}));}
}
Object.assign(environment,{finishedAt:new Date().toISOString(),rows:rows.length,resourceMeasurementScope:resumed?'Resume process only, not entire benchmark suite':'Complete benchmark process'});
try{environment.processResourceUsage=process.resourceUsage();}catch(e){environment.resourceUsageUnavailable=e.code||e.message;}
try{environment.finalProcessMemoryUsage=process.memoryUsage();}catch(e){environment.memoryUsageUnavailable=e.code||e.message;}
fs.writeFileSync(path.join(root,'benchmark-environment.json'),JSON.stringify(environment,null,2)+'\n');
})();
