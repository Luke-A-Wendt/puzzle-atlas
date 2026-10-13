/* Connected incidence maps for the two dodecahedral puzzles.
 * Crystal: two spherical circle families per axis (15 + 10 belt stops).
 * Megaminx: one circle per axis (15 belt stops). Every moving sticker remains
 * a distinct shared intersection. Face-local spins have companion circles.
 * All embeddings commute with the puzzle's 72-degree rigid rotations.
 */
(function(root){
'use strict';
const TAU=2*Math.PI,EPS=1e-7;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=a=>scale(a,1/length(a));
function rotate(p,axis,a){const n=unit(axis),c=Math.cos(a),s=Math.sin(a);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
function cornerPosition(face,a,b,cut){const base=scale(add(a,b),cut/(1+dot(a,b))),offset=scale(unit(cross(a,b)),Math.sqrt(Math.max(0,1-dot(base,base)))),x=add(base,offset),y=sub(base,offset);return dot(x,face)>dot(y,face)?x:y;}
function create(model,options={}){
 const type=options.type||model.type||(model.slots.length===132?'megaminx':'crystal');
 if(!['crystal','megaminx'].includes(type))throw new Error('Unsupported connected dodecahedral map: '+type);
 const faces=model.faces,faceById=Object.fromEntries(faces.map(f=>[f.id,f])),slots=model.slots,templates=type==='crystal'?(model.polyhedron.pieces||model.pieces):null,positions=[];
 let highCut,lowCut=null;
 if(type==='crystal'){
  // Edge positions retain their reflection symmetry within the face. Their
  // other home face defines the high belt; two deeper cuts define the low belt.
  // Corner positions are placed on the intersection of two high belts.
  const edge=templates.find(p=>p.kind==='edge'),sticker=slots.find(s=>s.piece===edge.id),other=edge.homeFaces.find(id=>id!==sticker.face),point=unit(add(scale(sticker.normal,.3),scale(sticker.center,.7)));
  highCut=dot(point,faceById[other].normal);
  for(const s of slots){const piece=templates[s.piece];if(piece.kind==='edge')positions[s.id]=unit(add(scale(s.normal,.3),scale(s.center,.7)));else{const [a,b]=piece.homeFaces.filter(id=>id!==s.face).map(id=>faceById[id].normal);positions[s.id]=cornerPosition(s.normal,a,b,highCut);}}
 }else{
  // This latitude keeps the eleven nodes of each solved face together,
  // while retaining exact intersections and 72-degree rotation symmetry.
  highCut=.67553;const radial=Math.sqrt(1-highCut*highCut);
  for(const s of slots){if(s.kind==='center'){positions[s.id]=null;continue;}const face=faceById[s.face],others=s.pieceFaces.filter(id=>id!==s.face);if(s.kind==='edge'){const n=faceById[others[0]].normal;positions[s.id]=add(scale(n,highCut),scale(unit(sub(face.normal,scale(n,dot(face.normal,n)))),radial));}else positions[s.id]=cornerPosition(face.normal,faceById[others[0]].normal,faceById[others[1]].normal,highCut);}
 }
 const rawSlot=s=>typeof s==='number'?slots[s]:s&&slots[typeof s.slot==='number'?s.slot:s.id];
 const affected=(s,face)=>{s=rawSlot(s);return!!s&&!!positions[s.id]&&(type==='crystal'?templates[s.piece].cutFaces.includes(face):s.pieceFaces.includes(face));};
 const rings=[],allByFace={},mainByFace={};
 for(const face of faces){const cuts=[];for(const s of slots){if(!affected(s,face.id))continue;const cut=dot(positions[s.id],face.normal);if(Math.abs(cut)>=1-EPS)continue;let ring=cuts.find(r=>Math.abs(r.cut-cut)<EPS);if(!ring){ring={face:face.id,name:face.id,normal:face.normal,cut,slots:[],main:false,companion:true,angle:-TAU/5};cuts.push(ring);}ring.slots.push(s.id);if(s.face!==face.id){ring.main=true;ring.companion=false;}}
  cuts.sort((a,b)=>Number(b.main)-Number(a.main)||b.cut-a.cut);allByFace[face.id]=cuts;mainByFace[face.id]=cuts.filter(r=>r.main);rings.push(...cuts);
  if(mainByFace[face.id].length!==(type==='crystal'?2:1))throw new Error('Invalid '+type+' belt circle count');
  if(type==='crystal')lowCut=Math.min(...mainByFace[face.id].map(r=>r.cut));
 }
 const position=s=>{s=rawSlot(s);return s?positions[s.id]:null;};
 function interpolate(s,move,t){const p=position(s);if(!p||!affected(s,move.face)||t<=0)return p;const face=faceById[move.face],angle=-TAU/5*(move.dir===undefined?1:move.dir)*(move.turns||1)*Math.min(t,1);return rotate(p,face.normal,angle);}
 return{type,positions,rings,allByFace,mainByFace,highCut,lowCut,position,direction:position,interpolate,affected};
}
root.ConnectedRingBelts=Object.freeze({create,rotate});if(typeof module!=='undefined'&&module.exports)module.exports=root.ConnectedRingBelts;
})(typeof globalThis!=='undefined'?globalThis:this);
