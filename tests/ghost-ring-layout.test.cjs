'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/games/ghost-engine.js'),R=require('../dist/games/connected-rings.js');
const {quality,verifyModel}=require('./connected-ring-maps.test.cjs');
const {families,auditPage}=require('./ring-intersection-audit.cjs');
const transform=(a,v)=>a.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
const multiply=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,x,i)=>s+x*b[i][j],0)));
test('Ghost solved colors form six disjoint groups and every possible reference address remains legible',()=>{
 const m=E.create(),map=R.create(m),views=map.views().map(v=>({...v,normal:m.configs[m.slots[v.id].faceIndex].normal}));
 const metrics=quality(views,map.nodeRadius,'Ghost solved color groups');
 assert.equal(metrics.faceNeighborFraction,1,'every solved node has a closer neighbor of the same color');
 assert(map.nodeRadius>6,'solved nodes remain readable');
 // Enumerate 24 rigid orientations of one marker, not configuration states.
 // All 168 addresses are covered; their minimum separation bounds every
 // possible set of simultaneously occupied nodes, including unseen scrambles.
 const rotations=[[[1,0,0],[0,1,0],[0,0,1]]],seen=new Set([String(rotations[0])]);
 for(let i=0;i<rotations.length;i++)for(const cfg of m.configs){const next=multiply(cfg.matrix,rotations[i]),key=String(next);if(!seen.has(key)){seen.add(key);rotations.push(next);}}
 assert.equal(rotations.length,24);
 const addresses=new Map();
 for(const slot of m.slots)for(const rotation of rotations){const center=transform(rotation,slot.markerCenter),normal=transform(rotation,slot.markerNormal),key=center+'/'+normal;addresses.set(key,map.raw(map.direction({center,normal})));}
 assert.equal(addresses.size,168);
 const points=[...addresses.values()];let minimum=Infinity;
 for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)minimum=Math.min(minimum,Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y));
 assert(minimum>13.5,'all legal addresses retain at least 13.5 map-pixel spacing; got '+minimum);
});
test('Ghost moving colors follow visible rings to exact legal endpoints and intersect rings at rest',()=>{
 verifyModel(E,'ghost',{geometryOnly:true});
 families.ghost='GhostEngine';
 const audits=auditPage('ghost');
 for(const audit of audits){assert.equal(audit.intersections,audit.movableNodes);assert.equal(audit.shapeFailures.length,0);}
});
