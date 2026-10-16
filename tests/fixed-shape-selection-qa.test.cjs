'use strict';
// Independent end-to-end identity checks for the physical shape pose maps.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const Shape=require('../dist/games/shape-engine'),Ghost=require('../dist/games/ghost-engine'),Rings=require('../dist/games/connected-rings');
const games=path.join(__dirname,'../dist/games');
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
const clean=value=>JSON.parse(JSON.stringify(value));
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-6,message+': '+a+' vs '+b);
for(const id of ['axis','ghost','flatdiamond','pyramorphix','mastermorphix'])test(id+': only real physical tiles connect the ring sites, solver addresses and 3D selection',async()=>{
 const app=createPage(id,{globals:{fetch:fetchFile}}),bridge=app.context.PUZZLE_SOLVER_BRIDGE,ui=app.context.ConstrainedSolverUI;
 const data=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models',id+'.json'))),map=Rings.create(id==='ghost'?Ghost.create():Shape.create(id));
 assert.equal(app.context.PUZZLE_API.runMoves(data.moves.slice(0,3).map(m=>m.engineMove)),true);await app.settle();await app.advance(0);
 app.element('rings').dispatch('wheel',{clientX:250,clientY:250,deltaY:-Math.log(1.25)/.0015,deltaMode:0});await app.advance(0);
 ui.setActive(true);for(let i=0;i<100&&ui.state().phase==='loading';i++)await app.advance(0);assert.equal(ui.state().phase,'selecting');
 const current=clean(bridge.nodes()),viewport=bridge.viewport(),mapping=app.context.ConstrainedSolverCore.mapSnapshot(data,app.snapshot());
 assert.equal(current.length,data.stickerCount,'empty locations never inflate physical tile count');assert.equal(new Set(current.map(n=>n.stickerId)).size,data.stickerCount);
 for(const node of current){const address=mapping.stickerToNode[node.stickerId],site=map.position(data.nodes[address]);assert(site,'actual tile has an exact legal address');near(node.x,viewport.x+site.x*viewport.scale,'occupied ring x');near(node.y,viewport.y+site.y*viewport.scale,'occupied ring y');}
 const occupied=new Set(Object.values(mapping.stickerToNode)),vacant=data.nodes.filter((s,i)=>!occupied.has(i)).map(s=>map.position(s)).map(s=>({x:viewport.x+s.x*viewport.scale,y:viewport.y+s.y*viewport.scale})).find(s=>s.x>15&&s.x<485&&s.y>15&&s.y<485&&current.every(n=>Math.hypot(s.x-n.x,s.y-n.y)>n.r+18));
 assert(vacant,'there is an empty region for hit testing');
 const overlay=app.element('csNodeOverlay');ui.setTool('hold');overlay.dispatch('pointerdown',{pointerId:13,clientX:vacant.x,clientY:vacant.y});overlay.dispatch('pointerup',{pointerId:13,clientX:vacant.x,clientY:vacant.y});assert.deepEqual(clean(ui.state().held),[],'an empty address cannot be held');
 const cube=app.element('cube'),pick=app.context.PuzzleSelection3D.pick;let target=null;
 for(let y=25;y<375&&!target;y+=8)for(let x=25;x<475;x+=8){const tile=pick(cube,x,y);if(tile!==null&&current.some(n=>n.stickerId===String(tile)&&n.x>15&&n.x<485&&n.y>15&&n.y<485)){target={x,y,id:String(tile)};break;}}
 assert(target,'actual visible 3D tile exists');assert(current.some(n=>n.stickerId===target.id),'3D tile is an occupied ring tile');
 cube.dispatch('pointerdown',{pointerId:14,clientX:target.x,clientY:target.y});cube.dispatch('pointerup',{pointerId:14,clientX:target.x,clientY:target.y});assert.deepEqual(clean(ui.state().held),[target.id],'3D click holds the same physical identity');
 const node=bridge.nodes().find(n=>n.stickerId===target.id);overlay.dispatch('pointerdown',{pointerId:15,clientX:node.x,clientY:node.y});overlay.dispatch('pointerup',{pointerId:15,clientX:node.x,clientY:node.y});assert.deepEqual(clean(ui.state().held),[],'clicking its transformed ring node releases that same hold');
});
