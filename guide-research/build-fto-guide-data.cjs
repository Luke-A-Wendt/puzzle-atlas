'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('../dist/games/fto-engine.js'), model=E.create();
const pieces=model.pieces.map(p=>({id:p.id,name:p.name,kind:p.kind,home:p.home,face:p.stickers[0].face}));
const byName=Object.fromEntries(pieces.map(p=>[p.name,p]));
const keyPos=p=>p.join(',');const byPos=Object.fromEntries(pieces.map(p=>[keyPos(p.home),p]));
const parse=s=>s.split(/\s+/).filter(Boolean).map(t=>({face:t.replace(/[′']/g,''),dir:/[′']/.test(t)?-1:1}));
const format=seq=>seq.map(t=>t.face+(t.dir<0?'′':'')).join(' ');
const inv=seq=>seq.slice().reverse().map(t=>({...t,dir:-t.dir}));
const run=seq=>seq.forEach(t=>model.applyMove(t));
const moves=E.outerConfigs.flatMap(c=>[{face:c.id,dir:1},{face:c.id,dir:-1}]);
const permutation=Object.fromEntries(moves.map(m=>{model.reset();model.applyMove(m);return[format([m]),Object.fromEntries(model.pieces.map(p=>[p.name,byPos[keyPos(p.pos)].name]))]}));
const canonical=(names,pair=false)=>pair?names.slice().sort().join(','):[names.join(','),[names[1],names[2],names[0]].join(','),[names[2],names[0],names[1]].join(',')].sort()[0];
const methods={
 edge:{slots:pieces.filter(p=>p.kind==='edge').map(p=>p.name).sort(),base:['BH','DE','CE'],core:"B' E B",kind:'edge'},
 vertex:{slots:pieces.filter(p=>p.kind==='vertex').map(p=>p.name).sort(),base:['ABGH','ACFH','BCEH'],core:"B A' B' A",kind:'vertex'},
 flip:{slots:pieces.filter(p=>p.kind==='vertex').map(p=>p.name).sort(),base:['ABGH','ACFH'],core:"B' A C' A' C A' B A",kind:'vertex',pair:true},
 centerABCD:{slots:pieces.filter(p=>p.kind==='center'&&/[ABCD]/.test(p.face)).map(p=>p.name).sort(),base:['A1','C2','A3'],core:Array(5).fill("Bm A Bm' A'").join(' '),kind:'center'},
 centerEFGH:{slots:pieces.filter(p=>p.kind==='center'&&/[EFGH]/.test(p.face)).map(p=>p.name).sort(),core:Array(5).fill("Bm E Bm' E'").join(' '),kind:'center'}
};
model.reset();run(parse(methods.centerEFGH.core));
const changed=model.pieces.filter(p=>p.kind==='center'&&keyPos(p.home)!==keyPos(p.pos));
let first=changed[0];methods.centerEFGH.base=[first.name,byPos[keyPos(first.pos)].name];methods.centerEFGH.base.push(byPos[keyPos(model.pieces.find(p=>p.name===methods.centerEFGH.base[1]).pos)].name);
for(const [name,method]of Object.entries(methods)){
 const queue=[canonical(method.base,method.pair)],paths=new Map([[queue[0],[]]]);
 for(let i=0;i<queue.length;i++){
  const k=queue[i],slots=k.split(','),path=paths.get(k);
  for(const move of moves){const label=format([move]),next=canonical(slots.map(s=>permutation[label][s]),method.pair);if(!paths.has(next)){paths.set(next,[...path,move]);queue.push(next);}}
 }
 assert.equal(paths.size,method.pair?15:method.kind==='vertex'?40:440,name+' complete coverage');
 method.paths=Object.fromEntries([...paths].map(([k,path])=>[k,format(path)]));
 method.core=format(parse(method.core));
 if(require.main===module)console.log(name,method.base,'paths',paths.size,'max setup',Math.max(...[...paths.values()].map(a=>a.length)));
}
if(require.main===module){
 const serialized=JSON.stringify(methods);fs.writeFileSync(path.join(__dirname,'fto-guide-data.json'),serialized);
 const template=fs.readFileSync(path.join(__dirname,'fto-guide-template.js'),'utf8');
 fs.writeFileSync(path.join(__dirname,'../dist/fto-guides.js'),template.replace('__FTO_GUIDE_DATA__',serialized));
}
module.exports={E,model,pieces,byName,byPos,keyPos,parse,format,inv,run,canonical,methods};
