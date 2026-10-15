'use strict';
// Reproducible, fully checked teaching data. Uses the same model/cache as playback.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {identity,compose,inverse}=require('../solver-backend/src/group.cjs');
const {PermutationMembership}=require('../solver-backend/src/permutation-membership.cjs');
function build(){
 const model=JSON.parse(fs.readFileSync(path.join(root,'solver-backend/data/cube2.json'))),cache=JSON.parse(fs.readFileSync(path.join(root,'solver-backend/data/full-solver/cube2.json')));
 const member=new PermutationMembership(model,cache),d=model.degree,I=Array.from(identity(d));
 const evaluate=word=>Array.from(word.reduce((p,j)=>compose(p,model.moves[j].perm),identity(d)));
 const levels=cache.levels.map((l,i)=>({index:i,base:l.base,held:cache.base.slice(0,i),entries:[{image:l.base,word:[],perm:I},...l.entries.map(([image,ref,perm])=>({image,word:member.expand([ref]),perm}))]}));
 for(const l of levels)for(const t of l.entries){assert.deepEqual(evaluate(t.word),t.perm);assert.equal(t.perm[l.base],t.image);assert(l.held.every(b=>t.perm[b]===b));}
 function sift(p,start=0){let r=Array.from(p);for(let k=start;k<levels.length;k++){const l=levels[k],t=l.entries.find(t=>t.image===r[l.base]);if(!t)return false;r=Array.from(compose(r,inverse(t.perm)));}return r.every((x,i)=>x===i);}
 // Union of level transversals is a redundant strong generating set. Verify
 // orbit closure and Schreier closure instead of enumerating configurations.
 let checks=0;
 for(let k=0;k<levels.length;k++){
  const l=levels[k],gens=levels.slice(k).flatMap(x=>x.entries.filter(t=>t.word.length));
  for(const t of l.entries)for(const g of gens){const u=l.entries.find(x=>x.image===g.perm[t.image]);assert(u,'Orbit closure failed');assert(sift(compose(compose(t.perm,g.perm),inverse(u.perm)),k+1),'Schreier closure failed');checks++;}
 }
 for(const m of model.moves)assert(sift(m.perm),'Primitive missing from chain');
 const scrambleNames=['R','U','F2',"D'",'L','B2',"R'",'U2'];
 const scramble=scrambleNames.map(n=>model.moves.findIndex(m=>m.name===n));
 let residual=evaluate(scramble),word=[];const stages=[];
 for(const l of levels){const image=residual[l.base],t=l.entries.find(t=>t.image===image);assert(t);if(!t.word.length)continue;
  const correction=t.word.slice().reverse().map(j=>model.moves[j].inverse),before=residual;
  residual=Array.from(compose(residual,inverse(t.perm)));word.push(...correction);
  stages.push({level:l.index,base:l.base,image,transporter:t.word,correction,correctionPerm:Array.from(inverse(t.perm)),before,after:residual});
 }
 assert.deepEqual(residual,I);assert.deepEqual(evaluate([...scramble,...word]),I);
 const active=levels.filter(l=>l.entries.length>1),order=levels.reduce((p,l)=>p*BigInt(l.entries.length),1n);
 const data={schemaVersion:1,degree:d,convention:'perm[source]=destination; matrix[destination][source]=1; words are in playback order',modelSignature:cache.modelSignature,nodes:model.nodes.map(n=>({index:n.index,id:n.id,face:n.face,color:n.color,center:n.center,normal:n.normal,piece:n.piece})),moves:model.moves.map(m=>({name:m.name,perm:m.perm,inverse:m.inverse,order:m.order})),base:cache.base,levels,order:order.toString(),orientationQuotientOrder:(order/24n).toString(),certificate:{transporterWords:active.reduce((s,l)=>s+l.entries.length-1,0),schreierChecks:checks,primitiveMembershipChecks:model.moves.length,maxRepresentativeLength:Math.max(...levels.flatMap(l=>l.entries.map(t=>t.word.length))),rawSolveLengthBound:active.reduce((s,l)=>s+Math.max(...l.entries.map(t=>t.word.length)),0)},example:{scramble,permutation:evaluate(scramble),solution:word,stages}};
 return data;
}
if(require.main===module){const data=build(),json=JSON.stringify(data);fs.writeFileSync(path.join(root,'dist/cube2-case-data.json'),json+'\n');fs.writeFileSync(path.join(root,'dist/cube2-case-data.js'),'window.Cube2CaseData='+json+';\n');console.log(JSON.stringify({bytes:Buffer.byteLength(json),...data.certificate,order:data.order}));}
module.exports={build};
