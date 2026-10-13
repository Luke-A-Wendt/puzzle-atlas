'use strict';
const fs=require('fs'),path=require('path');
const M=require('./shape-methods.cjs');
const {FACES,vec,slots,pos,slot,rot,parse,inv}=M;
const cores={edge:M.algorithms.edge,corner:M.algorithms.corner,flip:"R D' F D F' D R' D'",twist:M.algorithms.twist};
const base={edge:['UL','UF','UR'],corner:['UFL','DFR','UFR'],flip:['DF','DR'],twist:['UBR','UFR']};
function key(a,method){if(method==='flip')return a.slice().sort().join(',');if(a.length===2)return a.join(',');return[a.join(','),[a[1],a[2],a[0]].join(','),[a[2],a[0],a[1]].join(',')].sort()[0];}
const moves=FACES.flatMap(f=>[f,f+"'",f+'2']);
function moved(s,t){const p=pos(s),v=vec[t[0]],a=v.findIndex(Boolean);return p[a]===v[a]?slot(rot(p,a,-v[a]*(t.endsWith('2')?2:t.endsWith("'")?-1:1))):s;}
const data={};
for(const method of Object.keys(cores)){
 const paths={[key(base[method],method)]:''},queue=[base[method]];
 for(let i=0;i<queue.length;i++){const a=queue[i],p=paths[key(a,method)];for(const t of moves){const b=a.map(s=>moved(s,t)),k=key(b,method);if(paths[k]===undefined){paths[k]=(p+' '+t).trim();queue.push(b);}}}
 data[method]={slots:slots[method==='corner'||method==='twist'?3:2],base:base[method],core:cores[method],paths};
}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
const centers={};
// Three edge cycles return all movable pieces but rotate U clockwise and R
// counterclockwise. A pure R half-turn gives the same clockwise repair at both.
const halfR=parse(M.algorithms.half).map(t=>({U:'R',R:'U',L:'D'}[t[0]])+t.slice(1)).join(' ');
const cw=Array(3).fill(cores.edge).join(' ')+' '+halfR;
for(const u of FACES)for(const r of FACES){if(vec[u].some((x,i)=>x&&vec[r][i]))continue;const f=cross(vec[r],vec[u]);const mapping={U:u,R:r,F:FACES.find(s=>M.eq(vec[s],f))};for(const[a,b]of[['U','D'],['R','L'],['F','B']])mapping[b]=FACES.find(s=>M.eq(vec[s],vec[mapping[a]].map(v=>-v)));
 centers[[u,r].sort().join(',')]=parse(cw).map(t=>mapping[t[0]]+t.slice(1)).join(' ');
}
const halves={};
for(const f of FACES){const adj=FACES.find(s=>vec[f].every((v,i)=>!v||!vec[s][i])),right=vec[adj],up=vec[f],front=cross(right,up),map={U:f,R:adj,F:FACES.find(s=>M.eq(vec[s],front))};for(const[a,b]of[['U','D'],['R','L'],['F','B']])map[b]=FACES.find(s=>M.eq(vec[s],vec[map[a]].map(v=>-v)));halves[f]=parse(M.algorithms.half).map(t=>map[t[0]]+t.slice(1)).join(' ');}
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const a=FACES[i],b=FACES[j],k=[a,b].sort().join(',');if(!centers[k]){const c=FACES.find(s=>s!==a&&s!==b);centers[k]=[centers[[a,c].sort().join(',')],centers[[b,c].sort().join(',')],halves[c]].join(' ');}}
data.center={slots:FACES,pairs:centers,halves};
// A shape-only MasterMorphix repair: one axis center rotates a quarter-turn,
// while equivalent silver edges and flat corners exchange invisibly. Derived
// from the physical model, not a color-mode supercube algorithm.
const E=require('../dist/games/shape-engine.js');
const mirrorCore="R U R' U' R' F R2 U' R' U' R U R' F' L' R2 D' R U' R' D R U R L";
const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
const tetraRotations=E.rotations.filter(m=>tetra.every(n=>{const r=E.vector.transform(m,n);return r[0]*r[1]*r[2]===1;}));
const mirrorSequences={};
for(const f of FACES){const m=tetraRotations.find(m=>M.eq(E.vector.transform(m,vec.U),vec[f]));const mapping=Object.fromEntries(FACES.map(s=>[s,FACES.find(t=>M.eq(E.vector.transform(m,vec[s]),vec[t]))]));mirrorSequences[f]=parse(mirrorCore).map(t=>mapping[t[0]]+t.slice(1)).join(' ');}
data.mirrorCenter={slots:FACES,sequences:mirrorSequences};
const template=fs.readFileSync(path.join(__dirname,'shape-guide-template.js'),'utf8');
fs.writeFileSync(path.join(__dirname,'../dist/shape-guides.js'),template.replace('/* GENERATED_DATA */',JSON.stringify(data)));
console.log(Object.fromEntries(Object.entries(data).map(([k,d])=>[k,d.paths?Object.keys(d.paths).length:Object.keys(d.pairs||d.sequences).length])));
module.exports=data;
