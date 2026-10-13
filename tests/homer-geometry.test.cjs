'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),{createCanvas}=require('@napi-rs/canvas');
const html=fs.readFileSync('dist/games/cube2.html','utf8');vm.runInThisContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(x=>x.includes('root.CubeEngine =')));const E=CubeEngine,G=require('../dist/games/homer-geometry.js'),R=require('../dist/games/homer-renderer.js'),solved=E.makeSolved(),pieces=G.basePieces(),near=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-8);
assert.equal(pieces.length,8);for(const p of pieces){assert(p.faces.length>100);for(const v of p.vertices)for(let axis=0;axis<3;axis++)assert(v.p[axis]*p.home[axis]>=G.GAP-1e-8,'Every detail is clipped into its physical octant');assert(p.faces.some(f=>f.material==='cut'),'Exposed slices have a physical dark cap');}
const positions=state=>new Map(G.states(state).map(p=>[p.id,p]));
for(const face of Object.keys(E.configs))for(const dir of [-1,1]){const move={face,dir,turns:1},cfg=E.configs[face],after=E.applyMove(solved,move),before=positions(solved),target=positions(after);let moved=0;
 for(const piece of pieces){const a=before.get(piece.id),b=target.get(piece.id),turn=a.pos[cfg.axis]===cfg.layer;if(turn)moved++;for(const v of piece.vertices){const q=G.transform(v.p,a.columns),endpoint=turn?R.rotate(q,cfg.axis,cfg.turn*dir*Math.PI/2):q;assert(near(endpoint,G.transform(v.p,b.columns)),'All feature vertices meet the exact next-state endpoint');}}
 assert.equal(moved,4);assert(G.isSolved(E.applyMove(after,E.invertMove(move))));let state=solved;for(let i=0;i<4;i++)state=E.applyMove(state,move);assert.deepStrictEqual(state,solved);assert(!G.isSolved(after));
}
// A head is asymmetric along all three dimensions. None of its eight cut
// pieces can impersonate any other slot (including its three corner twists),
// even after all paint is removed. Bounding boxes already distinguish them.
const rotations=[],axes=[[1,0,0],[0,1,0],[0,0,1]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
for(const a of axes.flatMap(a=>[a,a.map(x=>-x)]))for(const b of axes.flatMap(a=>[a,a.map(x=>-x)]))if(dot(a,b)===0)rotations.push([a,b,cross(a,b)]);
const bounds=(p,rotation)=>{const vs=p.vertices.map(v=>G.transform(v.p,rotation));return[0,1,2].flatMap(axis=>[Math.min(...vs.map(v=>v[axis])),Math.max(...vs.map(v=>v[axis]))]);};
const identity=axes,targetBounds=new Map(pieces.map(p=>[p.id,bounds(p,identity)]));let matches=0;
for(const source of pieces)for(const rotation of rotations){const target=G.transform(source.home,rotation).join(','),same=near(bounds(source,rotation),targetBounds.get(target));if(same){matches++;assert.equal(source.id,target,'No other unpainted part fits this slot');assert.deepStrictEqual(rotation.map(a=>a.map(x=>x||0)),identity,'No invisible corner twist fits this slot');}}
assert.equal(matches,8);
for(const rotation of rotations){const globallyRotated=solved.map(s=>({...s,p:G.transform(s.p,rotation),n:G.transform(s.n,rotation)}));assert(G.isSolved(globallyRotated),'Global orientation does not change completion');}
for(let i=0;i<100;i++){const moves=E.scramble('homer-'+i,30);let s=moves.reduce(E.applyMove,solved);assert(!G.isSolved(s));s=moves.slice().reverse().map(E.invertMove).reduce(E.applyMove,s);assert.deepStrictEqual(s,solved);}
const canvas=createCanvas(700,700),ctx=canvas.getContext('2d');for(const progress of [0,.5,1]){const result=R.render(ctx,solved,{width:700,height:700,view:{yaw:-.30,pitch:.08,zoom:1},animation:{move:E.normalizeMove('R'),progress},selected:'R'});assert.equal(result.pieces,8);assert(result.targets.some(t=>t.face==='R'));assert(result.targets.some(t=>t.face==='U'));assert(result.targets.some(t=>t.face==='F'));assert(ctx.getImageData(0,0,700,700).data.some((x,i)=>i%4===3&&x>0));}
console.log('Homer: 8 clipped physical pieces; all 12 quarter-turn endpoints; four-turn and 100 scramble reversals; unique monochrome shape; 24 global orientations; real depth-buffer renders PASS.');
