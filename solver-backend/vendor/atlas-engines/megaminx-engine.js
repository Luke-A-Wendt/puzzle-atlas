
/* Megaminx geometry and exact legal face permutations. No external dependencies.
   A–L are game-local face labels; a positive move is clockwise as seen outside.
   The dodecahedron is the intersection n.face · p <= 1, with icosahedral normals. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2, EPS = 1e-9, CUT = 0.70;
  const add = (a,b) => a.map((x,i) => x+b[i]);
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const scale = (v,k) => v.map(x => x*k);
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length = v => Math.hypot(...v);
  const unit = v => scale(v,1/length(v));
  const distance = (a,b) => length(sub(a,b));
  function rotate(v,axis,angle) {
    const n = unit(axis), c = Math.cos(angle), s = Math.sin(angle);
    return add(add(scale(v,c),scale(cross(n,v),s)),scale(n,dot(n,v)*(1-c)));
  }
  const colors = ['#f8fafc','#e54147','#27b985','#3286ee','#9967e8','#ffd251',
                  '#f38838','#6dd8db','#f18fbd','#b6d657','#926750','#747d90'];
  const colorNames = ['White','Red','Emerald','Blue','Violet','Yellow',
                      'Orange','Aqua','Pink','Lime','Brown','Slate'];
  const normals = [[0,1,0]];
  const h = 1/Math.sqrt(5), r = 2/Math.sqrt(5);
  for (let k=0;k<5;k++) normals.push([r*Math.sin(k*TAU/5),h,r*Math.cos(k*TAU/5)]);
  for (let k=0;k<5;k++) normals.push([r*Math.sin((k+.5)*TAU/5),-h,r*Math.cos((k+.5)*TAU/5)]);
  normals.push([0,-1,0]);
  const faces = normals.map((normal,index) => {
    const u = unit(sub([1,0,0],scale(normal,normal[0]))), v = cross(normal,u);
    return {id:String.fromCharCode(65+index),index,name:colorNames[index],color:colors[index],
            normal,center:normal.slice(),u,v,vertices:[],neighbors:[]};
  });
  const configs = Object.fromEntries(faces.map(f => [f.id,f]));
  const vertices = [];
  for (let i=0;i<12;i++) for (let j=i+1;j<12;j++) for (let k=j+1;k<12;k++) {
    const a=normals[i],b=normals[j],c=normals[k],bc=cross(b,c),det=dot(a,bc);
    if (Math.abs(det)<EPS) continue;
    const p=scale(add(add(bc,cross(c,a)),cross(a,b)),1/det);
    if (normals.every(n => dot(n,p)<=1+EPS)) vertices.push({p,faces:[faces[i].id,faces[j].id,faces[k].id]});
  }
  for (const f of faces) {
    const angle = p => Math.atan2(dot(sub(p,f.center),f.v),dot(sub(p,f.center),f.u));
    f.vertices=vertices.filter(v => v.faces.includes(f.id)).map(v => v.p).sort((a,b) => angle(a)-angle(b));
    f.neighbors=faces.filter(g => Math.abs(dot(g.normal,f.normal)-h)<EPS)
      .sort((a,b) => angle(a.normal)-angle(b.normal)).map(g => g.id);
  }
  function cleanPolygon(poly) {
    const result=[];
    for (const p of poly) if (!result.length || distance(p,result[result.length-1])>1e-8) result.push(p);
    if (result.length>1 && distance(result[0],result[result.length-1])<1e-8) result.pop();
    return result;
  }
  function clip(poly,n,threshold,high) {
    const out=[], sign=high?1:-1;
    for (let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length], da=sign*(dot(a,n)-threshold), db=sign*(dot(b,n)-threshold);
      if (da>=-EPS) out.push(a);
      if ((da>EPS && db<-EPS)||(da<-EPS && db>EPS)) out.push(add(a,scale(sub(b,a),da/(da-db))));
    }
    return cleanPolygon(out);
  }
  function centroid(poly,n) {
    const a=poly[0]; let area=0,total=[0,0,0];
    for (let i=1;i<poly.length-1;i++) {
      const b=poly[i],c=poly[i+1],tri=Math.abs(dot(cross(sub(b,a),sub(c,a)),n))/2;
      area+=tri; total=add(total,scale(add(add(a,b),c),tri/3));
    }
    return {area,p:area?scale(total,1/area):a};
  }
  // Solver identities are topological, never an angular-sort side effect.
  // Tiny browser/libm differences can put a centroid on opposite sides of
  // atan2's -pi/+pi seam, cyclically changing an entire face's sticker IDs.
  // Each row is the published order of center, edges, then corners, keyed by
  // the sorted names of the faces meeting at that piece. Keep these IDs stable
  // so the integer move model and its precomputed stabilizer cache agree on
  // every device. Geometry may vary by a few ulps without changing identity.
  const canonicalPieces={
    A:'A AF AB AC AD AE ABF ABC ACD ADE AEF',
    B:'B BK BG BC AB BF BFK BGK BCG ABC ABF',
    C:'C BC CG CH CD AC ABC BCG CGH CDH ACD',
    D:'D AD CD DH DI DE ADE ACD CDH DHI DEI',
    E:'E EF AE DE EI EJ AEF ADE DEI EIJ EFJ',
    F:'F FK BF AF EF FJ FJK BFK ABF AEF EFJ',
    G:'G GK GL GH CG BG GKL GHL CGH BCG BGK',
    H:'H HI DH CH GH HL HIL DHI CDH CGH GHL',
    I:'I EI DI HI IL IJ EIJ DEI DHI HIL IJL',
    J:'J FJ EJ IJ JL JK EFJ EIJ IJL JKL FJK',
    K:'K JK KL GK BK FK JKL GKL BGK BFK FJK',
    L:'L JL IL HL GL KL IJL HIL GHL GKL JKL'
  };
  const slots=[];
  for (const f of faces) {
    const faceSlots=[];
    for (let mask=0;mask<32;mask++) {
      let poly=f.vertices.slice(); const pieceFaces=[f.id];
      for (let i=0;i<5 && poly.length>=3;i++) {
        const high=Boolean(mask&(1<<i)),g=configs[f.neighbors[i]];
        if (high) pieceFaces.push(g.id);
        poly=clip(poly,g.normal,CUT,high);
      }
      if (poly.length<3) continue;
      const c=centroid(poly,f.normal); if (c.area<1e-8) continue;
      if (pieceFaces.length>3) throw new Error('Invalid Megaminx cut geometry');
      pieceFaces.sort();
      const kind=['','center','edge','corner'][pieceFaces.length];
      faceSlots.push({face:f.id,p:c.p,normal:f.normal.slice(),regionPolygon:poly,
        polygon:poly.map(p => add(c.p,scale(sub(p,c.p),.90))),kind,pieceFaces,area:c.area});
    }
    const byPiece=new Map(faceSlots.map(s=>[s.kind+':'+s.pieceFaces.join(''),s]));
    const canonical=canonicalPieces[f.id].split(' ');
    if (byPiece.size!==faceSlots.length || faceSlots.length!==canonical.length)
      throw new Error('Megaminx face topology is not a bijection');
    for (const name of canonical) {
      const key=['','center','edge','corner'][name.length]+':'+name,s=byPiece.get(key);
      if (!s) throw new Error('Missing canonical Megaminx sticker '+f.id+':'+name);
      byPiece.delete(key);s.id=slots.length;slots.push(s);
    }
    if (byPiece.size) throw new Error('Unknown Megaminx sticker topology');
  }
  if (vertices.length!==20 || slots.length!==132 || faces.some(f => slots.filter(s => s.face===f.id).length!==11))
    throw new Error('Invalid Megaminx geometry');
  // Each turn is computed once as a geometric bijection of immutable sticker slots.
  const permutations={};
  for (const f of faces) {
    const map=slots.map(s => {
      if (!s.pieceFaces.includes(f.id)) return s.id;
      const p=rotate(s.p,f.normal,-TAU/5),normal=rotate(s.normal,f.normal,-TAU/5);
      let nearest=-1,best=Infinity;
      for (const target of slots) {
        const d=distance(target.p,p)+distance(target.normal,normal);
        if (d<best) {nearest=target.id;best=d;}
      }
      if (best>1e-7) throw new Error('Face turn does not map to a legal sticker slot');
      return nearest;
    });
    if (new Set(map).size!==132) throw new Error('Face turn is not a bijection');
    permutations[f.id]=map;
  }
  function normalizeMove(move) {
    if (!move || !configs[move.face]) throw new Error('Invalid Megaminx face');
    const dir=move.dir===undefined?1:move.dir, turns=move.turns===undefined?1:move.turns;
    if ((dir!==1 && dir!==-1) || (turns!==1 && turns!==2)) throw new Error('Invalid Megaminx turn');
    return {face:move.face,dir,turns};
  }
  function makeSolved() {return slots.map(s => ({id:s.id,slot:s.id,color:configs[s.face].color}));}
  function selected(sticker,move) {return slots[sticker.slot].pieceFaces.includes(normalizeMove(move).face);}
  function applyMove(state,move) {
    const m=normalizeMove(move),map=permutations[m.face],count=m.dir>0?m.turns:5-m.turns;
    return state.map(sticker => {
      let slot=sticker.slot; for (let i=0;i<count;i++) slot=map[slot];
      return {id:sticker.id,slot,color:sticker.color};
    });
  }
  function invertMove(move) {const m=normalizeMove(move);return {face:m.face,dir:-m.dir,turns:m.turns};}
  function moveLabel(move) {const m=normalizeMove(move);return m.face+(m.turns===2?'2':'')+(m.dir<0?'′':'');}
  function isSolved(state) {
    if (!Array.isArray(state) || state.length!==132) return false;
    return state.every(s => slots[s.slot] && s.color===configs[slots[s.slot].face].color);
  }
  // String-seeded 32-bit generator, stable across browsers and sessions.
  function seededRandom(seed) {
    let a=2166136261;
    for (const char of String(seed)) {a^=char.charCodeAt(0);a=Math.imul(a,16777619);}
    return function() {
      a|=0; a=(a+0x6D2B79F5)|0;
      let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t;
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function scramble(seed,count=40) {
    if (!Number.isInteger(count) || count<0) throw new Error('Invalid scramble length');
    const random=seededRandom(seed),moves=[];let previous=null;
    for (let i=0;i<count;i++) {
      const candidates=faces.filter(f => f.id!==previous);
      const face=candidates[Math.floor(random()*candidates.length)].id;
      moves.push({face,dir:random()<.5?-1:1,turns:random()<.5?1:2});previous=face;
    }
    return moves;
  }
  const polyhedron={vertices:vertices.map(v => v.p),vertexFaces:vertices.map(v => v.faces),faces,cut:CUT,inradius:1};
  root.MegaEngine=Object.freeze({faces,configs,colors,slots,polyhedron,makeSolved,normalizeMove,
    applyMove,invertMove,moveLabel,isSolved,selected,scramble,seededRandom,rotate,
    vector:Object.freeze({add,sub,scale,dot,cross,length,unit,distance})});
  if (typeof module!=='undefined' && module.exports) module.exports=root.MegaEngine;
})(typeof globalThis!=='undefined'?globalThis:this);

