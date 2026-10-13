/* Dino Cube / Rainbow Cube: twelve exact edge solids and corner-axis 120° turns.
 * Rainbow is the Dino cube truncated to a cuboctahedron, with eight stationary
 * triangular centres. Each legal move is one even 3-cycle; edges cannot flip.
 * Physical reference: https://www.jaapsch.net/puzzles/dinocube.htm
 */
(function(root){
'use strict';
const EPS=1e-7,ANGLE=-2*Math.PI/3;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=a=>scale(a,1/length(a)),distance=(a,b)=>length(sub(a,b)),mean=a=>scale(a.reduce(add,[0,0,0]),1/a.length);
const identity=()=>[[1,0,0],[0,1,0],[0,0,1]],transform=(m,p)=>m.map(r=>dot(r,p)||0),multiply=(a,b)=>a.map(r=>[0,1,2].map(j=>r.reduce((s,x,k)=>s+x*b[k][j],0)||0));
function rotateVector(p,axis,angle){const n=unit(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
const palette=['#f4f2e8','#ef4859','#42bf73','#ffd447','#ff9346','#448af1','#35d4c3','#b882ed','#e48cbd','#91cc35','#a954cd','#cc613b','#82bfd4','#d9bb86'];
const axisData=[['U',1,1],['R',0,1],['F',2,1],['D',1,-1],['L',0,-1],['B',2,-1]];
const cornerNames=['UFR','UBR','UBL','UFL','DFR','DBR','DBL','DFL'];
const positionName=p=>['U','D','F','B','R','L'].filter(id=>{const [,a,s]=axisData.find(c=>c[0]===id);return p[a]*s>0;}).join('');
const baseConfigs=cornerNames.map((name,index)=>{const corner=[name.includes('R')?1:-1,name.includes('U')?1:-1,name.includes('F')?1:-1],normal=unit(corner),cols=identity().map(p=>rotateVector(p,normal,ANGLE).map(v=>Math.round(v)||0));return{id:String.fromCharCode(65+index),label:String.fromCharCode(65+index),name,index,axis:index%4,corner,normal,anchor:corner,angle:ANGLE,matrix:identity().map((_,i)=>cols.map(c=>c[i])),tip:false,middle:false};});
for(const c of baseConfigs){const opposite=baseConfigs.find(d=>dot(c.corner,d.corner)===-3);c.opposite=opposite.id;c.axis=Math.min(c.index,opposite.index);}
function orderPolygon(points,normal){const c=mean(points),u=unit(sub(points[0],c)),v=cross(normal,u);return points.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function area(points,normal){let total=0;for(let i=1;i<points.length-1;i++)total+=Math.abs(dot(cross(sub(points[i],points[0]),sub(points[i+1],points[0])),normal))/2;return total;}
function unique(points){const out=[];for(const p of points)if(!out.some(q=>distance(p,q)<EPS))out.push(p);return out;}
function polytope(planes){const vertices=[];for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);if(Math.abs(det)<EPS)continue;const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vertices.some(v=>distance(v,p)<EPS))continue;vertices.push(p);}return planes.map(plane=>{const points=vertices.filter(p=>Math.abs(dot(p,plane.normal)-plane.offset)<EPS);if(points.length<3)return null;const n=unit(plane.normal),polygon=orderPolygon(points,n);return area(polygon,n)>EPS?{...plane,normal:n,offset:plane.offset/length(plane.normal),vertices:polygon,points:polygon,center:mean(polygon)}:null;}).filter(Boolean);}
function normalizeMove(move,dir){if(typeof move==='string'){const match=/^([A-H])(['’′]?)$/i.exec(move.trim());if(!match)throw new Error('Invalid Dino move: '+move);move={face:match[1].toUpperCase(),dir:dir===undefined?(match[2]?-1:1):dir,turns:1};}if(!move)throw new Error('Invalid Dino move');let face=String(move.face||move.id).toUpperCase();const alias=baseConfigs.find(c=>c.name===face);if(alias)face=alias.id;const direction=dir===undefined?(move.dir===undefined?1:move.dir):dir,turns=move.turns===undefined?1:move.turns;if(!baseConfigs.some(c=>c.id===face)||![1,-1].includes(direction)||turns!==1)throw new Error('Invalid Dino turn');return{face,dir:direction,turns:1};}
const invertMove=move=>{const m=normalizeMove(move);return{...m,dir:-m.dir};},invertMoves=moves=>moves.slice().reverse().map(invertMove);
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const cache={};
function geometry(type){if(cache[type])return cache[type];if(!['dino','rainbow'].includes(type))throw new Error('Unknown Dino puzzle: '+type);
 const planes=axisData.map(([id,axis,sign],index)=>{const normal=[0,0,0];normal[axis]=sign;return{id,index,normal,offset:1,colorIndex:index,color:palette[index]};});
 if(type==='rainbow')for(const c of baseConfigs)planes.push({id:'T'+c.id,index:planes.length,normal:c.corner,offset:2,colorIndex:6+c.index,color:palette[6+c.index]});
 const faces=polytope(planes),pieces=[],slots=[];
 function addPiece(home,body,kind,stationary=false){const surface=body.filter(f=>!f.cut),id=pieces.length,centroid=mean(unique(body.flatMap(f=>f.points))),name=positionName(home)+(stationary?' center':'');
  const stickers=surface.map(f=>{const points=f.points.map(p=>add(f.center,scale(sub(p,f.center),.91))),s={id:slots.length,piece:id,face:f.id,faceIndex:f.index,color:f.color,colorIndex:f.colorIndex,normal:f.normal,center:f.center,regionPolygon:f.points,vertices:points,points};slots.push(s);return s;});
  pieces.push({id,home:home.slice(),pos:home.slice(),centroid,kind,name,stationary,fixed:stationary,neighbors:surface.map(f=>f.id),stickers,body,virtualStickers:[]});
 }
 // Every Dino piece is the tetrahedron joining a cube edge to its two face centres.
 // Its two inner triangular faces lie on the intersecting corner-cut planes.
 for(let zero=0;zero<3;zero++)for(const a of [-1,1])for(const b of [-1,1]){const home=[0,0,0],nonzero=[0,1,2].filter(i=>i!==zero);home[nonzero[0]]=a;home[nonzero[1]]=b;const ends=[-1,1].map(s=>home.map((v,i)=>i===zero?s:v)),cuts=ends.map(n=>({normal:scale(n,-1),offset:-1,cut:true}));addPiece(home,polytope([...planes,...cuts]),'edge');}
 if(type==='rainbow')for(const c of baseConfigs){const bodyPlanes=[{...planes.find(f=>f.id==='T'+c.id)}];
  // Each centre occupies the gap between its three edge tetrahedra, cut at d=2.
  // Its lower boundary is the common d=1 turn plane; the hidden core lies below.
  for(let axis=0;axis<3;axis++){const n=c.corner.slice();n[axis]*=-1;bodyPlanes.push({normal:n,offset:1,cut:true});}
  bodyPlanes.push({normal:scale(c.corner,-1),offset:-1,cut:true});
  addPiece(c.corner,polytope(bodyPlanes),'center',true);
 }
 const vertices=unique(faces.flatMap(f=>f.points)),radius=Math.max(...vertices.map(length));
 if(pieces.length!==(type==='dino'?12:20)||slots.length!==(type==='dino'?24:56))throw new Error(type+' geometry mismatch');
 cache[type]={type,faces,pieces,slots,vertices,radius};return cache[type];
}
const pointKey=p=>p.map(x=>Math.round(x*1e6)).join(',');
const geometryKey=p=>p.map(pointKey).sort().join(';');
const tetrahedralRotations=[identity()];for(let i=0;i<tetrahedralRotations.length;i++)for(const c of baseConfigs){const m=multiply(c.matrix,tetrahedralRotations[i]);if(!tetrahedralRotations.some(r=>JSON.stringify(r)===JSON.stringify(m)))tetrahedralRotations.push(m);}
function create(type){const g=geometry(type),configs=baseConfigs.map(c=>({...c,anchor:scale(c.corner,type==='rainbow'?2/3:1)})),configById=Object.fromEntries(configs.map(c=>[c.id,c]));
 const model={type,configs,configById,outerConfigs:configs,tipConfigs:[],middleConfigs:[],faces:g.faces,colors:palette.slice(0,type==='rainbow'?14:6),slots:g.slots,polyhedron:g,radius:g.radius,pieces:[],vector,positionName};let cachedFaces=null;
 const affected=(p,c)=>!p.stationary&&dot(p.pos,c.corner)===2;
 function refresh(){cachedFaces=null;model.stickerState=model.pieces.flatMap(p=>p.stickers.map(s=>({id:s.id,slot:s.id,piece:p.id,color:s.color,face:s.face,faceIndex:s.faceIndex,normal:transform(p.orientation,s.normal),center:transform(p.orientation,s.center),pos:p.pos.slice(),stationary:p.stationary})));model.virtualStickerState=[];}
 model.reset=()=>{model.pieces=g.pieces.map(p=>({...p,pos:p.home.slice(),orientation:identity()}));refresh();return model;};
 model.normalizeMove=normalizeMove;
 model.movingPieces=move=>{const m=normalizeMove(move);return model.pieces.filter(p=>affected(p,configById[m.face])).map(p=>p.id);};
 // The centre stays in its slot, but its triangular cap spins in place during a turn.
 // At 120° the unmarked equilateral cap is geometrically identical to its start.
 model.animationPieces=move=>{const m=normalizeMove(move),c=configById[m.face];return model.pieces.filter(p=>affected(p,c)||(p.stationary&&p.home.every((x,i)=>x===c.corner[i]))).map(p=>p.id);};
 model.applyMove=(move,dir)=>{const m=normalizeMove(move,dir),c=configById[m.face],matrix=m.dir===1?c.matrix:multiply(c.matrix,c.matrix);for(const p of model.pieces)if(affected(p,c)){p.pos=transform(matrix,p.pos);p.orientation=multiply(matrix,p.orientation);}refresh();return model;};
 model.mesh=piece=>{if(typeof piece==='number')piece=model.pieces[piece];const convert=f=>{const points=f.points.map(v=>transform(piece.orientation,v));return{...f,vertices:points,points,regionPolygon:f.regionPolygon&&f.regionPolygon.map(v=>transform(piece.orientation,v)),normal:transform(piece.orientation,f.normal),center:transform(piece.orientation,f.center)};};return{...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};};
 model.snapshot=()=>({type,pieces:model.pieces.map(p=>({id:p.id,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s})),virtualStickers:[]});
 // Uniform colour faces recognize both physical, mirror-related Dino solutions.
 // Matching slot geometry also prevents accepting an incomplete or malformed face.
 model.uniformFaces=()=>{if(cachedFaces!==null)return cachedFaces;const surface=model.pieces.flatMap(p=>model.mesh(p).stickers);return cachedFaces=model.faces.filter(f=>{const original=g.slots.filter(s=>s.faceIndex===f.index),current=surface.filter(s=>distance(s.normal,f.normal)<EPS&&Math.abs(dot(s.center,f.normal)-f.offset)<EPS);return current.length===original.length&&new Set(current.map(s=>s.color)).size===1&&current.map(s=>geometryKey(s.regionPolygon)).sort().join('|')===original.map(s=>geometryKey(s.regionPolygon)).sort().join('|');}).length;};
 model.isSolved=()=>model.uniformFaces()===model.faces.length;
 model.isExactSolved=()=>model.pieces.every(p=>p.pos.every((v,i)=>v===p.home[i])&&p.orientation.every((r,i)=>r.every((v,j)=>v===Number(i===j))));
 model.scramble=(seed,count=25)=>{if(!Number.isInteger(count)||count<0)throw new Error('Invalid scramble length');const random=seededRandom(seed),out=[];let previous=null;for(let i=0;i<count;i++){const choices=configs.filter(c=>c.id!==previous),c=choices[Math.floor(random()*choices.length)];out.push({face:c.id,dir:random()<.5?-1:1,turns:1});previous=c.id;}return out;};
 model.invertMove=invertMove;model.invertMoves=invertMoves;model.moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.dir<0?'′':'');};model.rotateVector=rotateVector;model.reset();return model;
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,transform,multiply,identity};
root.DinoEngine=Object.freeze({create,types:['dino','rainbow'],configs:baseConfigs,normalizeMove,invertMove,invertMoves,seededRandom,rotateVector,rotate:rotateVector,vector,positionName,rotations:tetrahedralRotations,polytope});
if(typeof module!=='undefined'&&module.exports)module.exports=root.DinoEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
