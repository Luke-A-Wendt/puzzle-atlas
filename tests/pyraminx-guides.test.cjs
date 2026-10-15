'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dist/games/pyraminx.html'),'utf8'),src=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('root.TetraEngine'));const ctx={window:{}};vm.createContext(ctx);vm.runInContext(src,ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/poly-guides.js'),'utf8'),ctx);
const E=ctx.TetraEngine,S=E.makeSolved(),guide=ctx.window.POLY_GUIDES.pyraminx,parse=s=>s.trim().split(/\s+/).filter(Boolean).map(t=>({face:t[0],dir:/['′]/.test(t)?-1:1})),run=(s,a)=>parse(a).reduce((s,m)=>E.applyMove(s,m),s),good=q=>q.color===S[q.slot].color;
const solvedPiece=(s,id)=>s.filter(q=>E.slots[q.slot].pieceId===id).every(good),codes=step=>Array.from(step.body.matchAll(/<code>([^<]+)<\/code>/g),m=>m[1]);
test('Pyraminx published tip/base/final-edge stages solve 100 independent scrambles',()=>{
 const inserts={eLR:["R U' R'","L' U L"],eBL:["L U' L'","B' U B"],eBR:["B U' B'","R' U R"]},cycles=codes(guide.steps[3]),flips=codes(guide.steps[4]);
 for(let trial=0;trial<100;trial++){
  let s=E.scramble('pyraminx-guide-'+trial,30).reduce((a,m)=>E.applyMove(a,m),S);
  for(const v of ['U','L','R','B']){const matched=()=>s.filter(q=>E.slots[q.slot].pieceId==='t'+v).every(q=>q.color===s.find(x=>E.slots[x.slot].pieceId==='c'+v&&E.slots[x.slot].face===E.slots[q.slot].face)?.color);let n=0;while(!matched()){assert(++n<=2);s=E.applyMove(s,{face:v.toLowerCase(),dir:1});}}
  for(const v of ['L','R','B']){let n=0;while(!solvedPiece(s,'c'+v)){assert(++n<=2);s=E.applyMove(s,{face:v,dir:1});}}
  const done=[];
  for(const[target,choices]of Object.entries(inserts)){
   for(let attempt=0;attempt<3&&!solvedPiece(s,target);attempt++){
    let found=null;for(let u=0;u<3;u++){for(const a of choices){const next=run(s,a);if(solvedPiece(next,target)&&done.every(id=>solvedPiece(next,id))){found=next;break;}}if(found)break;s=E.applyMove(s,{face:'U',dir:1});}if(found){s=found;break;}
    const needed=S.filter(q=>E.slots[q.id].pieceId===target).map(q=>q.id),where=E.slots[s.find(q=>q.id===needed[0]).slot].pieceId;assert(inserts[where]);s=run(s,inserts[where][0]);
   }
   assert(solvedPiece(s,target));done.push(target);
  }
  let n=0;while(!solvedPiece(s,'cU')){assert(++n<=2);s=E.applyMove(s,{face:'U',dir:1});}
  const edgePlaced=q=>E.slots[q.slot].pieceId===E.slots[q.id].pieceId;if(!s.filter(q=>E.slots[q.id].kind==='edge').every(edgePlaced)){s=cycles.map(a=>run(s,a)).find(state=>state.filter(q=>E.slots[q.id].kind==='edge').every(edgePlaced));assert(s);}
  if(!s.every(good)){s=flips.map(a=>run(s,a)).find(state=>state.every(good));assert(s);}
  assert(E.isSolved(s),'full Pyraminx guide '+trial);
 }
});
