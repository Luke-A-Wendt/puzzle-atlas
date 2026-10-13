/* Exact rigid-piece models for cubic-mechanism shape puzzles.
 * Geometry is cut from convex solids; internal cut faces remain on each body.
 * All legal quarter turns use signed integer matrices, including independent
 * corner-octahedron tips. Physical references: jaapsch.net/puzzles/
 * cubevari.htm, octahed.htm, pyramorf.htm. No external runtime dependencies.
 */
(function(root){
'use strict';
const EPS=1e-7,ANGLE=-Math.PI/2;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a),unit=a=>scale(a,1/length(a)),distance=(a,b)=>length(sub(a,b)),mean=a=>scale(a.reduce(add,[0,0,0]),1/a.length);
const identity=()=>[[1,0,0],[0,1,0],[0,0,1]],transform=(m,p)=>m.map(r=>dot(r,p)||0),multiply=(a,b)=>a.map(r=>[0,1,2].map(j=>r.reduce((s,x,k)=>s+x*b[k][j],0)||0));
function rotateVector(p,axis,angle){const n=unit(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));}
const palette=['#f4f2e8','#f36c73','#36bf85','#ffd447','#ff9b52','#4394f7','#b884ee','#55c5d8','#a9adb8','#e990c5','#91be53','#d4ac72','#242832'];
const axisData=[['U',1,1],['R',0,1],['F',2,1],['D',1,-1],['L',0,-1],['B',2,-1]];
const baseConfigs=axisData.map(([id,axis,sign],index)=>{const normal=[0,0,0];normal[axis]=sign;const cols=identity().map(p=>rotateVector(p,normal,ANGLE).map(v=>Math.round(v)||0));return{id,label:id,index,axis,sign,normal,anchor:normal,angle:ANGLE,matrix:identity().map((_,i)=>cols.map(c=>c[i])),opposite:axisData[(index+3)%6][0],tip:false,middle:false};});
const faceOf=(axis,sign)=>axisData.find(d=>d[1]===axis&&d[2]===sign)[0];
function positionName(p){return ['U','D','F','B','R','L'].filter(id=>{const c=baseConfigs.find(c=>c.id===id);return p[c.axis]*c.sign>0;}).join('');}
function orderPolygon(points,normal){const c=mean(points),u=unit(sub(points[0],c)),v=cross(normal,u);return points.slice().sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function area(points,normal){let total=0;for(let i=1;i<points.length-1;i++)total+=Math.abs(dot(cross(sub(points[i],points[0]),sub(points[i+1],points[0])),normal))/2;return total;}
function unique(points){const out=[];for(const p of points)if(!out.some(q=>distance(p,q)<EPS))out.push(p);return out;}
function polytope(planes){const vertices=[];for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);if(Math.abs(det)<EPS)continue;const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vertices.some(v=>distance(v,p)<EPS))continue;vertices.push(p);}return planes.map(plane=>{const points=vertices.filter(p=>Math.abs(dot(p,plane.normal)-plane.offset)<EPS);if(points.length<3)return null;const n=unit(plane.normal),polygon=orderPolygon(points,n);return area(polygon,n)>EPS?{...plane,normal:n,offset:plane.offset/length(plane.normal),vertices:polygon,points:polygon,center:mean(polygon)}:null;}).filter(Boolean);}
function signs(){const out=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])out.push([x,y,z]);return out;}
function makePlanes(type){let planes=[],cut,tipCut=null;
 if(type==='rhombic'){cut=2/3;for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){const n=[0,0,0];n[a]=sa;n[b]=sb;const pair=a===0?b-1:2,ci=pair*2+(sa===sb?0:1);planes.push({normal:n,offset:2,colorIndex:ci});}}
 else if(type==='flatdiamond'){cut=1/3;for(const c of baseConfigs)planes.push({normal:c.normal,offset:1,colorIndex:c.index});for(const c of baseConfigs){const n=scale([1,1,1],2*c.sign);n[c.axis]-=3*c.sign;planes.push({normal:n,offset:3,colorIndex:c.index});}planes.push({normal:[1,1,1],offset:5/3,colorIndex:8},{normal:[-1,-1,-1],offset:5/3,colorIndex:8});}
 else if(type==='cornerocta'||type==='trajber'||type==='jewel'){const r=1.8;cut=type==='trajber'?r*.28:r/3;if(type==='cornerocta')tipCut=2*r/3;planes=signs().map((normal,index)=>({normal,offset:r,colorIndex:index}));if(type==='jewel')for(const c of baseConfigs)planes.push({normal:c.normal,offset:2*r/3,colorIndex:12});}
 else if(type==='pyramorphix'||type==='mastermorphix'){/* The 3x3 cuts must be inside +/-1/3: at that degenerate depth the four flat corner pieces vanish. +/-1/5 gives the standard 26-piece tetrahedral topology. */cut=type==='pyramorphix'?0:1/5;planes=signs().filter(n=>n[0]*n[1]*n[2]===1).map((normal,index)=>({normal,offset:1,colorIndex:[1,2,3,5][index]}));}
 else throw new Error('Unknown shape puzzle: '+type);
 return{cut,tipCut,planes:planes.map((p,index)=>({...p,id:'S'+index,index,color:palette[p.colorIndex]}))};
}
const cache={};
function geometry(type){if(cache[type])return cache[type];const specification=makePlanes(type),{planes,cut,tipCut}=specification,faces=polytope(planes),pieces=[],slots=[];
 const bands=type==='pyramorphix'?[-1,1]:tipCut?[-2,-1,0,1,2]:[-1,0,1];
 for(const x of bands)for(const y of bands)for(const z of bands){const home=[x,y,z];if(!home.some(Boolean))continue;const cuts=[];for(let axis=0;axis<3;axis++){const b=home[axis],n=[0,0,0];n[axis]=1;if(b===0)cuts.push({normal:n,offset:cut,cut:true},{normal:scale(n,-1),offset:cut,cut:true});else{cuts.push({normal:scale(n,-Math.sign(b)),offset:-(Math.abs(b)===2?tipCut:cut),cut:true});if(tipCut&&Math.abs(b)===1)cuts.push({normal:scale(n,Math.sign(b)),offset:tipCut,cut:true});}}
 const body=polytope([...planes,...cuts]),surface=body.filter(f=>!f.cut);if(!surface.length)continue;const vertices=unique(body.flatMap(f=>f.points)),centroid=mean(vertices);if(cuts.some(p=>dot(p.normal,centroid)>p.offset-EPS))continue;
 const id=pieces.length,nonzero=home.filter(Boolean).length,isTip=home.some(v=>Math.abs(v)===2),kind=isTip?'tip':nonzero===3?'corner':nonzero===2?'edge':'center',name=positionName(home)+(isTip?' tip':'');
 const stickers=surface.map(f=>{const points=f.points.map(p=>add(f.center,scale(sub(p,f.center),.92)));const s={id:slots.length,piece:id,face:f.id,faceIndex:f.index,color:f.color,colorIndex:f.colorIndex,normal:f.normal,center:f.center,regionPolygon:f.points,vertices:points,points};slots.push(s);return s;});
 const virtualStickers=isTip?[]:home.flatMap((v,axis)=>v?[{normal:baseConfigs.find(c=>c.axis===axis&&c.sign===Math.sign(v)).normal,color:palette[baseConfigs.find(c=>c.axis===axis&&c.sign===Math.sign(v)).index],face:faceOf(axis,Math.sign(v))}]:[]);
 pieces.push({id,home:home.slice(),pos:home.slice(),centroid,kind,name,neighbors:surface.map(f=>f.id),stickers,body,virtualStickers});
 }
 const vertices=unique(faces.flatMap(f=>f.points)),radius=Math.max(...vertices.map(length));
 const expected={rhombic:[26,60],flatdiamond:[26,68],cornerocta:[24,72],trajber:[26,56],pyramorphix:[8,16],jewel:[18,54],mastermorphix:[26,40]};
 if(pieces.length!==expected[type][0]||slots.length!==expected[type][1])throw new Error(type+' geometry mismatch: '+pieces.length+' pieces / '+slots.length+' stickers');
 cache[type]={type,faces,pieces,slots,vertices,radius,cut,tipCut};return cache[type];
}
function normalizeMove(move,dir){if(typeof move==='string'){const match=/^([URFDLBurfdlb])(2?)(['’′]?)$/.exec(move.trim());if(!match)throw new Error('Invalid shape move: '+move);move={face:match[1],dir:dir===undefined?(match[3]?-1:1):dir,turns:match[2]?2:1};}if(!move||!baseConfigs.some(c=>c.id===String(move.face||move.id).toUpperCase()))throw new Error('Invalid shape turn');const direction=move.dir===undefined?1:move.dir,turns=move.turns===undefined?1:move.turns;if(![1,-1].includes(direction)||![1,2].includes(turns))throw new Error('Invalid shape turn amount');return{face:move.face||move.id,dir:direction,turns};}
const invertMove=move=>{const m=normalizeMove(move);return{...m,dir:-m.dir};},invertMoves=moves=>moves.slice().reverse().map(invertMove);
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function affected(pos,c){return c.tip?pos[c.axis]*c.sign===2:pos[c.axis]*c.sign>0;}
const rotations=[identity()];for(let i=0;i<rotations.length;i++)for(const c of baseConfigs.slice(0,3)){const m=multiply(c.matrix,rotations[i]);if(!rotations.some(r=>JSON.stringify(r)===JSON.stringify(m)))rotations.push(m);}
const pointKey=p=>p.map(x=>Math.round(x*1e6)).join(',');
function polygonSignature(p,color,matrix){return color+':'+p.map(v=>pointKey(matrix?transform(matrix,v):v)).sort().join(';');}
function surfaceSignature(pieces,matrix,monochrome=false){return pieces.flatMap(p=>p.stickers.map(s=>polygonSignature(s.regionPolygon.map(v=>transform(p.orientation||identity(),v)),monochrome?'surface':s.color,matrix))).sort().join('|');}
function create(type){const g=geometry(type),configs=baseConfigs.map(c=>({...c}));if(type==='cornerocta')for(const c of baseConfigs)configs.push({...c,id:c.id.toLowerCase(),label:c.id.toLowerCase(),index:c.index+6,tip:true,opposite:c.opposite.toLowerCase()});const configById=Object.fromEntries(configs.map(c=>[c.id,c])),solvedSignatures=new Set(rotations.map(m=>surfaceSignature(g.pieces,m))),shapeSignatures=new Set(rotations.map(m=>surfaceSignature(g.pieces,m,true)));
 const model={type,mirrorEligible:['flatdiamond','pyramorphix','mastermorphix'].includes(type),configs,configById,outerConfigs:configs.filter(c=>!c.tip),tipConfigs:configs.filter(c=>c.tip),middleConfigs:[],faces:g.faces,colors:palette.slice(),slots:g.slots,polyhedron:g,radius:g.radius,pieces:[],cut:g.cut,tipCut:g.tipCut,vector,positionName};let cachedSolved=null,cachedShapeSolved=null;
 function refresh(){cachedSolved=null;cachedShapeSolved=null;model.stickerState=model.pieces.flatMap(p=>p.stickers.map(s=>({id:s.id,slot:s.id,piece:p.id,color:s.color,normal:transform(p.orientation,s.normal),center:transform(p.orientation,s.center),pos:p.pos.slice()})));model.virtualStickerState=model.pieces.flatMap(p=>p.virtualStickers.map((s,i)=>({id:p.id+':'+i,piece:p.id,p:p.pos.slice(),n:transform(p.orientation,s.normal),color:s.color,homeFace:s.face})));}
 model.reset=()=>{model.pieces=g.pieces.map(p=>({...p,pos:p.home.slice(),orientation:identity()}));refresh();return model;};
 model.normalizeMove=(move,dir)=>{const m=normalizeMove(move,dir);if(!configById[m.face])throw new Error('This puzzle has no '+m.face+' turn');return m;};
 model.movingPieces=move=>{const m=model.normalizeMove(move);return model.pieces.filter(p=>affected(p.pos,configById[m.face])).map(p=>p.id);};
 model.applyMove=(move,dir)=>{const m=model.normalizeMove(move,dir),c=configById[m.face],count=((m.dir*m.turns)%4+4)%4;let matrix=identity();for(let i=0;i<count;i++)matrix=multiply(c.matrix,matrix);for(const p of model.pieces)if(affected(p.pos,c)){p.pos=transform(matrix,p.pos);p.orientation=multiply(matrix,p.orientation);}refresh();return model;};
 model.mesh=piece=>{if(typeof piece==='number')piece=model.pieces[piece];const convert=f=>{const points=f.points.map(v=>transform(piece.orientation,v));return{...f,vertices:points,points,regionPolygon:f.regionPolygon&&f.regionPolygon.map(v=>transform(piece.orientation,v)),normal:transform(piece.orientation,f.normal),center:transform(piece.orientation,f.center)};};return{...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};};
 model.snapshot=()=>({type,pieces:model.pieces.map(p=>({id:p.id,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s})),virtualStickers:model.virtualStickerState.map(s=>({...s,p:s.p.slice(),n:s.n.slice()}))});
 model.isSolved=()=>cachedSolved===null?(cachedSolved=solvedSignatures.has(surfaceSignature(model.pieces))):cachedSolved;
 model.isShapeSolved=()=>cachedShapeSolved===null?(cachedShapeSolved=shapeSignatures.has(surfaceSignature(model.pieces,null,true))):cachedShapeSolved;
 model.isExactSolved=()=>model.pieces.every(p=>p.pos.every((v,i)=>v===p.home[i])&&p.orientation.every((r,i)=>r.every((v,j)=>v===Number(i===j))));
 model.uniformFaces=()=>{if(model.isSolved())return model.faces.length;const surface=model.pieces.flatMap(p=>model.mesh(p).stickers);return model.faces.filter(f=>{const target=g.slots.filter(s=>s.faceIndex===f.index).map(s=>polygonSignature(s.regionPolygon,s.color)).sort().join('|'),current=surface.filter(s=>distance(s.normal,f.normal)<EPS&&Math.abs(dot(s.center,f.normal)-f.offset)<EPS).map(s=>polygonSignature(s.regionPolygon,s.color)).sort().join('|');return current.length>0&&current===target;}).length;};
 model.scramble=(seed,count=type==='pyramorphix'?20:30)=>{if(!Number.isInteger(count)||count<0)throw new Error('Invalid scramble length');const random=seededRandom(seed),out=[];let previous=-1;for(let i=0;i<count;i++){const options=model.outerConfigs.filter(c=>c.axis!==previous),c=options[Math.floor(random()*options.length)],amount=Math.floor(random()*3);out.push({face:c.id,dir:amount===1?-1:1,turns:amount===2?2:1});previous=c.axis;}if(type==='cornerocta')for(const c of model.tipConfigs){const n=Math.floor(random()*4);if(n)out.push({face:c.id,dir:n===3?-1:1,turns:n===2?2:1});}return out;};
 model.invertMoves=invertMoves;model.invertMove=invertMove;model.moveLabel=move=>{const m=model.normalizeMove(move);return m.face+(m.turns===2?'2':m.dir<0?'′':'');};model.rotateVector=rotateVector;model.reset();return model;
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,transform,multiply,identity};
root.ShapeEngine=Object.freeze({create,types:['rhombic','flatdiamond','cornerocta','trajber','pyramorphix','jewel','mastermorphix'],configs:baseConfigs,normalizeMove,invertMove,invertMoves,seededRandom,rotateVector,rotate:rotateVector,vector,positionName,rotations,polytope});
if(typeof module!=='undefined'&&module.exports)module.exports=root.ShapeEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
