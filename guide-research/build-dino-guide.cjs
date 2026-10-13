'use strict';
const fs=require('fs'),path=require('path'),E=require('../dist/games/dino-engine.js');
const model=E.create('dino'),slots=model.pieces.filter(p=>p.kind==='edge').map(p=>E.positionName(p.home));
const core=model.configs[0].id,moved=model.movingPieces(core),first=model.pieces.find(p=>p.id===moved[0]);
model.applyMove(core);const from=E.positionName(first.home),to=E.positionName(first.pos),third=E.positionName(model.pieces.find(p=>E.positionName(p.home)===to).pos),base=[from,to,third];
const canonical=s=>[s.join(','),[s[1],s[2],s[0]].join(','),[s[2],s[0],s[1]].join(',')].sort()[0];
const moves=model.configs.flatMap(c=>[c.id,c.id+"'"]),permutations={};
for(const t of moves){model.reset();model.applyMove(t);permutations[t]=Object.fromEntries(model.pieces.filter(p=>p.kind==='edge').map(p=>[E.positionName(p.home),E.positionName(p.pos)]));}
const paths={[canonical(base)]:''},queue=[base];
for(let i=0;i<queue.length;i++)for(const t of moves){const next=queue[i].map(s=>permutations[t][s]),key=canonical(next);if(paths[key]!==undefined)continue;paths[key]=(paths[canonical(queue[i])]+' '+t).trim();queue.push(next);}
if(queue.length!==440)throw new Error('Incomplete triple orbit: '+queue.length);
const data={slots,base,core,paths,axes:model.configs.map(c=>({id:c.id,name:c.name}))};
const template=fs.readFileSync(path.join(__dirname,'dino-guide-template.js'),'utf8');
fs.writeFileSync(path.join(__dirname,'../dist/dino-guides.js'),template.replace('/* GENERATED_DATA */',JSON.stringify(data)));
console.log('Built '+queue.length+' exact Dino/Rainbow three-piece cycles.');
