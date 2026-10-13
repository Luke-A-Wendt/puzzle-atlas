/* Checks the actual guide strings against the shipped exact-coordinate engine. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const guideContext={};guideContext.window=guideContext;vm.createContext(guideContext);
for(const file of ['cube-guides.js','large-cube-guides.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),guideContext);
const key=s=>s.p.join(',')+'|'+s.n.join(',');
let checked=0;
for(const n of [5,6,7,8]){
  const ctx={CUBE_SIZE:n};ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'dist/games/nxn-engine.js'),'utf8'),ctx);
  const E=ctx.CubeEngine,solved=E.makeSolved(),home=new Map(solved.map(s=>[s.id,s])),slots=new Map(solved.map(s=>[key(s),s]));
  const run=(alg,start=solved)=>alg.trim().split(/\s+/).reduce((s,m)=>E.applyMove(s,m),start);
  const changed=s=>s.filter(t=>key(t)!==key(home.get(t.id)));
  const kind=s=>s.p.filter(v=>Math.abs(v)===E.extent).length;
  const centersPreserved=s=>assert(s.filter(x=>kind(x)===1).every(x=>x.color===slots.get(key(x)).color),'center colors preserved');
  const actualGuide=guideContext.LARGE_CUBE_GUIDES['cube'+n];
  assert.equal(actualGuide.steps.filter(s=>s.title.startsWith('3×3 stage · ')).length,guideContext.CUBE_GUIDES.cube3.steps.length,'complete embedded 3×3 phase');
  const codes=(title)=>[...actualGuide.steps.find(s=>s.title===title).body.matchAll(/<code>([^<]+)<\/code>/g)].map(x=>x[1]);
  const cycleAlgorithms=codes('Finish awkward edges · a controlled wing cycle');
  const parityAlgorithms=codes(n%2?'Edge parity · repair a reversed wing pair':'Edge pairing parity · repair one wing orbit');
  for(let i=0;i<cycleAlgorithms.length;i++){
    const alg=cycleAlgorithms[i],after=run(alg),changes=changed(after),slice=E.configs['U'+'i'.repeat(i+1)].layer,e=E.extent;
    assert.equal(changes.length,6,'only three two-sticker wings move');
    assert(changes.every(s=>kind(s)===2),'only edge stickers move');
    const mapping=new Map([[[-e,slice,e].join(','),[e,slice,e].join(',')],[[e,slice,e].join(','),[e,-slice,e].join(',')],[[e,-slice,e].join(','),[-e,slice,e].join(',')]]);
    for(const s of changes)assert.equal(s.p.join(','),mapping.get(home.get(s.id).p.join(',')),'documented wing cycle');
    assert.equal(changed(run(alg,run(alg,after))).length,0,'cycle cubed is identity');
    checked++;
  }
  for(let i=0;i<parityAlgorithms.length;i++){
    const alg=parityAlgorithms[i],after=run(alg),a=E.configs['R'+'i'.repeat(i+1)].layer,e=E.extent;
    centersPreserved(after);
    const edgeChanges=changed(after).filter(s=>kind(s)>1);
    assert.equal(edgeChanges.length,4,'one wing pair only');
    for(const s of edgeChanges){
      const before=home.get(s.id);
      assert.equal(Math.abs(before.p[0]),a);assert.equal(before.p[1],e);assert.equal(before.p[2],e);
      assert.equal(s.p[0],-before.p[0]);assert.equal(s.p[1],e);assert.equal(s.p[2],e);
      assert.equal(s.n[1],before.n[2]);assert.equal(s.n[2],before.n[1]);
    }
    assert(E.isSolved(run(alg,after)),'repair solves a generated parity case');
    checked++;
  }
  if(n%2===0){
    const alg=codes(`${n}×${n} permutation parity · exchange two whole edges`)[0],after=run(alg),e=E.extent;
    centersPreserved(after);
    const edgeChanges=changed(after).filter(s=>kind(s)>1);
    assert.equal(edgeChanges.length,4*(n-2),'all UF and UB pieces exchange');
    for(const s of edgeChanges){const h=home.get(s.id);assert.equal(h.p[1],e);assert.equal(Math.abs(h.p[2]),e);assert.equal(s.p[2],-h.p[2]);assert.equal(s.n[1],h.n[1]);}
    assert(E.isSolved(run(alg,after)),'PLL repair is visually involutive');
    const all=run(parityAlgorithms.join(' '));centersPreserved(all);assert.equal(changed(all).filter(s=>kind(s)>1).length,2*(n-2),'all wing orbits flip one complete edge');
    for(const s of changed(all).filter(s=>kind(s)>1)){
      const h=home.get(s.id);assert.equal(h.p[1],e);assert.equal(h.p[2],e);
      assert.equal(s.p[0],-h.p[0]);assert.equal(s.n[1],h.n[2]);assert.equal(s.n[2],h.n[1]);
    }
    checked+=2;
  }
  const centers=actualGuide.steps.find(s=>s.title==='A precise center tool · cycle just three pieces');
  const rows=[...centers.body.matchAll(/<tr><td>(Ri{1,3})<\/td><td>(Li{1,3}|M)<\/td><td>row (\d+), col (\d+)<\/td><td>row (\d+), col (\d+)<\/td><td>row (\d+), col (\d+)<\/td><\/tr>/g)];
  assert.equal(rows.length,n===5?2:n===6?4:n===7?6:9);
  const centerSeeds=[];
  for(const [,A,B,ur,uc,f1r,f1c,f2r,f2c] of rows){
    const alg=`${A} U' ${B}' U ${A}' U' ${B} U`,after=run(alg),changes=changed(after),e=E.extent;
    assert.equal(changes.length,3,'center cycle affects exactly three stickers');assert(changes.every(s=>kind(s)===1));
    const u=[2*(uc-1)-e,e,2*(ur-1)-e],f1=[2*(f1c-1)-e,e-2*(f1r-1),e],f2=[2*(f2c-1)-e,e-2*(f2r-1),e];
    const map=new Map([[u.join(','),f1.join(',')],[f1.join(','),f2.join(',')],[f2.join(','),u.join(',')]]);
    centerSeeds.push(slots.get(u.join(',')+'|0,1,0'));
    for(const s of changes)assert.equal(s.p.join(','),map.get(home.get(s.id).p.join(',')),'documented center coordinates');
    assert.equal(changed(run(alg,run(alg,after))).length,0);
    checked++;
  }
  if(n===8){
    assert.equal(cycleAlgorithms.length,3,'all three wing depths have controlled cycles');
    assert.equal(parityAlgorithms.length,3,'all three wing depths have parity repairs');
    assert(actualGuide.notation.join(' ').includes('L · Li · Lii · Liii · Riii · Rii · Ri · R'),'all eight single-layer names');
    assert(actualGuide.steps[0].body.includes('216 movable center pieces'));
    assert(actualGuide.steps[0].body.includes('72 wings'));
    assert(!actualGuide.steps.map(s=>s.body).join(' ').includes('four-piece edge'),'no stale six-cube edge width');
    // Prove that the nine documented seed positions represent every center
    // family, rather than just nine variants of fewer reachable families.
    const covered=new Set(),faces=Object.keys(E.configs);
    for(const seed of centerSeeds){
      assert(seed,'documented slot exists');
      const orbit=new Map([[key(seed),seed]]),queue=[seed];
      for(let at=0;at<queue.length;at++)for(const face of faces){
        const next=E.applyMove([queue[at]],face)[0],k=key(next);
        if(!orbit.has(k)){orbit.set(k,next);queue.push(next);}
      }
      assert.equal(orbit.size,24,'each center family has 24 members');
      for(const [k,sticker] of orbit){assert.equal(kind(sticker),1);assert(!covered.has(k),'different table rows cover different families');covered.add(k);}
      const counts=new Map();for(const s of orbit.values())counts.set(s.n.join(','),(counts.get(s.n.join(','))||0)+1);
      assert.equal(counts.size,6);assert([...counts.values()].every(v=>v===4),'each family has four centers per face');
      checked++;
    }
    assert.equal(covered.size,216,'all 6×6 centers on six faces are covered');
    assert(solved.filter(s=>kind(s)===1).every(s=>covered.has(key(s))));
    assert.equal(solved.filter(s=>kind(s)===2).length/2,72,'72 two-sticker wings');
  }
}
console.log(`Passed ${checked} exact guide checks: center cycles and orbit coverage, wing cycles, per-orbit parity, full 6×6/8×8 parity, and embedded 3×3 coverage.`);
