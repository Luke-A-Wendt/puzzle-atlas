'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
function rotate(v,axis,a){const c=Math.cos(a),s=Math.sin(a),[x,y,z]=v;return axis===0?[x,c*y-s*z,s*y+c*z]:[c*x+s*z,y,-s*x+c*z];}
function camera(v,view){return rotate(rotate(v,1,view.yaw),0,view.pitch);}
function world(v,view){return rotate(rotate(v,0,-view.pitch),1,-view.yaw);}
function capture(app){
  let faces=[],options=null,finishes=0;
  app.context.PuzzleSelection3D={begin(_ctx,o){faces=[];options=o;finishes=0;return {face:f=>faces.push(f),finish:()=>{finishes++;}};}};
  return ()=>({faces,options,finishes});
}

for(const puzzle of ['tetraminx','pyraminx','megaminx'])test(puzzle+' markers use exact ring IDs, full sticker geometry, and animated camera transforms',()=>{
  const app=createPage(puzzle),read=capture(app),E=app.context.TetraEngine||app.context.MegaEngine;
  let observedMoving=0,observedFixed=0;
  for(const face of Object.keys(E.configs)){
    assert(app.context.PUZZLE_API.select(face));
    app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);
    const before=read(),snapshot=app.snapshot(),view=snapshot.view;
    assert.equal(before.finishes,1,'arrows finish after the full face pass');
    assert(before.options.occluders.length>before.faces.length,'all opaque bodies participate in arrow occlusion');
    assert(before.options.radius>0);assert(before.options.eye>0);
    const ids=new Set(snapshot.stickers.map(s=>String(s.id))),highlighted=new Set(app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.highlighted).map(n=>n.stickerId));
    const prior=new Map(before.faces.map(f=>[f.id,f]));
    for(const f of before.faces){
      assert(ids.has(f.id),'sticker ID belongs to the actual puzzle state');
      assert.equal(f.selected,highlighted.has(f.id),'3D selection exactly matches ring highlights, including stationary centers');
      assert(f.points.length>=3&&f.outline.length>=3);
      assert(Math.abs(Math.hypot(...f.normal)-1)<1e-8,'normal has unit length');
      const center=f.outline.reduce((sum,p)=>sum.map((x,i)=>x+p[i]/f.outline.length),[0,0,0]);
      assert(distance(f.center,center)<1e-8,'arrow is centered on the complete sticker, even when BSP splits it');
      assert(before.options.project(f.center).every(Number.isFinite));
    }
    const halfDuration=app.context.PuzzlePlaybackControls.duration(app.element('speed').value)/2;
    assert(app.context.PUZZLE_API.move(face));app.frame(halfDuration); // sample the exact halfway pose at the chosen rate.
    const middle=read(),move=E.normalizeMove({face,dir:1,turns:1}),cfg=E.configs[face],angle=-Math.PI/(puzzle==='megaminx'?5:3);
    assert.equal(middle.finishes,1);
    for(const f of middle.faces){
      const earlier=prior.get(f.id);if(!earlier)continue;
      const sticker=snapshot.stickers.find(s=>String(s.id)===f.id),moving=E.selected(sticker,move);
      const transform=v=>moving?camera(E.rotate(world(v,view),cfg.normal,angle),view):v;
      assert(distance(f.center,transform(earlier.center))<1e-7,'arrow anchor follows the exact rigid sticker turn');
      assert(distance(f.normal,transform(earlier.normal))<1e-7,'arrow remains orthogonal to its moving tile');
      if(moving)observedMoving++;else observedFixed++;
    }
    app.frame(halfDuration);assert.equal(app.snapshot().animating,false);
  }
  assert(observedMoving>0&&observedFixed>0,'exercise moving and stationary marker anchors');
});

for(const puzzle of ['tetraminx','pyraminx','megaminx'])test(puzzle+' preserves rear marker anchors and publishes matching axis labels through clear/select/animation',()=>{
  const app=createPage(puzzle),E=app.context.TetraEngine||app.context.MegaEngine,axis=app.context.PuzzleAxisDisplay;
  assert(axis,'shared axis presentation module loads with the game');
  let anchors=[],painted=[];
  app.context.PuzzleSelection3D={begin(){anchors=[];painted=[];return{track:f=>anchors.push(f),face:f=>painted.push(f),finish(){}};}};
  const render=()=>{app.context.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame(0);};
  render();
  assert.equal(new Set(anchors.map(a=>a.id)).size,app.snapshot().stickers.length,'every sticker supplies a transformed arrow anchor, including rear stickers');
  assert(painted.length<anchors.length,'rear borders are culled while arrow anchors remain available');
  const outer=puzzle==='megaminx'?E.faces.map(f=>f.id):E.vertices.map(v=>v.id);
  assert.deepEqual(Array.from(axis.ringAxes()).sort(),Array.from(outer).sort(),'all outer 3D labels also appear on the ring map');
  for(const face of Object.keys(E.configs)){
    app.context.PUZZLE_API.select(face);render();
    assert.equal(axis.selection(face),face);
    assert(axis.ringAxes().includes(face),'selected main/tip axis is labeled in both representations');
    const highlighted=new Set(app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.highlighted).map(n=>n.stickerId));
    assert(highlighted.size>0);
    assert(painted.every(f=>f.selected===highlighted.has(f.id)));
    axis.clear();render();
    assert.equal(app.snapshot().selected,face,'clearing visual selection does not invalidate the engine axis');
    assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.highlighted).length,0,'cleared ring has no stale highlighted nodes');
    assert(painted.every(f=>!f.selected),'cleared 3D tiles have no stale highlights');
    const beforeMove=app.snapshot(),beforeAnchors=new Map(anchors.map(a=>[a.id,a]));
    const halfDuration=app.context.PuzzlePlaybackControls.duration(app.element('speed').value)/2;
    assert(app.context.PUZZLE_API.runMoves([face]));app.frame(halfDuration);
    assert(app.context.PUZZLE_SOLVER_BRIDGE.nodes().some(n=>n.highlighted),'a solving move temporarily reveals its active axis');
    assert.equal(new Set(anchors.map(a=>a.id)).size,app.snapshot().stickers.length,'mid-turn rear markers retain all identities');
    for(const anchor of anchors){
      const prior=beforeAnchors.get(anchor.id),sticker=beforeMove.stickers.find(s=>String(s.id)===anchor.id);
      const moving=E.selected(sticker,{face,dir:1,turns:1}),angle=-Math.PI/(puzzle==='megaminx'?5:3);
      const expected=v=>moving?camera(E.rotate(world(v,beforeMove.view),E.configs[face].normal,angle),beforeMove.view):v;
      assert(distance(anchor.center,expected(prior.center))<1e-7,'rear and front anchors both follow the exact rigid turn');
      assert(distance(anchor.normal,expected(prior.normal))<1e-7,'rear and front arrows both remain perpendicular to their tile');
    }
    app.frame(halfDuration);assert.equal(app.snapshot().animating,false);render();
    assert.equal(app.context.PUZZLE_SOLVER_BRIDGE.nodes().filter(n=>n.highlighted).length,0,'temporary animation highlight disappears at its endpoint');
  }
});
