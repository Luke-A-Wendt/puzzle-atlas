'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPage}=require('./solver-dom.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function settle(app){for(let i=0;i<20;i++){if(!app.snapshot().animating&&app.snapshot().mode==='idle')return;app.frame(2000);}throw Error('Turn did not finish');}
function physical(app){const state=app.snapshot();return plain(state.stickers||state.pieces);}
function rotate([x,y,z],axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];}
function camera(point,view){return rotate(rotate(point,1,view.yaw),0,view.pitch);}
function screenCross(a,b,center={x:0,y:0}){return(a.x-center.x)*(b.y-center.y)-(a.y-center.y)*(b.x-center.x);}

for(const puzzle of ['cube3','homer'])test(puzzle+' turn controls follow the ring map, while the face-on camera uses the selected outward side',async()=>{
 const app=createPage(puzzle);await app.flush();const E=app.context.CubeEngine,G=app.context.RingGeometry,api=app.context.PUZZLE_API;
 for(const [axis,cfg]of Object.entries(E.configs)){
  api.reset();api.select(axis);await app.flush();
  const original=physical(app),before=E.makeSolved(),ring=G.getRing(axis),normal=[0,0,0];normal[cfg.axis]=Math.sign(cfg.layer)||-Math.sign(cfg.turn);
  // This API is deliberately retained independently of the removed camera
  // buttons. Its camera faces the selected outward normal, not its negative.
  assert.equal(api.viewAxis(axis),true);const view=app.snapshot().view;
  assert.ok(camera(normal,view)[2]>1-1e-10,axis+' selected outward normal faces the camera');
  for(const [button,screenDirection]of [['cw',1],['ccw',-1]]){
   api.select(axis);await app.flush();app.click(button);settle(app);
   const move=app.snapshot().history.at(-1),after=E.applyMove(before,move),angle=cfg.turn*move.dir*(move.turns||1);
   const belt=before.map((s,i)=>({s,i})).filter(({s})=>E.selected(s,move)&&s.n[cfg.axis]===0);
   assert.ok(belt.length>0,axis+' has traveling belt stickers');
   for(const {s,i}of belt){
    const p=G.interpolateSticker(s,after[i],ring,.25,angle),q=G.interpolateSticker(s,after[i],ring,.251,angle);
    assert.ok(screenDirection*screenCross(p,q,{x:ring.cx,y:ring.cy})>0,axis+' '+button+' follows the primary ring screen direction');
   }
   // Screen y points downward. Looking at the negative end reverses the
   // apparent direction without changing the move or the ring projection.
   const tangent=[0,0,0];tangent[(cfg.axis+1)%3]=1;
   const p=camera(tangent,view),q=camera(rotate(tangent,cfg.axis,angle*.001),view);
   const apparent=Math.sign(screenCross({x:p[0],y:-p[1]},{x:q[0],y:-q[1]}));
   assert.equal(apparent,screenDirection*normal[cfg.axis],axis+' has the correct face-on physical rotation');
  }
  assert.deepEqual(physical(app),original,axis+' left/right are exact inverses');
 }
});

for(const puzzle of ['tetraminx','megaminx','skewb'])test(puzzle+' turn controls follow the projected primary ring, independent of face notation',async()=>{
 const app=createPage(puzzle);await app.flush();const api=app.context.PUZZLE_API;
 const G=puzzle==='tetraminx'?app.context.TetraRings:puzzle==='megaminx'?app.context.MegaRings:app.context.OctaRingGeometry.create(app.context.SkewbEngine.create('skewb'));
 const axes=[...new Set(app.document.querySelectorAll('.notation-key').map(button=>button.dataset.face))];
 for(const axis of axes){
  api.reset();api.select(axis);await app.flush();const original=physical(app),ring=G.getRing(axis);
  for(const [button,direction]of [['cw',1],['ccw',-1]]){
   api.select(axis);await app.flush();app.click(button);settle(app);const move=app.snapshot().history.at(-1);
   // Sample the actual projected track in the direction commanded by the
   // production handler. Positive signed area is clockwise in canvas space.
   const sign=Math.sign(ring.advance*move.dir),points=Array.from({length:257},(_,i)=>ring.at(sign*ring.period*i/256));
   const area=points.slice(1).reduce((sum,p,i)=>sum+screenCross(points[i],p),0);
   assert.ok(direction*area>1e-6,axis+' '+button+' follows the primary ring arrow direction');
  }
  assert.deepEqual(physical(app),original,axis+' left/right are exact inverses');
 }
});
