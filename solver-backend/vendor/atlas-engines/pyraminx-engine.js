
/* Pyraminx: exact sticker permutations and rigid convex pieces.
   Main U/L/R/B turns carry the adjacent tip; lowercase moves turn only the tip.
   Positive direction is clockwise viewed from the chosen vertex toward the core. */
(function(root){
'use strict';
const TAU=Math.PI*2,RADIUS=1.6,EPS=1e-9;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=a=>mul(a,1/length(a)),distance=(a,b)=>length(sub(a,b)),avg=ps=>ps.reduce((a,b)=>add(a,mul(b,1/ps.length)),[0,0,0]);
function rotate(p,n,a){const c=Math.cos(a),s=Math.sin(a);return add(add(mul(p,c),mul(cross(n,p),s)),mul(n,dot(n,p)*(1-c)));}
const labels=['U','L','R','B'],names=['Upper','Left','Right','Back'];
const directions=[[0,1,0],[-Math.sqrt(2/3),-1/3,Math.sqrt(2)/3],[Math.sqrt(2/3),-1/3,Math.sqrt(2)/3],[0,-1/3,-2*Math.sqrt(2)/3]];
const vertices=labels.map((id,i)=>({id,index:i,name:names[i],normal:directions[i],p:mul(directions[i],RADIUS)}));
const byVertex=Object.fromEntries(vertices.map(v=>[v.id,v]));
const colors={U:'#f4ce48',L:'#4c90ef',R:'#ee596e',B:'#39bd8b'};
const colorNames={U:'Yellow',L:'Blue',R:'Red',B:'Green'};
function orient(poly,n){return dot(cross(sub(poly[1],poly[0]),sub(poly[2],poly[1])),n)<0?poly.slice().reverse():poly;}
const faces=vertices.map(v=>{const normal=mul(v.normal,-1);return{id:v.id,name:colorNames[v.id],color:colors[v.id],normal,vertices:orient(vertices.filter(q=>q.id!==v.id).map(q=>q.p),normal)};});
const faceById=Object.fromEntries(faces.map(f=>[f.id,f]));
function lambda(p,v){return(1+3*dot(v.normal,p)/RADIUS)/4;}
const slots=[];
for(const face of faces){
 const fv=vertices.filter(v=>v.id!==face.id);
 function point(w){return w.reduce((p,v,i)=>add(p,mul(fv[i].p,v/3)),[0,0,0]);}
 function tile(weights){const poly=orient(weights.map(point),face.normal),p=avg(poly),axes=vertices.filter(v=>lambda(p,v)>1/3+1e-7).map(v=>v.id);const tip=vertices.find(v=>lambda(p,v)>2/3+1e-7);const kind=tip?'tip':axes.length===2?'edge':'center',pieceId=(tip?'t':kind==='center'?'c':'e')+axes.slice().sort().join('');slots.push({id:slots.length,face:face.id,normal:face.normal,p,regionPolygon:poly,polygon:poly.map(q=>add(p,mul(sub(q,p),.87))),axes,kind,pieceId});}
 for(let i=0;i<=2;i++)for(let j=0;j<=2-i;j++){const k=2-i-j;tile([[i+1,j,k],[i,j+1,k],[i,j,k+1]]);}
 for(let i=0;i<=1;i++)for(let j=0;j<=1-i;j++){const k=1-i-j;tile([[i,j+1,k+1],[i+1,j,k+1],[i+1,j+1,k]]);}
}
const configs={};for(const v of vertices){configs[v.id]={face:v.id,vertex:v.id,normal:v.normal,tip:false,label:v.name+' layer'};configs[v.id.toLowerCase()]={face:v.id.toLowerCase(),vertex:v.id,normal:v.normal,tip:true,label:v.name+' tip'};}
function normalizeMove(m){if(typeof m==='string'){const match=/^([ULRBulrb])([2]?)(['′’]?)$/.exec(m.trim());if(!match)throw Error('Invalid Pyraminx move');m={face:match[1],turns:match[2]?2:1,dir:match[3]?-1:1};}if(!m||!configs[m.face])throw Error('Invalid Pyraminx move');const dir=m.dir===undefined?1:m.dir,turns=m.turns===undefined?1:m.turns;if(![-1,1].includes(dir)||![1,2].includes(turns))throw Error('Invalid turn');return{face:m.face,dir,turns};}
function slotSelected(slot,cfg){return slot.axes.includes(cfg.vertex)&&(!cfg.tip||slot.kind==='tip');}
const permutations={};for(const cfg of Object.values(configs)){permutations[cfg.face]=slots.map(s=>{if(!slotSelected(s,cfg))return s.id;const p=rotate(s.p,cfg.normal,-TAU/3),n=rotate(s.normal,cfg.normal,-TAU/3);let best=Infinity,id=-1;for(const t of slots){const d=distance(t.p,p)+distance(t.normal,n);if(d<best){best=d;id=t.id;}}if(best>1e-7)throw Error('Invalid Pyraminx permutation');return id;});if(new Set(permutations[cfg.face]).size!==36)throw Error('Non-bijective move');}
// Store orientations as one of the tetrahedron's twelve exact rotation states.
const orientations=[[[1,0,0],[0,1,0],[0,0,1]]];
const frameDistance=(a,b)=>Math.max(...a.flatMap((v,i)=>v.map((x,j)=>Math.abs(x-b[i][j]))));
function findFrame(f){return orientations.findIndex(o=>frameDistance(o,f)<1e-8);}
for(let i=0;i<orientations.length;i++)for(const v of vertices){const f=orientations[i].map(p=>rotate(p,v.normal,-TAU/3));if(findFrame(f)<0)orientations.push(f);if(orientations.length>12)throw Error('Invalid orientation group');}
const orientationTurns={};for(const v of vertices)orientationTurns[v.id]=orientations.map(f=>findFrame(f.map(p=>rotate(p,v.normal,-TAU/3))));
const transform=(p,ori)=>[0,1,2].map(a=>p.reduce((s,v,i)=>s+v*orientations[ori][i][a],0));
function makeSolved(){return slots.map(s=>({id:s.id,slot:s.id,color:colors[s.face],ori:0}));}
function selected(s,m){return slotSelected(slots[s.slot],configs[normalizeMove(m).face]);}
function applyMove(state,m){m=normalizeMove(m);const cfg=configs[m.face],count=((m.dir*m.turns)%3+3)%3,map=permutations[m.face];return state.map(s=>{if(!slotSelected(slots[s.slot],cfg))return{...s};let slot=s.slot,ori=s.ori;for(let i=0;i<count;i++){slot=map[slot];ori=orientationTurns[cfg.vertex][ori];}return{id:s.id,slot,color:s.color,ori};});}
function invertMove(m){m=normalizeMove(m);return{...m,dir:-m.dir};}
function moveLabel(m){m=normalizeMove(m);return m.face+(m.turns===2?'2':'')+(m.dir<0?'′':'');}
function isSolved(state){if(!Array.isArray(state)||state.length!==36)return false;const groups=new Map();for(const s of state){const slot=slots[s.slot];if(!slot)return false;if(!groups.has(slot.face))groups.set(slot.face,new Set());groups.get(slot.face).add(s.color);}return groups.size===4&&[...groups.values()].every(g=>g.size===1);}
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function scramble(seed,count=20){const rnd=seededRandom(seed),moves=[];let prev='';for(let i=0;i<count;i++){const options=labels.filter(v=>v!==prev),face=options[Math.floor(rnd()*options.length)];moves.push({face,dir:rnd()<.5?-1:1,turns:1});prev=face;}for(const v of labels)moves.push({face:v.toLowerCase(),dir:rnd()<.5?-1:1,turns:1});return moves;}
function clean(poly){const out=[];for(const p of poly)if(!out.length||distance(p,out[out.length-1])>1e-8)out.push(p);if(out.length>1&&distance(out[0],out[out.length-1])<1e-8)out.pop();return out;}
function clipSolid(mesh,n,d){
 const distances=mesh.flatMap(f=>f.points.map(p=>dot(n,p)-d));if(distances.every(v=>v<=EPS))return mesh;
 const result=[],cap=[];function addCap(p){if(!cap.some(v=>distance(v,p)<1e-8))cap.push(p);}
 for(const face of mesh){const out=[];for(let i=0;i<face.points.length;i++){const a=face.points[i],b=face.points[(i+1)%face.points.length],da=dot(n,a)-d,db=dot(n,b)-d;
  if(da<=EPS){out.push(a);if(Math.abs(da)<=EPS)addCap(a);}
  if((da>EPS)!==(db>EPS)){const p=add(a,mul(sub(b,a),da/(da-db)));out.push(p);addCap(p);}}
  const points=clean(out);if(points.length>=3)result.push({...face,points});}
 if(cap.length>=3){const center=avg(cap),ref=Math.abs(n[0])<.8?[1,0,0]:[0,1,0],u=unit(cross(ref,n)),v=cross(n,u);cap.sort((a,b)=>Math.atan2(dot(sub(a,center),v),dot(sub(a,center),u))-Math.atan2(dot(sub(b,center),v),dot(sub(b,center),u)));result.push({points:cap,normal:n,face:null});}return result;
}
const base=faces.map(f=>({face:f.id,normal:f.normal,points:f.vertices}));
const homePieces=[];for(const pieceId of new Set(slots.map(s=>s.pieceId))){const samples=slots.filter(s=>s.pieceId===pieceId),sample=samples[0];let mesh=base;const constraints=[];
 if(sample.kind==='tip'){const v=byVertex[sample.axes[0]];constraints.push({n:mul(v.normal,-1),d:-RADIUS*5/9});}
 else{for(const v of vertices){const high=sample.axes.includes(v.id);constraints.push({n:mul(v.normal,high?-1:1),d:RADIUS/9*(high?-1:1)});}if(sample.kind==='center'){const v=byVertex[sample.axes[0]];constraints.push({n:v.normal,d:RADIUS*5/9});}}
 for(const c of constraints)mesh=clipSolid(mesh,c.n,c.d);
 const unique=[];mesh.forEach(f=>f.points.forEach(p=>{if(!unique.some(v=>distance(v,p)<1e-8))unique.push(p);}));const center=avg(unique);homePieces.push({id:pieceId,kind:sample.kind,axes:sample.axes,mesh,center,slots:samples});
}
let core=base;for(const v of vertices)core=clipSolid(core,v.normal,RADIUS/9);
function getPieces(state){const byHome=new Map();for(const s of state){const id=slots[s.id].pieceId;if(!byHome.has(id))byHome.set(id,[]);byHome.get(id).push(s);}return homePieces.map(home=>{const stickers=byHome.get(home.id),ori=stickers[0].ori,current=slots[stickers[0].slot];return{id:home.id,kind:home.kind,axes:current.axes,ori,center:transform(home.center,ori),faces:home.mesh.map(f=>{const points=f.points.map(p=>transform(add(home.center,mul(sub(p,home.center),.98)),ori)),sticker=f.face?stickers.find(s=>slots[s.id].face===f.face):null;return{points,normal:transform(f.normal,ori),sticker,stickerPolygon:sticker?slots[sticker.id].polygon.map(p=>transform(add(p,mul(f.normal,.001)),ori)):null};})};});}
root.TetraEngine=Object.freeze({configs,vertices,faces,faceById,slots,homePieces,core,orientations,makeSolved,applyMove,normalizeMove,selected,slotSelected,invertMove,moveLabel,isSolved,seededRandom,scramble,rotate,transform,getPieces,radius:RADIUS,vector:{add,sub,mul,dot,cross,length,unit,distance,avg}});
if(typeof module!=='undefined'&&module.exports)module.exports=root.TetraEngine;
})(typeof globalThis!=='undefined'?globalThis:this);

