/* Exact Skewb-family turns with clipped rigid-piece geometry.
 * Cube, tetrahedral Jing, dodecahedral Puzzleball and octahedral Diamond
 * forms share four central diagonal cuts. Master Skewb uses eight parallel
 * shallow cuts, retaining all fifty actual external rigid pieces.
 * L/R/D/B are the fixed tetrad; l/r/d/b turn their opposite hemispheres.
 * Clockwise always means clockwise looking from outside the named side.
 * The geometry is generated once; all state changes use integer matrices.
 */
(function (root) {
  'use strict';
  const EPS=1e-8, ANGLE=-2*Math.PI/3;
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const sub=(a,b)=>a.map((x,i)=>x-b[i]);
  const scale=(a,k)=>a.map(x=>x*k);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=a=>Math.hypot(...a);
  const unit=a=>scale(a,1/length(a));
  const distance=(a,b)=>length(sub(a,b));
  const mean=a=>scale(a.reduce(add,[0,0,0]),1/a.length);
  const identity=()=>[[1,0,0],[0,1,0],[0,0,1]];
  const transform=(m,p)=>m.map(r=>dot(r,p));
  const multiply=(a,b)=>a.map(row=>[0,1,2].map(j=>row.reduce((s,x,k)=>s+x*b[k][j],0)));
  function rotateVector(p,axis,angle) {
    const n=unit(axis),c=Math.cos(angle),s=Math.sin(angle);
    return add(add(scale(p,c),scale(cross(n,p),s)),scale(n,dot(n,p)*(1-c)));
  }
  const anchors=[[1,1,1],[-1,1,-1],[1,-1,-1],[-1,-1,1]];
  const labels=['L','R','D','B','l','r','d','b'];
  const configs=labels.map((id,index)=>{
    const anchor=scale(anchors[index%4],index<4?1:-1), normal=unit(anchor);
    const cols=identity().map(p=>rotateVector(p,normal,ANGLE).map(x=>Math.round(x)));
    const matrix=identity().map((_,i)=>cols.map(col=>col[i]));
    return {id,label:id,index,anchor,normal,angle:ANGLE,matrix,opposite:labels[(index+4)%8],core:index<4};
  });
  const configById=Object.fromEntries(configs.map(c=>[c.id,c]));
  const palette=['#f2f4fa','#f6c84b','#e65361','#46b990','#4c91ec','#ab75e8','#f39948','#55c5d8'];
  const colorNames=['Pearl','Gold','Coral','Emerald','Blue','Violet','Orange','Aqua'];
  function orderPolygon(points,normal) {
    const center=mean(points),u=unit(sub(points[0],center)),v=cross(normal,u);
    return points.slice().sort((a,b)=>Math.atan2(dot(sub(a,center),v),dot(sub(a,center),u))-Math.atan2(dot(sub(b,center),v),dot(sub(b,center),u)));
  }
  function area(points,normal) {
    if(points.length<3)return 0;
    let result=0;
    for(let i=1;i<points.length-1;i++)result+=Math.abs(dot(cross(sub(points[i],points[0]),sub(points[i+1],points[0])),normal))/2;
    return result;
  }
  function hull(vertices) {
    const faces=[];
    for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)for(let k=j+1;k<vertices.length;k++) {
      let n=cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));
      if(length(n)<EPS)continue;
      n=unit(n);let offset=dot(n,vertices[i]);
      if(offset<0){n=scale(n,-1);offset=-offset;}
      if(offset<EPS||vertices.some(p=>dot(n,p)>offset+EPS))continue;
      if(faces.some(f=>distance(n,f.normal)<EPS))continue;
      const polygon=orderPolygon(vertices.filter(p=>Math.abs(dot(p,n)-offset)<EPS),n);
      faces.push({normal:n,offset,vertices:polygon,points:polygon,center:mean(polygon)});
    }
    return faces;
  }
  function polytope(planes) {
    const vertices=[];
    for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++) {
      const a=planes[i],b=planes[j],c=planes[k],bc=cross(b.normal,c.normal),det=dot(a.normal,bc);
      if(Math.abs(det)<EPS)continue;
      const p=scale(add(add(scale(bc,a.offset),scale(cross(c.normal,a.normal),b.offset)),scale(cross(a.normal,b.normal),c.offset)),1/det);
      if(planes.some(f=>dot(f.normal,p)>f.offset+EPS)||vertices.some(v=>distance(v,p)<EPS))continue;
      vertices.push(p);
    }
    return planes.map(plane=>{
      const points=vertices.filter(p=>Math.abs(dot(p,plane.normal)-plane.offset)<EPS);
      if(points.length<3)return null;
      const polygon=orderPolygon(points,plane.normal);
      return area(polygon,plane.normal)>EPS?{...plane,vertices:polygon,points:polygon,center:mean(polygon)}:null;
    }).filter(Boolean);
  }
  const cache={};
  function buildGeometry(type) {
    if(cache[type])return cache[type];
    if(!['ultimate','diamond','skewb','jing','masterskewb'].includes(type))throw new Error('Unknown Skewb puzzle: '+type);
    let vertices=[];
    if(type==='jing') { vertices=anchors.map(a=>a.slice());
    } else if(type==='skewb'||type==='masterskewb') {
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
    } else if(type==='diamond') {
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const p=[0,0,0];p[axis]=sign*1.7;vertices.push(p);}
    } else {
      const phi=(1+Math.sqrt(5))/2;
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
      for(const a of [-1,1])for(const b of [-1,1]){
        vertices.push([0,a/phi,b*phi],[a/phi,b*phi,0],[a*phi,0,b/phi]);
      }
    }
    let faces=hull(vertices);
    // Stable face order, with a neighboring-color palette and matching opposite
    // colors on Ultimate, as on the usual six-color physical puzzle.
    faces.sort((a,b)=>b.normal[1]-a.normal[1]||Math.atan2(a.normal[2],a.normal[0])-Math.atan2(b.normal[2],b.normal[0]));
    const paired=[];
    faces=faces.map((f,index)=>{
      let colorIndex;
      if(type==='skewb'||type==='masterskewb'){const axis=f.normal.findIndex(v=>Math.abs(v)>.9);colorIndex=axis===1?(f.normal[axis]>0?0:1):axis===0?(f.normal[axis]>0?2:6):(f.normal[axis]>0?3:4);}
      else if(type==='jing')colorIndex=[1,2,3,4][index];
      else if(type==='diamond')colorIndex=index;
      else {
        colorIndex=paired.findIndex(n=>Math.abs(dot(n,f.normal))>1-EPS);
        if(colorIndex<0){colorIndex=paired.length;paired.push(f.normal);}
      }
      const faceConfig=type==='diamond'?configs.find(c=>dot(c.normal,f.normal)>1-EPS):null;
      const cubeFace=(type==='skewb'||type==='masterskewb')?['R','U','F'][f.normal.findIndex(v=>v>.9)]||['L','D','B'][f.normal.findIndex(v=>v<-.9)]:null;
      return {...f,id:cubeFace||(faceConfig?faceConfig.id:'F'+(index+1)),index,color:palette[colorIndex],colorName:colorNames[colorIndex],colorIndex};
    });
    const pieceAnchors=[...anchors,...anchors.map(a=>scale(a,-1))];
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const p=[0,0,0];p[axis]=sign;pieceAnchors.push(p);}
    const pieces=[],stickerSlots=[];
    const actualConfigs=(type==='jing'?configs.slice(0,4):configs).map(c=>({...c,offset:type==='masterskewb'?.5:0}));
    const regions=[];
    if(type==='masterskewb') {
      // Each of four diagonal directions has two parallel cuts. Enumerating
      // the 3^4 half-space cells creates the actual 50 external rigid pieces.
      for(let code=0;code<81;code++){
        let value=code;const cuts=[],regimes=[];
        for(const n of anchors){const region=value%3;value=Math.floor(value/3);regimes.push(region);
          if(region===0)cuts.push({normal:unit(n),offset:-.5/Math.sqrt(3),cut:true});
          if(region===1)cuts.push({normal:unit(n),offset:.5/Math.sqrt(3),cut:true},{normal:scale(unit(n),-1),offset:.5/Math.sqrt(3),cut:true});
          if(region===2)cuts.push({normal:scale(unit(n),-1),offset:-.5/Math.sqrt(3),cut:true});
        }
        const body=polytope([...faces,...cuts]),skin=body.filter(f=>!f.cut);
        if(!skin.length)continue;
        const vertices=[];for(const face of body)for(const v of face.points)if(!vertices.some(w=>distance(v,w)<EPS))vertices.push(v);
        const volume=body.reduce((sum,f)=>sum+area(f.points,f.normal)*dot(f.normal,f.center)/3,0);
        if(volume<EPS)continue;
        const pos=mean(vertices).map(x=>Math.round(x*1e12)/1e12);
        regions.push({pos,body,regimes});
      }
    } else for(const pos of pieceAnchors) {
      const signs=anchors.map(n=>dot(n,pos)>0?1:-1),cuts=anchors.map((n,i)=>({normal:scale(unit(n),-signs[i]),offset:0,cut:true}));
      regions.push({pos,body:polytope([...faces,...cuts]),signs});
    }
    const faceName=p=>(p[1]>EPS?'U':p[1]<-EPS?'D':'')+(p[2]>EPS?'F':p[2]<-EPS?'B':'')+(p[0]>EPS?'R':p[0]<-EPS?'L':'');
    for(const region of regions) {
      const {pos,body}=region,id=pieces.length;
      const stickers=body.filter(p=>!p.cut).map(p=>{
        const points=p.points.map(v=>add(p.center,scale(sub(v,p.center),.91)));
        const sticker={id:stickerSlots.length,piece:id,face:p.id,faceIndex:p.index,color:p.color,colorIndex:p.colorIndex,normal:p.normal,center:p.center,vertices:points,points,regionPolygon:p.points};
        stickerSlots.push(sticker);return sticker;
      });
      const neighbors=configs.slice(0,4).filter(c=>dot(c.anchor,pos)>0).map(c=>c.id);
      const diagonal=pos.every(v=>Math.abs(v)>EPS),fixed=diagonal&&anchors.some(a=>distance(unit(a),unit(pos))<EPS);
      let kind=diagonal?(type==='diamond'?'center':'corner'):(type==='diamond'?'corner':'roof');
      let name=diagonal?(fixed?configs.find(c=>distance(unit(c.anchor),unit(pos))<EPS).id:neighbors.join('')):neighbors.join('');
      if(type==='jing')kind=stickers.length===3?'corner':stickers.length===2?'edge':'center';
      if(type==='skewb'&&!diagonal)kind='center';
      if(type==='masterskewb'){
        kind=stickers.length===3?'corner':stickers.length===2?'edge':pos.filter(v=>Math.abs(v)>EPS).length===1?'center':'face';
        name=kind==='face'?stickers[0].face+':'+faceName(pos):faceName(pos);
      }
      pieces.push({id,pos:pos.slice(),home:pos.slice(),kind,fixed,name,neighbors,...region,stickers,body});
    }
    const expected={diamond:[8,14,32],ultimate:[12,14,48],skewb:[6,14,30],jing:[4,14,28],masterskewb:[6,50,78]}[type];
    if(faces.length!==expected[0]||pieces.length!==expected[1]||stickerSlots.length!==expected[2])throw new Error('Unexpected '+type+' geometry: '+faces.length+' faces, '+pieces.length+' pieces, '+stickerSlots.length+' stickers');
    const permutations={};
    for(const config of actualConfigs) {
      const mapping=stickerSlots.map(s=>{
        const moving=dot(pieces[s.piece].pos,config.anchor)>config.offset+EPS;
        if(!moving)return s.id;
        const center=transform(config.matrix,s.center),normal=transform(config.matrix,s.normal);
        const target=stickerSlots.find(t=>distance(t.center,center)<EPS&&distance(t.normal,normal)<EPS);
        if(!target)throw new Error(type+' turn '+config.id+' has no destination for sticker '+s.id);
        return target.id;
      });
      if(new Set(mapping).size!==stickerSlots.length)throw new Error('Non-bijective move '+config.id);
      permutations[config.id]=mapping;
    }
    return cache[type]={type,configs:actualConfigs,faces,pieces,slots:stickerSlots,vertices,permutations,radius:Math.max(...vertices.map(length))};
  }
  function normalizeMove(move,dir) {
    if(typeof move==='number')move={face:configs[move]&&configs[move].id,dir:dir===undefined?1:dir};
    if(typeof move==='string')move={face:move,dir:dir===undefined?1:dir};
    if(!move||!configById[move.face||move.id])throw new Error('Invalid Skewb turn');
    const direction=move.dir===undefined?1:move.dir;
    if(direction!==1&&direction!==-1)throw new Error('Turn direction must be 1 or -1');
    return {face:move.face||move.id,dir:direction};
  }
  function invertMove(move){const m=normalizeMove(move);return {face:m.face,dir:-m.dir};}
  const invertMoves=moves=>moves.slice().reverse().map(invertMove);
  function seededRandom(seed) {
    let a=2166136261;
    for(const c of String(seed)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}
    return ()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  }
  function scramble(seed,count=24,available=configs.slice(0,4)) {
    if(!Number.isInteger(count)||count<0)throw new Error('Invalid scramble length');
    const random=seededRandom(seed),moves=[];let previous=-1;
    // Using the fixed tetrad gives a genuine scramble without gratuitous whole-
    // puzzle reorientations. Master has eight independent shallow cuts and
    // explicitly supplies all of them so both off-center orbits get mixed.
    for(let i=0;i<count;i++){
      const choices=available.filter(c=>c.index!==previous);
      const choice=choices[Math.floor(random()*choices.length)];
      moves.push({face:choice.id,dir:random()<.5?-1:1});previous=choice.index;
    }
    return moves;
  }
  function create(type) {
    const geometry=buildGeometry(type);
    const localConfigs=geometry.configs,localById=Object.fromEntries(localConfigs.map(c=>[c.id,c]));
    const normalize=(move,dir)=>{const m=normalizeMove(move,dir);if(!localById[m.face])throw new Error('Unavailable '+type+' turn: '+m.face);return m;};
    const model={type,configs:localConfigs,configById:localById,faces:geometry.faces,colors:[...new Set(geometry.faces.map(f=>f.color))],slots:geometry.slots,polyhedron:geometry,permutations:geometry.permutations,radius:geometry.radius,pieces:[],stickerState:[]};
    model.reset=()=>{
      model.pieces=geometry.pieces.map(p=>({...p,pos:p.home.slice(),orientation:identity()}));
      model.stickerState=geometry.slots.map(s=>({id:s.id,slot:s.id,color:s.color,piece:s.piece}));
      return model;
    };
    model.movingPieces=(move)=>{
      const m=normalize(move),cfg=localById[m.face],axis=cfg.anchor;
      return model.pieces.filter(p=>dot(p.pos,axis)>cfg.offset+EPS).map(p=>p.id);
    };
    model.applyMove=(move,dir)=>{
      const m=normalize(move,dir),config=localById[m.face];
      const matrix=m.dir===1?config.matrix:multiply(config.matrix,config.matrix);
      for(const piece of model.pieces)if(dot(piece.pos,config.anchor)>config.offset+EPS){
        piece.pos=transform(matrix,piece.pos).map(x=>Object.is(x,-0)?0:x);
        piece.orientation=multiply(matrix,piece.orientation);
      }
      const permutation=geometry.permutations[m.face];
      for(const sticker of model.stickerState){sticker.slot=permutation[sticker.slot];if(m.dir===-1)sticker.slot=permutation[sticker.slot];}
      return model;
    };
    model.mesh=(piece)=>{
      if(typeof piece==='number')piece=model.pieces[piece];
      const convert=p=>{const points=p.points.map(v=>transform(piece.orientation,v));return {...p,vertices:points,points,normal:transform(piece.orientation,p.normal),center:transform(piece.orientation,p.center)};};
      return {...piece,stickers:piece.stickers.map(convert),body:piece.body.map(convert)};
    };
    model.snapshot=()=>({pieces:model.pieces.map(p=>({id:p.id,pos:p.pos.slice(),orientation:p.orientation.map(r=>r.slice())})),stickers:model.stickerState.map(s=>({...s}))});
    model.uniformFaces=()=>model.faces.filter(f=>{
      const colors=model.stickerState.filter(s=>model.slots[s.slot].faceIndex===f.index).map(s=>s.color);
      return colors.every(c=>c===colors[0]);
    }).length;
    model.isSolved=()=>model.uniformFaces()===model.faces.length;
    model.isExactSolved=()=>model.stickerState.every(s=>s.slot===s.id);
    model.scramble=(seed,count=24)=>scramble(seed,count,type==='masterskewb'?localConfigs:localConfigs.slice(0,4));model.invertMoves=invertMoves;model.invertMove=invertMove;
    model.moveLabel=move=>{const m=normalizeMove(move);return m.face+(m.dir<0?'′':'');};
    model.normalizeMove=normalize;model.rotateVector=rotateVector;model.reset();return model;
  }
  const types=['ultimate','diamond','skewb','jing','masterskewb'];
  const vector={add,sub,scale,dot,cross,length,unit,distance,mean,transform,multiply};
  root.SkewbEngine=Object.freeze({create,types,configs,configById,rotateVector,rotate:rotateVector,normalizeMove,invertMove,invertMoves,scramble,seededRandom,vector});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.SkewbEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
