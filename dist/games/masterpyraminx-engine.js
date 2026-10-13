/* Master Pyraminx: exact four-layer tetrahedral geometry.
 * Every face is a 4-by-4 triangular grid. The 30 visible rigid cells are
 * 4 tips, 4 axials, 12 wings, 6 midges and 4 centers (64 stickers).
 * Barycentric cuts lambda_i = 1/4, 1/2, 3/4 define all straight cuts.
 * U/L/R/B turn the upper two layers; Uw/Lw/Rw/Bw turn three; u/l/r/b
 * turn only the tips. A positive move is 120 degrees clockwise looking
 * inward from the named vertex. All moves have fixed sticker permutations.
 */
(function(root){
'use strict';
const TAU=2*Math.PI,EPS=1e-8,RADIUS=1.6,ANGLE=-TAU/3;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=v=>Math.hypot(...v),unit=v=>scale(v,1/length(v)),distance=(a,b)=>length(sub(a,b)),mean=ps=>scale(ps.reduce(add,[0,0,0]),1/ps.length);
const identity=()=>[[1,0,0],[0,1,0],[0,0,1]],transform=(m,p)=>m.map(r=>dot(r,p)),multiply=(a,b)=>a.map(r=>[0,1,2].map(j=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
function rotateVector(p,axis,a){const n=unit(axis),c=Math.cos(a),s=Math.sin(a);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
const labels=['U','L','R','B'],names=['Upper','Left','Right','Back'],colors=['#f4ce48','#4c90ef','#ee596e','#39bd8b'],colorNames=['Yellow','Blue','Red','Green'];
const normals=[[0,1,0],[-Math.sqrt(2/3),-1/3,Math.sqrt(2)/3],[Math.sqrt(2/3),-1/3,Math.sqrt(2)/3],[0,-1/3,-2*Math.sqrt(2)/3]];
const vertices=normals.map(n=>scale(n,RADIUS));
const lambda=(p,index)=>(3*dot(p,normals[index])/RADIUS+1)/4;
const cutOffset=lambda=>(4*lambda-1)*RADIUS/3;
function orient(ps,n){return dot(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),n)<0?ps.slice().reverse():ps;}
const faces=labels.map((id,index)=>{const normal=scale(normals[index],-1),points=orient(vertices.filter((_,i)=>i!==index),normal);return{id,index,normal,points,vertices:points,center:mean(points),color:colors[index],colorIndex:index,name:colorNames[index]};});
const configs=[];
for(const [suffix,threshold,kind]of [['',.5,'layer'],['w',.25,'wide'],['tip',.75,'tip']])for(let index=0;index<4;index++){
 const normal=normals[index],id=suffix==='tip'?labels[index].toLowerCase():labels[index]+suffix,columns=identity().map(p=>rotateVector(p,normal,ANGLE));
 configs.push({id,face:id,index:configs.length,vertex:labels[index],axisIndex:index,label:id,name:names[index]+' '+(kind==='wide'?'wide layer':kind),normal,anchor:normal,angle:ANGLE,threshold,tip:kind==='tip',kind,matrix:identity().map((_,i)=>columns.map(c=>c[i]))});
}
const configById=Object.fromEntries(configs.map(c=>[c.id,c]));
const matrixKey=m=>m.flat().map(x=>Math.round(x*1e8)).join(',');
const rotations=[identity()],rotationIndex=new Map([[matrixKey(rotations[0]),0]]);
for(let i=0;i<rotations.length;i++)for(const c of configs.slice(0,4)){const m=multiply(c.matrix,rotations[i]),key=matrixKey(m);if(!rotationIndex.has(key)){rotationIndex.set(key,rotations.length);rotations.push(m);}}
if(rotations.length!==12)throw Error('Master Pyraminx rotation group mismatch');
function snapMatrix(m){const index=rotationIndex.get(matrixKey(m));if(index===undefined)throw Error('Invalid Master Pyraminx orientation');return rotations[index];}
const positiveRotation=Object.fromEntries(configs.map(c=>[c.id,snapMatrix(c.matrix)])),negativeRotation=Object.fromEntries(configs.map(c=>[c.id,snapMatrix(c.matrix[0].map((_,i)=>c.matrix.map(row=>row[i])))]));
function unique(ps){const out=[];for(const p of ps)if(!out.some(q=>distance(p,q)<EPS))out.push(p);return out;}
function orderPolygon(ps,n){const c=mean(ps),u=unit(sub(ps[0],c)),v=cross(n,u);return ps.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function area(ps,n){let a=0;for(let i=1;i<ps.length-1;i++)a+=Math.abs(dot(cross(sub(ps[i],ps[0]),sub(ps[i+1],ps[0])),n))/2;return a;}
function polytope(planes){const vs=[];for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);if(Math.abs(det)<EPS)continue;const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vs.some(v=>distance(v,p)<EPS))continue;vs.push(p);}return planes.map(f=>{const points=vs.filter(p=>Math.abs(dot(p,f.normal)-f.offset)<EPS);if(points.length<3)return null;const n=unit(f.normal),polygon=orderPolygon(points,n);return area(polygon,n)>EPS?{...f,normal:n,points:polygon,vertices:polygon,center:mean(polygon)}:null;}).filter(Boolean);}
// Every visible triangle belongs to one exact tetrahedral/octahedral cell.
const groups=new Map();
for(const f of faces){const vertexIndices=labels.map((_,i)=>i).filter(i=>i!==f.index),point=weights=>weights.reduce((p,w,i)=>add(p,scale(vertices[vertexIndices[i]],w/4)),[0,0,0]);
 function tile(weights){const regionPolygon=orient(weights.map(point),f.normal),center=mean(regionPolygon),bands=labels.map((_,i)=>Math.max(0,Math.min(3,Math.floor(4*lambda(center,i)+EPS)))),key=bands.join(',');if(!groups.has(key))groups.set(key,{bands,surfaces:[]});groups.get(key).surfaces.push({face:f.id,faceIndex:f.index,normal:f.normal,color:f.color,colorIndex:f.index,regionPolygon,center});}
 for(let a=0;a<4;a++)for(let b=0;b<4-a;b++){const c=3-a-b;tile([[a+1,b,c],[a,b+1,c],[a,b,c+1]]);}
 for(let a=0;a<3;a++)for(let b=0;b<3-a;b++){const c=2-a-b;tile([[a+1,b+1,c],[a,b+1,c+1],[a+1,b,c+1]]);}
}
const templates=[],slots=[];
for(const {bands,surfaces}of groups.values()){
 const id=templates.length,max=Math.max(...bands),kind=surfaces.length===1?'center':surfaces.length===3?(max===3?'tip':'axial'):max===2?'wing':'midge';
 const planes=bands.flatMap((band,index)=>[{normal:scale(normals[index],-1),offset:-cutOffset(band/4)},{normal:normals[index],offset:cutOffset((band+1)/4)}]),body=polytope(planes),home=mean(unique(body.flatMap(f=>f.points))),homeFaces=surfaces.map(s=>s.face).sort();
 const name=kind==='tip'||kind==='axial'?labels[bands.indexOf(max)]+(kind==='tip'?' tip':' axial'):kind==='wing'?labels[bands.indexOf(2)]+labels[bands.indexOf(1)]+' wing':kind==='midge'?labels.filter((_,i)=>bands[i]===1).join('')+' midge':homeFaces[0]+' center';
 const stickers=surfaces.map(s=>{const points=s.regionPolygon.map(p=>add(s.center,scale(sub(p,s.center),.91))),sticker={...s,id:slots.length,piece:id,pieceId:id,kind,points,vertices:points};slots.push(sticker);return sticker;});
 templates.push({id,home,pos:home,centroid:home,name,kind,bands,homeFaces,stickers,body});
}
if(templates.length!==30||slots.length!==64||faces.some(f=>slots.filter(s=>s.face===f.id).length!==16))throw Error('Master Pyraminx geometry mismatch');
function nearestSlot(center,normal){let best=null,error=Infinity;for(const s of slots){const d=distance(center,s.center)+distance(normal,s.normal);if(d<error){best=s;error=d;}}if(error>1e-6)throw Error('Master Pyraminx sticker outside a legal slot');return best;}
const polyhedron={vertices,faces,slots,pieces:templates,radius:RADIUS};
function normalizeMove(move,dir){if(typeof move==='string'){const m=/^([ULRB](?:w)?|[ulrb])(2)?(['’′]?)$/.exec(move.trim());if(!m)throw Error('Invalid Master Pyraminx move: '+move);move={face:m[1],turns:m[2]?2:1,dir:m[3]?-1:1};}if(!move)throw Error('Invalid Master Pyraminx move');const face=String(move.face||move.id),direction=dir===undefined?(move.dir===undefined?1:move.dir):dir,turns=move.turns===undefined?1:move.turns;if(!configById[face]||![1,-1].includes(direction)||![1,2].includes(turns))throw Error('Invalid Master Pyraminx turn');return{face,dir:direction,turns};}
const invertMove=move=>{const m=normalizeMove(move);return{...m,dir:-m.dir};},invertMoves=moves=>moves.slice().reverse().map(invertMove),moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.turns===2?'2':'')+(m.dir<0?'′':'');};
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function create(){const model={type:'masterpyraminx',faces,colors,slots,configs,configById,outerConfigs:configs.slice(0,4),tipConfigs:configs.filter(c=>c.tip),middleConfigs:configs.filter(c=>c.kind==='wide'),polyhedron,radius:RADIUS,pieces:[],vector,rotateVector,normalizeMove,invertMove,invertMoves,moveLabel,mirrorEligible:false};
 function refresh(){model.stickerState=model.pieces.flatMap(p=>p.stickers.map(s=>{const center=transform(p.orientation,s.center),normal=transform(p.orientation,s.normal),slot=nearestSlot(center,normal);return{id:s.id,slot:slot.id,piece:p.id,color:s.color,face:s.face,faceIndex:s.faceIndex,center:slot.center,normal:slot.normal,pos:p.pos.slice()};}));model.virtualStickerState=[];}
 model.reset=()=>{model.pieces=templates.map(p=>({...p,pos:p.home.slice(),orientation:identity(),slot:p.id}));refresh();return model;};
 model.movingPieces=move=>{const m=normalizeMove(move),cfg=configById[m.face];return model.pieces.filter(p=>lambda(p.pos,cfg.axisIndex)>cfg.threshold+EPS).map(p=>p.id);};
 model.applyMove=(move,dir)=>{const m=normalizeMove(move,dir),ids=new Set(model.movingPieces(m)),matrix=m.dir>0?positiveRotation[m.face]:negativeRotation[m.face];for(let step=0;step<m.turns;step++)for(const p of model.pieces)if(ids.has(p.id)){p.orientation=snapMatrix(multiply(matrix,p.orientation));const pos=transform(p.orientation,p.home),target=templates.find(q=>q.kind===p.kind&&distance(q.home,pos)<1e-6);if(!target)throw Error('Master Pyraminx piece outside a legal slot');p.pos=target.home;p.slot=target.id;}refresh();return model;};
 model.mesh=piece=>{if(typeof piece==='number')piece=model.pieces[piece];const convert=f=>{const points=f.points.map(v=>transform(piece.orientation,v));return{...f,vertices:points,points,regionPolygon:f.regionPolygon&&f.regionPolygon.map(v=>transform(piece.orientation,v)),normal:transform(piece.orientation,f.normal),center:transform(piece.orientation,f.center)};};return{...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};};
 model.positionName=pos=>templates.find(p=>distance(p.home,pos)<1e-6)?.name||'?';
 model.uniformFaces=()=>faces.filter(f=>new Set(model.stickerState.filter(s=>slots[s.slot].face===f.id).map(s=>s.color)).size===1).length;
 model.isSolved=()=>model.uniformFaces()===4;
 model.isExactSolved=()=>model.stickerState.every(s=>s.slot===s.id);
 model.snapshot=()=>({type:'masterpyraminx',pieces:model.pieces.map(p=>({id:p.id,name:p.name,kind:p.kind,slot:p.slot,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s})),virtualStickers:[]});
 model.scramble=(seed,count=40)=>{if(!Number.isInteger(count)||count<0)throw Error('Invalid scramble length');const random=seededRandom(seed),out=[];let previous=null;for(let i=0;i<count;i++){const choices=configs.slice(0,8).filter(c=>c.vertex!==previous),c=choices[Math.floor(random()*choices.length)];out.push({face:c.id,dir:random()<.5?-1:1,turns:1});previous=c.vertex;}for(const c of model.tipConfigs)out.push({face:c.id,dir:random()<.5?-1:1,turns:1});return out;};
 return model.reset();
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,identity,transform,multiply};
root.MasterPyraminxEngine=Object.freeze({create,configs,configById,faces,colors,slots,polyhedron,rotations,normalizeMove,invertMove,invertMoves,moveLabel,rotateVector,seededRandom,vector,lambda,cutOffset});if(typeof module!=='undefined'&&module.exports)module.exports=root.MasterPyraminxEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
