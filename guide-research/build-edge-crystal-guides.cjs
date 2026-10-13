'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const H=require('../dist/games/helicopter-engine.js'),C=require('../dist/games/crystal-engine.js');
const parse=s=>s.trim().split(/\s+/).filter(Boolean),inverse=s=>parse(s).reverse().map(t=>t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
const key=(a,mode)=>mode==='pair'?a.slice().sort().join(','):mode==='pairs'?[a.slice(0,2).sort().join(','),a.slice(2,4).sort().join(',')].sort().join(','):mode==='ordered'?a.join(','):[a.join(','),[a[1],a[2],a[0]].join(','),[a[2],a[0],a[1]].join(',')].sort()[0];
const same=(a,b)=>Math.abs(a-b)<1e-6,identity=p=>p.orientation.every((r,i)=>r.every((v,j)=>same(v,Number(i===j))));
function make(type,E){
 const m=E.create(),home=Object.fromEntries(m.pieces.map(p=>[p.name,p])),slot=p=>type==='crystal'?m.pieces[p.slot].name:m.pieces.find(q=>q.home.every((v,i)=>same(v,p.pos[i]))).name;
 const moves=m.configs.flatMap(c=>type==='crystal'?[c.id,c.id+"'"]:[c.id]),perms={};
 for(const t of moves){m.reset();m.applyMove(t);perms[t]=Object.fromEntries(m.pieces.map(p=>[p.name,slot(p)]));}
 const run=s=>{m.reset();parse(s).forEach(t=>m.applyMove(t));return m.pieces.filter(p=>!identity(p));};
 const methods={};
 function add(name,kind,mode,cores,expected){
  const seeds=[];
  for(const core of cores){const changed=run(core).filter(p=>p.kind===kind);let base;
   if(mode==='cycle'){assert.equal(changed.length,3,name);base=[changed[0].name,slot(changed[0])];base.push(slot(m.pieces.find(p=>p.name===base[1])));}
   else if(mode==='ordered'){assert.equal(changed.length,2,name);base=changed.slice().sort((a,b)=>{const sign=p=>E.vector.dot(E.vector.unit(p.home),E.vector.cross(p.stickers[0].normal,E.vector.transform(p.orientation,p.stickers[0].normal)));return sign(a)-sign(b);}).map(p=>p.name);assert(base.every(s=>slot(home[s])===s));}
   else if(mode==='pair')base=changed.map(p=>p.name);
   else {assert.equal(changed.length,4,name);base=[changed[0].name,slot(changed[0])];const p=changed.find(p=>!base.includes(p.name));base.push(p.name,slot(p));}
   assert.equal(base.length,mode==='cycle'?3:mode==='pairs'?4:2,name);
   if(!seeds.some(s=>key(s.base,mode)===key(base,mode)))seeds.push({core,base});
  }
  const paths={},queue=[];
  seeds.forEach((s,i)=>{const k=key(s.base,mode);paths[k]=[i,''];queue.push(s.base);});
  for(let i=0;i<queue.length;i++){const a=queue[i],[seed,p]=paths[key(a,mode)];for(const t of moves){const b=a.map(s=>perms[t][s]),k=key(b,mode);if(paths[k]!==undefined)continue;paths[k]=[seed,(p+' '+t).trim()];queue.push(b);}}
  assert.equal(queue.length,expected,name+' complete coverage');
  methods[name]={kind,mode,slots:m.pieces.filter(p=>p.kind===kind).map(p=>p.name).sort(),seeds,paths};
  console.log(type,name,queue.length,'max setup',Math.max(...Object.values(paths).map(p=>parse(p[1]).length)));
 }
 if(type==='helicopter'){
  const frames=[];const vectors={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]},labels=Object.keys(vectors),v=E.vector;
  for(const u of labels)for(const r of labels)if(v.dot(vectors[u],vectors[r])===0){const f=v.cross(vectors[r],vectors[u]),mapping={U:u,R:r,F:labels.find(k=>vectors[k].every((x,i)=>x===f[i]))};for(const[a,b]of[['U','D'],['R','L'],['F','B']])mapping[b]=labels.find(k=>vectors[k].every((x,i)=>x===-vectors[mapping[a]][i]));frames.push(mapping);}
  const rotateWords=core=>frames.map(map=>parse(core).map(t=>m.normalizeMove([...t].map(c=>map[c]).join('')).face).join(' '));
  add('swap','corner','pair',['UF'],28);
  add('twist','corner','ordered',['UB UR UF UL UF UR'],56);
  add('center','center','cycle',rotateWords('UF FL UL FL UF FL UL FL'),160);
  add('pairs','center','pairs',rotateWords('UF UR UF UR UF UR'),1350);
  const unseen=new Set(methods.center.slots),orbits=[];while(unseen.size){const first=unseen.values().next().value,orbit=[first];unseen.delete(first);for(let i=0;i<orbit.length;i++)for(const t of moves){const n=perms[t][orbit[i]];if(unseen.has(n)){unseen.delete(n);orbit.push(n);}}orbits.push(orbit.sort());}
  assert.deepEqual(orbits.map(o=>o.length),[6,6,6,6]);methods.orbits=orbits;
 }else{
  add('corner','corner','cycle',["A C B C' A' C B' C'"],2280);
  const g="A B' A' B A B' A' B";
  add('twist','corner','ordered',[g+" D "+inverse(g)+" D'"],380);
  add('edge','edge','cycle',["A G' A' G"],8120);
  const q="C' C' F F L' L' C C F' F'";
  add('flip','edge','pair',[q+' A '+inverse(q)+" A'"],435);
 }
 m.reset();return methods;
}
const data={helicopter:make('helicopter',H),crystal:make('crystal',C)};
fs.writeFileSync(path.join(__dirname,'edge-crystal-guide-data.json'),JSON.stringify(data));
if(fs.existsSync(path.join(__dirname,'edge-crystal-guide-template.js')))fs.writeFileSync(path.join(__dirname,'../dist/edge-crystal-guides.js'),fs.readFileSync(path.join(__dirname,'edge-crystal-guide-template.js'),'utf8').replace('/* GENERATED_DATA */',JSON.stringify(data)));
module.exports={data,key,parse,inverse};
