'use strict';
const fs=require('fs');
const FACES=['U','R','F','D','L','B'];
const vec={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
const slot=p=>(p[1]?(p[1]>0?'U':'D'):'')+(p[2]?(p[2]>0?'F':'B'):'')+(p[0]?(p[0]>0?'R':'L'):'');
const rank=s=>s.length;
const slots=Object.fromEntries([1,2,3].map(n=>[n,[-1,0,1].flatMap(x=>[-1,0,1].flatMap(y=>[-1,0,1].map(z=>[x,y,z]))).filter(p=>p.filter(Boolean).length===n).map(slot)]));
const pos=s=>s.split('').reduce((p,f)=>p.map((x,i)=>x+vec[f][i]),[0,0,0]);
const eq=(a,b)=>a.every((v,i)=>v===b[i]);
function rot(v,axis,t){let [x,y,z]=v;for(let i=0;i<(t%4+4)%4;i++){if(axis===0)[y,z]=[-z,y];else if(axis===1)[x,z]=[z,-x];else [x,y]=[-y,x];}return[x||0,y||0,z||0];}
const parse=s=>s.trim().split(/\s+/).filter(Boolean);
const inv=s=>parse(s).reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
function model(){return Object.values(slots).flat().map(id=>({id,p:pos(id),n:{U:vec.U.slice(),R:vec.R.slice(),F:vec.F.slice()}}));}
function run(c,s){for(const t of parse(s)){const f=t[0],v=vec[f],a=v.findIndex(Boolean),q=-v[a]*(t.endsWith('2')?2:t.endsWith("'")?-1:1);for(const p of c)if(p.p[a]===v[a]){p.p=rot(p.p,a,q);for(const n in p.n)p.n[n]=rot(p.n[n],a,q);}}return c;}
function eff(s){return run(model(),s).filter(p=>!eq(p.p,pos(p.id))||Object.keys(p.n).some(k=>!eq(p.n[k],vec[k]))).map(p=>({home:p.id,slot:slot(p.p),n:p.n}));}
const algorithms={edge:"R U' R U R U R U' R' U' R2",corner:"R' D' R U' R' D R U",flip:"R U R' U' R' F R F'",twist:"R' D' R D R' D' R D U D' R' D R D' R' D R U'",half:"R L U2 R' L' U R L U2 R' L' U",T:"R U R' U' R' F R2 U' R' U' R U R' F'"};
if(require.main===module)for(const[k,s]of Object.entries(algorithms))console.log(k,s,JSON.stringify(eff(s)));
module.exports={FACES,vec,slots,pos,slot,eq,rot,parse,inv,model,run,eff,algorithms};
