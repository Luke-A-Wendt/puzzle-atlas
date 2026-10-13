/* Kilominx's corner-only connected atlas.
 * Each sticker lies at the intersection of the two OTHER incident face rings.
 * All 72-degree moves commute with this spherical embedding. A face-local
 * companion circle carries the five stickers on the turned face itself.
 * The latitude is optimized for five-node face groups, rather than copied from
 * Megaminx's eleven-node faces: every node has a same-face nearest neighbour.
 */
(function(root){
'use strict';
const TAU=2*Math.PI,EPS=1e-7,add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>scale(a,1/Math.hypot(...a));
function create(model){
 const highCut=.61,faces=model.faces,faceById=Object.fromEntries(faces.map(f=>[f.id,f])),positions=[],rings=[],allByFace={},mainByFace={};
 for(const s of model.slots){const [a,b]=s.pieceFaces.filter(id=>id!==s.face).map(id=>faceById[id].normal),base=scale(add(a,b),highCut/(1+dot(a,b))),offset=scale(unit(cross(a,b)),Math.sqrt(Math.max(0,1-dot(base,base)))),x=add(base,offset),y=sub(base,offset);positions[s.id]=dot(x,s.normal)>dot(y,s.normal)?x:y;}
 for(const face of faces){const cuts=[];for(const s of model.slots){if(!s.pieceFaces.includes(face.id))continue;const cut=dot(positions[s.id],face.normal);if(Math.abs(cut)>=1-EPS)continue;let ring=cuts.find(r=>Math.abs(r.cut-cut)<EPS);if(!ring){ring={face:face.id,name:face.id,normal:face.normal,cut,slots:[],main:false,companion:true,angle:-TAU/5};cuts.push(ring);}ring.slots.push(s.id);if(s.face!==face.id){ring.main=true;ring.companion=false;}}cuts.sort((a,b)=>Number(b.main)-Number(a.main)||b.cut-a.cut);allByFace[face.id]=cuts;mainByFace[face.id]=cuts.filter(r=>r.main);if(cuts.length!==2||mainByFace[face.id].length!==1)throw new Error('Kilominx requires one transport ring and one face-local companion per axis');rings.push(...cuts);}
 return{type:'kilominx',positions,rings,allByFace,mainByFace,highCut,suggestedProjection:{pole:[.9330326871484361,.19857142857142862,-.3000323190385839],alpha:.55}};
}
root.KilominxRings=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=root.KilominxRings;
})(typeof globalThis!=='undefined'?globalThis:this);
