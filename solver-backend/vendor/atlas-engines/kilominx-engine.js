/* Kilominx: the 20 corners of a face-turning dodecahedron.
 * Five rigid corner cells turn 72 degrees per face; 60 colored sticker slots.
 * Flat exterior cells are dodecahedron vertex Voronoi sectors. The polygonal
 * solid beneath each sticker is a display shell, not a mechanical core model.
 * Corner action: https://www.jaapsch.net/puzzles/impossi.htm
 * Regular dodecahedron is constructed as the dual of icosahedral face normals.
 */
(function(root){
'use strict';
const TAU=2*Math.PI,EPS=1e-7,CUT=1/Math.sqrt(5),ANGLE=-TAU/5;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=v=>Math.hypot(...v),unit=v=>scale(v,1/length(v)),distance=(a,b)=>length(sub(a,b)),mean=ps=>scale(ps.reduce(add,[0,0,0]),1/ps.length);
const identity=()=>[[1,0,0],[0,1,0],[0,0,1]],transform=(m,p)=>m.map(r=>dot(r,p)),multiply=(a,b)=>a.map(r=>[0,1,2].map(j=>r.reduce((s,x,k)=>s+x*b[k][j],0)));
function rotateVector(p,axis,a){const n=unit(axis),c=Math.cos(a),s=Math.sin(a);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
const colors=['#f8fafc','#e54147','#27b985','#3286ee','#9967e8','#ffd251','#f38838','#6dd8db','#f18fbd','#b6d657','#926750','#747d90'];
const colorNames=['White','Red','Emerald','Blue','Violet','Yellow','Orange','Aqua','Pink','Lime','Brown','Slate'];
const normals=[[0,1,0]],r=2/Math.sqrt(5);for(let k=0;k<5;k++)normals.push([r*Math.sin(k*TAU/5),CUT,r*Math.cos(k*TAU/5)]);for(let k=0;k<5;k++)normals.push([r*Math.sin((k+.5)*TAU/5),-CUT,r*Math.cos((k+.5)*TAU/5)]);normals.push([0,-1,0]);
const configs=normals.map((normal,index)=>{const columns=identity().map(p=>rotateVector(p,normal,ANGLE)),id=String.fromCharCode(65+index);return{id,index,label:id,name:colorNames[index],normal,anchor:normal,angle:ANGLE,tip:false,matrix:identity().map((_,i)=>columns.map(c=>c[i]))};});
for(const c of configs)c.opposite=configs.find(d=>dot(c.normal,d.normal)<-1+EPS).id;
const configById=Object.fromEntries(configs.map(c=>[c.id,c]));
const matrixKey=m=>m.flat().map(x=>Math.round(x*1e8)).join(',');
const rotations=[identity()],rotationIndex=new Map([[matrixKey(rotations[0]),0]]);for(let i=0;i<rotations.length;i++)for(const c of configs){const m=multiply(c.matrix,rotations[i]),key=matrixKey(m);if(!rotationIndex.has(key)){rotationIndex.set(key,rotations.length);rotations.push(m);}}if(rotations.length!==60)throw new Error('Kilominx rotation group mismatch');
function snapMatrix(m){const index=rotationIndex.get(matrixKey(m));if(index===undefined)throw new Error('Invalid Kilominx orientation');return rotations[index];}
const positiveRotation=Object.fromEntries(configs.map(c=>[c.id,snapMatrix(c.matrix)])),negativeRotation=Object.fromEntries(configs.map(c=>[c.id,snapMatrix(c.matrix[0].map((_,i)=>c.matrix.map(row=>row[i])))]));
function unique(ps){const out=[];for(const p of ps)if(!out.some(q=>distance(p,q)<EPS))out.push(p);return out;}
function orderPolygon(ps,n){const c=mean(ps),u=unit(sub(ps[0],c)),v=cross(n,u);return ps.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function area(ps,n){let a=0;for(let i=1;i<ps.length-1;i++)a+=Math.abs(dot(cross(sub(ps[i],ps[0]),sub(ps[i+1],ps[0])),n))/2;return a;}
function polytope(planes){const vs=[];for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);if(Math.abs(det)<EPS)continue;const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vs.some(v=>distance(v,p)<EPS))continue;vs.push(p);}return planes.map(f=>{const points=vs.filter(p=>Math.abs(dot(p,f.normal)-f.offset)<EPS);if(points.length<3)return null;const n=unit(f.normal),polygon=orderPolygon(points,n);return area(polygon,n)>EPS?{...f,normal:n,offset:f.offset/length(f.normal),points:polygon,vertices:polygon,center:mean(polygon)}:null;}).filter(Boolean);}
function clip(poly,n,threshold,high){const out=[],sign=high?1:-1;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(dot(a,n)-threshold),db=sign*(dot(b,n)-threshold);if(da>=-EPS)out.push(a);if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS))out.push(add(a,scale(sub(b,a),da/(da-db))));}const clean=unique(out);return clean.filter((p,i)=>length(cross(sub(p,clean[(i+clean.length-1)%clean.length]),sub(clean[(i+1)%clean.length],p)))>EPS);}
const planes=configs.map(c=>({id:c.id,index:c.index,normal:c.normal,offset:1,color:colors[c.index],colorIndex:c.index,name:c.name})),faces=polytope(planes),vertices=unique(faces.flatMap(f=>f.points));
for(const f of faces){f.u=unit(sub([1,0,0],scale(f.normal,f.normal[0])));f.v=cross(f.normal,f.u);f.neighbors=faces.filter(g=>Math.abs(dot(g.normal,f.normal)-CUT)<EPS).map(g=>g.id);}
// Split every pentagon into five kite-shaped cells: face centre -> edge
// midpoint -> vertex -> edge midpoint. Three cells meet on each physical
// corner. Voronoi halfspaces between equal-radius vertices supply a closed,
// flat-sided display solid and reproduce these same surface quadrilaterals.
const templates=[],slots=[];
for(const vertex of vertices){
 const id=templates.length,homeFaces=faces.filter(f=>Math.abs(dot(f.normal,vertex)-1)<EPS).map(f=>f.id).sort(),name=homeFaces.join('');
 const bisectors=vertices.filter(v=>distance(v,vertex)>EPS).map(v=>({normal:sub(v,vertex),offset:0,cut:true}));
 const body=polytope([...planes,...bisectors]);
 const surfaces=homeFaces.map(faceId=>{const f=faces.find(f=>f.id===faceId),i=f.points.findIndex(v=>distance(v,vertex)<EPS),previous=f.points[(i+4)%5],next=f.points[(i+1)%5],regionPolygon=orderPolygon([f.center,mean([vertex,previous]),vertex,mean([vertex,next])],f.normal),center=mean(regionPolygon);return{face:f.id,faceIndex:f.index,normal:f.normal,color:f.color,colorIndex:f.index,center,regionPolygon};});
 const home=mean(surfaces.map(s=>s.center)),stickers=surfaces.map(s=>{const points=s.regionPolygon.map(p=>add(s.center,scale(sub(p,s.center),.93))),sticker={...s,id:slots.length,piece:id,kind:'corner',pieceFaces:homeFaces,vertices:points,points};slots.push(sticker);return sticker;});
 templates.push({id,home,pos:home,vertex,centroid:mean(unique(body.flatMap(f=>f.points))),name,kind:'corner',cutFaces:homeFaces,homeFaces,stickers,body});
}
if(vertices.length!==20||templates.length!==20||slots.length!==60||faces.some(f=>slots.filter(s=>s.face===f.id).length!==5))throw new Error('Kilominx geometry mismatch');
function nearestSlot(center,normal){let best=null,error=Infinity;for(const s of slots){const d=distance(center,s.center)+distance(normal,s.normal);if(d<error){best=s;error=d;}}if(error>1e-5)throw new Error('Kilominx sticker outside a legal slot');return best;}
const radius=Math.max(...vertices.map(length)),polyhedron={vertices,faces,slots,pieces:templates,radius};
function normalizeMove(move,dir){if(typeof move==='string'){const m=/^([A-L])(2)?(['’′]?)$/i.exec(move.trim());if(!m)throw new Error('Invalid Kilominx move: '+move);move={face:m[1].toUpperCase(),turns:m[2]?2:1,dir:m[3]?-1:1};}if(!move)throw new Error('Invalid Kilominx move');const face=String(move.face||move.id).toUpperCase(),direction=dir===undefined?(move.dir===undefined?1:move.dir):dir,turns=move.turns===undefined?1:move.turns;if(!configById[face]||![1,-1].includes(direction)||![1,2].includes(turns))throw new Error('Invalid Kilominx turn');return{face,dir:direction,turns};}
const invertMove=move=>{const m=normalizeMove(move);return{...m,dir:-m.dir};},invertMoves=moves=>moves.slice().reverse().map(invertMove),moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.turns===2?'2':'')+(m.dir<0?'′':'');};
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function create(){const model={type:'kilominx',faces,colors,slots,configs,configById,outerConfigs:configs,tipConfigs:[],middleConfigs:[],polyhedron,radius,pieces:[],vector,rotateVector,normalizeMove,invertMove,invertMoves,moveLabel,mirrorEligible:false};
 function refresh(){model.stickerState=model.pieces.flatMap(p=>p.stickers.map(s=>{const center=transform(p.orientation,s.center),normal=transform(p.orientation,s.normal),slot=nearestSlot(center,normal);return{id:s.id,slot:slot.id,piece:p.id,color:s.color,face:s.face,faceIndex:s.faceIndex,center:slot.center,normal:slot.normal,pos:p.pos.slice()};}));model.virtualStickerState=[];}
 model.reset=()=>{model.pieces=templates.map(p=>({...p,pos:p.home.slice(),orientation:identity(),slot:p.id}));refresh();return model;};
 model.movingPieces=move=>{const m=normalizeMove(move);return model.pieces.filter(p=>templates[p.slot].homeFaces.includes(m.face)).map(p=>p.id);};
 model.applyMove=(move,dir)=>{const m=normalizeMove(move,dir),ids=new Set(model.movingPieces(m)),matrix=m.dir>0?positiveRotation[m.face]:negativeRotation[m.face];for(let step=0;step<m.turns;step++)for(const p of model.pieces)if(ids.has(p.id)){p.orientation=snapMatrix(multiply(matrix,p.orientation));const pos=transform(p.orientation,p.home),target=templates.find(q=>q.kind===p.kind&&distance(q.home,pos)<1e-6);if(!target)throw new Error('Kilominx piece outside a legal slot');p.pos=target.home;p.slot=target.id;}refresh();return model;};
 model.mesh=piece=>{if(typeof piece==='number')piece=model.pieces[piece];const convert=f=>{const points=f.points.map(v=>transform(piece.orientation,v));return{...f,vertices:points,points,regionPolygon:f.regionPolygon&&f.regionPolygon.map(v=>transform(piece.orientation,v)),normal:transform(piece.orientation,f.normal),center:transform(piece.orientation,f.center)};};return{...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};};
 model.positionName=pos=>templates.find(p=>distance(p.home,pos)<1e-6)?.name||'?';
 model.uniformFaces=()=>faces.filter(f=>new Set(model.stickerState.filter(s=>slots[s.slot].face===f.id).map(s=>s.color)).size===1).length;
 model.isSolved=()=>model.uniformFaces()===12;
 model.isExactSolved=()=>model.pieces.every(p=>p.id===p.slot&&matrixKey(p.orientation)===matrixKey(identity()));
 model.snapshot=()=>({type:'kilominx',pieces:model.pieces.map(p=>({id:p.id,name:p.name,kind:p.kind,slot:p.slot,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s})),virtualStickers:[]});
 model.scramble=(seed,count=40)=>{if(!Number.isInteger(count)||count<0)throw new Error('Invalid scramble length');const random=seededRandom(seed),out=[];let previous=null;for(let i=0;i<count;i++){const choices=configs.filter(c=>c.id!==previous),c=choices[Math.floor(random()*choices.length)];out.push({face:c.id,dir:random()<.5?-1:1,turns:random()<.25?2:1});previous=c.id;}return out;};
 return model.reset();
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,identity,transform,multiply};
root.KilominxEngine=Object.freeze({create,configs,configById,faces,colors,slots,polyhedron,rotations,normalizeMove,invertMove,invertMoves,moveLabel,rotateVector,seededRandom,vector,CUT});if(typeof module!=='undefined'&&module.exports)module.exports=root.KilominxEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
