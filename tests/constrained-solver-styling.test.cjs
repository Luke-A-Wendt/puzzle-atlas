'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPage}=require('./solver-dom.cjs');
const games=path.join(__dirname,'../dist/games');

function recordCanvas(ctx){
  let transform=[1,0,0,1,0,0],stack=[],arcs=[],dash=[],strokes=[],rects=[];
  const multiply=([a,b,c,d,e,f])=>{const [A,B,C,D,E,F]=transform;transform=[A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F];};
  Object.assign(ctx,{
    setTransform:(...m)=>{transform=m;},scale:(x,y)=>multiply([x,0,0,y,0,0]),translate:(x,y)=>multiply([1,0,0,1,x,y]),rotate:a=>multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]),
    save:()=>stack.push({transform:transform.slice(),dash:dash.slice()}),restore:()=>{const s=stack.pop();if(s){transform=s.transform;dash=s.dash;}},
    clearRect:()=>{strokes=[];rects=[];},beginPath:()=>{arcs=[];},setLineDash:value=>{dash=Array.from(value);},
    arc:(x,y,r)=>{const [a,b,c,d,e,f]=transform;arcs.push({x:a*x+c*y+e,y:b*x+d*y+f,r:r*Math.hypot(a,b)});},
    stroke:()=>strokes.push({arcs:arcs.map(a=>({...a})),color:ctx.strokeStyle,width:ctx.lineWidth*Math.hypot(transform[0],transform[1]),dash:dash.slice()}),
    fillRect:(...rect)=>rects.push(rect)
  });
  return {strokes:()=>strokes,rects:()=>rects};
}
async function page(id){
  const app=createPage(id,{globals:{fetch:async url=>({ok:true,text:async()=>fs.readFileSync(path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,'')),'utf8')})}});
  app.native=recordCanvas(app.element('rings').drawing);app.overlay=recordCanvas(app.element('csNodeOverlay').drawing);
  app.ui=()=>app.context.ConstrainedSolverUI;
  app.ui().setActive(true);for(let i=0;i<80&&app.ui().state().phase==='loading';i++)await app.advance(0);
  assert.equal(app.ui().state().phase,'selecting');await app.advance(0);return app;
}
const white=c=>['#fff','#ffffff','#ffffffff','white'].includes(String(c).toLowerCase());
const at=(records,node)=>records.filter(s=>s.arcs.some(a=>Math.hypot(a.x-node.x,a.y-node.y)<.001));

test('held selected and unselected nodes add only an outer dashed white circle matching native stroke weight',async()=>{
  for(const id of ['cube2','cube7','tetraminx','fto','pyramorphix']){
    const app=await page(id),nodes=app.context.PUZZLE_SOLVER_BRIDGE.nodes();
    const selected=nodes.find(n=>n.highlighted),unselected=nodes.find(n=>!n.highlighted);
    assert(selected&&unselected,id+' has active and inactive nodes');
    app.ui().selectNode(selected.stickerId);app.ui().selectNode(unselected.stickerId);await app.advance(0);
    for(const node of [selected,unselected]){
      const overlay=at(app.overlay.strokes(),node);
      assert.equal(overlay.length,1,id+' held node receives one overlay circle even when keyboard-focused');
      assert(white(overlay[0].color),id+' held outline is white');assert(overlay[0].dash.length>0,id+' held outline is dashed');
      assert(Math.abs(overlay[0].width-node.highlightLineWidth)<.001,id+' held/native line weights match');
      assert(overlay[0].arcs[0].r>node.highlightOuterRadius+node.highlightLineWidth,id+' dashed circle lies outside the native outline');
    }
    const nativeSelected=at(app.native.strokes(),selected).filter(s=>white(s.color)&&s.dash.length===0);
    const nativeUnselected=at(app.native.strokes(),unselected).filter(s=>white(s.color)&&s.dash.length===0);
    assert.equal(nativeSelected.length,1,id+' selected native solid white inner circle remains');
    assert.equal(nativeUnselected.length,0,id+' inactive held node has no solid inner white circle');
    assert(Math.abs(nativeSelected[0].width-selected.highlightLineWidth)<.001,id+' metadata matches actual native painted line width');
    assert.equal(app.overlay.rects().length,0,id+' no held-node square ticks remain');
  }
});

test('solver selection styles match the native move-action hover colors exactly',()=>{
  const theme=fs.readFileSync(path.join(games,'game-theme.css'),'utf8'),solver=fs.readFileSync(path.join(games,'constrained-solver.css'),'utf8');
  const native=/button:hover:not\(:disabled\)\{([^}]+)\}/.exec(theme)?.[1];
  const selected=/\.cs-tools button\[aria-pressed="true"\]\{([^}]+)\}/.exec(solver)?.[1];
  assert(native&&selected);
  for(const property of ['background','border-color'])assert.equal(new RegExp(property+':([^;}]+)').exec(selected)?.[1],new RegExp(property+':([^;}]+)').exec(native)?.[1],property);
  assert.doesNotMatch(solver,/cs-readme|cs-equation|#csReadme/,'readme styling belongs in the guide, not ring controls');
});

test('3D face-label selection remains active and preserves held nodes in solver mode',async()=>{
  const app=await page('cube2'),held=app.context.PUZZLE_SOLVER_BRIDGE.nodes().slice(0,2).map(n=>n.stickerId);
  for(const id of held)app.ui().selectNode(id);
  const labels=[];app.element('cube').drawing.fillText=(text,x,y)=>{if(/^[URFDLB]$/.test(text))labels.push({face:text,x,y:y-.4});};
  app.context.PUZZLE_SOLVER_BRIDGE.requestRender();await app.advance(0);
  const chosen=labels.find(label=>label.face!==app.snapshot().selected);assert(chosen,'a different face badge is visible');
  const event={clientX:chosen.x,clientY:chosen.y,pointerId:76};app.element('cube').dispatch('pointerdown',event);app.element('cube').dispatch('pointerup',event);await app.advance(0);
  assert.equal(app.snapshot().selected,chosen.face);assert.equal(app.snapshot().history.length,0);
  assert.deepEqual(Array.from(app.ui().state().held),Array.from(held));
  const nodes=app.context.PUZZLE_SOLVER_BRIDGE.nodes();assert(nodes.some(n=>n.highlighted));
  for(const id of held){const node=nodes.find(n=>n.stickerId===id),strokes=at(app.overlay.strokes(),node);assert.equal(strokes.length,1);assert(white(strokes[0].color));assert(strokes[0].dash.length>0);}
});
