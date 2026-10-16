'use strict';
// Independent integration checks: native geometry, solver overlay and pointer
// input must agree after navigation. No solver search is needed for these.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return {ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
const clean=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-6,message+': '+actual+' vs '+expected);
const families=['cube2','cube3','cube4','cube10','mirror','homer','axis','mastermorphix','ghost','pyraminx','megaminx','kilominx','masterpyraminx','diamondcube','crystal','helicopter'];

for(const id of families)test(id+' shares zoomed/panned positions between nodes, held overlay and hit testing',async()=>{
 const app=createPage(id,{speed:3,globals:{fetch:fetchFile}}),bridge=app.context.PUZZLE_SOLVER_BRIDGE,ui=app.context.ConstrainedSolverUI;
 await app.advance(0);await app.advance(0);
 const initial=clean(bridge.nodes()),initialView=clean(bridge.viewport()),snapshot=app.snapshot();
 assert(initial.length>0);
 app.element('rings').dispatch('wheel',{clientX:250,clientY:250,deltaY:-Math.log(2)/.0015,deltaMode:0});
 await app.advance(0);await app.advance(0);
 const zoomed=clean(bridge.nodes()),navigation=app.context.RingMapNavigation.state();near(navigation.zoom,2,'zoom');
 const byId=new Map(zoomed.map(n=>[String(n.stickerId),n]));
 for(const n of initial){const p=byId.get(String(n.stickerId));near(p.x,250+2*(n.x-250),'node x');near(p.y,250+2*(n.y-250),'node y');assert(p.r>=n.r-1e-6,'zoom cannot make a node smaller');}
 near(bridge.viewport().scale,initialView.scale*2,'viewport scale');
 ui.setActive(true);for(let i=0;i<100&&ui.state().phase==='loading';i++)await app.advance(0);
 assert.equal(ui.state().phase,'selecting');ui.setTool('hold');
 const overlay=app.element('csNodeOverlay');
 // Touch translation occurs above the solver selection canvas and must not
 // accidentally commit a click/lasso when the fingers are released.
 overlay.dispatch('pointerdown',{pointerId:31,pointerType:'touch',clientX:200,clientY:200});
 overlay.dispatch('pointerdown',{pointerId:32,pointerType:'touch',clientX:300,clientY:200});
 overlay.dispatch('pointermove',{pointerId:31,pointerType:'touch',clientX:218,clientY:212});
 overlay.dispatch('pointermove',{pointerId:32,pointerType:'touch',clientX:318,clientY:212});
 overlay.dispatch('pointerup',{pointerId:31,pointerType:'touch',clientX:218,clientY:212});
 overlay.dispatch('pointerup',{pointerId:32,pointerType:'touch',clientX:318,clientY:212});
 await app.advance(0);await app.advance(0);
 assert.deepEqual(clean(ui.state().held),[],'pinch/pan does not commit holds');
 const shifted=bridge.nodes();for(const n of zoomed){const p=shifted.find(p=>String(p.stickerId)===String(n.stickerId));near(p.x,n.x+18,'pan x');near(p.y,n.y+12,'pan y');}
 const node=shifted.filter(n=>n.x>40&&n.x<460&&n.y>40&&n.y<460).sort((a,b)=>Math.hypot(a.x-250,a.y-250)-Math.hypot(b.x-250,b.y-250))[0];assert(node,'an on-screen node remains selectable');
 overlay.dispatch('pointerdown',{pointerId:33,clientX:node.x,clientY:node.y});overlay.dispatch('pointerup',{pointerId:33,clientX:node.x,clientY:node.y});
 assert.deepEqual(clean(ui.state().held),[String(node.stickerId)],'held selection hits transformed node');
 const arcs=[],ctx=overlay.drawing;ctx.arc=(x,y,r)=>arcs.push({x,y,r});await app.advance(0);
 assert(arcs.some(p=>Math.abs(p.x-node.x)<1e-6&&Math.abs(p.y-node.y)<1e-6&&p.r>=node.r),'held outline stays centered');
 // Returning to the original scale restores its exact layout and center.
 overlay.dispatch('wheel',{clientX:80,clientY:100,deltaY:600,deltaMode:0});await app.advance(0);await app.advance(0);
 assert.equal(app.context.RingMapNavigation.state().zoom,1);near(bridge.viewport().scale,initialView.scale,'restored scale');
 for(const n of initial){const p=bridge.nodes().find(p=>String(p.stickerId)===String(n.stickerId));near(p.x,n.x,'restored x');near(p.y,n.y,'restored y');}
 assert.deepEqual(app.snapshot(),snapshot,'navigation and selection do not permute stickers');
});
