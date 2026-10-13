const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../dist/games/tetraminx.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
const ctx={FaceGroupedRings:require('../dist/games/face-grouped-rings.js')};ctx.window=ctx;vm.createContext(ctx);for(const s of scripts.slice(0,2))vm.runInContext(s,ctx);
const E=ctx.TetraEngine,G=ctx.TetraRings,solved=E.makeSolved();
assert.equal(E.slots.length,24);assert.equal(E.homePieces.length,10);assert.equal(G.rings.length,4);assert.equal(Object.keys(E.configs).join(''),'ULRB');assert.equal(E.slots.filter(s=>s.kind==='tip').length,0);
const signature=s=>s.map(x=>`${x.id}:${x.slot}:${x.ori}`).join('|');
for(const face of Object.keys(E.configs)){
 let s=solved;for(let n=0;n<3;n++)s=E.applyMove(s,face);assert.equal(signature(s),signature(solved));
 const changed=E.applyMove(solved,face).filter(x=>x.id!==x.slot);assert.equal(changed.length,9);
 assert.throws(()=>E.applyMove(solved,face.toLowerCase()));
 for(const sticker of changed){const p=G.position(sticker);assert.equal(p.faceLabel,E.slots[sticker.slot].face);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
}
for(const p of E.homePieces){assert.ok(p.kind!=='tip');for(const f of p.mesh)for(const point of f.points)for(const v of E.vertices)assert.ok(E.vector.dot(v.normal,point)<=E.radius*5/9+1e-8,'No geometry extends into a removed tip');}
for(let trial=0;trial<100;trial++){
 const moves=E.scramble('tetraminx-'+trial,30);assert.equal(moves.length,30);let s=moves.reduce((s,m)=>E.applyMove(s,m),solved);assert.equal(new Set(s.map(x=>x.slot)).size,24);
 for(const m of moves.slice().reverse())s=E.applyMove(s,E.invertMove(m));assert.equal(signature(s),signature(solved));assert.ok(E.isSolved(s));
}
// Run every guide stage over random states: align centers, insert base, cycle and flip.
const parse=s=>s.trim().split(/\s+/).map(t=>({face:t[0],dir:/['′]/.test(t)?-1:1}));
const alg=(s,a)=>parse(a).reduce((s,m)=>E.applyMove(s,m),s);
const good=q=>q.color===solved[q.slot].color;
const solvedPiece=(s,id)=>s.filter(q=>E.slots[q.slot].pieceId===id).every(good);
const inserts={eLR:["R U' R'","L' U L"],eBL:["L U' L'","B' U B"],eBR:["B U' B'","R' U R"]};
const cycles=["L' U L U L' U L","L' U' L U' L' U' L"];
const flips=["U L U' R U' R' U L'","U R U' B U' B' U R'","U B U' L U' L' U B'"];
for(let trial=0;trial<100;trial++){
 let s=E.scramble('tetraminx-guide-'+trial).reduce((a,m)=>E.applyMove(a,m),solved);
 for(const v of ['L','R','B']){for(let n=0;n<3&&!solvedPiece(s,'c'+v);n++)s=E.applyMove(s,v);assert.ok(solvedPiece(s,'c'+v));}
 const done=[];
 for(const [target,choices]of Object.entries(inserts)){
  for(let attempt=0;attempt<3&&!solvedPiece(s,target);attempt++){
   let found=null;
   for(let u=0;u<3;u++){for(const a of choices){const ss=alg(s,a);if(solvedPiece(ss,target)&&done.every(id=>solvedPiece(ss,id))){found=ss;break;}}if(found)break;s=E.applyMove(s,'U');}
   if(found){s=found;break;}
   const needed=solved.filter(q=>E.slots[q.id].pieceId===target).map(q=>q.id),current=E.slots[s.find(q=>q.id===needed[0]).slot].pieceId;assert.ok(inserts[current]);s=alg(s,inserts[current][0]);
  }
  assert.ok(solvedPiece(s,target));done.push(target);
 }
 for(let n=0;n<3&&!solvedPiece(s,'cU');n++)s=E.applyMove(s,'U');
 const edgeRight=q=>E.slots[q.slot].pieceId===E.slots[q.id].pieceId;
 if(!s.filter(q=>E.slots[q.id].kind==='edge').every(edgeRight)){s=cycles.map(a=>alg(s,a)).find(q=>q.filter(x=>E.slots[x.id].kind==='edge').every(edgeRight));assert.ok(s);}
 if(!s.every(good)){s=flips.map(a=>alg(s,a)).find(q=>q.every(good));assert.ok(s);}
 assert.ok(E.isSolved(s),'Full guide solves random state '+trial);
}
console.log('Tetraminx: 24 stickers, 10 truncated pieces, 4 rings; 100 scramble reversals and 100 complete guide solves passed.');
