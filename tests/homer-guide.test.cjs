'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx={};ctx.window=ctx;vm.createContext(ctx);
const html=fs.readFileSync(path.join(root,'dist/games/homer.html'),'utf8');
const engineScript=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('root.CubeEngine ='));
assert(engineScript,'Homer uses the exact 2×2 engine');vm.runInContext(engineScript,ctx);
vm.runInContext(fs.readFileSync(path.join(root,'dist/homer-guide.js'),'utf8'),ctx);
const E=ctx.CubeEngine,guide=ctx.HOMER_GUIDES.homer,S=E.makeSolved(),home=new Map(S.map(s=>[s.id,s]));
const position=p=>p.join(','),same=(a,b)=>position(a)===position(b),key=s=>s.map(t=>position(t.p)+'/'+position(t.n)).join('|');
const representatives=S.filter(s=>s.homeFace==='U'||s.homeFace==='D');
const tops=representatives.filter(s=>s.homeFace==='U'),bottoms=representatives.filter(s=>s.homeFace==='D');
const current=(state,piece)=>state.find(s=>s.id===piece.id);
const correctPosition=(state,piece)=>same(current(state,piece).p,piece.p);
const pieceSolved=(state,piece)=>state.filter(s=>same(home.get(s.id).p,piece.p)).every(s=>same(s.p,home.get(s.id).p)&&same(s.n,home.get(s.id).n));
const run=(state,alg)=>alg.trim().split(/\s+/).reduce((s,m)=>E.applyMove(s,m),state);
const code=title=>[...guide.steps.find(s=>s.title===title).body.matchAll(/<code>([^<]+)<\/code>/g)].map(m=>m[1]);
const [insert]=code('Rebuild the lower head'),[cycle]=code('Put the upper sections in their places'),[twist]=code('Untwist the face and crown');
assert.equal(insert,"R U R' U'");assert.equal(cycle,"U R U' L' U R' U' L");assert.equal(twist,"R' D' R D");
const frontFor=p=>p[2]===1?(p[0]===1?'F':'L'):(p[0]===1?'R':'B');
const rows={F:{F:'F',R:'R',B:'B',L:'L'},R:{F:'R',R:'B',B:'L',L:'F'},B:{F:'B',R:'L',B:'F',L:'R'},L:{F:'L',R:'F',B:'R',L:'B'}};
const translate=(alg,front)=>alg.replace(/[FRBL]/g,letter=>rows[front][letter]);
const exactSolved=state=>key(state)===key(S);
function bottomStage(initial){
  let state=initial;const finished=[];
  for(const piece of bottoms){
    if(!pieceSolved(state,piece)){
      if(current(state,piece).p[1]===-1)state=run(state,translate(insert,frontFor(current(state,piece).p)));
      assert.equal(current(state,piece).p[1],1,'misplaced lower piece is lifted');
      let setups=0;
      while(current(state,piece).p[0]!==piece.p[0]||current(state,piece).p[2]!==piece.p[2]){
        assert(setups++<4,'U can place piece above destination');state=E.applyMove(state,'U');
      }
      const tool=translate(insert,frontFor(piece.p));let tries=0;
      while(!pieceSolved(state,piece)){assert(tries++<6,'repeated insertion must orient and place selected corner');state=run(state,tool);}
    }
    finished.push(piece);assert(finished.every(p=>pieceSolved(state,p)),'previously completed lower sections are preserved');
  }
  return state;
}
function topStage(initial){
  let state=initial,iterations=0;
  while(!tops.every(p=>correctPosition(state,p))){
    assert(iterations++<12,'placement cases converge');
    let right=tops.filter(p=>correctPosition(state,p));
    if(right.length===0){
      let turns=0;
      do{assert(turns++<4,'U setup finds at least one correctly placed section');state=E.applyMove(state,'U');right=tops.filter(p=>correctPosition(state,p));}while(right.length===0);
      continue;
    }
    if(right.length===2&&(right[0].p[0]===right[1].p[0]||right[0].p[2]===right[1].p[2])){
      let turns=0;
      do{assert(turns++<4,'U setup finds one correctly placed section');state=E.applyMove(state,'U');right=tops.filter(p=>correctPosition(state,p));}while(right.length!==1);
    }
    const front=right.length===1?frontFor(right[0].p):'F';
    assert(right.length===1||right.length===2,'remaining case is one correct or two diagonal');
    state=run(state,translate(cycle,front));assert(bottoms.every(p=>pieceSolved(state,p)),'upper placement preserves entire lower head');
  }
  for(let visited=0;visited<4;visited++){
    let tries=0;
    const piece=state.find(s=>s.homeFace==='U'&&same(s.p,[1,1,1])),occupant=()=>state.find(s=>s.id===piece.id);
    while(!same(occupant().p,[1,1,1])||!same(occupant().n,[0,1,0])){assert(tries++<6,'twist block turns original crown surface up');state=run(state,twist);}
    assert(tries===0||tries===2||tries===4,'upper twist needs zero, two, or four full blocks');
    state=E.applyMove(state,'U');
  }
  assert(exactSolved(state),'four working-slot visits restore the complete head');return state;
}
// U and the guide’s three-corner cycle generate every legal state with D solved:
// 4! permutations times 3^3 orientations. Check the written case logic exhaustively.
const states=[S],seen=new Set([key(S)]);
for(let i=0;i<states.length;i++){
  for(const alg of ['U',cycle]){const next=run(states[i],alg),k=key(next);if(!seen.has(k)){seen.add(k);states.push(next);}}
  assert(states.length<=648,'only upper sections change');
}
assert.equal(states.length,648,'all legal final-layer cases covered');
for(const state of states)topStage(state);
for(let seed=0;seed<128;seed++){
  const scrambled=E.scramble('homer-guide-'+seed,30).reduce((s,m)=>E.applyMove(s,m),S);
  topStage(bottomStage(scrambled));
}
assert.equal(guide.steps.length,5);assert(!JSON.stringify(guide).includes('Mirror mode'));assert(guide.notation.join(' ').includes('always retains its original facial colors'));assert(guide.steps.every(s=>s.body.length>150));
assert(guide.steps[0].body.includes('eyes')&&guide.steps[0].body.includes('muzzle')&&guide.steps[0].body.includes('neck'));
console.log('Homer guide passed: all 648 final-layer cases and 128 full seeded solves using its actual three algorithms.');
