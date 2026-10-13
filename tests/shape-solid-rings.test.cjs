'use strict';
const assert=require('node:assert/strict'),E=require('../dist/games/shape-engine.js'),R=require('../dist/games/shape-rings.js');
let positions=0;
for(const type of E.types){const m=E.create(type),G=R.create(m),expected=m.slots.length,solved=G.views();
 assert.equal(solved.length,expected);assert.equal(new Set(solved.map(s=>s.id)).size,expected);
 const min=Math.min(...solved.flatMap((a,i)=>solved.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));assert(min>G.nodeRadius*2+1,type+' solved dots do not overlap');
 const nearOwn=solved.filter(a=>{const nearest=solved.filter(b=>b.id!==a.id).sort((b,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(a.x-c.x,a.y-c.y))[0];return nearest.color===a.color;}).length;
 assert(nearOwn/expected>.8,type+' solved nearest neighbors group by color');
 for(let seed=0;seed<8;seed++){m.reset();if(seed)m.scramble('solid-'+seed,25).forEach(v=>m.applyMove(v));
  for(const cfg of m.configs)for(const dir of [-1,1])for(const turns of [1,2]){const move={face:cfg.id,dir,turns},before=G.views(),orbit=G.orbits(cfg.id),moving=new Set(m.movingPieces(cfg.id));assert.equal(before.length,expected);
   const ending=before.map(s=>G.interpolate(s,{move,progress:1}));
   for(const t of [0,.125,.25,.5,.75,.875,1])for(const node of before){const p=G.interpolate(node,{move,progress:t});positions++;assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=0&&p.x<=500&&p.y>=0&&p.y<=500);assert.equal(p.color,m.slots.find(s=>s.id===node.id).color);}
   m.applyMove(move);const after=new Map(G.views().map(s=>[s.id,s]));for(const p of ending){const q=after.get(p.id);assert(Math.hypot(p.x-q.x,p.y-q.y)<1e-7,type+' exact animated endpoint');}m.applyMove({...move,dir:-dir});
  }
 }
 console.log(type+': '+expected+' unique real stickers; solved min spacing '+min.toFixed(1)+'; '+nearOwn+'/'+expected+' nearest color neighbors; all main/tip/half-turn endpoints and connected turn paths PASS');
}
console.log(positions+' projected animation positions checked');
