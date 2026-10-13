'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/games/shape-engine.js'),R=require('../dist/games/connected-rings.js');
const {faceHullViolations}=require('./connected-ring-maps.test.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Diamond Puzzler has 26 physical planes but only three solved color bands.
// Testing every physical face separately would incorrectly accept any layout.
function colorQuality(type){
 const map=R.create(E.create(type)),nodes=map.views(),colors=[...new Set(nodes.map(n=>n.color))];
 const represented=nodes.map(n=>({...n,normal:[colors.indexOf(n.color)+1,1,0]}));
 let sameColor=0;
 for(const a of nodes){const nearSame=Math.min(...nodes.filter(b=>b.id!==a.id&&b.color===a.color).map(b=>distance(a,b))),nearOther=Math.min(...nodes.filter(b=>b.color!==a.color).map(b=>distance(a,b)));sameColor+=nearSame<nearOther;}
 assert.equal(faceHullViolations(represented).length,0,'a solved color region must not enclose a different color');
 return{map,nodes,sameColor};
}
test('Diamond Puzzler places all three solved color bands in contiguous disjoint regions',()=>{
 const {map,nodes,sameColor}=colorQuality('diamondstyle');
 assert.equal(sameColor,26,'every node has a closer same-color neighbor');
 assert(map.nodeRadius>=11,'colors remain large and legible');
 const green=nodes.filter(n=>n.color==='#36bf85'),blue=nodes.filter(n=>n.color==='#4394f7'),red=nodes.filter(n=>n.color==='#f36c73');
 assert(green.every(n=>Math.abs(n.x-250)<1e-6),'middle band follows the map diameter');
 assert(blue.every(n=>n.x<250));assert(red.every(n=>n.x>250));
});
test('Diamond Cuboctahedron keeps fourteen solved face groups compact without reducing node size',()=>{
 const {map,nodes,sameColor}=colorQuality('diamondcube');
 assert.equal(nodes.length,86);assert(sameColor>=82,'at least 82 of 86 nodes have a closer same-face neighbor');
 assert(map.nodeRadius>=7.9,'uniform circular nodes retain their readable size');
 for(const curve of map.rings){assert(curve.points.length>20);assert(distance(curve.points[0],curve.points.at(-1))<1e-6,'all transport paths are smoothly sampled closed projected circles');}
});
