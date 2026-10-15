'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),c={CUBE_SIZE:3};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'dist/games/nxn-engine.js'),'utf8'),c);
const E=c.CubeEngine,S=E.makeSolved(),key=s=>s.p+'|'+s.n,positions=new Map(S.map((s,i)=>[key(s),i])),same=(a,b)=>String(a)===String(b),identity=Uint8Array.from(S,(_,i)=>i),cache=new Map();
const kind=p=>p.filter(v=>Math.abs(v)===2).length,faces={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]};
const faceOf=n=>Object.keys(faces).find(f=>same(n,faces[f])),cornerRepresentatives=S.map((s,i)=>i).filter(i=>kind(S[i].p)===3&&['U','D'].includes(S[i].homeFace)),down=cornerRepresentatives.filter(i=>S[i].homeFace==='D'),up=cornerRepresentatives.filter(i=>S[i].homeFace==='U');
const cornerPositions=up.map(i=>S[i].p),edgePositions=[[0,2,2],[2,2,0],[0,2,-2],[-2,2,0]],middlePositions=[[2,0,2],[2,0,-2],[-2,0,-2],[-2,0,2]];
const insert="R U R' U'",cross="F R U R' U' F'",swap="R U R' U R U2 R' U",cycle="U R U' L' U R' U' L",twist="R' D' R D",right="U R U' R' U' F' U F",left="U' L' U L U F U' F'";
vm.runInContext(fs.readFileSync(path.join(root,'dist/cube-guides.js'),'utf8'),c);const printed=c.CUBE_GUIDES.cube3.steps.map(x=>x.body).join(' ');for(const word of [insert,cross,swap,cycle,twist,right,left])assert(printed.includes('<code>'+word+'</code>'),'tested algorithm appears in actual guide: '+word);
const rows={F:{F:'F',R:'R',B:'B',L:'L'},R:{F:'R',R:'B',B:'L',L:'F'},B:{F:'B',R:'L',B:'F',L:'R'},L:{F:'L',R:'F',B:'R',L:'B'}};
const translate=(word,front)=>word.replace(/[FRBL]/g,f=>rows[front][f]),frontFor=p=>p[2]===2?(p[0]===2?'F':'L'):(p[0]===2?'R':'B');
function permutation(word){if(cache.has(word))return cache.get(word);const after=word.trim().split(/\s+/).reduce((s,m)=>E.applyMove(s,m),S),p=after.map(s=>positions.get(key(s)));cache.set(word,p);return p;}
function run(state,word){const p=permutation(word),out=new Uint8Array(54);for(let i=0;i<54;i++)out[p[i]]=state[i];return out;}
const geometry=new Map();for(let i=0;i<S.length;i++){const k=String(S[i].p);if(!geometry.has(k))geometry.set(k,[]);geometry.get(k).push(i);}
const current=(s,id)=>S[s.indexOf(id)],pieceAt=(s,p)=>geometry.get(String(p)),positionCorrect=(s,p)=>pieceAt(s,p).every(i=>same(S[s[i]].p,p)),pieceSolved=(s,id)=>geometry.get(String(S[id].p)).every(i=>s[i]===i);
function solveLast(initial){
 let state=initial,iterations=0;
 const oriented=s=>edgePositions.filter(p=>pieceAt(s,p).some(i=>S[i].homeFace==='U'&&S[s[i]].homeFace==='U'));
 while(oriented(state).length!==4){assert(iterations++<4);let list=oriented(state);if(!list.length){state=run(state,cross);continue;}assert.equal(list.length,2);const opposite=list[0].every((v,i)=>i===1||v===-list[1][i]),target=opposite?[[-2,2,0],[2,2,0]]:[[-2,2,0],[0,2,-2]];let k=0;while(!target.every(p=>oriented(state).some(q=>same(p,q)))){assert(k++<4);state=run(state,'U');}state=run(state,cross);if(!opposite)state=run(state,cross);}
 iterations=0;
 while(!edgePositions.every(p=>positionCorrect(state,p))){assert(iterations++<5);let best=state,bestCount=-1,temp=state;for(let i=0;i<4;i++){const count=edgePositions.filter(p=>positionCorrect(temp,p)).length;if(count>bestCount){best=temp;bestCount=count;}temp=run(temp,'U');}state=best;if(bestCount===4)break;assert.equal(bestCount,2);let front='F';const good=edgePositions.filter(p=>positionCorrect(state,p)),opp=good[0].every((v,i)=>i===1||v===-good[1][i]);if(!opp){front=Object.keys(rows).find(f=>[rows[f].B,rows[f].R].every(face=>positionCorrect(state,faces[face].map((v,i)=>i===1?2:v*2))));assert(front);}state=run(state,translate(swap,front));}
 iterations=0;
 while(!cornerPositions.every(p=>positionCorrect(state,p))){assert(iterations++<4);const good=cornerPositions.filter(p=>positionCorrect(state,p));assert(good.length===0||good.length===1);state=run(state,translate(cycle,good.length?frontFor(good[0]):'F'));}
 for(let visit=0;visit<4;visit++){const id=up.find(id=>same(current(state,id).p,[2,2,2]));assert.notEqual(id,undefined);let turns=0;while(!same(current(state,id).p,[2,2,2])||!same(current(state,id).n,[0,1,0])){assert(turns++<6);state=run(state,twist);}assert([0,2,4].includes(turns));state=run(state,'U');}
 assert.deepEqual(state,identity);return state;
}
function solveFirst(initial){
 let state=initial;const petals=()=>S.map((s,i)=>i).filter(i=>kind(S[i].p)===2&&S[i].homeFace==='U'&&S[state[i]].homeFace==='D'),dEdges=S.map((s,i)=>i).filter(i=>kind(S[i].p)===2&&S[i].homeFace==='D');
 const clear=face=>{let k=0;while(pieceAt(state,faces[face].map((v,i)=>i===1?2:v*2)).some(i=>S[i].homeFace==='U'&&S[state[i]].homeFace==='D')){assert(k++<4);state=run(state,'U');}};
 const lifts={'FR,F':'R','FR,R':"F'",'FL,F':"L'",'FL,L':'F','BR,B':"R'",'BR,R':'B','BL,B':'L','BL,L':"B'"};
 for(const id of dEdges){if(current(state,id).n[1]===1)continue;const before=petals().length;let at=current(state,id);
  if(at.n[1]===-1){const face=Object.keys(faces).find(f=>!['U','D'].includes(f)&&at.p.reduce((v,x,i)=>v+x*faces[f][i],0)===2);clear(face);state=run(state,face+'2');}
  else{if(at.p[1]!==0){const face=faceOf(at.n);if(at.p[1]<0)clear(face);state=run(state,face);at=current(state,id);}const edge=(at.p[2]===2?'F':'B')+(at.p[0]===2?'R':'L'),move=lifts[edge+','+faceOf(at.n)];assert(move);clear(move[0]);state=run(state,move);}
  assert(petals().length>=before+1);
 }
 assert.equal(petals().length,4);
 for(const id of dEdges){let turns=0;while(true){const at=current(state,id),other=pieceAt(state,at.p).find(i=>S[i].homeFace!=='U'),targetFace=S[state[other]].homeFace;if(S[other].homeFace===targetFace){state=run(state,targetFace+'2');break;}assert(turns++<4);state=run(state,'U');}}
 for(const id of down){if(pieceSolved(state,id))continue;if(current(state,id).p[1]===-2)state=run(state,translate(insert,frontFor(current(state,id).p)));let setups=0;while(current(state,id).p[0]!==S[id].p[0]||current(state,id).p[2]!==S[id].p[2]){assert(setups++<4);state=run(state,'U');}let turns=0;while(!pieceSolved(state,id)){assert(turns++<6);state=run(state,translate(insert,frontFor(S[id].p)));}}
 let iterations=0;
 while(!middlePositions.every(p=>positionCorrect(state,p)&&pieceAt(state,p).every(i=>state[i]===i))){assert(iterations++<14);let candidate=edgePositions.find(p=>pieceAt(state,p).every(i=>S[state[i]].homeFace!=='U'));
  if(!candidate){const bad=middlePositions.find(p=>pieceAt(state,p).some(i=>state[i]!==i));state=run(state,translate(right,frontFor([bad[0],2,bad[2]])));continue;}
  const tracked=state[pieceAt(state,candidate)[0]];let setups=0,side;
  while(true){const outward=pieceAt(state,candidate).find(i=>S[i].homeFace!=='U');side=S[state[outward]].homeFace;if(S[outward].homeFace===side)break;assert(setups++<4);state=run(state,'U');candidate=current(state,tracked).p;}
  const upper=pieceAt(state,candidate).find(i=>S[i].homeFace==='U'),other=S[state[upper]].homeFace;assert(other===rows[side].R||other===rows[side].L);state=run(state,translate(other===rows[side].R?right:left,side));
 }
 for(let i=0;i<54;i++)if(S[i].p[1]<2)assert.equal(state[i],i,'first two layers solved');return state;
}
// These four F2L-preserving tools generate the entire legal final-layer group.
const states=[identity],seen=new Set([Buffer.from(identity).toString('base64')]);
for(let i=0;i<states.length;i++)for(const word of ['U',cross,swap,cycle]){const next=run(states[i],word),k=Buffer.from(next).toString('base64');if(!seen.has(k)){seen.add(k);states.push(next);}}
assert.equal(states.length,62208);for(const state of states)solveLast(state);
for(let seed=0;seed<128;seed++){let state=identity;for(const m of E.scramble('cube3-guide-'+seed,30).filter(m=>m.face.length===1&&!['M','E','S'].includes(m.face)))state=run(state,E.moveLabel(m));solveLast(solveFirst(state));}
console.log('Complete cube3 guide: all 62,208 legal last-layer states and 128 independent full scrambles solved by the written cases.');
