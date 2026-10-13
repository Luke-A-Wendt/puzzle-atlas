#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const E=require('./export-models.cjs');
const {mapSnapshot,requestFromSnapshot}=require('../src/atlas-adapter.cjs');
const root=path.resolve(__dirname,'..'),reports=[];
for(const id of Object.keys(E.names)){
 const model=JSON.parse(fs.readFileSync(path.join(root,'data',id+'.json'))),a=E.loadSnapshot(id),adapter=model.requiresOccupiedState?E.shapeAdapter(a):E.fixedAdapter(a);
 const report=E.validate(a,adapter,model.moves);
 adapter.reset();const solved=adapter.getState().map(s=>JSON.parse(JSON.stringify(s)));
 for(let i=0;i<40;i++)adapter.apply(model.moves[(i*7+3)%model.moves.length].engineMove);
 const snapshot={stickers:adapter.getState()},mapping=mapSnapshot(model,snapshot),expected=adapter.mapping();
 for(let i=0;i<solved.length;i++)if(mapping.stickerToNode[String(solved[i].id)]!==expected[i])throw Error(id+' snapshot node mapping mismatch');
 const request=requestFromSnapshot(model,snapshot,{swapStickerIds:[solved[0].id,solved[1].id],mode:'exact_swap'});
 if(request.protected.length!==model.stickerCount-2)throw Error('Wrong protected physical node count');
 if(model.requiresOccupiedState&&request.protected.length===model.degree-2)throw Error('Empty pose slots accidentally protected');
 if(id==='helicopter'){let rejected=false;try{mapSnapshot(model,{...snapshot,advanced:true});}catch{rejected=true;}if(!rejected)throw Error('Jumble snapshot accepted');}
 reports.push({id,...report,snapshotMappingChecks:40,exactSwapProtectedCount:request.protected.length});
 process.stdout.write(id+' verified\n');
}
const result={schemaVersion:1,models:reports,totalSingleMoveChecks:reports.reduce((s,r)=>s+r.singleMoveChecks,0),totalSequenceSteps:reports.reduce((s,r)=>s+r.sequenceSteps,0),modelsVerified:reports.length};
fs.writeFileSync(path.join(root,'data','validation.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({models:result.modelsVerified,singleMoveChecks:result.totalSingleMoveChecks,sequenceSteps:result.totalSequenceSteps})+'\n');
