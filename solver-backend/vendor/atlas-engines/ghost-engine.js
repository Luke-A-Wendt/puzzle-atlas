/* Ghost Cube: original polyhedral realization of Adam G. Cowan’s mid-turn
 * 3×3 shape-modification principle. This is not a dimensional replica of a
 * commercial product. The shell is a rotated, translated cube, cut while its
 * outer y layers are offset. Geometry is stored in the aligned mechanism frame.
 * All permutations use exact signed integer matrices. Automatic docking only
 * changes the displayed physical pose, never sticker identity or solver state.
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

const CUT=.46, HALF=1.4, SHELL_CENTER=[.065,.025,-.035];
const OFFSETS=Object.freeze({'-1':-.31,'0':0,'1':.39});
const EULER=Object.freeze([.72,.15,.59]);
const rotateY=(p,a)=>rotateVector(p,[0,1,0],a);
function outerFrame(p){for(let axis=0;axis<3;axis++){const n=[0,0,0];n[axis]=1;p=rotateVector(p,n,EULER[axis]);}return p;}
const cloneMatrix=m=>m.map(r=>r.slice());
function transformFace(face,operation){const points=face.points.map(operation),normal=unit(operation(face.normal));return {...face,points,vertices:points,normal,center:mean(points),regionPolygon:face.regionPolygon?.map(operation)};}
function markerNormals(home,stickers){
 // A real surface patch carries one abstract orientation marker. Its home
 // direction follows its six-color shell face so the solved ring map forms
 // six clear groups. Actual polygons retain their own independent geometry.
 // The pair (home,markerNormal) must be nonparallel to determine a complete
 // piece orientation. For an axial center marker, add a small transverse
 // component from another patch on that same physical center piece.
 return stickers.map(s=>{
  const n=baseConfigs[s.faceIndex].normal;
  if(length(cross(home,n))>EPS)return n.slice();
  const other=stickers.find(t=>Math.abs(dot(baseConfigs[t.faceIndex].normal,n))<EPS);
  if(!other)throw Error('Ghost center needs a transverse orientation marker');
  return add(scale(n,4),baseConfigs[other.faceIndex].normal);
 });
}
let cachedGeometry;
function geometry(){
 if(cachedGeometry)return cachedGeometry;
 const planes=baseConfigs.map(c=>{const normal=outerFrame(c.normal);return {id:'S'+c.index,index:c.index,normal,offset:HALF+dot(normal,SHELL_CENTER),color:palette[c.index],colorIndex:c.index};});
 const faces=polytope(planes),pieces=[],slots=[];
 for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1]){
  const home=[x,y,z];if(!home.some(Boolean))continue;
  // Parallel slabs are preserved by docking. Within each slab the x/z cutting
  // grid has its own angle: these are the physical offset outer layers.
  const cuts=[];for(let axis=0;axis<3;axis++){const b=home[axis],raw=[0,0,0];raw[axis]=1;const n=rotateY(raw,OFFSETS[y]);if(b===0)cuts.push({normal:n,offset:CUT,cut:true},{normal:scale(n,-1),offset:CUT,cut:true});else cuts.push({normal:scale(n,-b),offset:-CUT,cut:true});}
  const dockedBody=polytope([...planes,...cuts]),surface=dockedBody.filter(f=>!f.cut);
  if(!surface.length)throw Error('Ghost construction omitted mechanism piece '+home);
  const aligned=f=>transformFace(f,p=>rotateY(p,-OFFSETS[y]));
  const body=dockedBody.map(aligned),vertices=unique(body.flatMap(f=>f.points)),centroid=mean(vertices),id=pieces.length;
  const stickers=surface.map(f=>{const a=aligned(f),points=a.points.map(p=>add(a.center,scale(sub(p,a.center),.925)));const s={id:slots.length,piece:id,face:f.id,faceIndex:f.index,color:f.color,colorIndex:f.colorIndex,normal:a.normal,center:a.center,regionPolygon:a.points,vertices:points,points};slots.push(s);return s;});
  const markers=markerNormals(home,stickers);stickers.forEach((s,i)=>{s.markerCenter=home.slice();s.markerNormal=markers[i].slice();});
  const virtualStickers=home.flatMap((v,axis)=>v?[{normal:baseConfigs.find(c=>c.axis===axis&&c.sign===v).normal,color:palette[baseConfigs.find(c=>c.axis===axis&&c.sign===v).index],face:faceOf(axis,v)}]:[]);
  const nonzero=home.filter(Boolean).length;
  pieces.push({id,home,pos:home.slice(),orientation:identity(),centroid,kind:nonzero===3?'corner':nonzero===2?'edge':'center',name:positionName(home),neighbors:surface.map(f=>f.id),stickers,body,virtualStickers,dockingOffset:OFFSETS[y]});
 }
 if(pieces.length!==26)throw Error('Ghost must contain 26 pieces');
 // A common radius bounds every quarter-turn and docking pose because every
 // transform is orthogonal about the same mechanism origin.
 const vertices=unique(pieces.flatMap(p=>p.body.flatMap(f=>f.points))),radius=Math.max(...vertices.map(length));
 return cachedGeometry={type:'ghost',faces,pieces,slots,vertices,radius,cut:CUT,tipCut:null,shellCenter:SHELL_CENTER.slice(),shellHalf:HALF,shellEuler:EULER.slice(),alignmentOffsets:{...OFFSETS}};
}
function normalizeMove(move,dir){if(typeof move==='string'){const m=/^([URFDLB])(2?)(['’′]?)$/.exec(move.trim());if(!m)throw Error('Invalid Ghost move: '+move);move={face:m[1],dir:dir===undefined?(m[3]?-1:1):dir,turns:m[2]?2:1};}const face=move?.face||move?.id,direction=move?.dir??1,turns=move?.turns??1;if(!baseConfigs.some(c=>c.id===face)||![1,-1].includes(direction)||![1,2].includes(turns))throw Error('Invalid Ghost turn');return {face,dir:direction,turns};}
const invertMove=move=>({...normalizeMove(move),dir:-normalizeMove(move).dir});
const invertMoves=moves=>moves.slice().reverse().map(invertMove);
function seededRandom(seed){let a=2166136261;for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const affected=(pos,c)=>pos[c.axis]*c.sign>0;
function moveMatrix(move){const m=normalizeMove(move),cfg=baseConfigs.find(c=>c.id===m.face);let result=identity();for(let i=0,n=(m.dir*m.turns%4+4)%4;i<n;i++)result=multiply(cfg.matrix,result);return result;}
const matrixIsIdentity=m=>m.every((r,i)=>r.every((x,j)=>x===Number(i===j)));
function create(type='ghost'){
 if(type!=='ghost')throw Error('GhostEngine only creates ghost');
 const g=geometry(),configs=baseConfigs.map(c=>({...c})),configById=Object.fromEntries(configs.map(c=>[c.id,c]));
 const model={type,mirrorEligible:true,configs,configById,outerConfigs:configs,tipConfigs:[],middleConfigs:[],faces:g.faces,colors:palette.slice(),slots:g.slots,polyhedron:g,radius:g.radius,pieces:[],cut:CUT,tipCut:null,vector,positionName,alignmentOffsets:g.alignmentOffsets};
 function refresh(){model.stickerState=model.pieces.flatMap(p=>p.stickers.map(s=>({id:s.id,slot:s.id,piece:p.id,color:s.color,normal:transform(p.orientation,s.markerNormal),center:transform(p.orientation,s.markerCenter),pos:p.pos.slice()})));model.virtualStickerState=model.pieces.flatMap(p=>p.virtualStickers.map((s,i)=>({id:p.id+':'+i,piece:p.id,p:p.pos.slice(),n:transform(p.orientation,s.normal),color:s.color,homeFace:s.face})));}
 model.reset=()=>{model.pieces=g.pieces.map(p=>({...p,pos:p.home.slice(),orientation:identity()}));refresh();return model;};
 model.normalizeMove=normalizeMove;model.movingPieces=move=>{const m=normalizeMove(move),c=configById[m.face];return model.pieces.filter(p=>affected(p.pos,c)).map(p=>p.id);};
 model.applyMove=(move,dir)=>{const m=normalizeMove(move,dir),c=configById[m.face],matrix=moveMatrix(m);for(const p of model.pieces)if(affected(p.pos,c)){p.pos=transform(matrix,p.pos);p.orientation=multiply(matrix,p.orientation);}refresh();return model;};
 model.isExactSolved=()=>model.pieces.every(p=>p.pos.every((v,i)=>v===p.home[i])&&matrixIsIdentity(p.orientation));
 // The asymmetric surface patches make center orientation observable. The
 // exact solved predicate intentionally includes all six center frames.
 model.isSolved=model.isExactSolved;model.isShapeSolved=model.isExactSolved;
 model.wouldSolve=move=>{const m=normalizeMove(move),c=configById[m.face],matrix=moveMatrix(m);return model.pieces.every(p=>{const moving=affected(p.pos,c),pos=moving?transform(matrix,p.pos):p.pos,ori=moving?multiply(matrix,p.orientation):p.orientation;return pos.every((v,i)=>v===p.home[i])&&matrixIsIdentity(ori);});};
 model.mesh=(piece,options={})=>{if(typeof piece==='number')piece=model.pieces[piece];const dock=options.dock===undefined?Number(model.isExactSolved()):options.dock,operation=v=>{let p=transform(piece.orientation,v);if(dock)p=rotateY(p,piece.dockingOffset*dock);return p;};return {...piece,body:piece.body.map(f=>transformFace(f,operation)),stickers:piece.stickers.map(f=>transformFace(f,operation))};};
 // Rendering includes physical alignment as a separate initial/final phase.
 // The ring permutation remains stationary until aligned, then follows its
 // exact quarter-turn path; docking does not change its logical state.
 model.animationPlan=animation=>{if(!animation)return {turn:0,dock:Number(model.isExactSolved())};const progress=Math.max(0,Math.min(1,animation.progress||0)),start=model.isExactSolved(),end=model.wouldSolve(animation.move),open=start?.22:0,close=end?.22:0,turn=Math.max(0,Math.min(1,(progress-open)/(1-open-close)));return {turn,dock:start&&progress<open?1-progress/open:end&&progress>1-close?(progress-(1-close))/close:0};};
 model.renderMesh=(piece,animation)=>{const plan=model.animationPlan(animation);if(!animation)return model.mesh(piece,{dock:plan.dock});const m=normalizeMove(animation.move),cfg=configById[m.face],moving=affected(piece.pos,cfg),angle=cfg.angle*m.dir*m.turns*plan.turn;const operation=v=>{let p=transform(piece.orientation,v);if(moving)p=rotateVector(p,cfg.normal,angle);if(plan.dock)p=rotateY(p,piece.dockingOffset*plan.dock);return p;};return {...piece,body:piece.body.map(f=>transformFace(f,operation)),stickers:piece.stickers.map(f=>transformFace(f,operation))};};
 model.snapshot=()=>({type,pieces:model.pieces.map(p=>({id:p.id,pos:p.pos.slice(),orientation:cloneMatrix(p.orientation)})),stickers:model.stickerState.map(s=>({...s})),virtualStickers:model.virtualStickerState.map(s=>({...s,p:s.p.slice(),n:s.n.slice()}))});
 model.uniformFaces=()=>model.isSolved()?6:0;
 model.scramble=(seed,count=30)=>{const random=seededRandom(seed),out=[];let previous=-1;for(let i=0;i<count;i++){const options=configs.filter(c=>c.axis!==previous),c=options[Math.floor(random()*options.length)],amount=Math.floor(random()*3);out.push({face:c.id,dir:amount===1?-1:1,turns:amount===2?2:1});previous=c.axis;}return out;};
 model.invertMove=invertMove;model.invertMoves=invertMoves;model.moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.turns===2?'2':m.dir<0?'′':'');};model.rotateVector=rotateVector;model.reset();return model;
}
const vector={add,sub,scale,dot,cross,length,unit,distance,mean,transform,multiply,identity};
root.GhostEngine=Object.freeze({create,types:['ghost'],configs:baseConfigs,normalizeMove,invertMove,invertMoves,seededRandom,rotateVector,rotate:rotateVector,vector,positionName,polytope,geometry,outerFrame});
// The existing shape UI is intentionally reused without changing other games.
if(root.ShapeEngine){const shared=root.ShapeEngine;root.ShapeEngine=Object.freeze({...shared,create:type=>type==='ghost'?create():shared.create(type)});}
if(typeof module!=='undefined'&&module.exports)module.exports=root.GhostEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
