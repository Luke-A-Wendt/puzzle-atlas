/* Face-Turning Octahedron: 42 rigid pieces, 72 triangular stickers.
 * Eight equal-depth 120-degree face turns; four optional middle slices.
 * The geometry is clipped from |x| + |y| + |z| <= 1.7, using the two
 * planes at one-third face depth on each of the four diagonal axes.
 * Every state move is an exact signed permutation matrix.
 * Physical reference: https://www.jaapsch.net/puzzles/octaface.htm
 */
(function(root){
'use strict';
const EPS=1e-8,ANGLE=-2*Math.PI/3,RADIUS=1.7,CUT=RADIUS/3;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a),unit=a=>scale(a,1/length(a)),distance=(a,b)=>length(sub(a,b)),mean=a=>scale(a.reduce(add,[0,0,0]),1/a.length);
const identity=()=>[[1,0,0],[0,1,0],[0,0,1]],transform=(m,p)=>m.map(r=>dot(r,p));
const multiply=(a,b)=>a.map(row=>[0,1,2].map(j=>row.reduce((s,x,k)=>s+x*b[k][j],0)));
function rotateVector(p,axis,angle){const n=unit(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
const anchors=[[1,1,1],[-1,1,-1],[1,-1,-1],[-1,-1,1]],labels=['A','B','C','D','E','F','G','H'];
const configs=labels.map((id,index)=>{
 const anchor=scale(anchors[index%4],index<4?1:-1),normal=unit(anchor),cols=identity().map(p=>rotateVector(p,normal,ANGLE).map(Math.round));
 const matrix=identity().map((_,i)=>cols.map(col=>col[i]));
 return{id,label:id,index,anchor,normal,angle:ANGLE,matrix,opposite:labels[(index+4)%8],middle:false,axis:index%4};
});
const outerConfigs=configs.slice();
for(let axis=0;axis<4;axis++){const c=configs[axis];configs.push({...c,id:c.id+'m',label:c.id+'m',index:8+axis,middle:true,opposite:c.id+'m',axis});}
const middleConfigs=configs.slice(8),configById=Object.fromEntries(configs.map(c=>[c.id,c]));
const palette=['#f2f4fa','#4c91ec','#e65361','#ab75e8','#f6c84b','#46b990','#f39948','#55c5d8'];
const colorNames=['Pearl','Blue','Coral','Violet','Gold','Emerald','Orange','Aqua'];
function orderPolygon(points,normal){const c=mean(points),u=unit(sub(points[0],c)),v=cross(normal,u);return points.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function area(points,normal){let result=0;for(let i=1;i<points.length-1;i++)result+=Math.abs(dot(cross(sub(points[i],points[0]),sub(points[i+1],points[0])),normal))/2;return result;}
function unique(points){const result=[];for(const p of points)if(!result.some(q=>distance(p,q)<EPS))result.push(p);return result;}
function polytope(planes){
 const vertices=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);if(Math.abs(det)<EPS)continue;
  const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);
  if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vertices.some(v=>distance(v,p)<EPS))continue;vertices.push(p);
 }
 return planes.map(plane=>{const points=vertices.filter(p=>Math.abs(dot(p,plane.normal)-plane.offset)<EPS);if(points.length<3)return null;const polygon=orderPolygon(points,unit(plane.normal));return area(polygon,unit(plane.normal))>EPS?{...plane,normal:unit(plane.normal),vertices:polygon,points:polygon,center:mean(polygon)}:null;}).filter(Boolean);
}
// Integer piece anchors are geometric centroids in units of RADIUS/6.
// This makes every state update exact, including piece position comparisons.
function affected(pos,config){const projection=dot(pos,config.anchor);return config.middle?Math.abs(projection)<2:projection>2;}
let geometryCache;
function buildGeometry(){
 if(geometryCache)return geometryCache;
 const vertices=[];for(let a=0;a<3;a++)for(const s of [-1,1]){const p=[0,0,0];p[a]=s*RADIUS;vertices.push(p);}
 const faces=outerConfigs.map((c,index)=>{
  const points=orderPolygon(vertices.filter(p=>Math.abs(dot(c.anchor,p)-RADIUS)<EPS),c.normal);
  return{id:c.id,index,normal:c.normal,offset:RADIUS/Math.sqrt(3),vertices:points,points,center:mean(points),color:palette[index],colorName:colorNames[index],colorIndex:index};
 });
 const pieces=[],slots=[];
 for(let code=0;code<81;code++){
  const bands=[];let temp=code;for(let i=0;i<4;i++){bands.push(temp%3-1);temp=Math.floor(temp/3);}
  const cuts=[];
  for(let i=0;i<4;i++){
   if(bands[i]===0){cuts.push({normal:anchors[i],offset:CUT,cut:true},{normal:scale(anchors[i],-1),offset:CUT,cut:true});}
   else cuts.push({normal:scale(anchors[i],-bands[i]),offset:-CUT,cut:true});
  }
  const body=polytope([...faces,...cuts]),surface=body.filter(p=>!p.cut);
  if(!surface.length)continue;
  const bodyVertices=unique(body.flatMap(f=>f.points));
  // Reject empty-volume cells that happen to coincide with a boundary.
  const centroid=mean(bodyVertices);
  if(cuts.some(p=>dot(p.normal,centroid)>p.offset-EPS))continue;
  const home=centroid.map(x=>Math.round(x*6/RADIUS)||0);
  const id=pieces.length,kind=surface.length===4?'vertex':surface.length===2?'edge':'center';
  const stickers=surface.map(p=>{
   const points=p.points.map(v=>add(p.center,scale(sub(v,p.center),.915)));
   const sticker={id:slots.length,piece:id,face:p.id,faceIndex:p.index,color:p.color,colorIndex:p.colorIndex,normal:p.normal,center:p.center,vertices:points,points,regionPolygon:p.points};slots.push(sticker);return sticker;
  });
  const neighbors=surface.map(f=>f.id),name=kind==='center'?surface[0].id+String(pieces.filter(p=>p.kind==='center'&&p.stickers[0].face===surface[0].id).length+1):neighbors.join('');
  pieces.push({id,pos:home.slice(),home:home.slice(),centroid:scale(home,RADIUS/6),kind,name,neighbors,bands,stickers,body});
 }
 if(faces.length!==8||pieces.length!==42||slots.length!==72)throw new Error('Unexpected FTO geometry: '+faces.length+' faces, '+pieces.length+' pieces, '+slots.length+' stickers');
 const permutations={};
 for(const config of configs){
  const mapping=slots.map(s=>{
   if(!affected(pieces[s.piece].home,config))return s.id;
   const center=transform(config.matrix,s.center),normal=transform(config.matrix,s.normal),target=slots.find(t=>distance(t.center,center)<EPS&&distance(t.normal,normal)<EPS);
   if(!target)throw new Error('FTO turn '+config.id+' has no destination for sticker '+s.id);return target.id;
  });
  if(new Set(mapping).size!==slots.length)throw new Error('Non-bijective FTO move '+config.id);permutations[config.id]=mapping;
 }
 geometryCache={type:'fto',faces,pieces,slots,vertices,permutations,radius:RADIUS};return geometryCache;
}
function normalizeMove(move,dir){
 if(typeof move==='number')move={face:configs[move]&&configs[move].id,dir:dir===undefined?1:dir};
 if(typeof move==='string')move={face:move,dir:dir===undefined?1:dir};
 if(!move||!configById[move.face||move.id])throw new Error('Invalid FTO turn');const direction=move.dir===undefined?1:move.dir;
 if(direction!==1&&direction!==-1)throw new Error('Turn direction must be 1 or -1');return{face:move.face||move.id,dir:direction};
}
function invertMove(move){const m=normalizeMove(move);return{face:m.face,dir:-m.dir};}
const invertMoves=moves=>moves.slice().reverse().map(invertMove);
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function scramble(seed,count=36){if(!Number.isInteger(count)||count<0)throw new Error('Invalid scramble length');const random=seededRandom(seed),moves=[];let previous=-1;for(let i=0;i<count;i++){const choices=outerConfigs.filter(c=>c.axis!==previous),choice=choices[Math.floor(random()*choices.length)];moves.push({face:choice.id,dir:random()<.5?-1:1});previous=choice.axis;}return moves;}
function create(){
 const geometry=buildGeometry();
 const model={type:'fto',configs,configById,outerConfigs,middleConfigs,faces:geometry.faces,colors:palette.slice(),slots:geometry.slots,polyhedron:geometry,permutations:geometry.permutations,radius:geometry.radius,pieces:[],stickerState:[]};
 model.reset=()=>{model.pieces=geometry.pieces.map(p=>({...p,pos:p.home.slice(),orientation:identity()}));model.stickerState=geometry.slots.map(s=>({id:s.id,slot:s.id,color:s.color,piece:s.piece}));return model;};
 model.movingPieces=move=>{const m=normalizeMove(move);return model.pieces.filter(p=>affected(p.pos,configById[m.face])).map(p=>p.id);};
 model.applyMove=(move,dir)=>{
  const m=normalizeMove(move,dir),config=configById[m.face],matrix=m.dir===1?config.matrix:multiply(config.matrix,config.matrix);
  for(const piece of model.pieces)if(affected(piece.pos,config)){piece.pos=transform(matrix,piece.pos).map(x=>Object.is(x,-0)?0:x);piece.orientation=multiply(matrix,piece.orientation);}
  const permutation=geometry.permutations[m.face];for(const s of model.stickerState){s.slot=permutation[s.slot];if(m.dir===-1)s.slot=permutation[s.slot];}return model;
 };
 model.mesh=piece=>{if(typeof piece==='number')piece=model.pieces[piece];const convert=p=>{const points=p.points.map(v=>transform(piece.orientation,v));return{...p,vertices:points,points,normal:transform(piece.orientation,p.normal),center:transform(piece.orientation,p.center)};};return{...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};};
 model.snapshot=()=>({pieces:model.pieces.map(p=>({id:p.id,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s}))});
 model.uniformFaces=()=>model.faces.filter(f=>{const colors=model.stickerState.filter(s=>model.slots[s.slot].faceIndex===f.index).map(s=>s.color);return colors.every(c=>c===colors[0]);}).length;
 model.isSolved=()=>model.uniformFaces()===8;model.isExactSolved=()=>model.stickerState.every(s=>s.slot===s.id);
 model.scramble=scramble;model.invertMoves=invertMoves;model.invertMove=invertMove;model.moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.dir<0?'′':'');};model.normalizeMove=normalizeMove;model.rotateVector=rotateVector;model.reset();return model;
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,transform,multiply};
root.FTOEngine=Object.freeze({create,configs,configById,outerConfigs,middleConfigs,rotateVector,rotate:rotateVector,normalizeMove,invertMove,invertMoves,scramble,seededRandom,vector});
if(typeof module!=='undefined'&&module.exports)module.exports=root.FTOEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
