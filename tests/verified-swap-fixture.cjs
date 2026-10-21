'use strict';
const assert=require('node:assert/strict');
// Explicit verified-word fixture for UI tests. Production still independently
// verifies the supplied word against the current colors and held locations.
async function offerVerifiedSwap(app,model,a,b,word){
 await app.advance(100);
 const worker=app.workers.findLast(w=>w.request?.task==='eligible-swaps');
 assert(worker,'eligibility request must exist before advertising a witness');
 const d=model.degree,readyPairs=new Uint8Array(Math.ceil(d*d/8)),readyFirstStatus=new Uint8Array(d);
 for(const [x,y]of [[a,b],[b,a]]){const i=x*d+y;readyPairs[i>>>3]|=1<<(i&7);readyFirstStatus[x]=1;}
 const result={status:'partial',degree:d,exemptSwapEndpoints:true,firstStatus:new Uint8Array(d),knownPairs:new Uint8Array(readyPairs.length),feasiblePairs:readyPairs,readyPairs,readyFirstStatus,readyWitnesses:[{word:word.slice(),pairs:[a,b]}]};
 worker.onmessage({data:{id:worker.request.id,type:'result',result,modelFingerprint:app.context.ConstrainedSolverCore.modelFingerprint(model)}});
 await app.advance(0);
}
module.exports={offerVerifiedSwap};
